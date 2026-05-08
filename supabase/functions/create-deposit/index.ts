import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getStripeSecret } from "../_shared/paymentMode.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const respond = (data) => new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

  try {
    const {
      stripe_account_id,
      amount_cents,
      client_email,
      service_name,
      therapist_name,
      booking_id,
      therapist_id,
    } = await req.json();

    let STRIPE_SECRET;
    try {
      STRIPE_SECRET = getStripeSecret();
    } catch (e) {
      return respond({ error: e.message });
    }
    if (!stripe_account_id) return respond({ error: 'No Stripe account connected' });

    const res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Stripe-Account': stripe_account_id,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: String(amount_cents),
        currency: 'usd',
        // automatic_payment_methods replaces the legacy payment_method_types
        // list. With this enabled, the PaymentIntent will accept any payment
        // method enabled at the platform level (cards, Apple Pay, Google Pay,
        // Cash App Pay, Link, Amazon Pay, Klarna, Pix, etc) without us
        // having to maintain a list. The Payment Element on the booking
        // page will surface only the methods that work for the visitor's
        // device and region.
        'automatic_payment_methods[enabled]': 'true',
        // allow_redirects: 'never' would force same-page methods only.
        // We allow redirects for Klarna and similar, but the booking page
        // sets a return_url so users come back to the right place.
        'automatic_payment_methods[allow_redirects]': 'always',
        description: `Deposit - ${service_name} with ${therapist_name}`,
        receipt_email: client_email,
        'metadata[booking_id]': booking_id || '',
        'metadata[therapist_id]': therapist_id || '',
      }),
    });

    const pi = await res.json();

    if (!res.ok) {
      return respond({ error: `Stripe: ${pi.error?.message || JSON.stringify(pi.error)}` });
    }

    return respond({
      client_secret: pi.client_secret,
      account_id: stripe_account_id,
    });

  } catch (e) {
    return respond({ error: `Error: ${e?.message ?? String(e)}` });
  }
});
