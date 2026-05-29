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

  // HK May 29 2026: param was 'membership_id' historically but the
  // function now operates on member_subscription rows. Accept both
  // names for backward compat with any external callers.
  const body = await req.json().catch(() => ({}));
  const subscription_id = body.subscription_id || body.membership_id || null;
  const subscriptionIds = subscription_id ? [subscription_id] : await findMembershipsDueIn7Days(supabase);

  const results: any[] = [];
  for (const id of subscriptionIds) {
    const r = await sendForMembership(supabase, RESEND_API_KEY!, id);
    results.push({ subscription_id: id, ...r });
    await new Promise(r => setTimeout(r, 250));
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});

async function findMembershipsDueIn7Days(supabase: any): Promise<string[]> {
  // HK May 29 2026: was querying `memberships` (the template/offering
  // table) which has no renewal_at, client_id, or price_cents columns.
  // Real renewals live on `member_subscriptions` with current_period_end.
  // memberships is just the catalog of plans the therapist sells;
  // member_subscriptions is each customer's active subscription.
  const now = new Date();
  const start = new Date(now.getTime() + 6.5 * 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(now.getTime() + 7.5 * 24 * 60 * 60 * 1000).toISOString();

  const { data: subs } = await supabase
    .from('member_subscriptions')
    .select('id, current_period_end')
    .eq('status', 'active')
    .gte('current_period_end', start)
    .lte('current_period_end', end)
    .limit(500);

  if (!subs?.length) return [];

  const ids = subs.map((s: any) => s.id);
  // Avoid duplicate fires within a 14-day window.
  const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: fired } = await supabase
    .from('notification_log')
    .select('reference_id')
    .eq('notification_type', 'renewal_due')
    .eq('audience', 'therapist')
    .in('reference_id', ids)
    .gte('sent_at', cutoff);
  const firedSet = new Set((fired || []).map((r: any) => r.reference_id));

  return ids.filter((id: string) => !firedSet.has(id));
}

async function sendForMembership(supabase: any, RESEND_KEY: string, subscriptionId: string) {
  // HK May 29 2026: subscriptionId, not membershipId. The caller now
  // hands us a member_subscriptions.id. Join to memberships to get the
  // plan name + price for the email body.
  const { data: sub } = await supabase
    .from('member_subscriptions')
    .select(`
      id, current_period_end, monthly_price, status, processor,
      client_name, client_email,
      memberships(id, name, monthly_price),
      therapists(id, full_name, business_name, custom_url, email, renewal_alerts_enabled_at),
      clients(id, name, email, phone)
    `)
    .eq('id', subscriptionId)
    .single();

  if (!sub) return { status: 'skipped', reason: 'not_found' };
  if (sub.status !== 'active') return { status: 'skipped', reason: 'not_active' };

  const membership = sub as any;
  const therapist = membership.therapists;
  const client = membership.clients;
  if (!therapist?.email) return { status: 'skipped', reason: 'no_therapist_email' };

  // HK May 26 2026 safety gate: don't fire renewal alerts for
  // memberships that existed before therapist opted in.
  if (!therapist.renewal_alerts_enabled_at) {
    return { status: 'skipped', reason: 'renewal_alerts_not_enabled' };
  }
  const enabledAt = new Date(therapist.renewal_alerts_enabled_at).getTime();
  // membership.created_at no longer exists on sub. Fall back to current_period_end
  // for the safety gate so we don't fire on subs that pre-existed opt-in.
  const subCreatedAt = (membership as any).created_at ? new Date((membership as any).created_at).getTime() : Date.now();
  if (subCreatedAt < enabledAt) {
    return { status: 'skipped', reason: 'subscription_predates_optin' };
  }

  const therapistName = therapist?.business_name || therapist?.full_name || 'You';
  const clientName = client?.name || membership.client_name || 'A client';
  const renewalDate = new Date(membership.current_period_end);
  const renewalWhen = renewalDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const dashboardUrl = `https://mybodymap.app/dashboard?tab=billing`;
  const monthlyCents = membership.monthly_price || (membership.memberships?.monthly_price) || 0;
  const amount = monthlyCents > 0 ? `$${(monthlyCents / 100).toFixed(2)}` : '';
  const planName = membership.memberships?.name || 'Membership';

  const subject = `${clientName}'s membership renews in 7 days`;

  const facts = [
    { label: 'Client',  value: clientName },
    { label: 'Plan',    value: planName },
    { label: 'Renews',  value: renewalWhen },
  ];
  if (amount) facts.push({ label: 'Amount', value: amount });

  const bodyHtml = `
    ${eyebrow('Renewal coming up', 'gold')}
    <h1>${clientName}'s membership renews in 7 days</h1>
    <p>Heads up so you have time to confirm payment details, update the plan, or have a check-in conversation before the auto-charge.</p>
    ${factBox(facts)}
    ${ctaButton('Review in your dashboard', dashboardUrl)}
    <p class="muted" style="font-size:12px;">No action needed if everything is in order. The renewal charge will fire automatically on ${renewalWhen}. If anything needs to change before then, open the membership in your dashboard.</p>
  `;

  const html = emailWrapper({ subject, bodyHtml, preheader: `${clientName} renews their ${planName} on ${renewalWhen}.` });

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
