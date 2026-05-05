// supabase/functions/purchase-membership/index.ts
//
// Membership = recurring monthly subscription. Stripe-only for v1
// because Square does not have a clean equivalent of Stripe Checkout
// in subscription mode for connected accounts. Square does have
// Subscriptions API but it requires a customer-with-card-on-file
// flow which is materially more complex.
//
// For Square-only therapists: the public booking page hides
// memberships and shows a small "Memberships need Stripe" note. They
// can still sell packages.
//
// Returns: { url, session_id } on success.

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
    const {
      therapist_id,
      membership_id,
      client_name,
      client_email,
      client_phone,
      redirect_url,
    } = await req.json();

    console.log('[purchase-membership] start', { therapist_id, membership_id, client_email });

    if (!therapist_id || !membership_id || !client_email) {
      return respond({ error: 'missing_params' }, 400);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return respond({ error: 'env_not_set' }, 500);
    if (!STRIPE_SECRET) return respond({ error: 'STRIPE_SECRET_KEY not set' }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: therapist } = await supabase
      .from('therapists')
      .select('id, full_name, business_name, stripe_account_id')
      .eq('id', therapist_id)
      .single();
    if (!therapist) return respond({ error: 'therapist_not_found' }, 404);
    if (!therapist.stripe_account_id) return respond({ error: 'memberships_require_stripe' }, 400);

    const { data: m } = await supabase
      .from('memberships')
      .select('*')
      .eq('id', membership_id)
      .eq('therapist_id', therapist_id)
      .eq('active', true)
      .single();
    if (!m) return respond({ error: 'membership_not_found' }, 404);

    const amountCents = Math.round(Number(m.monthly_price) * 100);
    const therapistName = therapist.business_name || therapist.full_name || 'Therapist';

    // We need a recurring Price. If the membership row has stripe_price_id
    // already set, reuse it. Otherwise create a new Stripe Price on the
    // connected account, on the fly, and persist its id.
    let priceId = m.stripe_price_id;
    if (!priceId) {
      console.log('[purchase-membership] creating stripe price');
      // Create a product, then a recurring price on it.
      const prodRes = await fetch('https://api.stripe.com/v1/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET}`,
          'Stripe-Account': therapist.stripe_account_id,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ name: m.name }),
      });
      const product = await prodRes.json();
      if (!prodRes.ok) {
        console.error('[purchase-membership] product create failed', product);
        return respond({ error: product.error?.message || 'product_create_failed' }, 400);
      }
      const priceRes = await fetch('https://api.stripe.com/v1/prices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET}`,
          'Stripe-Account': therapist.stripe_account_id,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          product: product.id,
          unit_amount: String(amountCents),
          currency: 'usd',
          'recurring[interval]': 'month',
        }),
      });
      const price = await priceRes.json();
      if (!priceRes.ok) {
        console.error('[purchase-membership] price create failed', price);
        return respond({ error: price.error?.message || 'price_create_failed' }, 400);
      }
      priceId = price.id;
      // Persist for next time so we do not create duplicate Stripe Products.
      await supabase.from('memberships').update({ stripe_price_id: priceId }).eq('id', membership_id);
    }

    // Subscription mode Checkout Session. After payment, Stripe redirects
    // back with a session id we can exchange for the customer + sub ids.
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('payment_method_types[]', 'card');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('customer_email', client_email);
    params.append('success_url', `${redirect_url}&membership_complete=1&processor=stripe&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${redirect_url}&membership_canceled=1`);
    params.append('metadata[therapist_id]', therapist_id);
    params.append('metadata[membership_id]', membership_id);
    params.append('metadata[client_name]', client_name || '');
    params.append('metadata[client_email]', client_email);
    params.append('metadata[client_phone]', client_phone || '');
    params.append('metadata[purpose]', 'membership_signup');
    params.append('subscription_data[metadata][therapist_id]', therapist_id);
    params.append('subscription_data[metadata][membership_id]', membership_id);

    const sRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Stripe-Account': therapist.stripe_account_id,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    const session = await sRes.json();
    if (!sRes.ok) {
      console.error('[purchase-membership] checkout session failed', session);
      return respond({ error: session.error?.message || 'session_failed' }, 400);
    }

    return respond({ url: session.url, session_id: session.id });

  } catch (e) {
    console.error('[purchase-membership] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
