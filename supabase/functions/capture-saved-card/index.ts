// supabase/functions/capture-saved-card/index.ts
//
// Called after a Stripe PaymentIntent has succeeded for a booking
// deposit. Reads the payment_method from the PI and writes it to
// the clients table as card_on_file_id, so the therapist can:
//   - Charge the card later for cancellation policy
//   - See "card on file" indicator on the client card
//   - Skip the card form on the client's next booking
//
// Why this is a separate function rather than inline in the booking
// page:
//   - Stripe's PaymentMethod IDs are sensitive; clients should not
//     read them client-side then write back via supabase.from().
//     Going through an edge function lets the server be the only
//     place that reads the PI from Stripe.
//   - The edge function uses the service-role key for the DB write,
//     which avoids any RLS edge case where a client cannot update
//     their own row mid-flow.
//
// Idempotent: can be called multiple times for the same PaymentIntent
// without harm. The second call is a no-op (same payment_method
// written again).

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
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

  try {
    const { payment_intent_id, stripe_account_id, client_id, therapist_id } = await req.json();

    if (!payment_intent_id || !stripe_account_id || !client_id) {
      return respond({ error: 'Missing required fields' }, 400);
    }

    let STRIPE_SECRET: string;
    try {
      STRIPE_SECRET = getStripeSecret();
    } catch (e) {
      return respond({ error: (e as Error).message }, 500);
    }

    // Read the PaymentIntent on the connected account
    const piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${payment_intent_id}`, {
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Stripe-Account': stripe_account_id,
      },
    });
    const pi = await piRes.json();

    if (!piRes.ok || !pi.id) {
      return respond({ error: pi.error?.message || 'Could not retrieve PaymentIntent' }, 400);
    }

    // The payment_method is set after a successful charge. For
    // 3DS or redirect flows, the PI may be in 'processing' state
    // briefly; the payment_method is still attached so we can read
    // it.
    const paymentMethodId = pi.payment_method;
    const customerId = pi.customer;

    if (!paymentMethodId) {
      return respond({
        error: 'PaymentIntent has no payment_method yet (charge may not have succeeded)',
      }, 400);
    }

    // Write to the clients row. Use service role key because the
    // client themselves does not own write access to their own row
    // for this field (RLS protects against tampering).
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return respond({ error: 'Service role missing' }, 500);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const updateFields: Record<string, unknown> = {
      card_on_file_id: paymentMethodId,
      card_on_file_provider: 'stripe',
      card_on_file_saved_at: new Date().toISOString(),
    };
    if (customerId) {
      updateFields.stripe_customer_id = customerId;
    }

    const { error: updErr } = await supabase
      .from('clients')
      .update(updateFields)
      .eq('id', client_id);

    if (updErr) {
      return respond({
        error: `DB update failed: ${updErr.message}`,
      }, 500);
    }

    return respond({
      success: true,
      payment_method_id: paymentMethodId,
      customer_id: customerId,
    });

  } catch (e) {
    return respond({ error: `Error: ${(e as any)?.message ?? String(e)}` }, 500);
  }
});
