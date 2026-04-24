import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSmsViaTwilio, shouldSend, logNotification } from "../_shared/notifications.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const RESEND_API_KEY    = Deno.env.get('RESEND_API_KEY');
  const SUPABASE_URL      = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

  const { session_id } = await req.json().catch(() => ({}));
  if (!session_id) {
    return new Response(JSON.stringify({ error: 'session_id required' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const { data: session } = await supabase
    .from('sessions')
    .select(`
      *,
      therapists(
        id, full_name, business_name, custom_url, email,
        notification_prefs,
        twilio_account_sid, twilio_auth_token, twilio_phone_number
      ),
      clients(id, name, email, phone, sms_opted_in)
    `)
    .eq('id', session_id)
    .single();

  if (!session) return new Response(JSON.stringify({ error: 'Session not found' }), {
    status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
  });

  const therapist = session.therapists;
  const client = session.clients;
  const clientEmail = client?.email;
  const clientPhone = client?.phone;
  const clientFirstName = client?.name?.split(' ')[0] || 'there';
  const therapistName = therapist?.business_name || therapist?.full_name || 'Your therapist';

  const sendEmail = shouldSend(therapist, 'client', 'post_session', 'email');
  const sendSms = shouldSend(therapist, 'client', 'post_session', 'sms') && client?.sms_opted_in === true;

  if (!sendEmail && !sendSms) {
    return new Response(JSON.stringify({ skipped: 'prefs_off' }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  let emailStatus = 'skipped_prefs';
  let smsStatus = 'skipped_prefs';
  let emailId: string | null = null;

  // Parse SOAP notes - show Assessment (what worked) and Plan (next steps) to client
  let soapHtml = '';
  try {
    const parsed = JSON.parse(session.therapist_notes || '{}');
    if (parsed.__soap) {
      if (parsed.A) soapHtml += `<p style="font-size:14px;color:#374151;margin:0 0 8px;line-height:1.6;"><strong>What we worked on:</strong> ${parsed.A}</p>`;
      if (parsed.P) soapHtml += `<p style="font-size:14px;color:#374151;margin:0;line-height:1.6;"><strong>For next time:</strong> ${parsed.P}</p>`;
    }
  } catch(e) {}

  const publicMessage = session.public_notes || '';
  const bookingUrl = `https://www.mybodymap.app/book/${therapist?.custom_url}`;
  const sessionDate = new Date(session.created_at).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });

  const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:system-ui,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="text-align:center;margin-bottom:24px;">
    <span style="font-size:32px;">🌿</span>
    <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#2A5741;margin:8px 0 0;">MyBodyMap</h1>
  </div>
  <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
    <h2 style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1A1A2E;margin:0 0 8px;">Great session today, ${clientFirstName} ✨</h2>
    <p style="color:#6B7280;font-size:15px;margin:0 0 24px;line-height:1.6;">Here's a quick note from ${therapistName} after your ${sessionDate} session.</p>
    ${publicMessage ? `
    <div style="background:linear-gradient(135deg,#F0FDF4,#DCFCE7);border:1.5px solid #86EFAC;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="font-size:13px;font-weight:700;color:#2A5741;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;">From ${therapistName}</p>
      <p style="font-size:15px;color:#1A1A2E;margin:0;line-height:1.7;font-style:italic;">"${publicMessage}"</p>
    </div>` : ''}
    ${soapHtml ? `
    <div style="background:#F5F0E8;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="font-size:13px;font-weight:700;color:#2A5741;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">Session summary</p>
      ${soapHtml}
    </div>` : ''}
    <div style="background:#FEF3C7;border:1.5px solid #FCD34D;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="font-size:13px;font-weight:700;color:#92400E;margin:0 0 4px;">Take care of yourself 💛</p>
      <p style="font-size:13px;color:#92400E;margin:0;line-height:1.6;">Drink plenty of water today. Hydration helps your muscles recover faster.</p>
    </div>
    <a href="${bookingUrl}" style="display:block;background:#2A5741;color:#fff;text-decoration:none;border-radius:10px;padding:14px 20px;text-align:center;font-size:15px;font-weight:700;margin-bottom:16px;">Book Your Next Session →</a>
    <p style="font-size:12px;color:#9CA3AF;text-align:center;margin:0;">Questions? Reply to this email or contact ${therapistName} directly.</p>
  </div>
  <p style="font-size:11px;color:#9CA3AF;text-align:center;margin:24px 0 0;">Sent by MyBodyMap · mybodymap.app</p>
</div>
</body></html>`;

  if (sendEmail && clientEmail) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${therapistName} <sessions@mybodymap.app>`,
        to: [clientEmail],
        reply_to: therapist?.email || undefined,
        subject: `Your session summary from ${therapistName}`,
        html: emailHtml,
      }),
    });
    const data = await res.json();
    emailStatus = res.ok ? 'sent' : 'failed';
    emailId = data.id;
    await logNotification(supabase, {
      therapist_id: therapist.id,
      client_id: client?.id,
      session_id,
      notification_type: 'post_session',
      audience: 'client',
      channel: 'email',
      recipient: clientEmail,
      status: emailStatus,
      provider_id: emailId,
    });
  }

  if (sendSms && clientPhone) {
    const smsMsg = `Thanks for coming in today, ${clientFirstName}! Book your next session at ${therapistName}: ${bookingUrl}  Reply STOP to opt out.`;
    const smsRes = await sendSmsViaTwilio(therapist, clientPhone, smsMsg);
    smsStatus = smsRes.ok ? 'sent' : (smsRes.skipped || 'failed');
    await logNotification(supabase, {
      therapist_id: therapist.id,
      client_id: client?.id,
      session_id,
      notification_type: 'post_session',
      audience: 'client',
      channel: 'sms',
      recipient: clientPhone,
      status: smsStatus,
      provider_id: smsRes.sid,
      error_message: smsRes.error,
    });
  }

  if (emailStatus === 'sent' || smsStatus === 'sent') {
    await supabase.from('sessions').update({ post_session_email_sent_at: new Date().toISOString() }).eq('id', session_id);
  }

  return new Response(JSON.stringify({ email: emailStatus, sms: smsStatus, email_id: emailId }), {
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
});
