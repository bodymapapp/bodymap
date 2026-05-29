// C15 - Final lapse nudge
//
// Fires for clients with no booking in 90+ days who already received
// C14. Final warm goodbye. After this we stop, never spam again.
// Industry data: a respectful final reach earns goodwill + sometimes
// reactivation.
//
// Defaults: ON for all therapists (same therapist opt-out applies).
//
// Trigger: daily cron at 10:30am UTC (after C14 cron).

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
  const clientIds = client_id ? [client_id] : await findFinalLapseClients(supabase);

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

async function findFinalLapseClients(supabase: any): Promise<string[]> {
  const now = new Date();
  // Window: 90-95 days since last booking (5-day cron-safe window)
  const windowStart = new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const windowEnd = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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

  const lastByClient = new Map<string, string>();
  for (const r of recent) {
    if (!lastByClient.has(r.client_id)) lastByClient.set(r.client_id, r.booking_date);
  }
  const candidateIds = Array.from(lastByClient.keys());
  if (!candidateIds.length) return [];

  // Filter out clients with ANY booking after 90 day cutoff (came back)
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: fresher } = await supabase
    .from('bookings')
    .select('client_id')
    .in('client_id', candidateIds)
    .gt('booking_date', cutoff)
    .not('status', 'eq', 'cancelled')
    .not('status', 'eq', 'declined')
    .limit(2000);
  const stillFresh = new Set((fresher || []).map((r: any) => r.client_id));
  const trulyLapsed = candidateIds.filter(id => !stillFresh.has(id));

  if (!trulyLapsed.length) return [];

  // Dedup: never send C15 twice EVER (it's the final), and only send
  // if C14 was sent in the past (no point in skipping straight to final).
  const { data: c15Fired } = await supabase
    .from('notification_log')
    .select('client_id')
    .eq('notification_type', 'lapse_final_nudge')
    .eq('audience', 'client')
    .eq('channel', 'email')
    .in('client_id', trulyLapsed);
  const c15Set = new Set((c15Fired || []).map((r: any) => r.client_id));

  const { data: c14Fired } = await supabase
    .from('notification_log')
    .select('client_id')
    .eq('notification_type', 'lapse_nudge')
    .eq('audience', 'client')
    .eq('channel', 'email')
    .in('client_id', trulyLapsed);
  const c14Set = new Set((c14Fired || []).map((r: any) => r.client_id));

  return trulyLapsed.filter(id => !c15Set.has(id) && c14Set.has(id));
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

  // Safety gate: only fire if therapist opted in and the lapse
  // started after opt-in. Same pattern as C14. Inherits the C14
  // history check already in findFinalLapseClients() so if C14 was
  // never sent (because gate blocked it), C15 also will not.
  if (!therapist?.lapse_checkins_enabled_at) {
    return { status: 'skipped', reason: 'lapse_checkins_not_enabled' };
  }

  if (therapist?.notification_prefs?.client?.lapse_final_nudge?.email === false) {
    return { status: 'skipped', reason: 'therapist_opted_out' };
  }

  const therapistFirst = (therapist?.full_name || therapist?.business_name || 'Your therapist').split(' ')[0];
  const businessName = therapist?.business_name || therapist?.full_name || 'Your therapist';
  const clientFirstName = client.name?.split(' ')[0] || 'there';
  const bookingUrl = `https://mybodymap.app/book/${therapist.custom_url}`;

  // HK May 29 2026: per EMAIL_COPY_SPEC C15. Warm, gentle goodbye,
  // NOT guilt-trip. Final touchpoint after C14 got no response.
  const subject = `Thinking of you, ${clientFirstName}`;

  const html = renderClientEmailDoc(subject, {
    therapist,
    toneEyebrow: 'Open door',
    toneEyebrowKind: 'sage',
    title: `Thinking of you, ${clientFirstName}`,
    opener: `This is the last check-in I'll send. I wanted you to know that the door at ${businessName} stays open for you, whenever you're ready, no matter how long it's been. If life has taken you in a different direction, no hard feelings.`,
    primaryCta: { label: 'Book if you want', href: bookingUrl },
    closingLine: `Wishing you well, whatever season you're in. You won't get any more check-in emails like this from me. The booking link above always works if you ever want to come back.`,
    prefName: 'Lapse final goodbye',
  }, `${therapistFirst} is here whenever you're ready.`);

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
    notification_type: 'lapse_final_nudge',
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
