// Daily signups digest — runs once a day via Supabase cron.
// Emails bodymap01@gmail.com (BCC bodymapdemo@gmail.com) with every therapist
// that signed up in the past 24 hours. Covers any signup path (email, Google,
// paid, free) because it reads directly from the therapists table.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const DIGEST_TO = Deno.env.get('DIGEST_TO') || 'bodymap01@gmail.com';

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: signups, error } = await supabase
      .from('therapists')
      .select('full_name, business_name, email, phone, custom_url, plan, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If nothing to report, skip the email (reduce inbox noise)
    if (!signups || signups.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: 'no signups' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const count = signups.length;
    const rowsHtml = signups.map(s => {
      const time = new Date(s.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-family:system-ui;font-size:14px;">
            <div style="font-weight:700;color:#1A3A28;">${s.business_name || s.full_name || '(no name)'}</div>
            <div style="color:#6B7280;font-size:12px;margin-top:2px;">${s.full_name || ''}</div>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-family:system-ui;font-size:13px;color:#374151;">${s.email || '—'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-family:system-ui;font-size:12px;color:#6B7280;">${s.phone || '—'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-family:system-ui;font-size:12px;">
            <span style="background:${s.plan === 'silver' ? '#DCFCE7' : '#FEF3C7'};color:${s.plan === 'silver' ? '#166534' : '#92400E'};padding:2px 8px;border-radius:20px;font-weight:700;">${s.plan || 'free'}</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-family:system-ui;font-size:12px;color:#6B7280;">${time}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><body style="background:#FAFAF7;padding:24px 0;margin:0;">
      <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;border:1px solid #E8E4DC;">
        <div style="font-family:Georgia,serif;font-size:11px;color:#6B9E80;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">🌿 BodyMap · Daily Signups</div>
        <h1 style="font-family:Georgia,serif;font-size:26px;color:#1A3A28;margin:0 0 8px;">${count} new therapist${count > 1 ? 's' : ''} joined yesterday</h1>
        <p style="font-family:system-ui;font-size:14px;color:#6B7280;margin:0 0 20px;line-height:1.6;">
          Here's everyone who signed up in the last 24 hours. Reach out personally if any look like strong fits — founding therapists respond well to a direct hello.
        </p>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #E8E4DC;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#F9FAF9;">
              <th style="padding:10px 12px;text-align:left;font-family:system-ui;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Business / Name</th>
              <th style="padding:10px 12px;text-align:left;font-family:system-ui;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Email</th>
              <th style="padding:10px 12px;text-align:left;font-family:system-ui;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Phone</th>
              <th style="padding:10px 12px;text-align:left;font-family:system-ui;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Plan</th>
              <th style="padding:10px 12px;text-align:left;font-family:system-ui;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Signed up</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <p style="font-family:system-ui;font-size:11px;color:#9CA3AF;text-align:center;margin:24px 0 0;">
          Sent by BodyMap · This digest is generated once a day and covers the previous 24 hours.
        </p>
      </div>
    </body></html>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'BodyMap <reminders@mybodymap.app>',
        to: [DIGEST_TO],
        bcc: ['bodymapdemo@gmail.com'],
        subject: `🌿 ${count} new BodyMap signup${count > 1 ? 's' : ''} yesterday`,
        html,
      }),
    });

    const resendData = await resendRes.json();
    return new Response(JSON.stringify({ sent: resendRes.ok, count, resend: resendData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('daily-signups-digest error:', err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
