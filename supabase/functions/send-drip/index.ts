import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const RESEND_API_KEY     = Deno.env.get('RESEND_API_KEY');
  const SUPABASE_URL       = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

  const now = new Date();

  // Day 3: signed up between 3d2h and 3d22h ago
  const day3Min = new Date(now.getTime() - (3 * 24 + 22) * 60 * 60 * 1000).toISOString();
  const day3Max = new Date(now.getTime() - (3 * 24 + 2) * 60 * 60 * 1000).toISOString();

  // Day 7: signed up between 7d2h and 7d22h ago
  const day7Min = new Date(now.getTime() - (7 * 24 + 22) * 60 * 60 * 1000).toISOString();
  const day7Max = new Date(now.getTime() - (7 * 24 + 2) * 60 * 60 * 1000).toISOString();

  const SKIP_EMAILS = [
    'bodymapdemo@gmail.com','bodymap01@gmail.com','hk5@email.com','hk2@email.com',
    'hk4@email.com','hkgpwc@gmail.com','harshk.mba@gmail.com','demo@mybodymap.app',
    'testtherapistapr15@email.com','testtherapistapr152@email.com','testtherapistapr153@email.com',
    'sarah.demo@bodymap.test','test_therapist2@bodymap.com','goodhands@email.com',
    'therapist11@test.com','tt12@email.com','tt12@emails.com','tt14@email.com',
    'tt18@email.com','tt22@email.com','tt24@email.com','tt25@email.com','tt26@email.com',
    'tt100@email.com','tt103@gmail.com','test101@email.com','test102@email.com',
    'testtherapist99@email.com',
  ];

  const results: any[] = [];

  // Fetch Day 3 therapists
  const { data: day3 } = await supabase.from('therapists')
    .select('full_name, email, custom_url, created_at')
    .gte('created_at', day3Min).lte('created_at', day3Max);

  for (const t of (day3 || [])) {
    if (!t.email || SKIP_EMAILS.includes(t.email.toLowerCase())) continue;
    const firstName = t.full_name?.split(' ')[0] || 'there';
    const intakeUrl = `https://mybodymap.app/book/${t.custom_url}`;
    const dashLink  = 'https://mybodymap.app/dashboard';

    const html = `
      <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;">
        <div style="margin-bottom:24px;">
          <span style="font-size:20px;font-weight:700;color:#1A3A28;">BodyMap</span>
          <span style="display:block;font-family:system-ui;font-size:11px;font-weight:700;color:#6B9E80;letter-spacing:0.12em;text-transform:uppercase;margin-top:2px;">Client Intelligence</span>
        </div>
        <h2 style="font-size:22px;font-weight:700;color:#1A3A28;margin:0 0 12px;">The fastest way to get your first client into BodyMap</h2>
        <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Hi ${firstName}, it takes about 60 seconds. Text or email this link to one client before their next session:</p>
        <div style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:12px;padding:16px 20px;margin-bottom:20px;text-align:center;">
          <div style="font-family:system-ui;font-size:12px;color:#2A5741;font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.08em;">Your intake link</div>
          <a href="${intakeUrl}" style="font-family:system-ui;font-size:15px;color:#2A5741;font-weight:700;">${intakeUrl}</a>
        </div>
        <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">They tap their focus areas and what to avoid. You see it in your dashboard before they arrive. After their first session, BodyMap remembers everything and pre-fills it automatically next time.</p>
        <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 28px;">That is the whole thing. One link, and your practice starts working differently.</p>
        <a href="${dashLink}" style="display:inline-block;background:#2A5741;color:#fff;font-family:system-ui;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Go to my dashboard</a>
        <p style="font-family:system-ui;font-size:12px;color:#9CA3AF;margin-top:32px;line-height:1.6;">The BodyMap Team &middot; <a href="https://mybodymap.app" style="color:#9CA3AF;">mybodymap.app</a></p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'The BodyMap Team <reminders@mybodymap.app>',
        to: [t.email],
        bcc: ['bodymapdemo@gmail.com'],
        subject: `${firstName}, here is your intake link — share it before their next session`,
        html,
      }),
    });
    const data = await res.json();
    results.push({ day: 3, email: t.email, status: res.ok ? 'sent' : 'failed', id: data.id });
    await new Promise(r => setTimeout(r, 300));
  }

  // Fetch Day 7 therapists
  const { data: day7 } = await supabase.from('therapists')
    .select('full_name, email, custom_url, created_at')
    .gte('created_at', day7Min).lte('created_at', day7Max);

  for (const t of (day7 || [])) {
    if (!t.email || SKIP_EMAILS.includes(t.email.toLowerCase())) continue;
    const firstName = t.full_name?.split(' ')[0] || 'there';
    const demoUrl   = 'https://mybodymap.app/bodymapdemopractice?name=Sarah+Mitchell&email=sarah.demo@bodymap.test';
    const dashLink  = 'https://mybodymap.app/dashboard';

    const html = `
      <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;">
        <div style="margin-bottom:24px;">
          <span style="font-size:20px;font-weight:700;color:#1A3A28;">BodyMap</span>
          <span style="display:block;font-family:system-ui;font-size:11px;font-weight:700;color:#6B9E80;letter-spacing:0.12em;text-transform:uppercase;margin-top:2px;">Client Intelligence</span>
        </div>
        <h2 style="font-size:22px;font-weight:700;color:#1A3A28;margin:0 0 12px;">After the first session, your clients never start from scratch again</h2>
        <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Hi ${firstName}, here is what happens after a client fills their intake once:</p>
        <div style="background:#F9FAF9;border-left:3px solid #2A5741;padding:16px 20px;margin-bottom:20px;">
          <p style="font-family:system-ui;font-size:14px;color:#4B5563;line-height:1.7;margin:0;">Next time they book, the link opens with a gold banner: <b>Welcome back</b>. Their zones are already filled in. Pressure, music, what to avoid. All there. They tap confirm and they are done in 10 seconds.</p>
        </div>
        <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">See it live with a demo client we set up:</p>
        <a href="${demoUrl}" style="display:inline-block;background:#2A5741;color:#fff;font-family:system-ui;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;margin-bottom:28px;">See the returning client demo</a>
        <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 8px;">This is what makes clients feel like your regulars remember them. Because you do.</p>
        <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 28px;">Questions? Just reply here.</p>
        <a href="${dashLink}" style="display:inline-block;background:#F0FDF4;color:#2A5741;border:1.5px solid #86EFAC;font-family:system-ui;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Go to my dashboard</a>
        <p style="font-family:system-ui;font-size:12px;color:#9CA3AF;margin-top:32px;line-height:1.6;">The BodyMap Team &middot; <a href="https://mybodymap.app" style="color:#9CA3AF;">mybodymap.app</a></p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'The BodyMap Team <reminders@mybodymap.app>',
        to: [t.email],
        bcc: ['bodymapdemo@gmail.com'],
        subject: `${firstName}, after the first session they never start from scratch again`,
        html,
      }),
    });
    const data = await res.json();
    results.push({ day: 7, email: t.email, status: res.ok ? 'sent' : 'failed', id: data.id });
    await new Promise(r => setTimeout(r, 300));
  }

  return new Response(JSON.stringify({ sent: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
