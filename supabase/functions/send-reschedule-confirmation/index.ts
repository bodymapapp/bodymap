// C10  - Reschedule confirmation
//
// Fires immediately when a booking is rescheduled (date/time changes
// while booking remains active). Replaces silent change with a clear
// trust-preserving update.
//
// Trigger: event-driven. Called when booking.start_date or
// booking.start_time changes via update flow.
//
// Payload:
//   { booking_id, prev_date, prev_time }
//   prev_date / prev_time describe the OLD slot for context.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logNotification } from "../_shared/notifications.ts";
import { emailWrapper, eyebrow, factBox, fromFor, replyToFor, formatApptDateTime } from "../_shared/emailTemplate.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { booking_id, prev_date, prev_time } = await req.json().catch(() => ({}));
  if (!booking_id) {
    return new Response(JSON.stringify({ error: 'booking_id required' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, client_id, booking_date, start_time, service_id,
      services(name, duration),
      location:therapist_locations(name, address),
      therapists(id, full_name, business_name, custom_url, email, notification_prefs),
      clients(id, name, email, phone, outreach_unsubscribed_at)
    `)
    .eq('id', booking_id)
    .single();

  if (!booking) return jsonErr('booking not found', 404);

  const therapist = booking.therapists;
  const client = booking.clients;
  if (!client?.email) return jsonErr('no client email', 200, { skipped: 'no_client_email' });
  if (client.outreach_unsubscribed_at) return jsonErr('unsubscribed', 200, { skipped: 'unsubscribed' });

  const serviceName = booking.services?.name || 'Massage session';
  const serviceDuration = booking.services?.duration || null;
  const locationAddr = booking.location?.address || null;
  const therapistName = therapist?.business_name || therapist?.full_name || 'Your therapist';
  const clientFirstName = client.name?.split(' ')[0] || 'there';
  const newWhen = formatApptDateTime(booking.booking_date, booking.start_time);
  const prevWhen = (prev_date && prev_time) ? formatApptDateTime(prev_date, prev_time) : null;
  const rescheduleUrl = `https://mybodymap.app/book/${therapist.custom_url}?reschedule=${booking.id}`;

  const subject = `New time for your session, ${clientFirstName}`;

  const facts = [
    { label: 'New time', value: newWhen },
    { label: 'Session',  value: serviceName },
  ];
  if (serviceDuration) facts.push({ label: 'Duration', value: `${serviceDuration} minutes` });
  if (locationAddr) facts.push({ label: 'Where', value: locationAddr });
  if (prevWhen) facts.push({ label: 'Previously', value: prevWhen });

  const bodyHtml = `
    ${eyebrow('Rescheduled', 'gold')}
    <h1>Your session has a new time</h1>
    <p>Hi ${clientFirstName},</p>
    <p>Confirming that we've moved your session to a new time. Here are the new details:</p>
    ${factBox(facts)}
    <p>I'll send a reminder 48 hours before. If this new time doesn't quite work either, you can move it again from the link below.</p>
    <p style="text-align:center;margin:18px 0 8px;">
      <a href="${rescheduleUrl}" style="display:inline-block;color:#2A5741;text-decoration:underline;font-size:14px;font-weight:600;">Need to change it again? →</a>
    </p>
    <p>See you soon.</p>
    <p class="muted" style="font-size:13px;margin-top:18px;">- ${therapist?.full_name || therapistName}</p>
  `;

  const html = emailWrapper({ subject, bodyHtml, preheader: `Your session is now ${newWhen}.` });

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
    notification_type: 'reschedule_confirmation',
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
