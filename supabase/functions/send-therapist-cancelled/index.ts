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

  const { booking_id, reason } = await req.json().catch(() => ({}));
  if (!booking_id) {
    return new Response(JSON.stringify({ error: 'booking_id required' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, client_id, client_name, client_email, booking_date, start_time, service_id,
      services(name),
      therapists(id, full_name, business_name, custom_url, email, phone, notification_prefs),
      clients(id, name, email, phone, outreach_unsubscribed_at)
    `)
    .eq('id', booking_id)
    .single();

  if (!booking) return jsonErr('booking not found', 404);

  const therapist = booking.therapists;
  const client = booking.clients;
  if (!client?.email) return jsonErr('no client email', 200, { skipped: 'no_client_email' });
  if (client.outreach_unsubscribed_at) return jsonErr('unsubscribed', 200, { skipped: 'unsubscribed' });

  const serviceName = booking.services?.name || 'session';
  const therapistFirstName = (therapist?.full_name || therapist?.business_name || 'Your therapist').split(' ')[0];
  const clientFirstName = resolveClientFirstName(booking, client, 'there');
  const apptWhen = formatApptDateTime(booking.booking_date, booking.start_time);
  const bookingUrl = `https://mybodymap.app/book/${therapist.custom_url}`;

  // HK May 29 2026: per docs/EMAIL_COPY_SPEC.md C7. Apologetic, personal,
  // session details visible, optional reason quoted, single CTA to rebook.
  const subject = `${therapistFirstName} had to cancel ${apptWhen.split(',')[0]}'s session`;

  const bodyHtml = renderClientEmail({
    therapist,
    toneEyebrow: 'Session cancelled',
    toneEyebrowKind: 'rose',
    title: `${therapistFirstName} had to cancel`,
    opener: `Hi ${clientFirstName}, I'm so sorry to send this. I have to cancel your ${serviceName} that we had scheduled. I know rearranging your day for this isn't nothing, and I appreciate your patience with me.`,
    serviceName,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    reason: reason || null,
    primaryCta: { label: 'Find another time', href: bookingUrl },
    closingLine: `Thank you for understanding. If you have any questions, just reply to this email and I'll get back to you personally.`,
    prefName: 'Cancellation by therapist',
  });

  const html = emailWrapper({ subject, bodyHtml, preheader: `Your ${serviceName} on ${apptWhen} can't happen. Here's how to find a new time.` });

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
