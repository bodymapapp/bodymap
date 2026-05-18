// supabase/functions/refund-session-payment/index.ts
//
// Phase 14.3b (HK May 17 2026): in-app refund for a session_payments
// row. Calls Stripe's /v1/refunds API on the connected account,
// then updates the local row to status='refunded'.
//
// The stripe-refund-webhook (Phase 14.3a) will also fire when Stripe
// processes this refund. That's fine: both code paths converge on
// status='refunded' and the webhook is idempotent (returns
// already_refunded on the second hit).
//
// Body:
//   {
//     session_payment_id: 'uuid',
//     therapist_id: 'uuid',
//     refund_amount_cents?: number    // omit for full refund
//   }
//
// Returns:
//   { success: true, refund_id, amount_refunded_cents, status }
//   or { error: '...' }
//
// Verifies the row belongs to the therapist (defense against forged
// session_payment_id from a different therapist's account).
//
// Idempotency: if the row is already status='refunded', returns the
// existing state without calling Stripe again.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { session_payment_id, therapist_id, refund_amount_cents, offline_only } = await req.json();

    if (!session_payment_id) return respond({ error: 'session_payment_id required' }, 400);
    if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);
    if (refund_amount_cents !== undefined && (typeof refund_amount_cents !== 'number' || refund_amount_cents <= 0)) {
      return respond({ error: 'refund_amount_cents must be a positive number when provided' }, 400);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

    // Phase 14.3b (HK May 17 2026): offline_only allows refunding
    // cash/Venmo/Zelle/check payments by just flipping the local
    // row. No Stripe call needed in that path, so we don't require
    // STRIPE_SECRET_KEY for offline refunds.
    if (!offline_only && !STRIPE_SECRET_KEY) return respond({ error: 'stripe_not_configured' }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Load the session_payments row. Verify therapist ownership.
    const { data: row, error: rErr } = await supabase
      .from('session_payments')
      .select('id, therapist_id, amount_cents, tip_cents, status, stripe_payment_intent_id, payment_method')
      .eq('id', session_payment_id)
      .single();
    if (rErr || !row) return respond({ error: 'payment_not_found' }, 404);
    if (row.therapist_id !== therapist_id) {
      return respond({ error: 'payment_not_owned_by_therapist' }, 403);
    }

    // Idempotency: already refunded? Return existing state.
    if (row.status === 'refunded') {
      return respond({
        success: true,
        already_refunded: true,
        status: 'refunded',
      });
    }

    // Determine refund amount up front; same logic for both branches.
    const fullAmount = (row.amount_cents || 0) + (row.tip_cents || 0);
    const finalRefundCents = refund_amount_cents || fullAmount;
    if (finalRefundCents > fullAmount) {
      return respond({
        error: 'refund_exceeds_paid',
        detail: `Cannot refund more than the original $${(fullAmount/100).toFixed(2)}.`,
      }, 400);
    }

    // Phase 14.3b (HK May 17 2026): offline_only short-circuits the
    // Stripe API call. For cash/Venmo/Zelle/check payments, just
    // flip the local row. The therapist returns the money out-of-band.
    if (offline_only) {
      const { error: updErr } = await supabase
        .from('session_payments')
        .update({ status: 'refunded' })
        .eq('id', session_payment_id);
      if (updErr) {
        console.error('[refund-session-payment] offline update failed', updErr);
        return respond({ error: 'update_failed', detail: updErr.message }, 500);
      }
      // Phase 15.3 (HK May 18 2026): fire notification for offline refunds.
      // Fire-and-forget; failures are logged but don't block the response.
      try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
        const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        await fetch(`${SUPABASE_URL}/functions/v1/notify-refund-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY,
          },
          body: JSON.stringify({ session_payment_id, source: 'in_app_offline' }),
        });
      } catch (e) {
        console.warn('[refund-session-payment] notify fire failed', e);
      }
      return respond({
        success: true,
        offline: true,
        amount_refunded_cents: finalRefundCents,
        status: 'refunded',
      });
    }

    // From here, this is the Stripe path.
    const isStripe = row.payment_method && row.payment_method.startsWith('stripe_');
    if (!isStripe) {
      return respond({
        error: 'not_a_stripe_payment',
        detail: `Cannot refund a ${row.payment_method} payment through Stripe. Pass offline_only=true to mark it refunded locally.`,
      }, 400);
    }

    if (!row.stripe_payment_intent_id) {
      return respond({
        error: 'no_payment_intent_id',
        detail: 'This row is missing its Stripe payment_intent_id; cannot issue a refund.',
      }, 400);
    }

    // Load therapist for Connect account id.
    const { data: therapist } = await supabase
      .from('therapists')
      .select('id, stripe_account_id, stripe_account_connected')
      .eq('id', therapist_id)
      .single();
    if (!therapist?.stripe_account_id || !therapist.stripe_account_connected) {
      return respond({ error: 'stripe_not_connected_for_therapist' }, 400);
    }

    // Call Stripe to issue the refund. Use idempotency_key based on
    // the row + amount so double-clicks within a few hours don't
    // create double refunds.
    const idempotencyKey = `refund_${session_payment_id}_${finalRefundCents}`;
    const refundParams = new URLSearchParams({
      payment_intent: row.stripe_payment_intent_id,
      amount: String(finalRefundCents),
    });

    const refundRes = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Account': therapist.stripe_account_id,
        'Idempotency-Key': idempotencyKey,
      },
      body: refundParams.toString(),
    });
    const refund = await refundRes.json();

    if (!refundRes.ok) {
      console.error('[refund-session-payment] Stripe error', refund);
      return respond({
        error: refund?.error?.message || 'stripe_refund_failed',
        code: refund?.error?.code,
      }, 400);
    }

    // Update local row. Mark refunded regardless of partial vs full,
    // matching the Smart Billing hero's current model (any refund
    // removes the row from collected). Future enhancement: track
    // refund_amount_cents separately so partial refunds show
    // correctly in the hero.
    const { error: updErr } = await supabase
      .from('session_payments')
      .update({
        status: 'refunded',
      })
      .eq('id', session_payment_id);

    if (updErr) {
      console.error('[refund-session-payment] failed to update row after Stripe refund', updErr);
      // Stripe refund DID succeed; the local row will be reconciled
      // by the stripe-refund-webhook when Stripe fires charge.refunded.
      return respond({
        success: true,
        refund_id: refund.id,
        amount_refunded_cents: finalRefundCents,
        warning: 'stripe_refund_succeeded_but_local_row_update_failed',
      });
    }

    // Phase 15.3 (HK May 18 2026): fire notification for Stripe refunds
    // initiated from inside the app. Fire-and-forget. The webhook
    // (stripe-refund-webhook) will ALSO fire a notification when
    // Stripe processes the refund. notify-refund-event is idempotent
    // because the underlying notification_log table accepts duplicate
    // rows by design (every send attempt logs). If we want to dedupe
    // later, do it at the notify-refund-event level via a recent-fire
    // check. For now, mild duplication is acceptable.
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
      const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      await fetch(`${SUPABASE_URL}/functions/v1/notify-refund-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
        },
        body: JSON.stringify({ session_payment_id, source: 'in_app_stripe' }),
      });
    } catch (e) {
      console.warn('[refund-session-payment] notify fire failed', e);
    }

    return respond({
      success: true,
      refund_id: refund.id,
      amount_refunded_cents: finalRefundCents,
      status: 'refunded',
    });

  } catch (e) {
    console.error('[refund-session-payment] uncaught', e);
    return respond({ error: String((e as any)?.message || e) }, 500);
  }
});

function respond(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
