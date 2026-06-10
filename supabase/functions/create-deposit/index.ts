// supabase/functions/create-deposit/index.ts
//
// Creates a Stripe PaymentIntent on a connected account for a booking
// deposit. The PaymentIntent uses automatic_payment_methods so all
// methods enabled at the Stripe platform level (cards, Apple Pay,
// Google Pay, Cash App Pay, Link, Amazon Pay, Klarna, Pix, and any
// future method) are offered to the client without code changes here.
//
// CARD AUTO-SAVE BEHAVIOR (May 8, 2026)
//
// HK reported during QA testing that paying a deposit did not save
// the card to the client's profile. Returning clients had to re-enter
// the card on every booking. Architectural fix:
//
//   1. We now find-or-create a Stripe Customer for the client BEFORE
//      creating the PaymentIntent. The Customer lives on the
//      connected account (the therapist's Stripe).
//
//   2. The PaymentIntent is linked to that Customer via the customer
//      parameter, AND we set setup_future_usage='off_session'.
//      This tells Stripe to attach the payment method to the Customer
//      after the charge succeeds, so it can be reused later for
//      cancellation-policy charges, package purchases, etc.
//
//   3. The PaymentIntent's payment_method (after charge succeeds)
//      becomes the client's card_on_file_id. The booking page's
//      deposit_return handler reads it from the PI and writes it to
//      the clients table.
//
// SAFETY NOTE
//
// setup_future_usage requires the customer to have given consent.
// The booking page already shows mandate text at the deposit step
// covering re-charge for cancellation policy. We rely on that mandate
// being visible, NOT on hiding the card-save behavior. Therapists
// who want to disable card-save entirely can be supported later via
// a per-therapist setting; defer until requested.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getStripeSecret } from "../_shared/paymentMode.ts";
import { validateCoupon, applyDiscountCents } from "../_shared/coupon.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const respond = (data: any) => new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

  try {
    const {
      stripe_account_id,
      amount_cents,
      client_id,
      client_email,
      client_name,
      client_phone,
      service_name,
      therapist_name,
      booking_id,
      therapist_id,
      // Pay-in-full + tip metadata (Lindsey #2). When payment_mode
      // is 'full', amount_cents already includes the full service
      // price plus tip; we just stash both numbers in PaymentIntent
      // metadata for downstream accounting.
      payment_mode,
      tip_cents,
      // HK Jun 9 2026: optional coupon entered at booking. When present we
      // re-validate it and recompute the charge from the real service price
      // here on the server, so the discount can never be faked from the
      // browser. The browser-sent amount_cents is ignored for coupon orders.
      coupon_code,
    } = await req.json();

    let STRIPE_SECRET: string;
    try {
      STRIPE_SECRET = getStripeSecret();
    } catch (e) {
      return respond({ error: (e as Error).message });
    }
    if (!stripe_account_id) return respond({ error: 'No Stripe account connected' });

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = (SUPABASE_URL && SUPABASE_SERVICE_KEY)
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      : null;

    // ─── Coupon: re-validate and recompute the charge server-side ──
    //
    // If a coupon code was entered, we never trust the browser's amount.
    // We load the coupon, validate it (active, not expired, under its
    // limit, new-clients rule), recompute the discount against the real
    // service price on the booking, and charge that. We also stamp the
    // booking so the therapist sees the code and the redemption trigger
    // can count it when the deposit is paid.
    let effectiveAmount = Number(amount_cents);
    let appliedCoupon: { id: string; code: string; discountCents: number } | null = null;
    if (coupon_code && String(coupon_code).trim() && supabase && booking_id) {
      const { data: bk } = await supabase
        .from('bookings').select('service_id, addon_total_price')
        .eq('id', booking_id).maybeSingle();
      const { data: cpn } = await supabase
        .from('coupons').select('*')
        .eq('therapist_id', therapist_id)
        .ilike('code', String(coupon_code).trim())
        .maybeSingle();

      let isNewClient = true;
      if (cpn?.new_clients_only && client_email) {
        const { data: existing } = await supabase
          .from('clients').select('id')
          .eq('therapist_id', therapist_id)
          .ilike('email', String(client_email).trim())
          .maybeSingle();
        isNewClient = !existing;
      }
      const v = validateCoupon(cpn as any, { isNewClient });
      if (!v.valid) {
        return respond({ error: 'coupon_invalid', coupon_reason: v.reason });
      }

      let svcPrice = 0;
      if (bk?.service_id) {
        const { data: svc } = await supabase
          .from('services').select('price').eq('id', bk.service_id).maybeSingle();
        svcPrice = Number(svc?.price || 0);
      }
      const fullPriceCents = Math.round((svcPrice + Number(bk?.addon_total_price || 0)) * 100);
      const { discountCents, discountedCents } = applyDiscountCents(fullPriceCents, cpn as any);

      const { data: th } = await supabase
        .from('therapists').select('deposit_percent').eq('id', therapist_id).maybeSingle();
      const pct = Number(th?.deposit_percent || 20);
      const tip = Number(tip_cents || 0);
      effectiveAmount = (payment_mode === 'full')
        ? discountedCents + tip
        : Math.round(discountedCents * pct / 100);
      // Stripe will not accept a charge under 50 cents. A discount this
      // deep is unusual for a deposit; floor at 50 so the charge succeeds.
      if (!Number.isFinite(effectiveAmount) || effectiveAmount < 50) effectiveAmount = Math.max(effectiveAmount, 50);

      appliedCoupon = { id: cpn!.id, code: cpn!.code, discountCents };
      await supabase.from('bookings').update({
        coupon_id: cpn!.id,
        coupon_code: cpn!.code,
        discount_cents: discountCents,
      }).eq('id', booking_id);
    }

    // ─── Step 1: find-or-create the Stripe Customer ──────────────
    //
    // We store stripe_customer_id on the clients row keyed per
    // therapist (since each therapist has their own connected account
    // and Customer namespace). Look up the existing one first; create
    // only if missing.
    //
    // If client_id was not provided (new booking by an unknown client),
    // look up the client row by email + therapist_id. The booking
    // insert path triggers a DB function that creates or finds the
    // client row, so by the time create-deposit runs, the row exists.
    let stripeCustomerId: string | null = null;
    let resolvedClientId: string | null = client_id || null;

    if (!resolvedClientId && client_email && therapist_id && supabase) {
      const { data: clientRow } = await supabase
        .from('clients')
        .select('id, stripe_customer_id')
        .eq('therapist_id', therapist_id)
        .ilike('email', client_email)
        .maybeSingle();
      if (clientRow?.id) {
        resolvedClientId = clientRow.id;
        stripeCustomerId = clientRow.stripe_customer_id || null;
      }
    } else if (resolvedClientId && supabase) {
      const { data: clientRow } = await supabase
        .from('clients')
        .select('stripe_customer_id')
        .eq('id', resolvedClientId)
        .maybeSingle();
      stripeCustomerId = clientRow?.stripe_customer_id || null;
    }

    if (!stripeCustomerId && client_email) {
      // Create a new Customer on the connected account
      const custBody = new URLSearchParams({
        email: client_email,
      });
      if (client_name) custBody.append('name', client_name);
      if (client_phone) custBody.append('phone', client_phone);

      const custRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET}`,
          'Stripe-Account': stripe_account_id,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: custBody,
      });
      const cust = await custRes.json();
      if (!custRes.ok || !cust.id) {
        // Customer creation failed. We still try to create the PI
        // without a customer; the charge will succeed but card will
        // not auto-save. Better than blocking the deposit entirely.
        console.warn('[create-deposit] Customer creation failed, proceeding without auto-save:', cust);
      } else {
        stripeCustomerId = cust.id;
        // Persist for next time so we do not duplicate Customers
        if (resolvedClientId && supabase) {
          await supabase.from('clients').update({
            stripe_customer_id: stripeCustomerId,
          }).eq('id', resolvedClientId);
        }
      }
    }

    // ─── Step 2: create the PaymentIntent ────────────────────────

    const isFullPayment = payment_mode === 'full';
    const piParams: Record<string, string> = {
      amount: String(effectiveAmount),
      currency: 'usd',
      'automatic_payment_methods[enabled]': 'true',
      'automatic_payment_methods[allow_redirects]': 'always',
      description: isFullPayment
        ? `Full payment - ${service_name} with ${therapist_name}`
        : `Deposit - ${service_name} with ${therapist_name}`,
      receipt_email: client_email,
      'metadata[booking_id]': booking_id || '',
      'metadata[therapist_id]': therapist_id || '',
      'metadata[client_id]': resolvedClientId || '',
      'metadata[payment_mode]': payment_mode || 'deposit',
      'metadata[tip_cents]': String(tip_cents || 0),
    };

    if (appliedCoupon) {
      piParams['metadata[coupon_id]'] = appliedCoupon.id;
      piParams['metadata[coupon_code]'] = appliedCoupon.code;
      piParams['metadata[discount_cents]'] = String(appliedCoupon.discountCents);
    }

    // If we have a Stripe Customer, attach it AND ask Stripe to save
    // the payment method for off-session reuse (cancellation charges,
    // future bookings without re-entering card). setup_future_usage
    // is the key parameter that converts a normal charge into a
    // charge-AND-save flow.
    if (stripeCustomerId) {
      piParams['customer'] = stripeCustomerId;
      piParams['setup_future_usage'] = 'off_session';
    }

    let res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Stripe-Account': stripe_account_id,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(piParams),
    });

    let pi = await res.json();

    // ─── Step 2b: handle stale stripe_customer_id ────────────────
    //
    // The stripe_customer_id stored on the clients row is scoped to
    // the Stripe connected account it was created against. If we
    // have ever moved a therapist between connected accounts
    // (Express account switch, account migration, the May 15 2026
    // architectural fix that reattached therapists to verified
    // accounts), the old customer IDs no longer exist in the new
    // account's namespace.
    //
    // Symptom: 'No such customer: cus_xxx' from Stripe.
    //
    // Recovery: drop the stale customer ID, create a fresh Customer
    // in the current connected account, save the new ID over the old
    // one, retry the PaymentIntent. The client experiences a one-time
    // re-save of their card on this booking; future bookings work
    // normally.
    if (!res.ok && pi.error?.code === 'resource_missing' &&
        (pi.error?.message || '').includes('customer') &&
        stripeCustomerId && client_email) {
      console.warn(`[create-deposit] Stale customer ${stripeCustomerId} for client ${resolvedClientId}; recreating in account ${stripe_account_id}`);

      // Create a fresh Customer in the current connected account
      const custBody = new URLSearchParams({ email: client_email });
      if (client_name) custBody.append('name', client_name);
      if (client_phone) custBody.append('phone', client_phone);

      const custRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET}`,
          'Stripe-Account': stripe_account_id,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: custBody,
      });
      const cust = await custRes.json();

      if (custRes.ok && cust.id) {
        // Overwrite the stale ID on the client row, AND clear any
        // saved payment_method_id since that was scoped to the old
        // customer / account too.
        if (resolvedClientId && supabase) {
          await supabase.from('clients').update({
            stripe_customer_id: cust.id,
            payment_method_id: null,
            card_saved_at: null,
          }).eq('id', resolvedClientId);
        }

        // Retry the PaymentIntent with the new customer
        piParams['customer'] = cust.id;
        res = await fetch('https://api.stripe.com/v1/payment_intents', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${STRIPE_SECRET}`,
            'Stripe-Account': stripe_account_id,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(piParams),
        });
        pi = await res.json();
        stripeCustomerId = cust.id;
      }
    }

    if (!res.ok) {
      return respond({ error: `Stripe: ${pi.error?.message || JSON.stringify(pi.error)}` });
    }

    return respond({
      client_secret: pi.client_secret,
      account_id: stripe_account_id,
      customer_id: stripeCustomerId,
      payment_intent_id: pi.id,
      client_id: resolvedClientId,
    });

  } catch (e) {
    return respond({ error: `Error: ${(e as any)?.message ?? String(e)}` });
  }
});
