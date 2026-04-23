import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Steps now have explicit time estimates for psychological commitment.
    // Total: 5 minutes. Frames whole setup as trivial vs. hours of admin saved.
    const steps = [
      {
        n: '1', title: 'Move your clients over', time: '90 seconds',
        body: 'Import from Square, MassageBook, Vagaro, or any CSV. Go to <b>Clients &gt; Import Clients</b> and upload your export file. Any row with a name, phone, or email comes in. Missing info can be added later.',
        link: dashLink, cta: 'Import clients'
      },
      {
        n: '2', title: 'Add your first service', time: '60 seconds',
        body: 'Tell clients what you offer and at what price. Go to <b>Settings &gt; Services</b> and add your massage types, duration, and price. This is what shows on your booking page.',
        link: dashLink, cta: 'Add services'
      },
      {
        n: '3', title: 'Set your working hours', time: '60 seconds',
        body: 'Clients can only book during your available times. Go to <b>Settings &gt; Availability</b> and toggle on your working days and times. Done.',
        link: dashLink, cta: 'Set hours'
      },
      {
        n: '4', title: 'Share your booking link', time: '30 seconds',
        body: `Your personal booking page is live at <a href="${bookingLink}" style="color:#2A5741;">${bookingLink}</a>. Drop it in your email signature, Instagram bio, or text it directly to a client. They book, fill their body map, and you see it all before they arrive.`,
        link: bookingLink, cta: 'See your booking page'
      },
      {
        n: '5', title: 'Send your first intake', time: '60 seconds',
        body: 'Go to <b>Clients &gt; Send Intake</b> and send the body map link to one client. They tap their focus zones, pressure preference, and areas to avoid on a visual body. It will be waiting in your dashboard before they arrive. After the first session, BodyMap remembers everything for next time.',
        link: dashLink, cta: 'Send an intake'
      },
    ];

    const stepsHtml = steps.map(s => `
      <div style="border-left:3px solid #2A5741;padding:16px 20px;margin-bottom:16px;background:#F9FAF9;border-radius:0 8px 8px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-family:system-ui;font-size:11px;font-weight:700;color:#6B9E80;letter-spacing:0.1em;text-transform:uppercase;">Step ${s.n}</div>
          <div style="font-family:system-ui;font-size:11px;font-weight:700;color:#9CA3AF;">⏱ ${s.time}</div>
        </div>
        <div style="font-size:17px;font-weight:700;color:#1A3A28;margin-bottom:8px;font-family:Georgia,serif;">${s.title}</div>
        <div style="font-family:system-ui;font-size:14px;color:#4B5563;line-height:1.7;margin-bottom:12px;">${s.body}</div>
        <a href="${s.link}" style="font-family:system-ui;font-size:13px;font-weight:700;color:#2A5741;text-decoration:none;">${s.cta} &rarr;</a>
      </div>
    `).join('');

    const html = `
      <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;">

        <!-- Brand header -->
        <div style="margin-bottom:28px;">
          <span style="font-size:22px;font-weight:700;color:#1A3A28;">BodyMap</span>
          <span style="display:block;font-family:system-ui;font-size:11px;font-weight:700;color:#6B9E80;letter-spacing:0.12em;text-transform:uppercase;margin-top:2px;">Client Intelligence for Massage Therapists</span>
        </div>

        <!-- Headline — confident, outcome-focused -->
        <h1 style="font-size:28px;font-weight:700;color:#1A3A28;margin:0 0 14px;line-height:1.2;">
          ${firstName}, welcome to the most modern, automated platform built for massage therapists. 🌿
        </h1>

        <p style="font-family:system-ui;font-size:16px;color:#4B5563;line-height:1.7;margin:0 0 18px;">
          Your back office just went on autopilot. Visual body maps instead of paper intake. Session patterns you never had time to spot. Automated reminders, gift cards, booking, and client history, all working quietly while you do what you actually love: the work on the table.
        </p>

        <!-- Silver badge -->
        <div style="display:inline-block;background:#F0FDF4;border:1px solid #86EFAC;border-radius:20px;padding:6px 14px;margin-bottom:28px;">
          <span style="font-family:system-ui;font-size:12px;font-weight:700;color:#2A5741;">🌿 Silver tier · Free forever (founding therapist)</span>
        </div>

        <!-- Setup promise with time commitment -->
        <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:18px 20px;margin-bottom:24px;">
          <div style="font-family:system-ui;font-size:13px;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Get started in 5 minutes</div>
          <p style="font-family:system-ui;font-size:14px;color:#78350F;line-height:1.6;margin:0;">
            Five short steps. The whole thing takes 5 minutes. You get <b>hours back every week</b>. No more paper intake, no more manual reminders, no more guessing what your client prefers this visit.
          </p>
        </div>

        ${stepsHtml}

        <!-- Primary CTA -->
        <div style="background:#2A5741;border-radius:12px;padding:26px 24px;margin-top:28px;text-align:center;">
          <p style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:#fff;margin:0 0 6px;">Ready? Let's do the 5 minutes.</p>
          <p style="font-family:system-ui;font-size:13px;color:rgba(255,255,255,0.8);margin:0 0 20px;line-height:1.6;">
            Open your dashboard and we'll walk you through step one.
          </p>
          <a href="${dashLink}" style="display:inline-block;background:#fff;color:#2A5741;font-family:system-ui;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">Start setup &rarr;</a>
        </div>

        <!-- Client-side hook (makes recipients evangelists) -->
        <div style="border-top:1px solid #E8E4DC;margin-top:36px;padding-top:24px;">
          <p style="font-family:Georgia,serif;font-size:15px;font-style:italic;color:#4B5563;line-height:1.7;margin:0 0 10px;">
            Your clients are going to love this.
          </p>
          <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0;">
            The body map intake is unlike anything they've filled out before. Visual, fast, and it remembers them next time. Once you send your first one, you'll see what we mean. They'll ask where you got it.
          </p>
        </div>

        <!-- What's next (sets expectation, reduces friction for drip emails) -->
        <div style="background:#F9FAF9;border-radius:10px;padding:18px 20px;margin-top:24px;">
          <div style="font-family:system-ui;font-size:11px;font-weight:700;color:#6B9E80;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">What's next</div>
          <p style="font-family:system-ui;font-size:14px;color:#4B5563;line-height:1.7;margin:0;">
            Over the next couple weeks, you'll get a few short emails with tips. Things like how to spot clients about to lapse, using session patterns to anticipate needs, and small moves that boost rebooking. We keep them useful and we keep them short. Promise.
          </p>
        </div>

        <!-- Footer -->
        <p style="font-family:system-ui;font-size:12px;color:#9CA3AF;margin-top:32px;line-height:1.7;text-align:center;">
          Questions? Just reply to this email, we read every single one.<br/>
          <span style="color:#D1D5DB;">The BodyMap Team &middot; <a href="https://mybodymap.app" style="color:#9CA3AF;">mybodymap.app</a></span><br/>
          <span style="color:#D1D5DB;">Built by a licensed massage therapist, for solo therapists.</span>
        </p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'The BodyMap Team <reminders@mybodymap.app>',
        to: [email],
        bcc: ['bodymapdemo@gmail.com'],
        subject: `${firstName}, your back office just went on autopilot 🌿`,
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
              subject: `${firstName}, your back office just went on autopilot 🌿`,
              body_snippet: 'Welcome to BodyMap. 5-step setup guide included.',
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
