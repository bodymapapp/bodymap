import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ok  = (data) => new Response(JSON.stringify(data),           { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const err = (msg)  => new Response(JSON.stringify({ error: msg }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { therapist_id, booking_id, amount_cents, client_email, service_name } = await req.json();

    const STRIPE_SECRET        = Deno.env.get('STRIPE_SECRET_KEY');
    const SUPABASE_URL         = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!STRIPE_SECRET)        return err('STRIPE_SECRET_KEY not configured');
    if (!SUPABASE_URL)         return err('SUPABASE_URL not set');
    if (!SUPABASE_SERVICE_KEY) return err('SUPABASE_SERVICE_ROLE_KEY not set');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: therapist } = await supabase
      .from('therapists')
      .select('stripe_account_id, full_name, business_name')
      .eq('id', therapist_id)
      .single();

    if (!therapist?.stripe_account_id) {
      return err('Stripe not connected. Go to Settings and connect your Stripe account.');
    }

    // Payment Intent created directly on therapist's Stripe account via Connect
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
        'payment_method_types[]': 'card',
        'metadata[booking_id]': booking_id,
        'metadata[therapist_id]': therapist_id,
        description: `Deposit - ${service_name} with ${therapist.business_name || therapist.full_name}`,
        receipt_email: client_email,
      }),
    });

    const pi = await piRes.json();

    if (!piRes.ok) {
      return err(`Stripe error: ${pi.error?.message || 'unknown'}`);
    }

    await supabase.from('bookings').update({
      deposit_payment_intent: pi.id,
      deposit_amount: amount_cents,
      deposit_required: true,
    }).eq('id', booking_id);

    return ok({
      client_secret: pi.client_secret,
      payment_intent_id: pi.id,
      amount: amount_cents,
    });

  } catch (e) {
    return err(`Unexpected error: ${e?.message ?? String(e)}`);
  }
});
