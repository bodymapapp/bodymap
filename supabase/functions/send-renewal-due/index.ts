// T14 - Membership renewal due
//
// Fires 7 days before a membership auto-renews. Reuses the existing
// memberships table; assumes a renewal_at timestamp lives on each
// active membership row.
//
// Trigger: daily cron at 9am UTC. Finds memberships where renewal_at
// is between 6.5 and 7.5 days from now AND status is active AND no
// renewal_due email already logged for this renewal_at value.
//
// Audience: THERAPIST (per spec T14). Client-side renewal handling
// happens via their own membership management. This is the operator
// alert.

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

  const { membership_id } = await req.json().catch(() => ({}));
  const membershipIds = membership_id ? [membership_id] : await findMembershipsDueIn7Days(supabase);

  const results: any[] = [];
  for (const id of membershipIds) {
    const r = await sendForMembership(supabase, RESEND_API_KEY!, id);
    results.push({ membership_id: id, ...r });
    await new Promise(r => setTimeout(r, 250));
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});

async function findMembershipsDueIn7Days(supabase: any): Promise<string[]> {
  const now = new Date();
  const start = new Date(now.getTime() + 6.5 * 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(now.getTime() + 7.5 * 24 * 60 * 60 * 1000).toISOString();

  const { data: memberships } = await supabase
    .from('memberships')
    .select('id, renewal_at')
    .eq('status', 'active')
    .gte('renewal_at', start)
    .lte('renewal_at', end)
    .limit(500);

  if (!memberships?.length) return [];

  const ids = memberships.map((m: any) => m.id);
  // Avoid duplicate fires for the same renewal cycle. Match on
  // notification_log.reference_id = membership.id with notification_type
  // 'renewal_due' fired within last 14 days.
  const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: fired } = await supabase
    .from('notification_log')
    .select('reference_id')
    .eq('notification_type', 'renewal_due')
    .eq('audience', 'therapist')
    .in('reference_id', ids)
    .gte('created_at', cutoff);
  const firedSet = new Set((fired || []).map((r: any) => r.reference_id));

  return ids.filter((id: string) => !firedSet.has(id));
}

async function sendForMembership(supabase: any, RESEND_KEY: string, membershipId: string) {
  const { data: membership } = await supabase
    .from('memberships')
    .select(`
      id, renewal_at, price_cents, plan_name, status,
      therapists(id, full_name, business_name, custom_url, email),
      clients(id, name, email, phone)
    `)
    .eq('id', membershipId)
    .single();

  if (!membership) return { status: 'skipped', reason: 'not_found' };
  if (membership.status !== 'active') return { status: 'skipped', reason: 'not_active' };

  const therapist = membership.therapists;
  const client = membership.clients;
  if (!therapist?.email) return { status: 'skipped', reason: 'no_therapist_email' };

  const therapistName = therapist?.business_name || therapist?.full_name || 'You';
  const clientName = client?.name || 'A client';
  const renewalDate = new Date(membership.renewal_at);
  const renewalWhen = renewalDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const dashboardUrl = `https://mybodymap.app/dashboard?tab=billing`;
  const amount = membership.price_cents ? `$${(membership.price_cents / 100).toFixed(2)}` : '';

  const subject = `${clientName}'s membership renews in 7 days`;

  const facts = [
    { label: 'Client',  value: clientName },
    { label: 'Plan',    value: membership.plan_name || 'Membership' },
    { label: 'Renews',  value: renewalWhen },
  ];
  if (amount) facts.push({ label: 'Amount', value: amount });

  const bodyHtml = `
    ${eyebrow('Renewal coming up', 'gold')}
    <h1>${clientName}'s membership renews in 7 days</h1>
    <p>Heads up so you have time to confirm payment details, update plan, or have a check-in conversation before the auto-charge.</p>
    ${factBox(facts)}
    ${ctaButton('Review in your dashboard', dashboardUrl)}
    <p class="muted" style="font-size:12px;">If you've changed how membership renewals work, update the membership directly. The charge fires automatically on the renewal date.</p>
  `;

  const html = emailWrapper({ subject, bodyHtml, preheader: `${clientName} renews their ${membership.plan_name || 'membership'} on ${renewalWhen}.` });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
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
    reference_id: membership.id,
    notification_type: 'renewal_due',
    audience: 'therapist',
    channel: 'email',
    recipient: therapist.email,
    status,
    provider_id: data.id,
    error_message: res.ok ? null : (data.message || JSON.stringify(data)),
    subject,
  });

  return { status, email_id: data.id };
}
