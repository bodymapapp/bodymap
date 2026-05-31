// C8 - Client cancelled within policy
//
// Fires immediately when a client cancels their own booking within
// the policy window (no fee charged). Warm acknowledgement, easy
// rebook CTA. Event-driven.
//
// Payload: { booking_id }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logNotification } from "../_shared/notifications.ts";
import { emailWrapper, fromFor, replyToFor, formatApptDateTime } from "../_shared/emailTemplate.ts";
import { renderClientEmail } from "../_shared/clientEmail.ts";
import { resolveClientFirstName } from "../_shared/clientName.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { booking_id } = await req.json().catch(() => ({}));
  if (!booking_id) return jsonErr('booking_id required', 400);

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, client_id, client_name, client_email, booking_date, start_time, service_id, services(name),
      therapists(id, full_name, business_name, custom_url, email),
      clients(id, name, email, outreach_unsubscribed_at)
    `)
    .eq('id', booking_id)
    .single();

  if (!booking) return jsonErr('booking not found', 404);

  const therapist = booking.therapists;
  const client = booking.clients;
  if (!client?.email) return jsonErr('no client email', 200, { skipped: 'no_client_email' });
  if (client.outreach_unsubscribed_at) return jsonErr('unsubscribed', 200, { skipped: 'unsubscribed' });

  const therapistFirst = (therapist?.full_name || therapist?.business_name || 'Your therapist').split(' ')[0];
  const clientFirstName = resolveClientFirstName(booking, client, 'there');
  const apptWhen = formatApptDateTime(booking.booking_date, booking.start_time);
  const bookingUrl = `https://mybodymap.app/book/${therapist.custom_url}`;
  const serviceName = booking.services?.name || 'session';

  // HK May 29 2026: per EMAIL_COPY_SPEC C8. Matter-of-fact, no judgment,
  // shows session details + 'no fee charged', rebook CTA.
  const subject = `Your cancellation is confirmed`;

  const bodyHtml = renderClientEmail({
    therapist,
    toneEyebrow: 'Cancellation confirmed',
    toneEyebrowKind: 'sage',
    title: `Your cancellation is confirmed`,
    opener: `Hi ${clientFirstName}, we've cancelled your ${serviceName}. No fee was charged, no need to explain. Whenever the timing works for you again, I'd love to see you.`,
    serviceName,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    primaryCta: { label: 'Book another time', href: bookingUrl },
    closingLine: `Take care.`,
    prefName: 'Client cancellation, within policy',
  });

  const html = emailWrapper({ subject, bodyHtml, preheader: `Your ${serviceName} on ${apptWhen} is cancelled. No charge.` });

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
    notification_type: 'client_cancelled_within_policy',
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
