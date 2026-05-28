// C4  - 48 hour reminder
//
// Fires 48h before session start. Email backup to SMS C4 sibling.
// Reduces no-shows by ~15% per industry data. Critical Tier 1 fire.
//
// Trigger: hourly cron, finds bookings where start is 47.5-48.5h from
// now and no C4 already logged.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logNotification } from "../_shared/notifications.ts";
import { emailWrapper, ctaButton, eyebrow, factBox, fromFor, replyToFor, formatApptDateTime } from "../_shared/emailTemplate.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { booking_id } = await req.json().catch(() => ({}));
  const bookingIds = booking_id ? [booking_id] : await findBookingsAt48h(supabase);

  const results: any[] = [];
  for (const id of bookingIds) {
    const r = await sendForBooking(supabase, RESEND_API_KEY!, id);
    results.push({ booking_id: id, ...r });
    await new Promise(r => setTimeout(r, 250));
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});

async function findBookingsAt48h(supabase: any): Promise<string[]> {
  const now = new Date();
  // Window: 47.5h to 48.5h from now (covers one cron run, hourly)
  const windowStart = new Date(now.getTime() + 47.5 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 48.5 * 60 * 60 * 1000);

  // Pull a 2-day window so we can date-filter then narrow by start_time
  const { data: candidates } = await supabase
    .from('bookings')
    .select('id, booking_date, start_time, status')
    .gte('booking_date', windowStart.toISOString().slice(0, 10))
    .lte('booking_date', windowEnd.toISOString().slice(0, 10))
    .not('status', 'eq', 'cancelled')
    .not('status', 'eq', 'declined')
    .limit(500);

  if (!candidates) return [];

  const inWindow = candidates.filter((b: any) => {
    try {
      const t = new Date(`${b.booking_date}T${b.start_time}`).getTime();
      return t >= windowStart.getTime() && t <= windowEnd.getTime();
    } catch (_) { return false; }
  });

  if (!inWindow.length) return [];

  const ids = inWindow.map((b: any) => b.id);
  const { data: alreadyLogged } = await supabase
    .from('notification_log')
    .select('booking_id')
    .eq('notification_type', 'reminder_48h')
    .eq('audience', 'client')
    .eq('channel', 'email')
    .in('booking_id', ids);
  const fired = new Set((alreadyLogged || []).map((r: any) => r.booking_id));

  return inWindow.filter((b: any) => !fired.has(b.id)).map((b: any) => b.id);
}

async function sendForBooking(supabase: any, RESEND_KEY: string, bookingId: string) {
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, client_id, booking_date, start_time, service_id, status,
      services(name, duration),
      location:therapist_locations(name, address),
      therapists(id, full_name, business_name, custom_url, email, notification_prefs),
      clients(id, name, email, phone, outreach_unsubscribed_at)
    `)
    .eq('id', bookingId)
    .single();

  if (!booking) return { status: 'skipped', reason: 'booking_not_found' };
  if (booking.status === 'cancelled' || booking.status === 'declined') return { status: 'skipped', reason: 'cancelled' };

  const therapist = booking.therapists;
  const client = booking.clients;
  if (!client?.email) return { status: 'skipped', reason: 'no_client_email' };
  if (client.outreach_unsubscribed_at) return { status: 'skipped', reason: 'unsubscribed' };

  const serviceName = booking.services?.name || 'Massage session';
  const serviceDuration = booking.services?.duration || null;
  const locationAddr = booking.location?.address || null;
  const therapistName = therapist?.business_name || therapist?.full_name || 'Your therapist';
  const clientFirstName = client.name?.split(' ')[0] || 'there';
  const apptWhen = formatApptDateTime(booking.booking_date, booking.start_time);
  const bookingUrl = `https://mybodymap.app/book/${therapist.custom_url}`;
  const rescheduleUrl = `https://mybodymap.app/book/${therapist.custom_url}?reschedule=${booking.id}`;

  const subject = `Looking forward to seeing you, ${clientFirstName}`;

  const facts = [
    { label: 'When',     value: apptWhen },
    { label: 'Session',  value: serviceName },
  ];
  if (serviceDuration) facts.push({ label: 'Duration', value: `${serviceDuration} minutes` });
  if (locationAddr) facts.push({ label: 'Where', value: locationAddr });

  const bodyHtml = `
    ${eyebrow('Two days to go', 'sage')}
    <h1>I'm looking forward to seeing you</h1>
    <p>Hi ${clientFirstName},</p>
    <p>A gentle reminder that we have time together coming up in two days. Hopefully you've already started looking forward to it as much as I have.</p>
    ${factBox(facts)}
    <p>If life has shifted and the timing no longer works, you can move things around from the link below. No worries either way.</p>
    <p style="text-align:center;margin:18px 0 8px;">
      <a href="${rescheduleUrl}" style="display:inline-block;color:#2A5741;text-decoration:underline;font-size:14px;font-weight:600;">Need to reschedule? →</a>
    </p>
    <p>See you soon.</p>
    <p class="muted" style="font-size:13px;margin-top:18px;">- ${therapist?.full_name || therapistName}</p>
  `;

  const html = emailWrapper({ subject, bodyHtml, preheader: `Your ${serviceName || 'session'} is two days away.` });

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
    notification_type: 'reminder_48h',
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
