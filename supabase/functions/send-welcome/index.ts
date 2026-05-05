import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateUnsubToken, UNSUB_BASE_URL, unsubscribeFooterHtml } from "../_shared/unsubscribe.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  try {
    const { email, firstName, customUrl } = await req.json();

    const bookingLink = `https://mybodymap.app/book/${customUrl}`;
    const dashLink = 'https://mybodymap.app/dashboard';

    // Fetch therapist id up front so we can inject a signed unsubscribe token
    // into the email footer. If we can't find the therapist, we still send the
    // email but without a personalized unsubscribe link. The global unsubscribe
    // page at /unsubscribe still lets them opt out by typing their email.
    let therapistId: string | null = null;
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: tRow } = await supabase.from('therapists').select('id').eq('email', email).maybeSingle();
        therapistId = tRow?.id || null;
      } catch (_err) { /* non-blocking */ }
    }
    const unsubToken = therapistId ? await generateUnsubToken(therapistId) : '';
    const unsubUrl = unsubToken ? `${UNSUB_BASE_URL}?t=${unsubToken}` : UNSUB_BASE_URL;
    const unsubFooter = therapistId ? unsubscribeFooterHtml(therapistId, unsubUrl) : '';

    // E1.1 Welcome / Onboarding - warm healer voice, 5 steps in any order.
    // Replaced 2026-04-23: previous version had marketing voice ("autopilot",
    // "most modern platform"). New copy honors the therapist as a healer
    // and positions setup as small, do-when-you-can tasks.
    const steps = [
      {
        n: '1', title: 'Bring your clients in',
        body: 'Import your list or add a few by hand. This is the foundation that everything else sits on top of.',
        link: `${dashLink}`, cta: 'Import clients'
      },
      {
        n: '2', title: 'Tell us what you offer',
        body: 'Your 60-min deep tissue. Your 90-min prenatal. Your hot stone add-on. Add your services so clients book the right thing.',
        link: `${dashLink}/settings`, cta: 'Add services'
      },
      {
        n: '3', title: 'Set your hours',
        body: "When you're open. When you're closed. When you are with a client and not to be disturbed. This is how clients book themselves without you typing a single text.",
        link: `${dashLink}/schedule`, cta: 'Set hours'
      },
      {
        n: '4', title: 'Connect payments',
        body: `Stripe or Square. One minute. After this, clients pay the moment they book. You never have to send "hey can you Venmo me" again.`,
        link: `${dashLink}/billing`, cta: 'Connect payments'
      },
      {
        n: '5', title: 'Send your first intake',
        body: `Pick one regular client. Text them your MyBodyMap link. Watch them fill out a visual body map on their phone in 60 seconds instead of scribbling on a clipboard. The first time you see it land in your dashboard is the moment this all clicks.`,
        link: `${dashLink}`, cta: 'Send first intake'
      },
    ];

    const stepsHtml = steps.map(s => `
      <div style="border-left:3px solid #2A5741;padding:16px 20px;margin-bottom:14px;background:#F9FAF9;border-radius:0 8px 8px 0;">
        <div style="font-family:system-ui;font-size:11px;font-weight:700;color:#6B9E80;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Step ${s.n}</div>
        <div style="font-size:17px;font-weight:700;color:#1A3A28;margin-bottom:6px;font-family:Georgia,serif;">${s.title}</div>
        <div style="font-family:system-ui;font-size:14px;color:#4B5563;line-height:1.7;margin-bottom:10px;">${s.body}</div>
        <a href="${s.link}" style="font-family:system-ui;font-size:13px;font-weight:700;color:#2A5741;text-decoration:none;">${s.cta} &rarr;</a>
      </div>
    `).join('');

    const html = `
      <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;color:#1F2937;line-height:1.7;font-size:15px;">

        <div style="margin-bottom:24px;">
          <span style="font-size:22px;font-weight:700;color:#1A3A28;">MyBodyMap</span>
          <span style="display:block;font-family:system-ui;font-size:11px;font-weight:700;color:#6B9E80;letter-spacing:0.12em;text-transform:uppercase;margin-top:2px;">Client Intelligence for Massage Therapists</span>
        </div>

        <h1 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 18px;line-height:1.3;">
          Welcome home, ${firstName}. 5 steps, any order, no hurry. 🌿
        </h1>

        <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">
          Hi ${firstName},
        </p>

        <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">
          You spent the day giving other people their breath back. Now here you are, screen on, thinking about one more thing to set up. We see you.
        </p>

        <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">
          So let's make this short.
        </p>

        <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 22px;">
          MyBodyMap works best once these 5 things are in place. Each one takes a minute or two. You can do them in any order. You can stop after three and come back next week. Whatever fits the day.
        </p>

        ${stepsHtml}

        <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:20px 0 16px;">
          That's it. No quiz at the end. No "complete your profile to unlock features." Just five small things that turn your hands-on practice into one that runs itself in the background.
        </p>

        <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">
          We are here if you get stuck. Reply to this email and a real person reads it.
        </p>

        <div style="background:#F0FDF4;border-left:3px solid #2A5741;padding:14px 18px;margin:0 0 24px;">
          <p style="font-family:Georgia,serif;font-size:16px;font-style:italic;color:#2A5741;margin:0;">Welcome home.</p>
        </div>

        <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0;">Cheers,</p>
        <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0;">MyBodyMap Team</p>

        <!-- Silver badge, kept subtle -->
        <div style="margin-top:26px;text-align:center;">
          <span style="display:inline-block;background:#F0FDF4;border:1px solid #86EFAC;border-radius:20px;padding:5px 12px;font-family:system-ui;font-size:11px;font-weight:700;color:#2A5741;">🌿 Silver tier · Free for life</span>
        </div>

        <p style="font-family:system-ui;font-size:12px;color:#9CA3AF;margin-top:28px;line-height:1.7;text-align:center;">
          Reply any time, we read every email.<br/>
          <span style="color:#D1D5DB;">The MyBodyMap Team &middot; <a href="https://mybodymap.app" style="color:#9CA3AF;">mybodymap.app</a></span>
        </p>
        ${unsubFooter}
      </div>
    `;

    const subjectLine = `Welcome home, ${firstName}. 5 steps, any order, no hurry.`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'The MyBodyMap Team <reminders@mybodymap.app>',
        to: [email],
        bcc: ['bodymapdemo@gmail.com'],
        subject: subjectLine,
        html,
      }),
    });

    const data = await res.json();

    // Log to notification_log so founder dashboard comms log shows this send.
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: tRow } = await supabase
          .from('therapists')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        if (tRow?.id) {
          try {
            await supabase.from('notification_log').insert({
              therapist_id: tRow.id,
              notification_type: 'welcome',
              audience: 'therapist',
              channel: 'email',
              recipient: email,
              status: res.ok ? 'sent' : 'failed',
              provider_id: data?.id || null,
              subject: subjectLine,
              body_snippet: '5-step onboarding welcome. Any order, no hurry.',
            });
          } catch (_e) {
            await supabase.from('notification_log').insert({
              therapist_id: tRow.id,
              notification_type: 'welcome',
              audience: 'therapist',
              channel: 'email',
              recipient: email,
              status: res.ok ? 'sent' : 'failed',
              provider_id: data?.id || null,
            });
          }
        }
      } catch (_err) { /* non-blocking */ }
    }

    return new Response(JSON.stringify({ ok: res.ok, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
