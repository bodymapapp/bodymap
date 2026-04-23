// send-drip edge function
// Runs on a daily cron, finds therapists in specific signup-age windows,
// and sends the right drip email based on which window they fall into.
//
// Sequence (counting from signup day):
//   Day 2  - "3 reasons BodyMap might be a terrible idea for you" (pattern-interrupt honest framing)
//   Day 5  - "Try your own body map, send one to yourself"
//   Day 10 - Social proof: real quote from Terra
//   Day 30 - Soft check-in honoring the long day, one sentence reply
//   Day 60 - Referral ask: share BodyMap, get a shoutout (moved from Day 21)
//
// Dedupe: writes to drip_sends table with (therapist_id, drip_day) unique key.
// If a row exists, we skip — prevents duplicate sends even if the cron runs twice.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  generateUnsubToken,
  unsubscribeFooterHtml,
  UNSUB_BASE_URL,
} from "../_shared/unsubscribe.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SKIP_EMAILS = new Set([
  'bodymapdemo@gmail.com','bodymap01@gmail.com','hk5@email.com','hk2@email.com',
  'hk4@email.com','hkgpwc@gmail.com','harshk.mba@gmail.com','demo@mybodymap.app',
  'testtherapistapr15@email.com','testtherapistapr152@email.com','testtherapistapr153@email.com',
  'sarah.demo@bodymap.test','test_therapist2@bodymap.com','goodhands@email.com',
  'therapist11@test.com','tt12@email.com','tt12@emails.com','tt14@email.com',
  'tt18@email.com','tt22@email.com','tt24@email.com','tt25@email.com','tt26@email.com',
  'tt100@email.com','tt103@gmail.com','test101@email.com','test102@email.com',
  'testtherapist99@email.com',
].map(e => e.toLowerCase()));

// Shared email chrome — header + footer wrapper used by every drip
function wrap(inner: string) {
  return `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;">
      <div style="margin-bottom:24px;">
        <span style="font-size:20px;font-weight:700;color:#1A3A28;">BodyMap</span>
        <span style="display:block;font-family:system-ui;font-size:11px;font-weight:700;color:#6B9E80;letter-spacing:0.12em;text-transform:uppercase;margin-top:2px;">Client Intelligence</span>
      </div>
      ${inner}
      <p style="font-family:system-ui;font-size:12px;color:#9CA3AF;margin-top:32px;line-height:1.7;text-align:center;">
        Reply any time, we read every email.<br/>
        <span style="color:#D1D5DB;">The BodyMap Team &middot; <a href="https://mybodymap.app" style="color:#9CA3AF;">mybodymap.app</a></span>
      </p>
    </div>
  `;
}

// ─── Email templates ─────────────────────────────────────

function day2Email(firstName: string, dashLink: string) {
  const inner = `
    <div style="background:#E8F0EA;border:1px solid #C8DCCC;border-radius:8px;padding:4px 10px;display:inline-block;margin-bottom:16px;">
      <span style="font-family:system-ui;font-size:11px;font-weight:700;color:#2A5741;text-transform:uppercase;letter-spacing:0.08em;">🌿 Day 2 · Unusual energy</span>
    </div>
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 12px;line-height:1.25;">3 reasons BodyMap might be a terrible idea for you</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Hey ${firstName}, every software company in the world sends you the same email. "Here are 17 reasons you need us." We got tired of writing it. You're probably tired of reading it. So let's flip it.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Here are 3 reasons BodyMap might be a terrible idea for you. Said with love.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 4px;"><strong style="color:#1A3A28;">1. You have a deep, spiritual connection with your paper intake forms.</strong></p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Look, we get it. The crinkle. The pen ink. The little basket by the door. If clipping a fresh form to a clipboard is one of your favorite parts of the day, please do not let us ruin that for you. Nothing we build can compete with that basket. You have our respect.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 4px;"><strong style="color:#1A3A28;">2. Doing the back office work is your happy place.</strong></p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Some people love typing "Looking forward to seeing you Thursday!" for the 400th time. Some people find peace in digging through texts to figure out if a client paid. If that's you, we salute you. We'd only be in your way. Keep the flow going.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 4px;"><strong style="color:#1A3A28;">3. You think clients who quietly stop booking are fine on their own.</strong></p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">They almost always are going through something. Stress at work. A bad back. A week that got away from them. A body that's forgotten what it feels like to exhale. That is exactly why they need to come see you. You are the person who gives them their breath back. But they won't remember that in the middle of a hard week. You have to be the one who reaches out. A short message from you, at the right moment, is sometimes the only reason someone remembers they deserve an hour of peace.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Still with us? Great. You're probably the right kind of weird for this.</p>

    <div style="background:#F0FDF4;border-left:3px solid #2A5741;padding:14px 18px;margin-bottom:24px;">
      <p style="font-family:system-ui;font-size:14px;color:#1A3A28;line-height:1.7;margin:0;">Open your dashboard and look at the Clients tab. It quietly flags anyone whose booking gap is stretching. One tap, one message, most of them come back. And they usually need it more than they'll admit.</p>
    </div>

    <a href="${dashLink}" style="display:inline-block;background:#2A5741;color:#fff;font-family:system-ui;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Open my dashboard →</a>
  `;
  return {
    subject: `3 reasons BodyMap might be a terrible idea, ${firstName}`,
    html: wrap(inner),
  };
}

function day5Email(firstName: string, customUrl: string, dashLink: string) {
  const selfIntakeLink = `https://mybodymap.app/book/${customUrl}`;
  const inner = `
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 12px;line-height:1.25;">${firstName}, feel what your clients feel</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Hey ${firstName},</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Here is a thing almost no therapist does before recommending a tool to their clients.</p>

    <p style="font-family:system-ui;font-size:17px;color:#1A3A28;line-height:1.7;margin:0 0 20px;font-weight:700;font-family:Georgia,serif;font-style:italic;">They actually try it themselves.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Take 60 seconds right now. Open your dashboard. Find your BodyMap link. Open it on your phone like you are a client booking with you for the first time.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Walk through the intake. Tap your own shoulders. Mark the spot on your lower back that aches after a long day. Note the places on your body that carry the week.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 12px;">When you are done, two things happen.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 10px;"><strong style="color:#1A3A28;">First,</strong> you realize how quick this is for your clients. Probably quicker than the paper form you currently hand them.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;"><strong style="color:#1A3A28;">Second,</strong> your own dashboard lights up with your own body. Your own pressure preference. Your own tension pattern. That is a small, quiet thing. But it is also exactly what every one of your clients is about to experience when they try this for themselves.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 24px;font-style:italic;">You give your clients peace. Let us give you a tiny moment of it too.</p>

    <a href="${selfIntakeLink}" style="display:inline-block;background:#2A5741;color:#fff;font-family:system-ui;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Take the intake yourself →</a>
  `;
  return {
    subject: `${firstName}, feel what your clients feel`,
    html: wrap(inner),
  };
}

function day10Email(firstName: string, dashLink: string) {
  // Real quote from Terra, a BodyMap user. Captures the core promise:
  // it works without effort. Short email, one quote, one CTA.
  const inner = `
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 12px;line-height:1.25;">What Terra said about BodyMap</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Hey ${firstName}, a therapist on BodyMap sent this yesterday:</p>

    <div style="background:#FFFBEB;border-left:4px solid #F59E0B;border-radius:0 10px 10px 0;padding:20px;margin-bottom:24px;">
      <p style="font-family:Georgia,serif;font-size:19px;color:#1A3A28;line-height:1.6;margin:0 0 10px;font-style:italic;">"Damn I like that. Gets right to the point and I don't have to do anything. Sweet."</p>
      <p style="font-family:system-ui;font-size:13px;color:#92400E;margin:0;">Terra, BodyMap therapist</p>
    </div>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">That's the whole idea. Your back office keeps working while you do the work on the table.</p>

    <a href="${dashLink}" style="display:inline-block;background:#2A5741;color:#fff;font-family:system-ui;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Open my dashboard</a>
  `;
  return {
    subject: `${firstName}, what Terra said about BodyMap`,
    html: wrap(inner),
  };
}

function day60Email(firstName: string, customUrl: string) {
  const referralLink = `https://mybodymap.app/?ref=${customUrl}`;
  const inner = `
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 16px;line-height:1.25;">${firstName}, a quiet thank you (and a small ask)</h2>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Hi ${firstName},</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Two months in. You've had enough sessions by now to know whether this thing earns its place in your practice or not.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">If it does, we want to say something first.</p>

    <p style="font-family:system-ui;font-size:17px;color:#1A3A28;line-height:1.7;margin:0 0 20px;font-weight:700;font-family:Georgia,serif;font-style:italic;">Thank you. Seriously. You are why this exists.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Every week, your body does physical work that most software founders will never understand. You stand, you lift, you hold space, you breathe through other people's weeks. And still you made room to try something new. That is a gift we do not take lightly.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Now the small ask.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Do you know another massage therapist out there who is buried under paper intake forms, chasing Venmo payments, wondering where their regulars went? Someone who would feel a little lighter if they found us?</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 12px;">Send them your referral link:</p>

    <div style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:12px;padding:16px 20px;margin:0 0 20px;">
      <a href="${referralLink}" style="font-family:system-ui;font-size:14px;color:#2A5741;font-weight:700;word-break:break-all;text-decoration:none;">${referralLink}</a>
    </div>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 8px;"><strong style="color:#1A3A28;">What they get:</strong> full Silver tier, free for life. No trial. No credit card. No "upgrade later" trick.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;"><strong style="color:#1A3A28;">What you get:</strong> our genuine thanks, plus a small shoutout in our launch post when the time comes (with your permission).</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;font-style:italic;">No pressure. Only share it if you truly think they would love it. One therapist helping another is how healing work spreads. That is the oldest story there is.</p>

    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0;">Cheers,</p>
    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0;">MyBodyMap Team</p>
  `;
  return {
    subject: `${firstName}, a quiet thank you (and a small ask)`,
    html: wrap(inner),
  };
}

function day30Email(firstName: string) {
  // Softer check-in acknowledging the therapist's long physical day.
  // Invites a single sentence reply, makes all three possible answers feel validated.
  const inner = `
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 16px;line-height:1.25;">${firstName}, no rush at all</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">You've been on your feet for 8 hours. You've given 5 massages. Your hands are done. Your back is done. The last thing you want to do right now is open a laptop and answer one more email.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">So this one is short. Delete it if you want. Come back to it whenever. Or never.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 24px;">We just wanted to check in.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">It's been a month since you joined BodyMap. If you ever get a quiet minute, maybe over tea, maybe on a Sunday, we'd love to hear how it's going. Good, not-great, or somewhere in the middle.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 12px;">Just hit reply. One sentence. No form, no survey, no rating scale.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 6px;">• "It's helping, here's what I like." We'll do more of that.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 6px;">• "It's not working for me, here's why." It goes straight into next week's build.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 24px;">• "Honestly, I haven't had a chance to look." Totally fair. You're running a practice and a body. That's two full-time jobs.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">We read every reply. Usually late at night, after our own long days. Always.</p>

    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0;font-style:italic;">Take care of yourself first.</p>
    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:12px 0 0;">Cheers,</p>
    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0;">MyBodyMap Team</p>
  `;
  return {
    subject: `${firstName}, no rush at all`,
    html: wrap(inner),
  };
}

// ─── Main handler ────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

  const now = Date.now();
  const dashLink = 'https://mybodymap.app/dashboard';

  // For each drip day, pick therapists whose signup falls in a 22-hour window centered on that day.
  // Example: Day 2 targets signups between 2d2h and 2d22h ago. Keeps the window wide enough that
  // even if the cron runs a bit late/early, we still catch people.
  //
  // Day 21 referral ask was moved to Day 60 on 2026-04-22 per HK. The ask
  // is the same (referral link, what they get, what you get) but fired later
  // when the therapist has had more real time to form an opinion about the
  // product. day60Email() contains the content; the original day21Email
  // function was renamed.
  const windows = [
    { day: 2 },
    { day: 5 },
    { day: 10 },
    { day: 30 },
    { day: 60 },
  ];

  const results: any[] = [];

  for (const w of windows) {
    const minAgo = (w.day * 24 + 22) * 60 * 60 * 1000;
    const maxAgo = (w.day * 24 + 2) * 60 * 60 * 1000;
    const minIso = new Date(now - minAgo).toISOString();
    const maxIso = new Date(now - maxAgo).toISOString();

    const { data: therapists } = await supabase
      .from('therapists')
      .select('id, full_name, email, custom_url, created_at, email_unsubscribed')
      .gte('created_at', minIso)
      .lte('created_at', maxIso);

    for (const t of (therapists || [])) {
      if (!t.email || SKIP_EMAILS.has(t.email.toLowerCase())) continue;
      // CAN-SPAM: respect unsubscribe
      if (t.email_unsubscribed) continue;

      // Dedupe: have we already sent this day to this therapist?
      const { data: existing } = await supabase
        .from('drip_sends')
        .select('id')
        .eq('therapist_id', t.id)
        .eq('drip_day', w.day)
        .maybeSingle();
      if (existing) continue;

      const firstName = t.full_name?.split(' ')[0] || 'there';
      let emailPayload: { subject: string; html: string } | null = null;

      if (w.day === 2)  emailPayload = day2Email(firstName, dashLink);
      if (w.day === 5)  emailPayload = day5Email(firstName, t.custom_url || '', dashLink);
      if (w.day === 10) emailPayload = day10Email(firstName, dashLink);
      if (w.day === 60) emailPayload = day60Email(firstName, t.custom_url || '');
      if (w.day === 30) emailPayload = day30Email(firstName);

      if (!emailPayload) continue;

      // Inject unsubscribe footer into HTML before sending
      const unsubToken = await generateUnsubToken(t.id);
      const unsubUrl = `${UNSUB_BASE_URL}?token=${encodeURIComponent(unsubToken)}`;
      const htmlWithUnsub = emailPayload.html + unsubscribeFooterHtml(t.id, unsubUrl);

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'The BodyMap Team <reminders@mybodymap.app>',
          to: [t.email],
          bcc: ['bodymapdemo@gmail.com'],
          subject: emailPayload.subject,
          html: htmlWithUnsub,
        }),
      });

      const data = await res.json();

      // Log the send so we don't do it again (drip_sends = dedupe table)
      await supabase.from('drip_sends').insert({
        therapist_id: t.id,
        drip_day: w.day,
        resend_id: data?.id || null,
        status: res.ok ? 'sent' : 'failed',
      });

      // Also write to unified notification_log so founder dashboard's
      // comms log view can render this send. Format: drip_day{N}.
      try {
        await supabase.from('notification_log').insert({
          therapist_id: t.id,
          notification_type: `drip_day${w.day}`,
          audience: 'therapist',
          channel: 'email',
          recipient: t.email,
          status: res.ok ? 'sent' : 'failed',
          provider_id: data?.id || null,
          subject: emailPayload.subject,
          body_snippet: (htmlWithUnsub || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200),
        });
      } catch (_e) {
        // Fallback without subject/body_snippet columns
        try {
          await supabase.from('notification_log').insert({
            therapist_id: t.id,
            notification_type: `drip_day${w.day}`,
            audience: 'therapist',
            channel: 'email',
            recipient: t.email,
            status: res.ok ? 'sent' : 'failed',
            provider_id: data?.id || null,
          });
        } catch (_e2) { /* non-blocking */ }
      }

      results.push({ day: w.day, email: t.email, status: res.ok ? 'sent' : 'failed' });

      // Gentle pace
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return new Response(JSON.stringify({ total: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
