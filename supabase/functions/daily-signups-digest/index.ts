// Daily signups digest — runs once a day via Supabase cron.
// Emails bodymap01@gmail.com (BCC bodymapdemo@gmail.com) with:
//   1. Every therapist that signed up in the past 24 hours (with any security flags)
//   2. Signup attempt stats: blocked, flagged, rate-limit hits
// Reads directly from therapists + signup_attempts tables (source of truth).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FLAG_LABELS: Record<string, string> = {
  email_name_mismatch: 'Name does not match email',
  all_caps_name: 'Name all caps',
  all_lowercase_name: 'Name all lowercase',
  numeric_name: 'Numbers in name',
  plus_alias_email: 'Plus-alias email',
  repeated_chars_name: 'Repeated characters in name',
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
      .select('full_name, business_name, email, phone, custom_url, plan, created_at, signup_risk_score, signup_flag_reasons')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: attempts } = await supabase
      .from('signup_attempts')
      .select('outcome, block_reason, ip')
      .gte('created_at', since);

    const blockedCount = (attempts || []).filter(a => a.outcome === 'blocked').length;
    const flaggedCount = (attempts || []).filter(a => a.outcome === 'flagged').length;
    const rateLimitCount = (attempts || []).filter(a => a.block_reason === 'rate_limit_hour' || a.block_reason === 'rate_limit_day').length;
    const disposableCount = (attempts || []).filter(a => a.block_reason === 'disposable_email').length;
    const uniqueBlockedIps = new Set((attempts || []).filter(a => a.outcome === 'blocked' && a.ip).map(a => a.ip)).size;

    if ((!signups || signups.length === 0) && blockedCount === 0 && flaggedCount === 0) {
      return new Response(JSON.stringify({ sent: false, reason: 'no activity' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const count = signups?.length || 0;

    const rowsHtml = (signups || []).map(s => {
      const time = new Date(s.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      const flags = (s.signup_flag_reasons || []).map((f: string) => FLAG_LABELS[f] || f);
      const hasFlags = flags.length > 0;
      return `
        <tr style="${hasFlags ? 'background:#FFFBEB;' : ''}">
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-family:system-ui;font-size:14px;">
            <div style="font-weight:700;color:#1A3A28;">${s.business_name || s.full_name || '(no name)'}</div>
            <div style="color:#6B7280;font-size:12px;margin-top:2px;">${s.full_name || ''}</div>
            ${hasFlags ? `<div style="margin-top:6px;"><span style="background:#FEF3C7;color:#92400E;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;">⚠ ${flags.join(' · ')}</span></div>` : ''}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-family:system-ui;font-size:13px;color:#374151;">${s.email || '(none)'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-family:system-ui;font-size:12px;color:#6B7280;">${s.phone || '(none)'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-family:system-ui;font-size:12px;">
            <span style="background:${s.plan === 'silver' ? '#DCFCE7' : '#FEF3C7'};color:${s.plan === 'silver' ? '#166534' : '#92400E'};padding:2px 8px;border-radius:20px;font-weight:700;">${s.plan || 'free'}</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-family:system-ui;font-size:12px;color:#6B7280;">${time}</td>
        </tr>`;
    }).join('');

    const signupsSection = count > 0 ? `
      <h1 style="font-family:Georgia,serif;font-size:26px;color:#1A3A28;margin:0 0 8px;">${count} new therapist${count > 1 ? 's' : ''} joined yesterday</h1>
      <p style="font-family:system-ui;font-size:14px;color:#6B7280;margin:0 0 20px;line-height:1.6;">
        Highlighted rows have security flags. These are allowed through but worth a second look. Real people do use partner emails, nicknames, etc.
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
    ` : '';

    const securitySection = (blockedCount > 0 || flaggedCount > 0) ? `
      <div style="margin-top:28px;padding:20px;background:#F9FAF9;border:1px solid #E8E4DC;border-radius:12px;">
        <div style="font-family:Georgia,serif;font-size:11px;color:#6B9E80;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">🛡️ Security activity</div>
        <div style="font-family:system-ui;font-size:14px;color:#374151;line-height:1.8;">
          ${blockedCount > 0 ? `<div><strong style="color:#991B1B;">${blockedCount}</strong> attempt${blockedCount > 1 ? 's' : ''} blocked${uniqueBlockedIps > 1 ? ` from ${uniqueBlockedIps} different IPs` : ''}</div>` : ''}
          ${rateLimitCount > 0 ? `<div>&nbsp;&nbsp;↳ ${rateLimitCount} rate-limit hit${rateLimitCount > 1 ? 's' : ''}</div>` : ''}
          ${disposableCount > 0 ? `<div>&nbsp;&nbsp;↳ ${disposableCount} disposable email${disposableCount > 1 ? 's' : ''}</div>` : ''}
          ${flaggedCount > 0 ? `<div><strong style="color:#92400E;">${flaggedCount}</strong> signup${flaggedCount > 1 ? 's' : ''} allowed but flagged (shown in yellow above)</div>` : ''}
        </div>
      </div>
    ` : '';

    const html = `<!DOCTYPE html><html><body style="background:#FAFAF7;padding:24px 0;margin:0;">
      <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;border:1px solid #E8E4DC;">
        <div style="font-family:Georgia,serif;font-size:11px;color:#6B9E80;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">🌿 BodyMap · Daily Signups</div>
        ${signupsSection}
        ${securitySection}
        <p style="font-family:system-ui;font-size:11px;color:#9CA3AF;text-align:center;margin:24px 0 0;">
          Sent by BodyMap · Generated daily covering the previous 24 hours.
        </p>
      </div>
    </body></html>`;

    const subject = count > 0
      ? `🌿 ${count} new BodyMap signup${count > 1 ? 's' : ''} yesterday${blockedCount > 0 ? ` (+${blockedCount} blocked)` : ''}`
      : `🛡️ BodyMap security: ${blockedCount} blocked, ${flaggedCount} flagged`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'BodyMap <reminders@mybodymap.app>',
        to: [DIGEST_TO],
        bcc: ['bodymapdemo@gmail.com'],
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json();
    return new Response(JSON.stringify({ sent: resendRes.ok, count, blockedCount, flaggedCount, resend: resendData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('daily-signups-digest error:', err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
