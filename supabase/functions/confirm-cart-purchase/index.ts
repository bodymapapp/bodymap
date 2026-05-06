// supabase/functions/confirm-cart-purchase/index.ts
//
// Verifies a cart payment with the processor, then creates one
// package_purchases row per line item. Idempotent on the payment
// reference so a double-redirect cannot grant credits twice.
//
// Returns: { ok, purchases: [{ package_id, purchase_id }, ...] }

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
    const { processor, session_id, order_id, therapist_id: therapistIdParam, client_email, client_name, client_phone } = await req.json();

    console.log('[confirm-cart-purchase] start', { processor, session_id, order_id });

    if (!processor) return respond({ error: 'processor required' }, 400);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return respond({ error: 'env_not_set' }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // List of { package_id, amount_cents } pulled from the processor
    const linePurchases: Array<{ package_id: string; amount_cents: number }> = [];
    let verifiedEmail = (client_email || '').toLowerCase();
    let paymentRefId = '';
    let therapist_id = therapistIdParam;

    // ----- STRIPE VERIFY -----
    if (processor === 'stripe') {
      if (!session_id || !STRIPE_SECRET) return respond({ error: 'stripe_verify_missing_params' }, 400);

      // Fetch session to get metadata (which includes therapist_id and
      // package_ids). We need therapist's stripe_account_id for the
      // line_items expansion call below, so we pull it after we know
      // who the therapist is.
      const sRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}?expand[]=line_items&expand[]=line_items.data.price.product`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET}`,
          // Stripe-Account header is set below after we know it.
        },
      });
      // We may need to retry with Stripe-Account if the session is on a
      // connected account. Try first without; if 404, try with the
      // therapist_id metadata to locate the account.
      let session = await sRes.json();
      if (!sRes.ok || !session.id) {
        // Retry with Stripe-Account header. We need therapist_id for
        // that, so the caller MUST pass it in the body for Stripe path.
        if (!therapist_id) return respond({ error: 'therapist_id required for stripe verify' }, 400);
        const { data: t } = await supabase.from('therapists').select('stripe_account_id').eq('id', therapist_id).single();
        if (!t?.stripe_account_id) return respond({ error: 'therapist_no_stripe' }, 400);
        const retry = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}?expand[]=line_items&expand[]=line_items.data.price.product`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${STRIPE_SECRET}`,
            'Stripe-Account': t.stripe_account_id,
          },
        });
        session = await retry.json();
        if (!retry.ok) return respond({ error: session.error?.message || 'stripe_verify_failed' }, 400);
      }

      if (session.payment_status !== 'paid') return respond({ error: 'payment_not_completed', status: session.payment_status }, 400);

      therapist_id = therapist_id || session.metadata?.therapist_id;
      verifiedEmail = (session.customer_email || session.customer_details?.email || verifiedEmail).toLowerCase();
      paymentRefId = session.payment_intent || session.id;

      // Walk each line item, recover the package_id from product metadata.
      // The cart purchase stamped each line's product with metadata.package_id.
      // session.metadata.package_ids is a fallback if that is missing.
      const fallbackIds = (session.metadata?.package_ids || '').split(',').filter(Boolean);
      const lines = session.line_items?.data || [];
      lines.forEach((line: any, idx: number) => {
        const fromProduct = line.price?.product?.metadata?.package_id;
        const pkgId = fromProduct || fallbackIds[idx];
        if (pkgId) {
          linePurchases.push({ package_id: pkgId, amount_cents: line.amount_total || (line.price?.unit_amount || 0) * (line.quantity || 1) });
        }
      });
    }

    // ----- SQUARE VERIFY -----
    if (processor === 'square') {
      if (!order_id) return respond({ error: 'square_verify_missing_order_id' }, 400);
      if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);
      const { data: t } = await supabase.from('therapists').select('square_access_token').eq('id', therapist_id).single();
      if (!t?.square_access_token) return respond({ error: 'therapist_no_square' }, 400);

      const oRes = await fetch(`https://connect.squareup.com/v2/orders/${order_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${t.square_access_token}`,
          'Square-Version': '2024-01-18',
        },
      });
      const orderData = await oRes.json();
      if (!oRes.ok) return respond({ error: orderData.errors?.[0]?.detail || 'square_verify_failed' }, 400);
      const order = orderData.order;
      if (order?.state !== 'COMPLETED') return respond({ error: 'payment_not_completed', state: order?.state }, 400);

      paymentRefId = order_id;
      const lines = order.line_items || [];
      lines.forEach((line: any) => {
        const pkgId = line.metadata?.package_id;
        if (pkgId) {
          linePurchases.push({ package_id: pkgId, amount_cents: line.total_money?.amount || 0 });
        }
      });
    }

    if (linePurchases.length === 0) return respond({ error: 'no_lines_resolved_to_packages' }, 400);
    if (!therapist_id) return respond({ error: 'therapist_id_unresolved' }, 400);

    // Idempotency: if we already created any purchases for this payment
    // ref, return them rather than duplicating.
    const { data: existing } = await supabase
      .from('package_purchases')
      .select('id, package_id')
      .eq('stripe_payment_id', paymentRefId);
    if (existing && existing.length > 0) {
      return respond({
        ok: true,
        idempotent: true,
        purchases: existing.map((p: any) => ({ package_id: p.package_id, purchase_id: p.id })),
      });
    }

    // Find or create a clients row for this email so the purchase can be
    // linked to a clients.id (optional; client_email is the primary
    // matching key on subsequent bookings).
    let clientId: string | null = null;
    if (verifiedEmail) {
      const { data: c } = await supabase
        .from('clients')
        .select('id')
        .eq('therapist_id', therapist_id)
        .eq('email', verifiedEmail)
        .maybeSingle();
      if (c) clientId = c.id;
    }

    // Load the package configs in bulk so we can copy session_count,
    // expires_in_days, etc., onto each purchase row.
    const pkgIdsToFetch = linePurchases.map((l) => l.package_id);
    const { data: pkgRows } = await supabase
      .from('packages')
      .select('*')
      .in('id', pkgIdsToFetch);
    const pkgById: Record<string, any> = {};
    (pkgRows || []).forEach((p: any) => { pkgById[p.id] = p; });

    // Create one package_purchases row per line item.
    const purchases: Array<{ package_id: string; purchase_id: string }> = [];
    for (const line of linePurchases) {
      const pkg = pkgById[line.package_id];
      if (!pkg) {
        console.warn('[confirm-cart-purchase] no package row for id', line.package_id);
        continue;
      }
      const expiresAt = pkg.expires_in_days
        ? new Date(Date.now() + pkg.expires_in_days * 86400000).toISOString()
        : null;
      const { data: inserted, error: insErr } = await supabase
        .from('package_purchases')
        .insert({
          therapist_id,
          package_id: pkg.id,
          client_id: clientId,
          client_email: verifiedEmail,
          client_name: client_name || null,
          sessions_purchased: pkg.session_count,
          sessions_remaining: pkg.session_count,
          price_paid: line.amount_cents / 100,
          stripe_payment_id: paymentRefId,
          expires_at: expiresAt,
          status: 'active',
        })
        .select('id')
        .single();
      if (insErr) {
        console.error('[confirm-cart-purchase] insert failed for', pkg.id, insErr);
        continue;
      }
      purchases.push({ package_id: pkg.id, purchase_id: inserted.id });
    }

    return respond({ ok: true, purchases });

  } catch (e) {
    console.error('[confirm-cart-purchase] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
