import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET) return respond({ error: 'STRIPE_SECRET_KEY not set' });
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
        'payment_method_types[]': 'card',
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
