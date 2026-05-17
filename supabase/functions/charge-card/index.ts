// supabase/functions/charge-card/index.ts
//
// Charge a card-on-file. Stripe-only by strategic design (card-on-file
// is the online engine). Refactored May 2026 to use PaymentProvider.
//
// Caller should pass either therapist_id (preferred) or
// stripe_account_id (legacy support). Body is otherwise unchanged.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, respond, getSupabaseClient, loadTherapist,
  getProvider, ProviderError,
} from '../_shared/payment-provider.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      therapist_id,
      stripe_account_id,           // legacy: callers passing this directly
      customer_id,
      payment_method_id,
      amount_cents, tip_cents,
      description, client_email, send_receipt,
      idempotency_key,
    } = await req.json();

    if (!payment_method_id) return respond({ error: 'payment_method_id required' }, 400);
    if (!amount_cents || amount_cents <= 0) return respond({ error: 'amount_cents required' }, 400);
    // customer_id is now OPTIONAL. When null/undefined, this is treated
    // as a one-shot charge against a fresh PaymentMethod (e.g. the
    // Phase 12 'Enter new card' Checkout path). When present, this is
    // the saved-card flow.

    const supabase = getSupabaseClient();

    // Resolve therapist. Prefer therapist_id; fall back to looking
    // up by stripe_account_id for backward compat.
    let therapist;
    if (therapist_id) {
      therapist = await loadTherapist(supabase, therapist_id);
    } else if (stripe_account_id) {
      const { data } = await supabase
        .from('therapists').select('*')
        .eq('stripe_account_id', stripe_account_id)
        .single();
      if (!data) return respond({ error: 'therapist_not_found' }, 404);
      therapist = data;
    } else {
      return respond({ error: 'therapist_id or stripe_account_id required' }, 400);
    }

    const provider = await getProvider(therapist, 'stripe-required');

    const total = amount_cents + (tip_cents || 0);
    const result = await provider.chargeSavedCard({
      therapist,
      providerCustomerId: customer_id || undefined,
      providerCardId: payment_method_id,
      amountCents: total,
      idempotencyKey: idempotency_key || `charge-${customer_id || payment_method_id}-${Date.now()}`,
      description: description || 'Massage session',
      receiptEmail: send_receipt && client_email ? client_email : undefined,
    });

    return respond({
      success: result.paid,
      payment_intent_id: result.paymentRefId,
      amount: result.amountCents,
      status: result.paid ? 'succeeded' : 'failed',
    });

  } catch (e) {
    if (e instanceof ProviderError) {
      console.error('[charge-card] provider error', e.code, e.message);
      return respond({ error: e.message, code: e.code }, 400);
    }
    console.error('[charge-card] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
