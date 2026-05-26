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
      id, client_id, start_date, start_time, service_name, status,
      therapists(id, full_name, business_name, custom_url, email, notification_prefs),
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

  const therapistName = therapist?.business_name || therapist?.full_name || 'Your therapist';
  const clientFirstName = client.name?.split(' ')[0] || 'there';
  const apptWhen = formatApptDateTime(booking.start_date, booking.start_time);
  const intakeUrl = `https://mybodymap.app/intake/${therapist.custom_url}?b=${booking.id}`;

  const subject = `Quick favor before your session, ${clientFirstName}`;

  const bodyHtml = `
    ${eyebrow('Heads up', 'sage')}
    <h1>Your intake takes 2 minutes</h1>
    <p>Hi ${clientFirstName},</p>
    <p>Looking forward to seeing you for your <strong>${booking.service_name || 'session'}</strong> on <strong>${apptWhen}</strong>. Before then, would you fill out a short intake?</p>
    <p>It tells ${therapistName} where you'd like to focus, what to avoid, and anything they should know going in. It takes about 2 minutes and makes a real difference to your session.</p>
    ${ctaButton('Fill out my intake →', intakeUrl)}
    ${tipBox('Why this matters', `${therapistName} reads every intake before your session so they can prepare for what you need, not waste your time asking the same questions on the table.`)}
    <p class="muted" style="font-size:12px;">Questions? Reply to this email or contact ${therapistName} directly.</p>
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
