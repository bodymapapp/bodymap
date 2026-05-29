import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSmsViaTwilio, shouldSend, logNotification } from "../_shared/notifications.ts";
import { renderClientEmailDoc } from "../_shared/clientEmail.ts";

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

  const therapistFirst = (therapist?.full_name || therapist?.business_name || 'Your therapist').split(' ')[0];
  const businessName = therapist?.business_name || therapist?.full_name || 'Your therapist';

  // Parse SOAP notes: surface only the client-friendly parts (A=what worked, P=next time).
  let sessionSummary: string | null = null;
  try {
    const parsed = JSON.parse(session.therapist_notes || '{}');
    if (parsed.__soap) {
      const parts: string[] = [];
      if (parsed.A) parts.push(`What we worked on: ${parsed.A}`);
      if (parsed.P) parts.push(`For next time: ${parsed.P}`);
      if (parts.length) sessionSummary = parts.join('\n\n');
    }
  } catch (_e) { /* malformed notes - skip */ }

  const publicMessage = session.public_notes || '';
  const bookingUrl = `https://www.mybodymap.app/book/${therapist?.custom_url}`;
  const sessionDate = new Date(session.created_at).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });

  // HK May 29 2026: per EMAIL_COPY_SPEC C6. Warm, restorative, NOT salesy.
  const subject = `Great session ${sessionDate.includes(',') ? sessionDate.split(',')[0] : 'today'}, ${clientFirstName}`;
  const opener = publicMessage
    ? `Hi ${clientFirstName}, hope you're feeling great after our session. A short note from ${therapistFirst} below.`
    : `Hi ${clientFirstName}, hope you're feeling great after our session. Here's a short note for your records.`;

  const emailHtml = renderClientEmailDoc(subject, {
    therapist,
    toneEyebrow: 'After your session',
    toneEyebrowKind: 'sage',
    title: `Hope you're feeling great`,
    opener,
    serviceName: session.service_name || null,
    reason: publicMessage || sessionSummary || null,
    primaryCta: { label: 'Book your next session', href: bookingUrl },
    closingLine: `A small thing: drink plenty of water today. Hydration helps your body recover faster. Your preferences are saved here, so booking again is just a couple taps whenever you're ready.`,
    prefName: 'Post-session note',
  }, `A short note from ${therapistFirst} after your session.`);

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
