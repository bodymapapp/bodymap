// supabase/functions/save-card-on-booking-token/index.ts
//
// Token-based card-on-file save. Used by Square's Web Payments SDK
// flow on the frontend: the SDK tokenizes the card to a 'nonce' /
// 'source_id', and we attach it to the Square customer via this
// endpoint.
//
// Why a separate endpoint from save-card-on-booking:
//   save-card-on-booking creates a SetupIntent for Stripe and returns
//   a client_secret to the frontend. That flow is Stripe-specific.
//   This endpoint receives a token from EITHER processor's frontend
//   SDK (after the SDK has already tokenized the card client-side)
//   and just attaches it. Symmetric: works for both.
//
// Both endpoints can coexist; the frontend picks based on which
// processor the therapist uses for card-on-file.

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
      client_id,
      customer_id,
      payment_token,
      processor,    // 'stripe' | 'square': used to force the provider
    } = await req.json();

    if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);
    if (!payment_token) return respond({ error: 'payment_token required' }, 400);
    if (!client_id) return respond({ error: 'client_id required' }, 400);

    const supabase = getSupabaseClient();
    const therapist = await loadTherapist(supabase, therapist_id);

    // Force the named provider when the caller specifies one. Otherwise
    // auto-select.
    let provider;
    if (processor === 'square') {
      const { SquareProvider } = await import('../_shared/providers/square.ts');
      provider = new SquareProvider(therapist);
    } else if (processor === 'stripe') {
      const { StripeProvider } = await import('../_shared/providers/stripe.ts');
      provider = new StripeProvider();
    } else {
      provider = await getProvider(therapist, 'auto');
    }

    // Capability check: surface a clean error if this provider+
    // strategy doesn't support saveCardOnFile.
    const cap = provider.getCapability('saveCardOnFile');
    if (cap.status === 'unsupported') {
      return respond({
        error: `${provider.name} does not support saving cards`,
        code: 'capability_unsupported',
      }, 400);
    }

    // Look up the client to get email / name for the provider's
    // customer record (already created server-side for Square; for
    // Stripe this just confirms it).
    const { data: client } = await supabase
      .from('clients').select('*').eq('id', client_id).single();
    if (!client) return respond({ error: 'client_not_found' }, 404);

    const result = await provider.saveCardOnFile({
      therapist,
      customer: {
        name: client.name || null,
        email: client.email || `noemail-${client_id}@nophone.local`,
        phone: client.phone || null,
      },
      paymentToken: payment_token,
    });

    // Persist the card details on the clients row. Use the
    // processor-specific column names; existing Stripe rows already
    // populate stripe_customer_id, so we mirror with square_customer_id
    // / square_card_id for Square.
    const updates: Record<string, unknown> = {};
    if (provider.name === 'square') {
      updates.square_customer_id = result.providerCustomerId;
      updates.square_card_id = result.providerCardId;
    } else {
      updates.stripe_customer_id = result.providerCustomerId;
      updates.payment_method_id = result.providerCardId;
    }
    updates.card_last4 = result.last4;
    updates.card_brand = result.brand;
    await supabase.from('clients').update(updates).eq('id', client_id);

    return respond({
      ok: true,
      processor: provider.name,
      card_id: result.providerCardId,
      providerCardId: result.providerCardId,
      last4: result.last4,
      brand: result.brand,
      capability_warnings: cap.status === 'limited' ? cap.limitations : undefined,
    });

  } catch (e) {
    if (e instanceof ProviderError) {
      console.error('[save-card-on-booking-token] provider error', e.code, e.message);
      return respond({ error: e.message, code: e.code }, 400);
    }
    console.error('[save-card-on-booking-token] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
