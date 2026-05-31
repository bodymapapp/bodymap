// supabase/functions/send-intake-email/index.ts
//
// HK May 31 2026: direct email send for intake forms. Mirrors
// send-agreement-email exactly. Before this function existed,
// "Send intake -> Email" opened the therapist's mailto: handler
// (Outlook on Mac, Mail on iPhone) which is slow and unprofessional.
// Now the email goes directly via Resend, same as agreements.
//
// Auto-deploys via the GitHub Action on push to main when
// supabase/functions/** changes.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing required environment variables' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { short_code, therapist_id, client_email, client_name, link } = body;
  if (!short_code || !therapist_id || !client_email || !link) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { data: therapist, error: tErr } = await supabase
    .from('therapists')
    .select('id, business_name, full_name, email, phone')
    .eq('id', therapist_id)
    .single();

  if (tErr || !therapist) {
    return new Response(JSON.stringify({ error: 'Therapist not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const businessName = therapist.business_name || therapist.full_name || 'your therapist';
  const firstName = (client_name || '').split(/\s+/)[0] || 'there';
  const therapistContact = therapist.email || therapist.phone || '';

  const subject = `Your intake form for ${businessName}`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0; padding:0; background:#F5EFE0; font-family: Georgia, serif; color:#1F2937;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5EFE0; padding:32px 16px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px; background:#FFFFFF; border-radius:12px; overflow:hidden; box-shadow:0 8px 24px rgba(31,58,44,0.08);">
        <tr>
          <td style="background:linear-gradient(180deg, #1F3A2C 0%, #2A5741 100%); padding:24px 28px; color:#FFFFFF;">
            <div style="height:3px; background:linear-gradient(90deg, #B87840 0%, #9A6230 50%, #B87840 100%); margin:-24px -28px 18px;"></div>
            <div style="font-family: Georgia, serif; font-style: italic; font-size:21px; font-weight:700; line-height:1.2;">
              ${escapeHtml(businessName)}
            </div>
            <div style="font-family: system-ui, sans-serif; font-size:10.5px; letter-spacing:0.14em; text-transform:uppercase; color:rgba(255,255,255,0.7); font-weight:600; margin-top:6px;">
              Intake Form
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 28px 8px; font-family: Georgia, serif; font-size:15px; line-height:1.65; color:#1F2937;">
            <p style="margin:0 0 14px;">Hi ${escapeHtml(firstName)},</p>
            <p style="margin:0 0 14px;">
              Before our session at ${escapeHtml(businessName)}, please take a couple of minutes to fill out your intake form. This helps me tailor the work to what you need.
            </p>
            <p style="margin:0 0 22px;">
              Tap the button below to open it. It takes about a minute on a phone.
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 28px 26px;">
            <a href="${escapeHtml(link)}" style="display:inline-block; background:#2A5741; color:#FFFFFF; text-decoration:none; padding:14px 28px; border-radius:10px; font-family: system-ui, sans-serif; font-size:14px; font-weight:700; letter-spacing:0.01em; box-shadow:0 4px 12px rgba(42,87,65,0.25);">
              Open Intake Form
            </a>
            <div style="font-family: system-ui, sans-serif; font-size:11px; color:#6B7280; margin-top:14px; line-height:1.5;">
              Or copy this link into your browser:<br>
              <span style="color:#1F2937; word-break:break-all;">${escapeHtml(link)}</span>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#F5EFE0; padding:16px 28px; text-align:center; font-family: system-ui, sans-serif; font-size:11px; color:#6B7280; line-height:1.55; border-top:1px solid #E5E7EB;">
            <div style="font-weight:700; color:#1F3A2C; margin-bottom:3px;">${escapeHtml(businessName)}</div>
            ${therapistContact ? `<div>${escapeHtml(therapistContact)}</div>` : ''}
          </td>
        </tr>
      </table>
      <div style="font-family: system-ui, sans-serif; font-size:10.5px; color:#9CA3AF; margin-top:18px;">
        Sent via MyBodyMap on behalf of ${escapeHtml(businessName)}.
      </div>
    </td></tr>
  </table>
</body>
</html>`;

  let emailStatus = 'failed';
  let emailError: string | null = null;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${businessName} via MyBodyMap <intake@mybodymap.app>`,
        to: [client_email],
        bcc: therapist.email ? [therapist.email] : undefined,
        reply_to: therapist.email || undefined,
        subject,
        html,
      }),
    });
    const resendData = await resendRes.json();
    if (resendRes.ok) {
      emailStatus = 'sent';
    } else {
      emailError = JSON.stringify(resendData);
    }
  } catch (e: any) {
    emailError = String(e?.message || e);
  }

  return new Response(JSON.stringify({
    ok: emailStatus === 'sent',
    error: emailError,
  }), {
    status: emailStatus === 'sent' ? 200 : 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
