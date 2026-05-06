// supabase/functions/confirm-membership-purchase/index.ts
//
// After hosted checkout returns, verifies + creates the
// member_subscriptions row + grants the first month's credits.
// Works with both Stripe and Square subscription flows.
//
// Stripe flow:
//   - One Checkout Session in 'subscription' mode
//   - verifyCheckout returns subscriptionId + customerId + period_end
//     all in one call
//   - Insert member_subscriptions row directly
//
// Square flow (more involved per the capability matrix's 'limited'
// declaration):
//   - First month was paid via a regular Payment Link (not a sub)
//   - Square's Catalog plan_variation_id was created in Chunk α and
//     persisted on memberships.square_plan_variation_id
//   - We get the Square customer_id from the redirect URL params
//     (passed through by SquareV1.createSubscriptionLink)
//   - Real recurring billing requires a saved card on the customer
//     plus an actual Subscription resource. For tonight, we
//     RECORD the membership as active for the first month (paid
//     up front) and flag that the recurring renewal needs the
//     therapist to ensure the client has a card on file (we'll
//     prompt this in the UI).
//   - This is the documented limitation in the capability matrix:
//     'no automatic proration, weaker dunning'. Recurring
//     renewals on Square will be handled in a follow-up commit.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, respond, getSupabaseClient, loadTherapist,
  getProvider, ProviderError,
} from '../_shared/payment-provider.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      session_id,         // Stripe checkout session id
      order_id,           // Square order id
      processor,          // 'stripe' | 'square' from redirect params
      plan_variation_id,  // Square: from redirect params (created in createSubscriptionLink)
      customer_id,        // Square: from redirect params (Square customer id)
      start_date,         // Square: from redirect params
      membership_id,
      therapist_id: therapistIdParam,
      client_email, client_name, client_phone,
    } = await req.json();

    if (!membership_id) return respond({ error: 'membership_id required' }, 400);
    if (!session_id && !order_id) return respond({ error: 'session_id or order_id required' }, 400);

    const supabase = getSupabaseClient();
    const { data: m } = await supabase
      .from('memberships').select('*').eq('id', membership_id).single();
    if (!m) return respond({ error: 'membership_not_found' }, 404);

    const therapist_id = therapistIdParam || m.therapist_id;
    const therapist = await loadTherapist(supabase, therapist_id);

    // Pick provider explicitly when caller tells us, else auto.
    let provider;
    if (processor === 'square') {
      const { SquareProvider } = await import('../_shared/providers/square.ts');
      provider = new SquareProvider(therapist);
    } else if (processor === 'stripe') {
      provider = await getProvider(therapist, 'stripe-required');
    } else {
      provider = await getProvider(therapist, 'auto');
    }

    const paymentRefId = processor === 'square' ? order_id : session_id;
    const verified = await provider.verifyCheckout({ therapist, paymentRefId });
    if (!verified.paid) {
      return respond({ error: 'payment_not_completed', status: verified.status }, 400);
    }

    const verifiedEmail = (verified.customerEmail || client_email || '').toLowerCase();
    let clientId: string | null = null;
    if (verifiedEmail) {
      const { data: c } = await supabase
        .from('clients').select('id')
        .eq('therapist_id', therapist_id).eq('email', verifiedEmail).maybeSingle();
      if (c) clientId = c.id;
    }

    // ─── STRIPE PATH ─────────────────────────────────────────────────
    if (processor === 'stripe' || (!processor && verified.subscriptionId)) {
      if (!verified.subscriptionId) {
        return respond({ error: 'no_subscription_returned' }, 400);
      }

      // Idempotency by subscription_id
      const { data: existing } = await supabase
        .from('member_subscriptions').select('id')
        .eq('stripe_subscription_id', verified.subscriptionId).maybeSingle();
      if (existing) {
        return respond({ ok: true, idempotent: true, subscription_id: existing.id });
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
          processor: 'stripe',
        })
        .select()
        .single();

      if (insErr) {
        console.error('[confirm-membership-purchase] stripe insert failed', insErr);
        return respond({ error: 'insert_failed: ' + insErr.message }, 500);
      }

      await supabase.from('member_credit_events').insert({
        member_subscription_id: insertedSub.id,
        delta: m.monthly_session_credits,
        reason: 'monthly_grant',
      });

      return respond({ ok: true, subscription_id: insertedSub.id, processor: 'stripe' });
    }

    // ─── SQUARE PATH ─────────────────────────────────────────────────
    // First month is paid. Record the subscription locally as active.
    // Recurring renewals on Square require additional setup (saved
    // card, Subscription resource creation, webhook for renewal
    // events) which is documented in the capability matrix as
    // 'limited' and will be wired in a follow-up commit when needed.
    //
    // For now: the membership is active for the current month (paid
    // up front), credits granted, end date set 30 days out. The
    // therapist gets a manual reminder before period_end to renew
    // the client's billing.

    // Idempotency by order_id (Square's stable reference)
    const idempotencyMarker = `square-sub-${order_id}`;
    const { data: existing } = await supabase
      .from('member_subscriptions').select('id')
      .eq('square_subscription_id', idempotencyMarker).maybeSingle();
    if (existing) {
      return respond({ ok: true, idempotent: true, subscription_id: existing.id });
    }

    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    const { data: insertedSub, error: insErr } = await supabase
      .from('member_subscriptions')
      .insert({
        therapist_id, membership_id,
        client_id: clientId,
        client_email: verifiedEmail,
        client_name: client_name || null,
        // Use the idempotency marker so this row links back to the
        // checkout that created it. Real Square Subscription id will
        // be persisted when recurring billing is wired up.
        square_subscription_id: idempotencyMarker,
        square_customer_id: customer_id || null,
        square_plan_variation_id: plan_variation_id || m.square_plan_variation_id || null,
        status: 'active',
        current_period_end: periodEnd.toISOString(),
        monthly_price: m.monthly_price,
        monthly_session_credits: m.monthly_session_credits,
        current_credits: m.monthly_session_credits,
        processor: 'square',
      })
      .select()
      .single();

    if (insErr) {
      console.error('[confirm-membership-purchase] square insert failed', insErr);
      return respond({ error: 'insert_failed: ' + insErr.message }, 500);
    }

    await supabase.from('member_credit_events').insert({
      member_subscription_id: insertedSub.id,
      delta: m.monthly_session_credits,
      reason: 'monthly_grant',
    });

    return respond({
      ok: true,
      subscription_id: insertedSub.id,
      processor: 'square',
      // Hint for the UI: Square memberships need follow-up for
      // recurring billing. UI shows this as a banner on the
      // membership detail row.
      requires_renewal_setup: true,
    });

  } catch (e) {
    if (e instanceof ProviderError) {
      console.error('[confirm-membership-purchase] provider error', e.code, e.message);
      return respond({ error: e.message, code: e.code }, 400);
    }
    console.error('[confirm-membership-purchase] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
