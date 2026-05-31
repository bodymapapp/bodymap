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

  const { booking_id, fee_amount_cents, fee_charged } = await req.json().catch(() => ({}));
  if (!booking_id) return jsonErr('booking_id required', 400);

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, client_id, client_name, client_email, booking_date, start_time, service_id, services(name),
      therapists(id, full_name, business_name, custom_url, email, late_cancel_policy_text),
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
  const policyText = (therapist as any)?.cancellation_policy?.custom_text
    || (therapist as any)?.cancellation_policy_text
    || null;

  // HK May 29 2026: per EMAIL_COPY_SPEC C9. Transparent, not punishing,
  // shows fee + policy inline.
  const subject = `Your cancellation and fee receipt`;

  const bodyHtml = renderClientEmail({
    therapist,
    toneEyebrow: 'Cancellation confirmed',
    toneEyebrowKind: 'gold',
    title: `Your cancellation is confirmed`,
    opener: `Hi ${clientFirstName}, we've cancelled your ${serviceName}. Because this came in close to the appointment time, the cancellation fee per my policy applies. Sharing the receipt below.`,
    serviceName,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    feeAmountCents: (fee_amount_cents && fee_charged) ? fee_amount_cents : null,
    feeChargedTo: (fee_amount_cents && fee_charged) ? 'card on file' : null,
    policyInline: policyText,
    primaryCta: { label: 'Book another time', href: bookingUrl },
    closingLine: `If you have any questions about the fee, please reply to this email.`,
    prefName: 'Client cancellation, late',
  });

  const html = emailWrapper({ subject, bodyHtml, preheader: `Your ${serviceName} on ${apptWhen} is cancelled. Fee receipt inside.` });

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
