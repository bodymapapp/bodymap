// C11 - No-show charged
//
// Fires immediately when a no-show fee is successfully charged to the
// client's card on file. Non-judgmental tone, clear receipt info,
// rebook CTA. Event-driven.
//
// Payload:
//   { booking_id, fee_amount_cents, charge_id }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logNotification } from "../_shared/notifications.ts";
import { emailWrapper, fromFor, replyToFor, formatApptDateTime } from "../_shared/emailTemplate.ts";
import { renderClientEmail } from "../_shared/clientEmail.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { booking_id, fee_amount_cents, charge_id } = await req.json().catch(() => ({}));
  if (!booking_id || !fee_amount_cents) return jsonErr('booking_id and fee_amount_cents required', 400);

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, client_id, booking_date, start_time, service_id, services(name),
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
  const clientFirstName = client.name?.split(' ')[0] || 'there';
  const apptWhen = formatApptDateTime(booking.booking_date, booking.start_time);
  const bookingUrl = `https://mybodymap.app/book/${therapist.custom_url}`;
  const serviceName = booking.services?.name || 'session';

  // HK May 29 2026: per EMAIL_COPY_SPEC C12. Professional, transparent,
  // shows the fee + the policy inline (not just a link), never punishing.
  const policyText = (therapist as any)?.cancellation_policy?.custom_text
    || (therapist as any)?.cancellation_policy_text
    || null;

  const subject = `About your missed session on ${apptWhen.split(' at ')[0]}`;

  const bodyHtml = renderClientEmail({
    therapist,
    toneEyebrow: 'About your missed session',
    toneEyebrowKind: 'gold',
    title: `About your missed session`,
    opener: `Hi ${clientFirstName}, I held your time and was looking forward to seeing you. Since you didn't make it, per the cancellation policy a fee has been charged to your card on file. Sharing the receipt here so you have it.`,
    serviceName,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    feeAmountCents: fee_amount_cents,
    feeChargedTo: 'card on file',
    policyInline: policyText,
    primaryCta: { label: 'Book another session', href: bookingUrl },
    closingLine: `If this was a misunderstanding or something came up, please reply to this email and I'll get back to you.`,
    prefName: 'No-show, fee charged',
  });

  const html = emailWrapper({ subject, bodyHtml, preheader: `A receipt for ${apptWhen} and a way to rebook when you're ready.` });

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
    notification_type: 'no_show_charged',
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
