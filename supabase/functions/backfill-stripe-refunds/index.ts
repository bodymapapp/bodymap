// supabase/functions/backfill-stripe-refunds/index.ts
//
// Phase 14.3a backfill (HK May 17 2026): one-shot reconciliation of
// session_payments rows whose Stripe charges have already been
// refunded outside the platform.
//
// Context: the stripe-refund-webhook handler was added today. Refunds
// issued before it was deployed are not reflected in session_payments
// (the rows still show status='succeeded' even though Stripe has
// already issued the refund). HK refunded 3 payments today; this
// function reconciles them.
//
// How it works:
//   1. Fetch session_payments rows with status='succeeded' and a
//      stripe_payment_intent_id, for the given therapist
//   2. For each row, ask Stripe whether the underlying charge has
//      been refunded
//   3. If refunded, update the row to status='refunded'
//
// Safe to re-run. Idempotent. Only flips rows where Stripe confirms
// a refund. Does not call Stripe for already-refunded rows.
//
// Invoke: POST /functions/v1/backfill-stripe-refunds
//   { therapist_id: 'uuid' }
//
// Returns: { scanned: N, refunded: M, errors: [...] }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { therapist_id } = await req.json();

    if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

    if (!STRIPE_SECRET_KEY) return respond({ error: 'stripe_not_configured' }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Load the therapist to get their Stripe account id (Connect).
    const { data: therapist } = await supabase
      .from('therapists')
      .select('id, stripe_account_id')
      .eq('id', therapist_id)
      .single();
    if (!therapist?.stripe_account_id) {
      return respond({ error: 'therapist_or_stripe_account_not_found' }, 404);
    }

    // Pull all succeeded session_payments with a payment_intent_id.
    // Limit 500 to keep it bounded.
    const { data: rows } = await supabase
      .from('session_payments')
      .select('id, stripe_payment_intent_id, amount_cents')
      .eq('therapist_id', therapist_id)
      .eq('status', 'succeeded')
      .not('stripe_payment_intent_id', 'is', null)
      .limit(500);

    let scanned = 0;
    let refunded = 0;
    const errors: any[] = [];

    for (const row of rows || []) {
      scanned++;
      try {
        // Ask Stripe whether the underlying PaymentIntent has been
        // refunded. We expand charges.data.refunds so a single API
        // call gets everything we need.
        const piRes = await fetch(
          `https://api.stripe.com/v1/payment_intents/${row.stripe_payment_intent_id}?expand[]=charges.data.refunds`,
          {
            headers: {
              'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
              'Stripe-Account': therapist.stripe_account_id,
            },
          }
        );
        const pi = await piRes.json();
        if (!piRes.ok) {
          errors.push({ row_id: row.id, error: pi?.error?.message || 'stripe_lookup_failed' });
          continue;
        }

        const charge = pi?.charges?.data?.[0];
        const amountRefunded = charge?.amount_refunded || 0;
        const refundsList = charge?.refunds?.data || [];

        if (amountRefunded > 0 && refundsList.length > 0) {
          // Refunded on Stripe but our row is still 'succeeded'. Fix it.
          await supabase
            .from('session_payments')
            .update({
              status: 'refunded',
            })
            .eq('id', row.id);
          refunded++;
        }
      } catch (e) {
        errors.push({ row_id: row.id, error: String((e as any)?.message || e) });
      }
    }

    return respond({
      scanned,
      refunded,
      errors,
    });

  } catch (e) {
    console.error('[backfill-stripe-refunds] uncaught', e);
    return respond({ error: String((e as any)?.message || e) }, 500);
  }
});

function respond(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
