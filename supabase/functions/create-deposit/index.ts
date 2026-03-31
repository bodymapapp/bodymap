import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { therapist_id, booking_id, amount_cents, client_email, client_name, service_name } = await req.json();

    const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

    // Get therapist's Stripe account
    const { data: therapist } = await supabase
      .from('therapists')
      .select('stripe_account_id, full_name, business_name')
      .eq('id', therapist_id)
      .single();

    if (!therapist?.stripe_account_id) {
      return new Response(JSON.stringify({ error: 'Therapist has no Stripe account connected' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create Payment Intent on therapist's connected account
    const piRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Stripe-Account': therapist.stripe_account_id,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: amount_cents.toString(),
        currency: 'usd',
        'automatic_payment_methods[enabled]': 'true',
        'metadata[booking_id]': booking_id,
        'metadata[therapist_id]': therapist_id,
        description: `Deposit for ${service_name} with ${therapist.business_name || therapist.full_name}`,
        receipt_email: client_email,
      }),
    });

    const pi = await piRes.json();

    if (!piRes.ok) {
      return new Response(JSON.stringify({ error: pi.error?.message || 'Stripe error' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Store payment intent on booking
    await supabase.from('bookings').update({
      deposit_payment_intent: pi.id,
      deposit_amount: amount_cents,
      deposit_required: true,
    }).eq('id', booking_id);

    return new Response(JSON.stringify({
      client_secret: pi.client_secret,
      payment_intent_id: pi.id,
      amount: amount_cents,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
