// supabase/functions/notify-agreement-signed/index.ts
//
// Triggered from the AgreementSign page when a client submits their
// typed-name signature. Sends a confirmation email to the therapist
// so they know a signature was completed without having to check
// the client profile manually.
//
// HK May 15 2026: 'There were no email confirmations that I sent it
// and someone received it.'
//
// Auto-deploys via the GitHub Action.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing env' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let body: any;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { send_request_id, therapist_id, signer_name, signed_at } = body;
  if (!send_request_id || !therapist_id || !signer_name) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { data: therapist } = await supabase
    .from('therapists')
    .select('id, business_name, full_name, email')
    .eq('id', therapist_id)
    .single();

  if (!therapist?.email) {
    return new Response(JSON.stringify({ error: 'Therapist has no email' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const businessName = therapist.business_name || therapist.full_name || 'your practice';
  const therapistFirst = (therapist.full_name || '').split(/\s+/)[0] || 'there';
  const signedDate = signed_at ? new Date(signed_at) : new Date();
  const dateStr = signedDate.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const subject = `${signer_name} signed your client agreement`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0; padding:0; background:#F5EFE0; font-family: Georgia, serif; color:#1F2937;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5EFE0; padding:32px 16px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px; background:#FFFFFF; border-radius:12px; overflow:hidden; box-shadow:0 8px 24px rgba(31,58,44,0.08);">
        <tr>
          <td style="padding:32px 28px 8px; text-align:center;">
            <div style="display:inline-block; width:54px; height:54px; line-height:54px; border-radius:50%; background:#DCFCE7; color:#16A34A; font-size:28px; font-weight:700; margin-bottom:14px;">\u2713</div>
            <div style="font-family: Georgia, serif; font-size:20px; font-weight:700; color:#1F2937; margin-bottom:6px;">
              Signed and on file
            </div>
            <div style="font-family: system-ui, sans-serif; font-size:13px; color:#6B7280; line-height:1.5;">
              Just letting you know one of your clients completed the agreement signing.
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px 4px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5EFE0; border-radius:10px; padding:14px 16px; font-family: system-ui, sans-serif;">
              <tr><td style="font-size:11px; font-weight:700; color:#9A6230; text-transform:uppercase; letter-spacing:0.08em; padding-bottom:4px;">Signed by</td></tr>
              <tr><td style="font-size:15px; font-weight:700; color:#1F2937; font-family: Georgia, serif; padding-bottom:10px;">${escapeHtml(signer_name)}</td></tr>
              <tr><td style="font-size:11px; font-weight:700; color:#9A6230; text-transform:uppercase; letter-spacing:0.08em; padding-bottom:4px;">When</td></tr>
              <tr><td style="font-size:14px; color:#1F2937;">${escapeHtml(dateStr)}</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px 28px; font-family: Georgia, serif; font-size:14px; line-height:1.65; color:#1F2937;">
            <p style="margin:0 0 12px;">The signature is recorded on the client profile in MyBodyMap, with a snapshot of the exact agreement text they saw at signing time. You can view it any time from the client's detail page.</p>
            <p style="margin:0;"><a href="https://www.mybodymap.app/dashboard" style="color:#2A5741; font-weight:700; text-decoration:none;">Open your dashboard \u2192</a></p>
          </td>
        </tr>
        <tr>
          <td style="background:#F5EFE0; padding:14px 28px; text-align:center; font-family: system-ui, sans-serif; font-size:10.5px; color:#9CA3AF; line-height:1.55; border-top:1px solid #E5E7EB;">
            ${escapeHtml(businessName)} \u00b7 Notification from MyBodyMap
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  let emailStatus = 'failed';
  let emailId: string | null = null;
  let emailError: string | null = null;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MyBodyMap <hello@mybodymap.app>',
        to: [therapist.email],
        subject,
        html,
      }),
    });
    const resendData = await resendRes.json();
    if (resendRes.ok) {
      emailStatus = 'sent';
      emailId = resendData.id;
    } else {
      emailError = JSON.stringify(resendData);
    }
  } catch (e) {
    emailError = String(e?.message || e);
  }

  return new Response(JSON.stringify({
    ok: emailStatus === 'sent',
    email_id: emailId,
    error: emailError,
  }), {
    status: emailStatus === 'sent' ? 200 : 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
