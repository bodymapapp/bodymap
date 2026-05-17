// supabase/functions/get-payment-method/index.ts
//
// Phase 13.5 followup (HK May 17 2026): fetch PaymentMethod details
// (card brand + last4) from Stripe so we can persist them on the
// clients row after a card is saved.
//
// Background:
//   CheckoutModal previously tried to fetch /v1/payment_methods/{id}
//   from the browser using the publishable key. That doesn't work,
//   Stripe blocks reads of PaymentMethod objects with anything but a
//   secret key. The fetch failed silently (.catch returns null), so
//   card_last4 + card_brand were always written as null. Result:
//   "Card on file" never appeared on subsequent visits even though
//   Stripe had the card saved on its side.
//
// This edge function:
//   1. Takes { stripe_account_id, payment_method_id }
//   2. Fetches the PaymentMethod from Stripe using the secret key
//      and the Stripe-Account header (Connect)
//   3. Returns { brand, last4 } or { error }
//
// Single-purpose, no side effects, no DB writes. Caller (CheckoutModal)
// uses the response to populate the clients row update.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getStripeSecret } from "../_shared/paymentMode.ts";

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
    const { stripe_account_id, payment_method_id } = await req.json();

    if (!stripe_account_id) return respond({ error: 'No Stripe account' }, 400);
    if (!payment_method_id) return respond({ error: 'No payment_method_id' }, 400);

    let STRIPE_SECRET: string;
    try {
      STRIPE_SECRET = getStripeSecret();
    } catch (e) {
      return respond({ error: e.message }, 500);
    }

    const pmRes = await fetch(`https://api.stripe.com/v1/payment_methods/${payment_method_id}`, {
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Stripe-Account': stripe_account_id,
      },
    });
    const pm = await pmRes.json();

    if (!pmRes.ok) {
      return respond({ error: pm.error?.message || 'Stripe error' }, pmRes.status);
    }

    return respond({
      brand: pm.card?.brand || null,
      last4: pm.card?.last4 || null,
      exp_month: pm.card?.exp_month || null,
      exp_year: pm.card?.exp_year || null,
    });

  } catch (e) {
    return respond({ error: String(e) }, 500);
  }
});
