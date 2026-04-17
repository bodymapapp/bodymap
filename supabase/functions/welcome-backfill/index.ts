import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SKIP_EMAILS = [
  'bodymapdemo@gmail.com',
  'bodymap01@gmail.com',
  'hk5@email.com',
  'hk2@email.com',
  'hk4@email.com',
  'hkgpwc@gmail.com',
  'harshk.mba@gmail.com',
  'demo@mybodymap.app',
  'testtherapistapr15@email.com',
  'testtherapistapr152@email.com',
  'testtherapistapr153@email.com',
  'sarah.demo@bodymap.test',
  'test_therapist2@bodymap.com',
  'goodhands@email.com',
  'therapist11@test.com',
  'tt12@email.com',
  'tt12@emails.com',
  'tt14@email.com',
  'tt18@email.com',
  'tt22@email.com',
  'tt24@email.com',
  'tt25@email.com',
  'tt26@email.com',
  'tt100@email.com',
  'tt103@gmail.com',
  'test101@email.com',
  'test102@email.com',
  'testtherapist99@email.com',
];

const SKIP_URLS = [
  'bodymapdemopractice',
  'hk5',
  'testtherapistapr15',
  'testtherapistapr152',
  'testtherapistapr153',
  'healinghands2',
  'goodhands',
  'hk2',
  'hk4',
  'demo',
  'veryhealing',
  'mainhealing',
  'verygoodhealing',
  'myveryhealinghands',
  'greathealing',
  'greatheal',
  'thaihands',
  'greatthai',
  'tt25',
  'newhands',
  'healinghands100',
  'healinghands101',
  'healinghands102',
  'healinghands103',
  'healinghands01',
  'hh14',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const RESEND_API_KEY     = Deno.env.get('RESEND_API_KEY');
  const SUPABASE_URL       = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

  // Fetch all therapists
  const { data: therapists, error } = await supabase
    .from('therapists')
    .select('full_name, email, custom_url, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Filter to real accounts only
  const real = (therapists || []).filter(t => {
    if (!t.email) return false;
    if (SKIP_EMAILS.includes(t.email.toLowerCase())) return false;
    if (SKIP_URLS.includes((t.custom_url || '').toLowerCase())) return false;
    return true;
  });

  const results = [];

  for (const t of real) {
    const firstName   = t.full_name?.split(' ')[0] || 'there';
    const customUrl   = t.custom_url || '';
    const dashLink    = 'https://mybodymap.app/dashboard';
    const bookingLink = `https://mybodymap.app/book/${customUrl}`;

    const steps = [
      { n:'1', title:'Move your clients over',
        body:'Import from Square, MassageBook, Vagaro, or any CSV in two clicks. Go to <b>Clients &gt; Import Clients</b> and upload your export file. Any row with a name, phone, or email comes in. Missing info can be added later.',
        link: dashLink, cta:'Import clients' },
      { n:'2', title:'Add your first service',
        body:'Tell clients what you offer and at what price. Go to <b>Settings &gt; Services</b> and add your massage types, duration, and price. This is what shows on your booking page.',
        link: dashLink, cta:'Settings' },
      { n:'3', title:'Set your working hours',
        body:'Clients can only book during your available times. Go to <b>Settings &gt; Availability</b> and toggle on your working days and set your start and end times.',
        link: dashLink, cta:'Set hours' },
      { n:'4', title:'Share your booking link',
        body:`Your personal booking page is live at <a href="${bookingLink}" style="color:#2A5741;">${bookingLink}</a>. Share it in your email signature, Instagram bio, or text it directly to clients. They book, fill their body map, and you see it all before they arrive.`,
        link: bookingLink, cta:'View your booking page' },
      { n:'5', title:'Send your first intake',
        body:'Go to <b>Clients &gt; Send Intake</b> and send the body map link to your first client. They tap their focus zones, pressure preference, and any areas to avoid. It will be waiting in your dashboard before they arrive. After the first session, BodyMap remembers everything for next time.',
        link: dashLink, cta:'Send an intake' },
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

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'The BodyMap Team <reminders@mybodymap.app>',
          to: [t.email],
          subject: `Welcome to BodyMap, ${firstName} - here's how to get started`,
          html,
        }),
      });
      const data = await res.json();
      results.push({ email: t.email, custom_url: customUrl, status: res.ok ? 'sent' : 'failed', id: data.id, error: data.message });
    } catch(e) {
      results.push({ email: t.email, custom_url: customUrl, status: 'error', error: String(e) });
    }

    // Small delay between sends
    await new Promise(r => setTimeout(r, 400));
  }

  return new Response(JSON.stringify({ total: therapists?.length, sent_to: real.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
