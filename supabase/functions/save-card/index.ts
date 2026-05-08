import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const { stripe_account_id, client_id, client_email, client_name, therapist_id } = await req.json();

    let STRIPE_SECRET: string;
    try {
      STRIPE_SECRET = getStripeSecret();
    } catch (e) {
      return respond({ error: e.message }, 500);
    }
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!stripe_account_id) return respond({ error: 'No Stripe account connected' }, 400);

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

    // Check if client already has a Stripe customer ID
    const { data: client } = await supabase
      .from('clients')
      .select('stripe_customer_id')
      .eq('id', client_id)
      .single();

    let customerId = client?.stripe_customer_id;

    // Create Stripe customer on therapist's connected account if not exists
    if (!customerId) {
      const custRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET}`,
          'Stripe-Account': stripe_account_id,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: client_email || '',
          name: client_name || '',
          'metadata[client_id]': client_id,
          'metadata[therapist_id]': therapist_id,
        }),
      });
      const cust = await custRes.json();
      if (!custRes.ok) return respond({ error: cust.error?.message }, 400);
      customerId = cust.id;

      // Save customer ID to client record
      await supabase.from('clients').update({ stripe_customer_id: customerId }).eq('id', client_id);
    }

    // Create SetupIntent to collect card without charging
    const siRes = await fetch('https://api.stripe.com/v1/setup_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Stripe-Account': stripe_account_id,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customerId,
        'payment_method_types[]': 'card',
        usage: 'off_session',
      }),
    });
    const si = await siRes.json();
    if (!siRes.ok) return respond({ error: si.error?.message }, 400);

    return respond({ client_secret: si.client_secret, customer_id: customerId, account_id: stripe_account_id });

  } catch (e) {
    return respond({ error: String(e) }, 500);
  }
});
