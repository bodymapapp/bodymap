// supabase/functions/confirm-membership-purchase/index.ts
//
// After Stripe Checkout subscription flow returns, verifies + creates
// the member_subscriptions row + grants the first month's credits.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, respond, getSupabaseClient, loadTherapist,
  getProvider, ProviderError,
} from '../_shared/payment-provider.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      session_id, membership_id,
      therapist_id: therapistIdParam,
      client_email, client_name, client_phone,
    } = await req.json();

    if (!session_id || !membership_id) return respond({ error: 'missing_params' }, 400);

    const supabase = getSupabaseClient();
    const { data: m } = await supabase
      .from('memberships').select('*').eq('id', membership_id).single();
    if (!m) return respond({ error: 'membership_not_found' }, 404);

    const therapist_id = therapistIdParam || m.therapist_id;
    const therapist = await loadTherapist(supabase, therapist_id);

    // Stripe-only by design.
    const provider = await getProvider(therapist, 'stripe-required');

    const verified = await provider.verifyCheckout({ therapist, paymentRefId: session_id });
    if (!verified.paid) {
      return respond({ error: 'payment_not_completed', status: verified.status }, 400);
    }
    if (!verified.subscriptionId) {
      return respond({ error: 'no_subscription_returned' }, 400);
    }

    // Idempotency by subscription_id
    const { data: existing } = await supabase
      .from('member_subscriptions')
      .select('id')
      .eq('stripe_subscription_id', verified.subscriptionId)
      .maybeSingle();
    if (existing) {
      return respond({ ok: true, idempotent: true, subscription_id: existing.id });
    }

    const verifiedEmail = (verified.customerEmail || client_email || '').toLowerCase();
    let clientId: string | null = null;
    if (verifiedEmail) {
      const { data: c } = await supabase
        .from('clients').select('id')
        .eq('therapist_id', therapist_id).eq('email', verifiedEmail).maybeSingle();
      if (c) clientId = c.id;
    }

    const { data: insertedSub, error: insErr } = await supabase
      .from('member_subscriptions')
      .insert({
        therapist_id, membership_id,
        client_id: clientId,
        client_email: verifiedEmail,
        client_name: client_name || null,
        stripe_subscription_id: verified.subscriptionId,
        stripe_customer_id: verified.subscriberCustomerId || null,
        status: 'active',
        current_period_end: verified.currentPeriodEnd || null,
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

    // Audit: first credit grant
    await supabase.from('member_credit_events').insert({
      member_subscription_id: insertedSub.id,
      delta: m.monthly_session_credits,
      reason: 'monthly_grant',
    });

    return respond({ ok: true, subscription_id: insertedSub.id });

  } catch (e) {
    if (e instanceof ProviderError) {
      console.error('[confirm-membership-purchase] provider error', e.code, e.message);
      return respond({ error: e.message, code: e.code }, 400);
    }
    console.error('[confirm-membership-purchase] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
