// supabase/functions/refund-purchase/index.ts
//
// Refund a package purchase. Uses PaymentProvider.refund() which works
// for both Stripe and Square via the abstraction we built.
//
// Scope: package_purchases only. Memberships are recurring and the
// honest interpretation of 'refund a membership' is 'cancel the
// subscription' — that's a separate endpoint and a different button.
//
// Idempotency: if the package_purchases row already has a refund_id,
// we return that instead of calling the provider again. So
// double-clicking the button is safe.
//
// Audit: stores refund_id, refunded_at, refund_amount_cents,
// refunded_by (the auth user id of the therapist) on the row. Status
// transitions to 'refunded'.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, respond, getSupabaseClient, loadTherapist,
  getProvider, ProviderError,
} from '../_shared/payment-provider.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { purchase_id, therapist_id, refunded_by } = await req.json();

    if (!purchase_id) return respond({ error: 'purchase_id required' }, 400);
    if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);

    const supabase = getSupabaseClient();

    // Load the purchase. Verify it belongs to this therapist (defense
    // against a therapist trying to refund someone else's purchase via
    // a forged purchase_id).
    const { data: purchase } = await supabase
      .from('package_purchases')
      .select('*')
      .eq('id', purchase_id)
      .eq('therapist_id', therapist_id)
      .single();

    if (!purchase) {
      return respond({ error: 'purchase_not_found_or_not_yours' }, 404);
    }

    // Already refunded? Return idempotent success.
    if (purchase.refund_id) {
      console.log('[refund-purchase] already refunded, returning idempotent', purchase.refund_id);
      return respond({
        ok: true, idempotent: true,
        refund_id: purchase.refund_id,
        amount_cents: purchase.refund_amount_cents,
      });
    }

    if (!purchase.stripe_payment_id) {
      return respond({ error: 'purchase has no payment_ref to refund against' }, 400);
    }

    // Determine the original amount (in cents) — our purchases store
    // price_paid as a numeric in dollars, so multiply.
    const amountCents = Math.round(Number(purchase.price_paid) * 100);
    if (!amountCents || amountCents <= 0) {
      return respond({ error: 'no_amount_to_refund' }, 400);
    }

    const therapist = await loadTherapist(supabase, therapist_id);
    const provider = await getProvider(therapist, 'auto');

    // Idempotency key: stable across retries. If the provider charged
    // a refund attempt and this function lost connection before
    // marking the row, a retry uses the same key and provider
    // returns the same refund.
    const idempotencyKey = `refund-pkg-${purchase.id}`;

    const result = await provider.refund({
      therapist,
      paymentRefId: purchase.stripe_payment_id,
      amountCents,
      reason: 'requested_by_customer',
      idempotencyKey,
    });

    if (!result.refunded) {
      return respond({ error: 'refund_failed', refund_id: result.refundId }, 502);
    }

    // Mark the row refunded. Note: zero out sessions_remaining so the
    // client can't redeem against a refunded package.
    const { error: updErr } = await supabase
      .from('package_purchases')
      .update({
        status: 'refunded',
        refund_id: result.refundId,
        refunded_at: new Date().toISOString(),
        refund_amount_cents: result.amountCents,
        refunded_by: refunded_by || null,
        sessions_remaining: 0,
      })
      .eq('id', purchase.id);

    if (updErr) {
      console.error('[refund-purchase] DB update failed AFTER refund issued', updErr);
      // The refund succeeded at the provider but our DB is now stale.
      // Return success but flag the inconsistency so the frontend
      // can show a soft warning.
      return respond({
        ok: true,
        refund_id: result.refundId,
        amount_cents: result.amountCents,
        warning: 'db_update_failed_refund_issued',
      });
    }

    console.log('[refund-purchase] success', { purchase_id, refund_id: result.refundId, amount_cents: result.amountCents });

    return respond({
      ok: true,
      refund_id: result.refundId,
      amount_cents: result.amountCents,
      processor: provider.name,
    });

  } catch (e) {
    if (e instanceof ProviderError) {
      console.error('[refund-purchase] provider error', e.code, e.message);
      return respond({ error: e.message, code: e.code }, 400);
    }
    console.error('[refund-purchase] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
