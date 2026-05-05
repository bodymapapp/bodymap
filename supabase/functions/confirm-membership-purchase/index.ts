// supabase/functions/confirm-membership-purchase/index.ts
//
// Called after the client returns from Stripe Checkout subscription
// flow. Verifies the session is paid, fetches subscription + customer
// ids, then creates the member_subscriptions row and grants the first
// month's credits.
//
// Returns: { ok: true, subscription_id }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const respond = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });

  try {
    const { session_id, membership_id, therapist_id: therapistIdParam, client_email, client_name, client_phone } = await req.json();
    console.log('[confirm-membership-purchase] start', { session_id, membership_id });

    if (!session_id || !membership_id) return respond({ error: 'missing_params' }, 400);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !STRIPE_SECRET) return respond({ error: 'env_not_set' }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: m } = await supabase.from('memberships').select('*').eq('id', membership_id).single();
    if (!m) return respond({ error: 'membership_not_found' }, 404);
    const therapist_id = therapistIdParam || m.therapist_id;
    const { data: therapist } = await supabase.from('therapists').select('id, stripe_account_id').eq('id', therapist_id).single();
    if (!therapist?.stripe_account_id) return respond({ error: 'no_stripe_account' }, 400);

    // Verify the session
    const sRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Stripe-Account': therapist.stripe_account_id,
      },
    });
    const session = await sRes.json();
    if (!sRes.ok) return respond({ error: session.error?.message || 'verify_failed' }, 400);
    if (session.payment_status !== 'paid') return respond({ error: 'payment_not_completed', status: session.payment_status }, 400);

    const stripeSubscriptionId = session.subscription;
    const stripeCustomerId = session.customer;
    const verifiedEmail = session.customer_email || session.customer_details?.email || client_email || '';

    // Idempotency: if a subscription with this stripe_subscription_id
    // already exists, return that.
    if (stripeSubscriptionId) {
      const { data: existing } = await supabase
        .from('member_subscriptions')
        .select('id')
        .eq('stripe_subscription_id', stripeSubscriptionId)
        .maybeSingle();
      if (existing) {
        console.log('[confirm-membership-purchase] already exists', existing.id);
        return respond({ ok: true, subscription_id: existing.id, idempotent: true });
      }
    }

    // Look up client_id if a clients row exists for this email
    let clientId = null;
    if (verifiedEmail) {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('therapist_id', therapist_id)
        .eq('email', verifiedEmail.toLowerCase())
        .maybeSingle();
      if (client) clientId = client.id;
    }

    // Get sub period dates from Stripe
    let periodEnd = null;
    if (stripeSubscriptionId) {
      const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${stripeSubscriptionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET}`,
          'Stripe-Account': therapist.stripe_account_id,
        },
      });
      const sub = await subRes.json();
      if (subRes.ok && sub.current_period_end) {
        periodEnd = new Date(sub.current_period_end * 1000).toISOString();
      }
    }

    // Insert the subscription with first month's credits granted
    const { data: insertedSub, error: insErr } = await supabase
      .from('member_subscriptions')
      .insert({
        therapist_id,
        membership_id,
        client_id: clientId,
        client_email: (verifiedEmail || '').toLowerCase(),
        client_name: client_name || null,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_customer_id: stripeCustomerId,
        status: 'active',
        current_period_end: periodEnd,
        monthly_price: m.monthly_price,
        monthly_session_credits: m.monthly_session_credits,
        current_credits: m.monthly_session_credits,
      })
      .select()
      .single();

    if (insErr) {
      console.error('[confirm-membership-purchase] insert failed', insErr);
      return respond({ error: 'insert_failed: ' + insErr.message }, 500);
    }

    // Audit row for the first credit grant
    await supabase.from('member_credit_events').insert({
      member_subscription_id: insertedSub.id,
      delta: m.monthly_session_credits,
      reason: 'monthly_grant',
    });

    console.log('[confirm-membership-purchase] success', { subscription_id: insertedSub.id });
    return respond({ ok: true, subscription_id: insertedSub.id });

  } catch (e) {
    console.error('[confirm-membership-purchase] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
