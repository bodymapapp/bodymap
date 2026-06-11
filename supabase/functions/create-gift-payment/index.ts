// supabase/functions/create-gift-payment/index.ts
//
// Public endpoint for the gift purchase page (/gift/:customUrl). A
// gift-giver buys a gift card for a recipient; the charge goes to the
// therapist's connected Stripe account at 0% platform fee. Mirrors
// create-deposit's Connect PaymentIntent pattern.
//
// Flow:
//   1. Resolve the therapist by custom_url.
//   2. Validate amount and required fields.
//   3. Insert a gift_certificates row as 'pending_payment'.
//   4. Create a PaymentIntent on the connected account with metadata
//      { type:'gift', gift_id } and return its client_secret.
//   5. The browser confirms with the Payment Element, then calls
//      confirm-gift-payment to activate the row and fire the emails.
//      Completion is client-driven (like deposits), so it does not
//      depend on a Connect webhook being configured.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getStripeSecret } from "../_shared/paymentMode.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_CENTS = 2500;   // $25
const MAX_CENTS = 50000;  // $500

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const respond = (data: any) => new Response(JSON.stringify(data), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });

  try {
    const {
      custom_url, amount, design_key, theme_key,
      recipient_name, recipient_email,
      purchaser_name, purchaser_email,
      message, delivery, scheduled_date,
    } = await req.json();

    let STRIPE_SECRET: string;
    try { STRIPE_SECRET = getStripeSecret(); }
    catch (e) { return respond({ error: (e as Error).message }); }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return respond({ error: 'Server config missing' });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents < MIN_CENTS || cents > MAX_CENTS) {
      return respond({ error: 'amount_out_of_range' });
    }
    if (!recipient_name || !recipient_email || !String(recipient_email).includes('@') ||
        !purchaser_name || !purchaser_email || !String(purchaser_email).includes('@')) {
      return respond({ error: 'missing_fields' });
    }
    if (!custom_url) return respond({ error: 'missing_therapist' });

    const { data: therapist } = await supabase
      .from('therapists')
      .select('id, business_name, full_name, stripe_account_id, stripe_account_connected')
      .eq('custom_url', custom_url)
      .maybeSingle();
    if (!therapist) return respond({ error: 'therapist_not_found' });
    if (!therapist.stripe_account_connected || !therapist.stripe_account_id) {
      return respond({ error: 'gifts_unavailable' });
    }

    const code = genCode();
    const dlv = (delivery === 'scheduled' || delivery === 'self') ? delivery : 'now';
    const sched = (dlv === 'scheduled' && scheduled_date) ? scheduled_date : null;

    const { data: gift, error: insErr } = await supabase
      .from('gift_certificates')
      .insert({
        therapist_id: therapist.id,
        code,
        amount: cents / 100,
        remaining: cents / 100,
        recipient_name,
        recipient_email,
        purchaser_name,
        purchaser_email,
        message: message || null,
        design_template: design_key || null,
        theme: theme_key || null,
        delivery: dlv,
        scheduled_date: sched,
        status: 'pending_payment',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();
    if (insErr || !gift) {
      console.error('[create-gift-payment] insert failed', insErr);
      return respond({ error: 'could_not_create' });
    }

    const piParams: Record<string, string> = {
      amount: String(cents),
      currency: 'usd',
      'automatic_payment_methods[enabled]': 'true',
      'automatic_payment_methods[allow_redirects]': 'always',
      description: `Gift card - ${therapist.business_name || therapist.full_name || 'massage'}`,
      receipt_email: purchaser_email,
      'metadata[type]': 'gift',
      'metadata[gift_id]': gift.id,
      'metadata[therapist_id]': therapist.id,
    };

    const res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Stripe-Account': therapist.stripe_account_id,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(piParams),
    });
    const pi = await res.json();
    if (!res.ok || !pi.client_secret) {
      await supabase.from('gift_certificates').update({ status: 'payment_failed' }).eq('id', gift.id);
      return respond({ error: `stripe: ${pi.error?.message || 'payment_intent_failed'}` });
    }

    await supabase.from('gift_certificates')
      .update({ stripe_payment_intent_id: pi.id })
      .eq('id', gift.id);

    return respond({
      client_secret: pi.client_secret,
      account_id: therapist.stripe_account_id,
      payment_intent_id: pi.id,
      gift_id: gift.id,
      code,
    });
  } catch (e) {
    return respond({ error: `error: ${(e as any)?.message ?? String(e)}` });
  }
});
