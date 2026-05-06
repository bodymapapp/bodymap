// supabase/functions/purchase-cart/index.ts
//
// Multi-package cart checkout. Takes an array of package_ids, creates
// one hosted checkout session with all of them as line items, returns
// the URL.
//
// Stripe path: Checkout Session in mode=payment with multiple
// line_items. Stripe handles the math, taxes, totals, and the
// receipt. After success, the redirect carries session_id back and
// confirm-cart-purchase reads the line items from Stripe and creates
// one package_purchases row per line item.
//
// Square path: an Order with multiple line items, then a Payment Link
// pointing at that Order. Square redirects back with order_id and
// confirm-cart-purchase reads the order's line_items to create the
// package_purchases rows.
//
// Why this exists: the previous purchase-package flow could only
// handle one item at a time. Therapists offering multiple packages
// (a 5-pack, a 10-pack, a starter trial) lost cart sales. With cart
// the client can buy two packages in one transaction.
//
// Memberships are NOT supported in the cart. Stripe Checkout does
// not allow mixing subscription and one-time line items in the same
// session. Memberships keep their direct-subscribe flow.

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
      // Cart items: [{ package_id: '...' }, ...]. Quantities not yet
      // supported in v1; one row per line. Same package_id can appear
      // multiple times if the client wants two of the same package.
      cart_items,
      client_name,
      client_email,
      client_phone,
      redirect_url,
    } = await req.json();

    console.log('[purchase-cart] start', { therapist_id, cart_size: cart_items?.length, client_email });

    if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);
    if (!Array.isArray(cart_items) || cart_items.length === 0) return respond({ error: 'cart_items must be non-empty array' }, 400);
    if (!client_email) return respond({ error: 'client_email required' }, 400);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return respond({ error: 'env_not_set' }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Load therapist
    const { data: therapist } = await supabase
      .from('therapists')
      .select('id, full_name, business_name, custom_url, stripe_account_id, square_access_token, square_location_id')
      .eq('id', therapist_id)
      .single();
    if (!therapist) return respond({ error: 'therapist_not_found' }, 404);
    const therapistName = therapist.business_name || therapist.full_name || 'Therapist';

    // Load all packages in the cart in one query
    const packageIds = cart_items.map((c: any) => c.package_id).filter(Boolean);
    if (packageIds.length === 0) return respond({ error: 'no valid package_ids in cart' }, 400);

    const { data: pkgs, error: pErr } = await supabase
      .from('packages')
      .select('*')
      .in('id', packageIds)
      .eq('therapist_id', therapist_id)
      .eq('active', true);
    if (pErr || !pkgs || pkgs.length === 0) return respond({ error: 'no_active_packages_found' }, 404);

    // Build a parallel array preserving the cart order. If a cart item's
    // package_id is missing or inactive, drop it from the cart silently.
    // (Could fail loudly but the cart UI should have already shown
    // active packages only; a stale item is a minor edge case.)
    const lineItems = cart_items
      .map((c: any) => pkgs.find((p: any) => p.id === c.package_id))
      .filter(Boolean);
    if (lineItems.length === 0) return respond({ error: 'all_cart_items_inactive' }, 400);

    const grandTotalCents = lineItems.reduce((sum: number, p: any) => sum + Math.round(Number(p.price) * 100), 0);

    // ----- STRIPE PATH -----
    if (therapist.stripe_account_id && STRIPE_SECRET) {
      console.log('[purchase-cart] using stripe, lines=', lineItems.length, 'total_cents=', grandTotalCents);
      const params = new URLSearchParams();
      params.append('mode', 'payment');
      params.append('payment_method_types[]', 'card');
      lineItems.forEach((p: any, idx: number) => {
        params.append(`line_items[${idx}][price_data][currency]`, 'usd');
        params.append(`line_items[${idx}][price_data][product_data][name]`, `${p.name} · ${p.session_count} sessions`);
        params.append(`line_items[${idx}][price_data][product_data][description]`, `Package from ${therapistName}`);
        params.append(`line_items[${idx}][price_data][product_data][metadata][package_id]`, p.id);
        params.append(`line_items[${idx}][price_data][unit_amount]`, String(Math.round(Number(p.price) * 100)));
        params.append(`line_items[${idx}][quantity]`, '1');
      });
      params.append('customer_email', client_email);
      params.append('success_url', `${redirect_url}&cart_complete=1&processor=stripe&session_id={CHECKOUT_SESSION_ID}`);
      params.append('cancel_url', `${redirect_url}&cart_canceled=1`);
      params.append('metadata[therapist_id]', therapist_id);
      params.append('metadata[client_name]', client_name || '');
      params.append('metadata[client_email]', client_email);
      params.append('metadata[client_phone]', client_phone || '');
      params.append('metadata[purpose]', 'cart_purchase');
      // Comma-separated list of package_ids on the session metadata so
      // the confirm function can match line items back to packages
      // even if Stripe's product metadata is hard to retrieve.
      params.append('metadata[package_ids]', lineItems.map((p: any) => p.id).join(','));

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
        console.error('[purchase-cart] stripe failed', session);
        return respond({ error: session.error?.message || 'stripe_session_failed' }, 400);
      }
      return respond({
        url: session.url,
        processor: 'stripe',
        session_id: session.id,
        line_count: lineItems.length,
        total_cents: grandTotalCents,
      });
    }

    // ----- SQUARE PATH -----
    // Self-heal location_id if missing (see square-create-deposit for
    // rationale). Allows therapists who connected Square pre-location
    // -persistence to still use cart checkout.
    if (therapist.square_access_token) {
      let locationId = therapist.square_location_id;
      if (!locationId) {
        try {
          const locRes = await fetch('https://connect.squareup.com/v2/locations', {
            headers: { 'Authorization': `Bearer ${therapist.square_access_token}`, 'Square-Version': '2024-01-18' },
          });
          const locData = await locRes.json();
          if (locRes.ok) {
            const active = (locData.locations || []).find((l: any) => l.status === 'ACTIVE') || (locData.locations || [])[0];
            if (active?.id) {
              locationId = active.id;
              await supabase.from('therapists').update({ square_location_id: locationId }).eq('id', therapist_id);
            }
          }
        } catch (e) { /* fall through */ }
      }
      if (!locationId) return respond({ error: 'Square location not configured. Please reconnect Square in Settings.' }, 400);

      console.log('[purchase-cart] using square, lines=', lineItems.length);
      const idempotencyKey = `cart-${client_email}-${Date.now()}`;
      const linkRes = await fetch('https://connect.squareup.com/v2/online-checkout/payment-links', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${therapist.square_access_token}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-01-18',
        },
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
          // Use 'order' shape to support multiple line items.
          // (quick_pay only supports a single item.)
          order: {
            location_id: locationId,
            line_items: lineItems.map((p: any) => ({
              name: `${p.name} · ${p.session_count} sessions`,
              quantity: '1',
              base_price_money: { amount: Math.round(Number(p.price) * 100), currency: 'USD' },
              note: `Package from ${therapistName}`,
              metadata: { package_id: p.id },
            })),
          },
          checkout_options: {
            ask_for_shipping_address: false,
            redirect_url: `${redirect_url}&cart_complete=1&processor=square`,
          },
          pre_populated_data: { buyer_email: client_email },
          description: `${lineItems.length} package${lineItems.length !== 1 ? 's' : ''} from ${therapistName}`,
        }),
      });
      const linkData = await linkRes.json();
      if (!linkRes.ok) {
        console.error('[purchase-cart] square failed', linkData);
        return respond({ error: linkData.errors?.[0]?.detail || 'square_link_failed', raw: linkData }, 400);
      }
      return respond({
        url: linkData.payment_link?.url,
        processor: 'square',
        link_id: linkData.payment_link?.id,
        order_id: linkData.payment_link?.order_id,
        line_count: lineItems.length,
        total_cents: grandTotalCents,
      });
    }

    return respond({ error: 'no_payment_processor_connected' }, 400);

  } catch (e) {
    console.error('[purchase-cart] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
