// supabase/functions/purchase-package/index.ts
//
// Client-facing package purchase flow. Creates a hosted checkout
// session (Stripe Checkout or Square Payment Link) for an upfront
// package payment, returns the URL. After successful payment the
// redirect handler on the booking page creates the package_purchases
// row and grants the client their session credits.
//
// Why hosted checkout for both processors:
//   - No SDK to embed, no card form to mount
//   - Uniform UX: button → external page → pay → redirect back
//   - Apple Pay / Google Pay come for free
//   - Same pattern we used for square-create-deposit
//
// Returns: { url, processor, session_or_link_id }

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
      package_id,
      client_name,
      client_email,
      client_phone,
      redirect_url,
    } = await req.json();

    console.log('[purchase-package] start', { therapist_id, package_id, client_email });

    if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);
    if (!package_id) return respond({ error: 'package_id required' }, 400);
    if (!client_email) return respond({ error: 'client_email required' }, 400);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return respond({ error: 'Supabase env not set' }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ----- Load therapist + package -----
    const { data: therapist, error: tErr } = await supabase
      .from('therapists')
      .select('id, full_name, business_name, custom_url, stripe_account_id, square_access_token, square_location_id')
      .eq('id', therapist_id)
      .single();
    if (tErr || !therapist) return respond({ error: 'therapist_not_found' }, 404);

    const { data: pkg, error: pErr } = await supabase
      .from('packages')
      .select('*')
      .eq('id', package_id)
      .eq('therapist_id', therapist_id)
      .eq('active', true)
      .single();
    if (pErr || !pkg) return respond({ error: 'package_not_found_or_inactive' }, 404);

    const amountCents = Math.round(Number(pkg.price) * 100);
    if (!amountCents || amountCents <= 0) return respond({ error: 'invalid_price' }, 400);

    const therapistName = therapist.business_name || therapist.full_name || 'Therapist';
    const itemName = `${pkg.name} · ${pkg.session_count} sessions`;

    // Pre-create the package_purchases row in 'active' state but with
    // sessions_remaining=0 until payment confirms. We use this row's
    // id as the idempotency anchor so a double-click does not create
    // two purchases. The redirect handler flips sessions_remaining =
    // sessions_purchased once payment is confirmed.
    //
    // Wait — actually cleaner to defer the row creation until
    // post-redirect. Otherwise we have orphan zero-credit rows if the
    // client abandons the checkout. Going with: create the
    // package_purchase row only after payment confirms (in the
    // redirect handler on the frontend).
    //
    // Trade-off: we lose perfect idempotency on the create. Mitigation
    // is the unique constraint on (therapist_id, package_id,
    // client_email, purchased_at::date) at the DB level — but we do
    // not have that today, so a double-redirect could create two
    // rows. Acceptable for now.

    // ----- STRIPE PATH -----
    if (therapist.stripe_account_id && STRIPE_SECRET) {
      console.log('[purchase-package] using stripe');
      // Stripe Checkout Session (one-time, hosted)
      const params = new URLSearchParams();
      params.append('mode', 'payment');
      params.append('payment_method_types[]', 'card');
      params.append('line_items[0][price_data][currency]', 'usd');
      params.append('line_items[0][price_data][product_data][name]', itemName);
      params.append('line_items[0][price_data][product_data][description]', `Package from ${therapistName}`);
      params.append('line_items[0][price_data][unit_amount]', String(amountCents));
      params.append('line_items[0][quantity]', '1');
      params.append('customer_email', client_email);
      params.append('success_url', `${redirect_url}&purchase_complete=1&processor=stripe&session_id={CHECKOUT_SESSION_ID}`);
      params.append('cancel_url', `${redirect_url}&purchase_canceled=1`);
      params.append('metadata[therapist_id]', therapist_id);
      params.append('metadata[package_id]', package_id);
      params.append('metadata[client_name]', client_name || '');
      params.append('metadata[client_email]', client_email);
      params.append('metadata[client_phone]', client_phone || '');
      params.append('metadata[purpose]', 'package_purchase');

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
        console.error('[purchase-package] stripe session failed', session);
        return respond({ error: session.error?.message || 'stripe_session_failed' }, 400);
      }
      return respond({
        url: session.url,
        processor: 'stripe',
        session_id: session.id,
      });
    }

    // ----- SQUARE PATH -----
    if (therapist.square_access_token && therapist.square_location_id) {
      console.log('[purchase-package] using square');
      const idempotencyKey = `pkg-${package_id}-${client_email}-${Date.now()}`;
      const linkRes = await fetch('https://connect.squareup.com/v2/online-checkout/payment-links', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${therapist.square_access_token}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-01-18',
        },
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
          quick_pay: {
            name: itemName,
            price_money: { amount: amountCents, currency: 'USD' },
            location_id: therapist.square_location_id,
          },
          checkout_options: {
            ask_for_shipping_address: false,
            redirect_url: `${redirect_url}&purchase_complete=1&processor=square&package_id=${package_id}`,
          },
          pre_populated_data: { buyer_email: client_email },
          description: `${pkg.name} from ${therapistName}`,
        }),
      });
      const linkData = await linkRes.json();
      if (!linkRes.ok) {
        console.error('[purchase-package] square link failed', linkData);
        return respond({ error: linkData.errors?.[0]?.detail || 'square_link_failed' }, 400);
      }
      return respond({
        url: linkData.payment_link?.url,
        processor: 'square',
        link_id: linkData.payment_link?.id,
        order_id: linkData.payment_link?.order_id,
      });
    }

    return respond({ error: 'no_payment_processor_connected' }, 400);

  } catch (e) {
    console.error('[purchase-package] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
