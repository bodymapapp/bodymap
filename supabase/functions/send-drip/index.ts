// send-drip edge function
// Runs on a daily cron, finds therapists in specific signup-age windows,
// and sends the right drip email based on which window they fall into.
//
// Sequence (counting from signup day):
//   Day 2  — "One tip: spot a client about to ghost you"
//   Day 5  — "Try your own body map, send one to yourself"
//   Day 10 — Social proof: real quote from Terra
//   Day 30 — One-question survey (harvest testimonials)
//   Day 60 — Referral ask: share BodyMap, get a shoutout (moved from Day 21)
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
    <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:4px 10px;display:inline-block;margin-bottom:16px;">
      <span style="font-family:system-ui;font-size:11px;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:0.08em;">⚠ Tip of the week</span>
    </div>
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 12px;line-height:1.25;">5 signs a regular is about to ghost you</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Hey ${firstName}, most client attrition happens quietly. You don't get a breakup text. You just stop seeing them on your calendar. The good news: the warning signs are almost always there a week or two before they disappear.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 6px;"><strong style="color:#1A3A28;">1.</strong> Their rebooking window stretches. A 4-week regular now goes 6. Then 7.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 6px;"><strong style="color:#1A3A28;">2.</strong> Their session feedback shortens. "Great" with no detail.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 6px;"><strong style="color:#1A3A28;">3.</strong> They skip the add-ons they always got. CBD oil, hot stones, gone.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 6px;"><strong style="color:#1A3A28;">4.</strong> They switch times. Weekly Thursday becomes random Saturdays.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;"><strong style="color:#1A3A28;">5.</strong> They stop referring friends. The pipeline they used to send you dries up.</p>

    <div style="background:#F0FDF4;border-left:3px solid #2A5741;padding:14px 18px;margin-bottom:24px;">
      <p style="font-family:system-ui;font-size:14px;color:#1A3A28;line-height:1.7;margin:0;"><strong>How BodyMap helps:</strong> your Insights tab surfaces clients whose rebooking window has stretched. One glance, one tap, one text. "Haven't seen you in a while, want to grab your usual Thursday?" That saves most of them.</p>
    </div>

    <a href="${dashLink}?tab=insights" style="display:inline-block;background:#2A5741;color:#fff;font-family:system-ui;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Check my Insights tab →</a>
  `;
  return {
    subject: `${firstName}, 5 signs a regular is about to ghost you`,
    html: wrap(inner),
  };
}

function day5Email(firstName: string, customUrl: string, dashLink: string) {
  const selfIntakeLink = `https://mybodymap.app/book/${customUrl}`;
  const inner = `
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 12px;line-height:1.25;">Try your own body map before your next client does</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Hey ${firstName}, this one takes 60 seconds and changes how you'll think about intake forever.</p>

    <div style="background:#F9FAF9;border-radius:10px;padding:20px;margin-bottom:20px;">
      <p style="font-family:Georgia,serif;font-size:16px;color:#1A3A28;line-height:1.7;margin:0 0 8px;font-style:italic;">Send the body map to yourself.</p>
      <p style="font-family:system-ui;font-size:14px;color:#4B5563;line-height:1.7;margin:0;">Pretend you're a new client booking with you. Walk through the intake. Tap your own zones. See what your clients see.</p>
    </div>

    <a href="${selfIntakeLink}" style="display:inline-block;background:#2A5741;color:#fff;font-family:system-ui;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;margin-bottom:24px;">Take the intake yourself →</a>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 10px;">When you're done, two things usually happen:</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 6px;"><strong style="color:#1A3A28;">1.</strong> You realize it's way easier than what your clients fill out today.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 24px;"><strong style="color:#1A3A28;">2.</strong> You see your own dashboard light up with real data. Your own body map waiting, pressure preference, areas to avoid. That's what you get for every client going forward.</p>

    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0;">P.S. Most therapists tell us this is the moment they finally "got it." Takes 60 seconds. Worth every one.</p>
  `;
  return {
    subject: `${firstName}, send yourself the body map (60 seconds)`,
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
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 12px;line-height:1.25;">Know another therapist who'd love BodyMap?</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Hey ${firstName}, if you've got a friend in the field who's still fighting paper intake or Square's rising fees, we'd love to meet them.</p>

    <div style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:12px;padding:20px;margin-bottom:24px;">
      <div style="font-family:system-ui;font-size:12px;color:#2A5741;font-weight:700;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.08em;">Your personal referral link</div>
      <a href="${referralLink}" style="font-family:system-ui;font-size:14px;color:#2A5741;font-weight:700;word-break:break-all;">${referralLink}</a>
    </div>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 12px;"><strong style="color:#1A3A28;">What they get:</strong> Silver for life, free, same as you. No trial, no card.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 24px;"><strong style="color:#1A3A28;">What you get:</strong> A shoutout on our Features page, a swag kit (stickers + tote), and our eternal thanks.</p>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 10px;">Easy ways to share:</p>
    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0 0 6px;">• Text it to one therapist friend who's always complaining about their software</p>
    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0 0 6px;">• Drop it in your LMT Facebook group if you love it</p>
    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0;">• Post a screenshot of your favorite feature on Instagram and tag us (@mybodymap.app)</p>
  `;
  return {
    subject: `${firstName}, a small ask (and a free thing for you)`,
    html: wrap(inner),
  };
}

function day30Email(firstName: string) {
  // Simple reply-to survey. Single question, easy to answer.
  const inner = `
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 12px;line-height:1.25;">${firstName}, one month in. How's it going?</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">You've been on BodyMap for a month, and we want to hear how it's going. Good, bad, or in between. No form, no survey link, no tracking. Just hit reply.</p>

    <div style="background:#F9FAF9;border-left:3px solid #2A5741;padding:16px 20px;margin-bottom:24px;">
      <p style="font-family:Georgia,serif;font-size:17px;color:#1A3A28;line-height:1.7;margin:0 0 4px;font-style:italic;">One question:</p>
      <p style="font-family:system-ui;font-size:16px;color:#1A3A28;line-height:1.7;margin:0;font-weight:600;">What's the one thing you'd tell another therapist about BodyMap?</p>
    </div>

    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 12px;">Good, bad, hard, easy. Whatever's real. One sentence is plenty.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">If it's a rave, we may share it on our Features page (we'll ask first). If it's a problem, it goes straight into next week's build. Your reply shapes what happens next.</p>

    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0;">Thank you for being one of the first. This thing exists because of you.</p>
    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:4px 0 0;">Cheers, MyBodyMap Team</p>
  `;
  return {
    subject: `${firstName}, one question about your first month 🌿`,
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

      // Log the send so we don't do it again
      await supabase.from('drip_sends').insert({
        therapist_id: t.id,
        drip_day: w.day,
        resend_id: data?.id || null,
        status: res.ok ? 'sent' : 'failed',
      });

      results.push({ day: w.day, email: t.email, status: res.ok ? 'sent' : 'failed' });

      // Gentle pace
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return new Response(JSON.stringify({ total: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
