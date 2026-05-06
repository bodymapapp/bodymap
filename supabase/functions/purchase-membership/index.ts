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

    // Memberships require Stripe — fail loud if not connected.
    const provider = await getProvider(therapist, 'stripe-required');
    console.log('[purchase-membership] provider:', provider.name);

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
        existingPriceId: m.stripe_price_id || null,
      },
    });

    // If a new Price was created during checkout, persist it on the
    // membership row for reuse on subsequent purchases.
    const newPriceId = (result as any).newPriceId;
    if (newPriceId && !m.stripe_price_id) {
      await supabase.from('memberships')
        .update({ stripe_price_id: newPriceId })
        .eq('id', membership_id);
    }

    return respond({
      url: result.url,
      session_id: result.providerSessionId,
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
