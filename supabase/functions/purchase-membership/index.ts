// supabase/functions/purchase-membership/index.ts
//
// Recurring monthly membership signup. Stripe-only by strategic
// design (Square has no clean subscription primitive). Uses
// getProvider with 'stripe-required' policy so a Square-only
// therapist gets a clear error rather than confusion.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, respond, getSupabaseClient, loadTherapist,
  getProvider, ProviderError,
} from '../_shared/payment-provider.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      therapist_id, membership_id,
      client_name, client_email, client_phone,
      redirect_url,
    } = await req.json();

    console.log('[purchase-membership] start', { therapist_id, membership_id });

    if (!therapist_id || !membership_id || !client_email) {
      return respond({ error: 'missing_params' }, 400);
    }

    const supabase = getSupabaseClient();
    const therapist = await loadTherapist(supabase, therapist_id);

    const { data: m } = await supabase
      .from('memberships').select('*')
      .eq('id', membership_id)
      .eq('therapist_id', therapist_id)
      .eq('active', true)
      .single();
    if (!m) return respond({ error: 'membership_not_found' }, 404);

    // Memberships work with both Stripe and Square per the parity
    // rollout. Routing decision:
    //   1. therapist.payment_routing.memberships if explicitly set
    //   2. Stripe by default (capability matrix declares it the
    //      first-class option for subscriptions)
    //   3. Square as fallback when only Square is connected
    const routing = (therapist as any).payment_routing || {};
    const explicit = routing.memberships;
    let provider;
    if (explicit === 'stripe') {
      provider = await getProvider(therapist, 'stripe-required');
    } else if (explicit === 'square') {
      const { SquareProvider } = await import('../_shared/providers/square.ts');
      provider = new SquareProvider(therapist);
    } else {
      // 'auto' or unset: prefer Stripe, fall back to Square
      if (therapist.stripe_account_id) {
        provider = await getProvider(therapist, 'stripe-required');
      } else if (therapist.square_access_token) {
        const { SquareProvider } = await import('../_shared/providers/square.ts');
        provider = new SquareProvider(therapist);
      } else {
        return respond({ error: 'no_processor_connected' }, 400);
      }
    }
    console.log('[purchase-membership] provider:', provider.name);

    // Capability check + surface limitations to the response so the
    // frontend can show a 'good to know' notice if Square subs.
    const cap = provider.getCapability('createSubscriptionLink');
    if (cap.status === 'unsupported') {
      return respond({ error: 'subscription_not_supported_on_provider', code: 'capability_unsupported' }, 400);
    }

    const result = await provider.createCheckoutLink({
      therapist,
      items: [], // not used in subscription mode
      customer: { name: client_name || null, email: client_email, phone: client_phone || null },
      redirectUrl: redirect_url,
      metadata: {
        therapist_id,
        membership_id,
        client_name: client_name || '',
        client_email,
        client_phone: client_phone || '',
        purpose: 'membership_signup',
      },
      mode: 'subscription',
      subscriptionPlan: {
        name: m.name,
        monthlyPriceCents: Math.round(Number(m.monthly_price) * 100),
        // existingPriceId carries either Stripe price id OR Square
        // plan variation id depending on which provider we're using.
        // Each provider knows what to do with it.
        existingPriceId: provider.name === 'stripe'
          ? (m.stripe_price_id || null)
          : (m.square_plan_variation_id || null),
      },
    });

    // If a new price/plan was created during checkout, persist on
    // the membership row for reuse. Column depends on provider.
    const newPriceId = (result as any).newPriceId;
    if (newPriceId) {
      const updateCol = provider.name === 'stripe'
        ? { stripe_price_id: newPriceId }
        : { square_plan_variation_id: newPriceId };
      const existingValue = provider.name === 'stripe'
        ? m.stripe_price_id
        : m.square_plan_variation_id;
      if (!existingValue) {
        await supabase.from('memberships').update(updateCol).eq('id', membership_id);
      }
    }

    return respond({
      url: result.url,
      session_id: result.providerSessionId,
      processor: provider.name,
      capability_warnings: cap.status === 'limited' ? cap.limitations : undefined,
    });

  } catch (e) {
    if (e instanceof ProviderError) {
      console.error('[purchase-membership] provider error', e.code, e.message);
      return respond({ error: e.message, code: e.code }, 400);
    }
    console.error('[purchase-membership] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
