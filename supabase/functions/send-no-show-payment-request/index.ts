// C12 - No-show payment request
//
// Fires when a no-show fee charge fails (declined card, no card on
// file, etc). Polite payment request with a Stripe-hosted link the
// client can pay through. Event-driven.
//
// Payload:
//   { booking_id, fee_amount_cents, payment_link_url }

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

  const { booking_id, fee_amount_cents, payment_link_url } = await req.json().catch(() => ({}));
  if (!booking_id || !fee_amount_cents) return jsonErr('booking_id and fee_amount_cents required', 400);

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, client_id, start_date, start_time, service_name,
      therapists(id, full_name, business_name, custom_url, email),
      clients(id, name, email, unsubscribed_at)
    `)
    .eq('id', booking_id)
    .single();

  if (!booking) return jsonErr('booking not found', 404);

  const therapist = booking.therapists;
  const client = booking.clients;
  if (!client?.email) return jsonErr('no client email', 200, { skipped: 'no_client_email' });
  if (client.unsubscribed_at) return jsonErr('unsubscribed', 200, { skipped: 'unsubscribed' });

  const therapistName = therapist?.business_name || therapist?.full_name || 'Your therapist';
  const clientFirstName = client.name?.split(' ')[0] || 'there';
  const apptWhen = formatApptDateTime(booking.start_date, booking.start_time);
  const fee = `$${(fee_amount_cents / 100).toFixed(2)}`;
  const payUrl = payment_link_url || `https://mybodymap.app/book/${therapist.custom_url}`;

  const subject = `Payment needed for missed session, ${clientFirstName}`;

  const bodyHtml = `
    ${eyebrow('Payment needed', 'gold')}
    <h1>A small follow-up on your missed session</h1>
    <p>Hi ${clientFirstName},</p>
    <p>Per ${therapistName}'s policy, missed sessions carry a <strong>${fee}</strong> fee. We tried to charge it but the payment didn't go through, so we're sending a payment link instead.</p>
    ${factBox([
      { label: 'For',         value: apptWhen },
      { label: 'Session',     value: booking.service_name || 'Massage session' },
      { label: 'Amount due',  value: fee },
    ])}
    ${ctaButton(`Pay ${fee} now`, payUrl)}
    <p class="muted" style="font-size:13px;line-height:1.55;">If you'd like to update your card on file or if there's a reason for the miss we should know about, reply to this email and ${therapistName} will get back to you.</p>
  `;

  const html = emailWrapper({ subject, bodyHtml, preheader: `Please complete the ${fee} payment for your missed session.` });

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
    notification_type: 'no_show_payment_request',
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
