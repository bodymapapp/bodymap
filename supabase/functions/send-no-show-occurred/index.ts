// T12 - No-show occurred (therapist alert)
//
// Fires when the system marks a booking as no-show. Quick operational
// alert with client context and follow-up CTA. Event-driven, called
// from no-show detection cron or therapist-initiated marker.
//
// Payload: { booking_id, fee_charged?, fee_amount_cents? }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logNotification } from "../_shared/notifications.ts";
import { emailWrapper, ctaButton, eyebrow, factBox, fromFor } from "../_shared/emailTemplate.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { booking_id, fee_charged, fee_amount_cents } = await req.json().catch(() => ({}));
  if (!booking_id) return jsonErr('booking_id required', 400);

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, client_id, start_date, start_time, service_name,
      therapists(id, full_name, business_name, custom_url, email),
      clients(id, name, email, phone)
    `)
    .eq('id', booking_id)
    .single();

  if (!booking) return jsonErr('booking not found', 404);

  const therapist = booking.therapists;
  const client = booking.clients;
  if (!therapist?.email) return jsonErr('no therapist email', 200, { skipped: 'no_therapist_email' });

  const clientName = client?.name || 'A client';
  const apptDate = new Date(`${booking.start_date}T${booking.start_time}`);
  const apptWhen = apptDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + ' at ' + apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const fee = fee_amount_cents ? `$${(fee_amount_cents / 100).toFixed(2)}` : null;
  const feeStatus = fee && fee_charged === true ? `${fee} charged successfully`
    : fee && fee_charged === false ? `${fee} fee NOT charged (card declined or none on file). The client got a payment link.`
    : 'No fee applied per your policy.';

  const clientLink = client?.id
    ? `https://mybodymap.app/dashboard/clients/${client.id}`
    : `https://mybodymap.app/dashboard?tab=schedule`;

  const subject = `${clientName} was a no-show today`;

  const facts = [
    { label: 'Client',       value: clientName },
    { label: 'When',         value: apptWhen },
    { label: 'Session',      value: booking.service_name || 'Massage session' },
    { label: 'Fee status',   value: feeStatus },
  ];

  const bodyHtml = `
    ${eyebrow('No-show recorded', 'rose')}
    <h1>${clientName} did not show up</h1>
    <p>Just a quick alert so you can follow up if you'd like to.</p>
    ${factBox(facts)}
    ${ctaButton(`Open ${clientName}'s profile`, clientLink)}
    <p class="muted" style="font-size:12px;">You can adjust how the platform handles no-shows in Settings > Cancellation Policy.</p>
  `;

  const html = emailWrapper({ subject, bodyHtml, preheader: `${clientName} did not show up for ${booking.service_name || 'their session'}.` });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'MyBodyMap <hello@mybodymap.app>',
      to: [therapist.email],
      reply_to: 'support@mybodymap.app',
      subject,
      html,
    }),
  });
  const data = await res.json();
  const status = res.ok ? 'sent' : 'failed';

  await logNotification(supabase, {
    therapist_id: therapist.id,
    client_id: client?.id || null,
    booking_id: booking.id,
    notification_type: 'no_show_occurred',
    audience: 'therapist',
    channel: 'email',
    recipient: therapist.email,
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
