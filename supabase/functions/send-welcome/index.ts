import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

  try {
    const { email, firstName, customUrl } = await req.json();

    const bookingLink = `https://mybodymap.app/book/${customUrl}`;
    const dashLink = 'https://mybodymap.app/dashboard';

    const steps = [
      {
        n: '1', title: 'Move your clients over',
        body: 'Import from Square, MassageBook, Vagaro, or any CSV in two clicks. Go to <b>Clients &gt; Import Clients</b> and upload your export file. Any row with a name, phone, or email comes in. Missing info can be added later.',
        link: dashLink, cta: 'Import clients'
      },
      {
        n: '2', title: 'Add your first service',
        body: 'Tell clients what you offer and at what price. Go to <b>Settings &gt; Services</b> and add your massage types, duration, and price. This is what shows on your booking page.',
        link: dashLink, cta: 'Settings'
      },
      {
        n: '3', title: 'Set your working hours',
        body: 'Clients can only book during your available times. Go to <b>Settings &gt; Availability</b> and toggle on your working days and set your start and end times.',
        link: dashLink, cta: 'Set hours'
      },
      {
        n: '4', title: 'Share your booking link',
        body: `Your personal booking page is live at <a href="${bookingLink}" style="color:#2A5741;">${bookingLink}</a>. Share it in your email signature, Instagram bio, or text it directly to clients. They book, fill their body map, and you see it all before they arrive.`,
        link: bookingLink, cta: 'View your booking page'
      },
      {
        n: '5', title: 'Send your first intake',
        body: 'Go to <b>Clients &gt; Send Intake</b> and send the body map link to your first client. They tap their focus zones, pressure preference, and any areas to avoid. It will be waiting in your dashboard before they arrive. After the first session, BodyMap remembers everything for next time.',
        link: dashLink, cta: 'Send an intake'
      },
    ];

    const stepsHtml = steps.map(s => `
      <div style="border-left:3px solid #2A5741;padding:16px 20px;margin-bottom:20px;background:#F9FAF9;border-radius:0 8px 8px 0;">
        <div style="font-family:system-ui;font-size:11px;font-weight:700;color:#6B9E80;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Step ${s.n}</div>
        <div style="font-size:17px;font-weight:700;color:#1A3A28;margin-bottom:8px;">${s.title}</div>
        <div style="font-family:system-ui;font-size:14px;color:#4B5563;line-height:1.7;margin-bottom:12px;">${s.body}</div>
        <a href="${s.link}" style="font-family:system-ui;font-size:13px;font-weight:700;color:#2A5741;text-decoration:none;">Go to ${s.cta} &rarr;</a>
      </div>
    `).join('');

    const html = `
      <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;">
        <div style="margin-bottom:28px;">
          <span style="font-size:22px;font-weight:700;color:#1A3A28;">BodyMap</span>
          <span style="display:block;font-family:system-ui;font-size:11px;font-weight:700;color:#6B9E80;letter-spacing:0.12em;text-transform:uppercase;margin-top:2px;">Client Intelligence</span>
        </div>
        <h1 style="font-size:26px;font-weight:700;color:#1A3A28;margin:0 0 8px;">Welcome, ${firstName}.</h1>
        <p style="font-family:system-ui;font-size:15px;color:#6B7280;line-height:1.7;margin:0 0 32px;">Your BodyMap practice is ready. Here are your first 5 steps. Each takes under 2 minutes.</p>
        ${stepsHtml}
        <div style="background:#2A5741;border-radius:12px;padding:24px;margin-top:32px;text-align:center;">
          <p style="font-family:system-ui;font-size:14px;color:rgba(255,255,255,0.8);margin:0 0 16px;">Questions? Just reply to this email. We read every one.</p>
          <a href="${dashLink}" style="display:inline-block;background:#fff;color:#2A5741;font-family:system-ui;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Open my dashboard &rarr;</a>
        </div>
        <p style="font-family:system-ui;font-size:12px;color:#9CA3AF;margin-top:32px;line-height:1.6;">
          The BodyMap Team &middot; <a href="https://mybodymap.app" style="color:#9CA3AF;">mybodymap.app</a><br/>
          Built for massage therapists, by a massage therapist.
        </p>
      </div>
    `;

    // Send to test address while in test mode
    const recipient = email; // sends to the new therapist

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'The BodyMap Team <reminders@mybodymap.app>',
        to: [recipient],
        bcc: ['bodymapdemo@gmail.com'],
        subject: `Welcome to BodyMap, ${firstName} - here's how to get started`,
        html,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify({ ok: res.ok, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
