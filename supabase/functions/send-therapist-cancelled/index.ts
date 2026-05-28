// C7  - Therapist cancelled the booking
//
// Fires immediately when a therapist cancels a confirmed booking.
// Warm, apologetic, with an immediate rebook CTA. Trust-critical.
//
// Trigger: event-driven. Called from cancel-booking edge function or
// when status flips therapist-side. Also exposed for manual fire.
//
// Payload: { booking_id, reason? }   reason is optional therapist note.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logNotification } from "../_shared/notifications.ts";
import { emailWrapper, ctaButton, eyebrow, factBox, fromFor, replyToFor, formatApptDateTime } from "../_shared/emailTemplate.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { booking_id, reason } = await req.json().catch(() => ({}));
  if (!booking_id) {
    return new Response(JSON.stringify({ error: 'booking_id required' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, client_id, booking_date, start_time, service_id,
      services(name),
      therapists(id, full_name, business_name, custom_url, email, phone, notification_prefs),
      clients(id, name, email, phone, unsubscribed_at)
    `)
    .eq('id', booking_id)
    .single();

  if (!booking) return jsonErr('booking not found', 404);

  const therapist = booking.therapists;
  const client = booking.clients;
  if (!client?.email) return jsonErr('no client email', 200, { skipped: 'no_client_email' });
  if (client.unsubscribed_at) return jsonErr('unsubscribed', 200, { skipped: 'unsubscribed' });

  const serviceName = booking.services?.name || 'session';
  const therapistName = therapist?.business_name || therapist?.full_name || 'Your therapist';
  const clientFirstName = client.name?.split(' ')[0] || 'there';
  const apptWhen = formatApptDateTime(booking.booking_date, booking.start_time);
  const bookingUrl = `https://mybodymap.app/book/${therapist.custom_url}`;

  const subject = `An update on your ${serviceName} from ${therapistName}`;

  const reasonBlock = reason && reason.trim()
    ? `<p style="font-style:italic;color:#3D4F43;background:#FAFAF7;border-left:3px solid #6B9E80;padding:12px 16px;border-radius:0 8px 8px 0;margin:14px 0;">"${reason.trim()}"</p>`
    : '';

  const bodyHtml = `
    ${eyebrow('Session cancelled', 'rose')}
    <h1>${therapistName} had to cancel</h1>
    <p>Hi ${clientFirstName},</p>
    <p>I'm so sorry to send this. Something came up and I won't be able to see you for your <strong>${serviceName}</strong> on <strong>${apptWhen}</strong>. I know rearranging your day for this is not nothing, and I appreciate your patience with me.</p>
    ${reasonBlock}
    <p>Whenever you're ready, the link below shows my open times. No rush.</p>
    ${ctaButton('Find a new time →', bookingUrl)}
    <p>Thank you for understanding. Reply to this email if you have any questions, and I'll get back to you personally.</p>
    <p class="muted" style="font-size:13px;margin-top:24px;">- ${therapist?.full_name || therapistName}</p>
  `;

  const html = emailWrapper({ subject, bodyHtml, preheader: `Your session on ${apptWhen} can't happen. Here's how to find a new time.` });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromFor(therapist, 'hello'),
      to: [client.email],
      reply_to: replyToFor(therapist),
      subject,
      html,
    }),
  });
  const data = await res.json();
  const status = res.ok ? 'sent' : 'failed';

  await logNotification(supabase, {
    therapist_id: therapist.id,
    client_id: client.id,
    booking_id: booking.id,
    notification_type: 'therapist_cancelled',
    audience: 'client',
    channel: 'email',
    recipient: client.email,
    status,
    provider_id: data.id,
    error_message: res.ok ? null : (data.message || JSON.stringify(data)),
    subject,
  });

  return new Response(JSON.stringify({ status, email_id: data.id }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});

function jsonErr(msg: string, code: number = 400, extra: any = {}) {
  return new Response(JSON.stringify({ error: msg, ...extra }), {
    status: code, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
