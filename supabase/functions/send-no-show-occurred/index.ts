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
  const clientFirstName = clientName.split(' ')[0];
  const apptDate = new Date(`${booking.start_date}T${booking.start_time}`);
  const apptWhen = apptDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + ' at ' + apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const fee = fee_amount_cents ? `$${(fee_amount_cents / 100).toFixed(2)}` : null;

  // Build the fee status block: separate visual treatment depending
  // on outcome so the therapist sees at a glance what happened with
  // the money.
  let feeStatusHtml = '';
  if (fee && fee_charged === true) {
    feeStatusHtml = `
      <div style="background:#EEF3EE;border-radius:10px;padding:12px 16px;margin:14px 0;border-left:3px solid #6B9E80;">
        <div style="font-size:11px;font-weight:700;color:#2A5741;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Fee captured</div>
        <div style="font-size:15px;color:#1F2937;font-weight:600;">${fee} charged to ${clientFirstName}'s card on file</div>
        <div style="font-size:12px;color:#6B7F72;margin-top:4px;">${clientFirstName} got a receipt and a warm note from you.</div>
      </div>`;
  } else if (fee && fee_charged === false) {
    feeStatusHtml = `
      <div style="background:#FAF3DC;border-radius:10px;padding:12px 16px;margin:14px 0;border-left:3px solid #C9A84C;">
        <div style="font-size:11px;font-weight:700;color:#92660E;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Payment pending</div>
        <div style="font-size:15px;color:#1F2937;font-weight:600;">${fee} could not be charged automatically</div>
        <div style="font-size:12px;color:#6B7F72;margin-top:4px;">We sent ${clientFirstName} a payment link, and a warm note from you with it.</div>
      </div>`;
  } else {
    feeStatusHtml = `
      <div style="background:#FAFAF7;border-radius:10px;padding:12px 16px;margin:14px 0;border-left:3px solid #6B7F72;">
        <div style="font-size:11px;font-weight:700;color:#6B7F72;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">No fee applied</div>
        <div style="font-size:15px;color:#1F2937;font-weight:600;">Your policy did not charge for this no-show</div>
        <div style="font-size:12px;color:#6B7F72;margin-top:4px;">${clientFirstName} did not receive a charge or payment request.</div>
      </div>`;
  }

  const clientLink = client?.id
    ? `https://mybodymap.app/dashboard/clients/${client.id}`
    : `https://mybodymap.app/dashboard?tab=schedule`;

  const subject = `${clientName} did not make it today`;

  const bodyHtml = `
    ${eyebrow('No-show', 'rose')}
    <h1>${clientName} did not show up</h1>
    <p>Their <strong>${booking.service_name || 'session'}</strong> was scheduled for <strong>${apptWhen}</strong>.</p>
    ${feeStatusHtml}
    <p>If you'd like to reach out personally, here's their profile:</p>
    ${ctaButton(`Open ${clientFirstName}'s profile`, clientLink)}
    <p class="muted" style="font-size:12px;">You can change how the platform handles no-shows in Settings, Cancellation Policy.</p>
  `;

  const html = emailWrapper({ subject, bodyHtml, preheader: `${clientName} did not show up for ${booking.service_name || 'their session'}. Fee status inside.` });

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
