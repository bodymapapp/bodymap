// C14 - First lapse nudge
//
// Fires for clients with no booking in 45+ days but who have at least
// one prior booking (returning client gone quiet). Warm, no pressure.
// Industry data: 12% retention bump from lapse nudges.
//
// Defaults: ON for all therapists. Therapist can opt out via Settings.
//
// Trigger: daily cron at 10am UTC. Finds clients matching the window
// who have not received a C14 in the prior 60 days.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logNotification } from "../_shared/notifications.ts";
import { fromFor, replyToFor } from "../_shared/emailTemplate.ts";
import { renderClientEmailDoc } from "../_shared/clientEmail.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { client_id } = await req.json().catch(() => ({}));
  const clientIds = client_id ? [client_id] : await findLapsedClients(supabase);

  const results: any[] = [];
  for (const id of clientIds) {
    const r = await sendForClient(supabase, RESEND_API_KEY!, id);
    results.push({ client_id: id, ...r });
    await new Promise(r => setTimeout(r, 250));
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});

async function findLapsedClients(supabase: any): Promise<string[]> {
  const now = new Date();
  // Window: 45-50 days since last booking (5-day cron-safe window)
  const windowStart = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const windowEnd = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Find recent bookings in the window. From these, the most recent
  // booking per client gives us 'last booking date'.
  const { data: recent } = await supabase
    .from('bookings')
    .select('client_id, booking_date')
    .gte('booking_date', windowStart)
    .lte('booking_date', windowEnd)
    .not('status', 'eq', 'cancelled')
    .not('status', 'eq', 'declined')
    .order('booking_date', { ascending: false })
    .limit(2000);

  if (!recent?.length) return [];

  // Group by client, take most recent
  const lastByClient = new Map<string, string>();
  for (const r of recent) {
    if (!lastByClient.has(r.client_id)) lastByClient.set(r.client_id, r.booking_date);
  }

  const candidateIds = Array.from(lastByClient.keys());
  if (!candidateIds.length) return [];

  // Filter out clients with ANY booking after windowStart (i.e. they
  // came back). This filters out clients whose latest booking was
  // older than 45 days but who have a fresh one we missed.
  const cutoff = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: fresher } = await supabase
    .from('bookings')
    .select('client_id')
    .in('client_id', candidateIds)
    .gt('booking_date', cutoff)
    .not('status', 'eq', 'cancelled')
    .not('status', 'eq', 'declined')
    .limit(2000);
  const stillFresh = new Set((fresher || []).map((r: any) => r.client_id));
  const lapsedIds = candidateIds.filter(id => !stillFresh.has(id));

  if (!lapsedIds.length) return [];

  // Dedup: skip clients who got C14 in the last 60 days
  const recentCutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: fired } = await supabase
    .from('notification_log')
    .select('client_id')
    .eq('notification_type', 'lapse_nudge')
    .eq('audience', 'client')
    .eq('channel', 'email')
    .in('client_id', lapsedIds)
    .gte('created_at', recentCutoff);
  const firedSet = new Set((fired || []).map((r: any) => r.client_id));

  return lapsedIds.filter(id => !firedSet.has(id));
}

async function sendForClient(supabase: any, RESEND_KEY: string, clientId: string) {
  const { data: client } = await supabase
    .from('clients')
    .select(`
      id, name, email, therapist_id, outreach_unsubscribed_at,
      therapists(id, full_name, business_name, custom_url, email, notification_prefs, lapse_checkins_enabled_at)
    `)
    .eq('id', clientId)
    .single();

  if (!client) return { status: 'skipped', reason: 'client_not_found' };
  if (!client.email) return { status: 'skipped', reason: 'no_client_email' };
  if (client.outreach_unsubscribed_at) return { status: 'skipped', reason: 'unsubscribed' };

  const therapist = client.therapists;

  // HK May 26 2026: SAFETY GATE so this never sweeps retroactive
  // emails into existing therapists' client bases. The lapse cron
  // ONLY fires when:
  //   1. therapist.lapse_checkins_enabled_at is non-null (therapist
  //      explicitly turned this on in Settings)
  //   2. The client's last booking was AFTER that enabled timestamp
  //      (so we only fire on lapses that happened AFTER opt-in,
  //      never on historical lapses)
  // Without this check, the first cron run after deployment would
  // blast every lapsed client across Terra/Candice/Jacquie/Joy with
  // a 'thinking of you' email they did not opt in to receive.
  if (!therapist?.lapse_checkins_enabled_at) {
    return { status: 'skipped', reason: 'lapse_checkins_not_enabled' };
  }
  // Find the client's most recent booking to compare against the
  // enabled-at gate.
  const { data: lastBooking } = await supabase
    .from('bookings')
    .select('booking_date')
    .eq('client_id', clientId)
    .not('status', 'eq', 'cancelled')
    .not('status', 'eq', 'declined')
    .order('booking_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastBooking?.booking_date) {
    const lastBookingTs = new Date(`${lastBooking.booking_date}T00:00:00Z`).getTime();
    const enabledTs = new Date(therapist.lapse_checkins_enabled_at).getTime();
    if (lastBookingTs < enabledTs) {
      return { status: 'skipped', reason: 'last_booking_predates_optin' };
    }
  }

  // Respect therapist opt-out. Default is ON once enabled, only skip if explicitly off.
  if (therapist?.notification_prefs?.client?.lapse_nudge?.email === false) {
    return { status: 'skipped', reason: 'therapist_opted_out' };
  }

  const therapistFirst = (therapist?.full_name || therapist?.business_name || 'Your therapist').split(' ')[0];
  const clientFirstName = client.name?.split(' ')[0] || 'there';
  const bookingUrl = `https://mybodymap.app/book/${therapist.custom_url}`;

  // HK May 29 2026: per EMAIL_COPY_SPEC C14. Soft, never salesy.
  // Targeted nudge recovers ~18% (per chat 16 retention rationale).
  const subject = `Saving a spot for you this week, ${clientFirstName}`;

  const html = renderClientEmailDoc(subject, {
    therapist,
    toneEyebrow: 'A warm hello',
    toneEyebrowKind: 'sage',
    title: `Thinking of you, ${clientFirstName}`,
    opener: `It's been a few weeks since your last session. No pressure, just wanted to check in and let you know I'm here whenever you're ready. Life gets full; when the body starts asking for some attention, a session can help reset things.`,
    primaryCta: { label: 'Pick a time that works', href: bookingUrl },
    closingLine: `If you'd rather not get these check-ins, you can unsubscribe at the link below. No hard feelings.`,
    prefName: 'Lapse nudge',
  }, `${therapistFirst} is here when you're ready.`);

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
    notification_type: 'lapse_nudge',
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
