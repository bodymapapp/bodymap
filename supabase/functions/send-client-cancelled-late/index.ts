// C9 - Client cancelled late (within fee window)
//
// Fires immediately when a client cancels their own booking inside
// the fee window. Acknowledges the cancellation with clear,
// non-punitive explanation of the cancellation fee. Event-driven.
//
// Payload:
//   { booking_id, fee_amount_cents?, fee_charged? }
//   fee_amount_cents is the dollar amount the policy applies (cents)
//   fee_charged is true if the charge succeeded, false if pending

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logNotification } from "../_shared/notifications.ts";
import { emailWrapper, ctaButton, eyebrow, factBox, tipBox, fromFor, replyToFor, formatApptDateTime } from "../_shared/emailTemplate.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { booking_id, fee_amount_cents, fee_charged } = await req.json().catch(() => ({}));
  if (!booking_id) return jsonErr('booking_id required', 400);

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, client_id, start_date, start_time, service_name,
      therapists(id, full_name, business_name, custom_url, email, late_cancel_policy_text),
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
  const bookingUrl = `https://mybodymap.app/book/${therapist.custom_url}`;
  const fee = fee_amount_cents ? `$${(fee_amount_cents / 100).toFixed(2)}` : null;

  const subject = `About your session on ${apptWhen.split(' at ')[0]}`;

  let feeBlock = '';
  if (fee && fee_charged) {
    feeBlock = tipBox(
      `A small note about the fee`,
      `Because this cancellation came in close to the appointment time, a cancellation fee of ${fee} was applied to your card on file. This is part of how I'm able to hold time exclusively for clients in advance. I appreciate you understanding.`,
      'gold',
    );
  } else if (fee && !fee_charged) {
    feeBlock = tipBox(
      `A small note about the fee`,
      `Because this cancellation came in close to the appointment time, a ${fee} cancellation fee applies. I'll reach out separately about how to take care of it.`,
      'gold',
    );
  }

  const bodyHtml = `
    ${eyebrow('Cancellation received', 'gold')}
    <h1>I'll see you another time</h1>
    <p>Hi ${clientFirstName},</p>
    <p>Your <strong>${booking.service_name || 'session'}</strong> on <strong>${apptWhen}</strong> has been cancelled. I hope everything is okay on your end.</p>
    ${feeBlock}
    <p>Whenever the timing works again, I'd love to see you. My open times are below.</p>
    ${ctaButton('Find a time that works', bookingUrl)}
    <p>Take care.</p>
    <p class="muted" style="font-size:13px;margin-top:18px;">- ${therapist?.full_name || therapistName}</p>
  `;

  const html = emailWrapper({ subject, bodyHtml, preheader: 'Cancelled and confirmed.' });

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
    notification_type: 'client_cancelled_late',
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
