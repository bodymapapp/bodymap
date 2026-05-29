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

  const payload = await req.json().catch(() => ({}));
  const { booking_id, prev_date, prev_time } = payload;
  if (!booking_id) {
    return new Response(JSON.stringify({ error: 'booking_id required' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // HK May 29 2026: every early-exit path now logs to notification_log
  // with an explanatory skip reason. Previously a missing email, an
  // unsubscribe flag, or a thrown exception inside renderClientEmail
  // would leave NO trace in the database, making reschedule-email
  // regressions impossible to diagnose without invoking the function
  // by hand. The function logged for 12 days between May 17 and May 29
  // because of exactly this pattern.
  const logSkip = async (reason: string, errorDetail: string | null = null) => {
    try {
      await logNotification(supabase, {
        therapist_id: null,
        client_id: null,
        booking_id,
        notification_type: 'reschedule_confirmation',
        audience: 'client',
        channel: 'email',
        recipient: null,
        status: 'skipped',
        provider_id: null,
        error_message: errorDetail ? `${reason}: ${errorDetail}` : reason,
        subject: null,
      });
    } catch (_e) { /* logging itself failed; nothing more we can do */ }
  };

  try {
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select(`
        id, client_id, booking_date, start_time, service_id,
        services(name, duration),
        location:therapist_locations(name, street1, street2, city, state, postal_code),
        therapists(id, full_name, business_name, custom_url, email, notification_prefs),
        clients(id, name, email, phone, outreach_unsubscribed_at)
      `)
      .eq('id', booking_id)
      .single();

    if (bErr || !booking) {
      await logSkip('booking_query_failed', bErr?.message || 'no rows');
      return jsonErr('booking not found', 404);
    }

    const therapist = booking.therapists;
    const client = booking.clients;
    if (!client?.email) {
      await logSkip('no_client_email');
      return jsonErr('no client email', 200, { skipped: 'no_client_email' });
    }
    if (client.outreach_unsubscribed_at) {
      await logSkip('unsubscribed');
      return jsonErr('unsubscribed', 200, { skipped: 'unsubscribed' });
    }

  const serviceName = booking.services?.name || 'Massage session';
  const serviceDuration = booking.services?.duration || null;
  const loc = booking.location; const locationAddr = loc ? [loc.street1, loc.street2, [loc.city, loc.state].filter(Boolean).join(", "), loc.postal_code].filter(Boolean).join(", ") : null;
  const therapistFirst = (therapist?.full_name || therapist?.business_name || 'Your therapist').split(' ')[0];
  const clientFirstName = client.name?.split(' ')[0] || 'there';
  const newWhen = formatApptDateTime(booking.booking_date, booking.start_time);
  const rescheduleUrl = `https://mybodymap.app/book/${therapist.custom_url}?reschedule=${booking.id}`;

  // HK May 29 2026: per EMAIL_COPY_SPEC C10. Calm, helpful, new+old time
  // both visible, single CTA to view/change again.
  const subject = `Your session has been moved to ${newWhen}`;

  const bodyHtml = renderClientEmail({
    therapist,
    toneEyebrow: 'Session rescheduled',
    toneEyebrowKind: 'gold',
    title: `Your session is now ${newWhen.split(' at ')[0]}`,
    opener: `Hi ${clientFirstName}, your ${serviceName} with ${therapistFirst} has been moved to a new time. Here are the new details.`,
    serviceName,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    durationMin: serviceDuration,
    locationAddress: locationAddr,
    previousDate: prev_date || null,
    previousTime: prev_time || null,
    primaryCta: { label: 'View or change again', href: rescheduleUrl },
    closingLine: `See you then.`,
    prefName: 'Booking rescheduled',
  });

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
  } catch (e) {
    // Last-resort catch. If anything thrown above (renderClientEmail
    // crash, Resend network failure, etc) bubbles past every other
    // handler, we still log a skipped row so the regression is
    // visible in notification_log. Returns 500 so the caller in
    // notify-booking-event sees a failed allSettled result in its
    // logs.
    const msg = String(e?.message || e);
    await logSkip('uncaught_exception', msg);
    return jsonErr('uncaught exception', 500, { detail: msg });
  }
});

function jsonErr(msg: string, code: number = 400, extra: any = {}) {
  return new Response(JSON.stringify({ error: msg, ...extra }), {
    status: code, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
