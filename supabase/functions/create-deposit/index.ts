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
    const { therapist_id, booking_id, amount_cents, client_email, client_name, service_name, success_url, cancel_url } = await req.json();

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

    // Create Stripe Checkout Session — hosted by Stripe, no iframe needed
    const csRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Stripe-Account': therapist.stripe_account_id,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        mode: 'payment',
        'payment_method_types[]': 'card',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': `Deposit – ${service_name}`,
        'line_items[0][price_data][product_data][description]': `Session deposit with ${therapist.business_name || therapist.full_name}. Remaining balance paid at session.`,
        'line_items[0][price_data][unit_amount]': amount_cents.toString(),
        'line_items[0][quantity]': '1',
        customer_email: client_email,
        success_url: success_url,
        cancel_url: cancel_url,
        'metadata[booking_id]': booking_id,
        'metadata[therapist_id]': therapist_id,
      }),
    });

    const cs = await csRes.json();

    if (!csRes.ok) {
      return err(`Stripe error: ${cs.error?.message || 'unknown'}`);
    }

    // Store session ID on booking
    await supabase.from('bookings').update({
      deposit_payment_intent: cs.id,
      deposit_amount: amount_cents,
      deposit_required: true,
    }).eq('id', booking_id);

    return ok({ checkout_url: cs.url });

  } catch (e) {
    return err(`Unexpected error: ${e?.message ?? String(e)}`);
  }
});
