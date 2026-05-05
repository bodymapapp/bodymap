// supabase/functions/confirm-package-purchase/index.ts
//
// Called after the client returns from the hosted checkout. Verifies
// the payment actually completed against the processor's API, then
// creates the package_purchases row with sessions_remaining set to
// sessions_purchased.
//
// Why server-side verification: the redirect alone is not sufficient
// because a determined user could craft the redirect URL and grant
// themselves credits without paying. Verifying with Stripe/Square
// before creating the purchase row closes that hole.
//
// Returns: { ok: true, purchase_id } or { error }

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
    const { processor, session_id, order_id, package_id, therapist_id: therapistIdParam, client_email, client_name, client_phone } = await req.json();

    console.log('[confirm-package-purchase] start', { processor, session_id, order_id, package_id });

    if (!processor || !package_id) return respond({ error: 'missing_params' }, 400);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return respond({ error: 'env_not_set' }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Load package + therapist. therapist_id can come from request OR
    // be derived from the package row, since redirect URLs on the
    // public booking page do not always carry it.
    const { data: pkg } = await supabase.from('packages').select('*').eq('id', package_id).single();
    if (!pkg) return respond({ error: 'package_not_found' }, 404);
    const therapist_id = therapistIdParam || pkg.therapist_id;
    const { data: therapist } = await supabase.from('therapists').select('id, stripe_account_id, square_access_token').eq('id', therapist_id).single();
    if (!therapist) return respond({ error: 'therapist_not_found' }, 404);

    let verifiedAmountCents = 0;
    let verifiedEmail = client_email || '';
    let paymentRefId = '';

    // ----- STRIPE VERIFY -----
    if (processor === 'stripe') {
      if (!session_id || !STRIPE_SECRET || !therapist.stripe_account_id) return respond({ error: 'stripe_verify_missing_params' }, 400);
      const sRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET}`,
          'Stripe-Account': therapist.stripe_account_id,
        },
      });
      const session = await sRes.json();
      if (!sRes.ok) return respond({ error: session.error?.message || 'stripe_verify_failed' }, 400);
      if (session.payment_status !== 'paid') return respond({ error: 'payment_not_completed', status: session.payment_status }, 400);
      verifiedAmountCents = session.amount_total;
      verifiedEmail = session.customer_email || session.customer_details?.email || verifiedEmail;
      paymentRefId = session.payment_intent || session.id;
    }

    // ----- SQUARE VERIFY -----
    if (processor === 'square') {
      if (!order_id || !therapist.square_access_token) return respond({ error: 'square_verify_missing_params' }, 400);
      const oRes = await fetch(`https://connect.squareup.com/v2/orders/${order_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${therapist.square_access_token}`,
          'Square-Version': '2024-01-18',
        },
      });
      const orderData = await oRes.json();
      if (!oRes.ok) return respond({ error: orderData.errors?.[0]?.detail || 'square_verify_failed' }, 400);
      const order = orderData.order;
      // Square order state COMPLETED means payment captured.
      if (order?.state !== 'COMPLETED') return respond({ error: 'payment_not_completed', state: order?.state }, 400);
      verifiedAmountCents = order.total_money?.amount || 0;
      paymentRefId = order_id;
    }

    if (verifiedAmountCents <= 0) return respond({ error: 'no_amount_verified' }, 400);

    // Idempotency check: if we already created a purchase for this
    // payment ref, return it instead of creating a duplicate.
    if (paymentRefId) {
      const { data: existing } = await supabase
        .from('package_purchases')
        .select('id')
        .eq('stripe_payment_id', paymentRefId)
        .maybeSingle();
      if (existing) {
        console.log('[confirm-package-purchase] already exists', existing.id);
        return respond({ ok: true, purchase_id: existing.id, idempotent: true });
      }
    }

    // Try to find an existing client record for this email so we can
    // link the purchase to a clients.id. Optional — the purchase row
    // also stores client_email for matching at booking time.
    let clientId = null;
    if (verifiedEmail) {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('therapist_id', therapist_id)
        .eq('email', verifiedEmail.toLowerCase())
        .maybeSingle();
      if (client) clientId = client.id;
    }

    // Compute expiry if package has expires_in_days set
    const expiresAt = pkg.expires_in_days
      ? new Date(Date.now() + pkg.expires_in_days * 86400000).toISOString()
      : null;

    const { data: purchase, error: insErr } = await supabase
      .from('package_purchases')
      .insert({
        therapist_id,
        package_id,
        client_id: clientId,
        client_email: (verifiedEmail || '').toLowerCase(),
        client_name: client_name || null,
        sessions_purchased: pkg.session_count,
        sessions_remaining: pkg.session_count,
        price_paid: verifiedAmountCents / 100,
        stripe_payment_id: paymentRefId,
        expires_at: expiresAt,
        status: 'active',
      })
      .select()
      .single();

    if (insErr) {
      console.error('[confirm-package-purchase] insert failed', insErr);
      return respond({ error: 'insert_failed: ' + insErr.message }, 500);
    }

    console.log('[confirm-package-purchase] success', { purchase_id: purchase.id });
    return respond({ ok: true, purchase_id: purchase.id });

  } catch (e) {
    console.error('[confirm-package-purchase] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
