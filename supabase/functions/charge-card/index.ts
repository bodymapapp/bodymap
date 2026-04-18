import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
      stripe_account_id,
      customer_id,
      payment_method_id,
      amount_cents,
      tip_cents,
      description,
      client_email,
      send_receipt,
    } = await req.json();

    const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET) return respond({ error: 'STRIPE_SECRET_KEY not set' }, 500);

    const total = amount_cents + (tip_cents || 0);

    const piRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Stripe-Account': stripe_account_id,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: String(total),
        currency: 'usd',
        customer: customer_id,
        payment_method: payment_method_id,
        'payment_method_types[]': 'card',
        confirm: 'true',
        off_session: 'true',
        description: description || 'Massage session',
        ...(send_receipt && client_email ? { receipt_email: client_email } : {}),
        'metadata[tip_cents]': String(tip_cents || 0),
      }),
    });

    const pi = await piRes.json();
    if (!piRes.ok) return respond({ error: pi.error?.message }, 400);

    return respond({ success: true, payment_intent_id: pi.id, amount: total, status: pi.status });

  } catch (e) {
    return respond({ error: String(e) }, 500);
  }
});
