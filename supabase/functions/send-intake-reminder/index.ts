// C3  - Intake reminder
//
// Fires +24h after booking if intake still pending AND session is
// ≥48h away. Email-only for this round (SMS deferred per HK May 26).
//
// Trigger: hourly cron sweeps bookings where (now - created_at) > 24h
// AND (start_datetime - now) > 48h AND no session row exists yet for
// the booking AND no C3 already logged for this booking.
//
// Invoked manually for testing via:
//   POST /functions/v1/send-intake-reminder { booking_id }
// or by the hourly cron via POST without payload (batch mode).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logNotification } from "../_shared/notifications.ts";
import { emailWrapper, ctaButton, eyebrow, tipBox, fromFor, replyToFor, formatApptDateTime } from "../_shared/emailTemplate.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { booking_id } = await req.json().catch(() => ({}));

  // Single-booking mode (testing / event-driven) vs batch (cron)
  const bookingIds = booking_id ? [booking_id] : await findIntakePendingBookings(supabase);

  const results: any[] = [];
  for (const id of bookingIds) {
    const r = await sendForBooking(supabase, RESEND_API_KEY!, id);
    results.push({ booking_id: id, ...r });
    // Resend 5 req/sec limit: pace at 250ms
    await new Promise(r => setTimeout(r, 250));
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});

async function findIntakePendingBookings(supabase: any): Promise<string[]> {
  // bookings created 24h+ ago, session is 48h+ away, no session row yet,
  // no C3 already logged. Skip cancelled.
  const now = new Date();
  const cutoffCreated = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const cutoffFuture = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const { data: candidates } = await supabase
    .from('bookings')
    .select('id, client_id, start_date, start_time, status, created_at')
    .lte('created_at', cutoffCreated)
    .gte('start_date', cutoffFuture.toISOString().slice(0, 10))
    .not('status', 'eq', 'cancelled')
    .not('status', 'eq', 'declined')
    .limit(100);

  if (!candidates || !candidates.length) return [];

  // Filter: no session row exists, no C3 logged
  const ids = candidates.map((b: any) => b.id);
  const { data: existingSessions } = await supabase
    .from('sessions')
    .select('booking_id')
    .in('booking_id', ids);
  const hasSession = new Set((existingSessions || []).map((s: any) => s.booking_id));

  const { data: alreadyLogged } = await supabase
    .from('notification_log')
    .select('booking_id')
    .eq('notification_type', 'intake_reminder')
    .eq('audience', 'client')
    .eq('channel', 'email')
    .in('booking_id', ids);
  const alreadyFired = new Set((alreadyLogged || []).map((r: any) => r.booking_id));

  return candidates
    .filter((b: any) => !hasSession.has(b.id) && !alreadyFired.has(b.id))
    .map((b: any) => b.id);
}

async function sendForBooking(supabase: any, RESEND_KEY: string, bookingId: string) {
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, client_id, start_date, start_time, service_name, status, created_at,
      therapists(id, full_name, business_name, custom_url, email, notification_prefs, intake_reminders_enabled_at),
      clients(id, name, email, phone, sms_opted_in, unsubscribed_at)
    `)
    .eq('id', bookingId)
    .single();

  if (!booking) return { status: 'skipped', reason: 'booking_not_found' };
  if (booking.status === 'cancelled' || booking.status === 'declined') return { status: 'skipped', reason: 'cancelled' };

  const therapist = booking.therapists;
  const client = booking.clients;
  if (!client?.email) return { status: 'skipped', reason: 'no_client_email' };
  if (client.unsubscribed_at) return { status: 'skipped', reason: 'unsubscribed' };

  // HK May 26 2026 safety gate: only fire for bookings created AFTER
  // therapist opted in to intake reminders. Without this, the first
  // hourly cron after deploy would sweep every booking with a pending
  // intake across all existing therapists' client bases.
  if (!therapist?.intake_reminders_enabled_at) {
    return { status: 'skipped', reason: 'intake_reminders_not_enabled' };
  }
  const bookingCreatedAt = new Date(booking.created_at || booking.start_date).getTime();
  const enabledAt = new Date(therapist.intake_reminders_enabled_at).getTime();
  if (bookingCreatedAt < enabledAt) {
    return { status: 'skipped', reason: 'booking_predates_optin' };
  }

  const therapistName = therapist?.business_name || therapist?.full_name || 'Your therapist';
  const clientFirstName = client.name?.split(' ')[0] || 'there';
  const apptWhen = formatApptDateTime(booking.start_date, booking.start_time);
  const intakeUrl = `https://mybodymap.app/intake/${therapist.custom_url}?b=${booking.id}`;

  const subject = `A short intake before we meet, ${clientFirstName}`;

  const bodyHtml = `
    ${eyebrow('Before our session', 'sage')}
    <h1>Two minutes makes a real difference</h1>
    <p>Hi ${clientFirstName},</p>
    <p>I'm looking forward to seeing you for your <strong>${booking.service_name || 'session'}</strong> on <strong>${apptWhen}</strong>. Before then, would you fill out a short intake?</p>
    <p>It lets me know where you'd like to focus, what to avoid, and anything I should know going in. About two minutes, and it helps your time on the table go further.</p>
    ${ctaButton('Fill out my intake →', intakeUrl)}
    ${tipBox('Why this matters', `I read every intake before our session so I'm already thinking about what you need before you arrive. The more I know going in, the more attuned the session can be.`)}
    <p>If anything comes up, just reply to this email.</p>
    <p class="muted" style="font-size:13px;margin-top:18px;">- ${therapist?.full_name || therapistName}</p>
  `;

  const html = emailWrapper({ subject, bodyHtml, preheader: 'Two minutes now means more focused time on the table.' });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
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
    notification_type: 'intake_reminder',
    audience: 'client',
    channel: 'email',
    recipient: client.email,
    status,
    provider_id: data.id,
    error_message: res.ok ? null : (data.message || JSON.stringify(data)),
    subject,
  });

  return { status, email_id: data.id };
}
