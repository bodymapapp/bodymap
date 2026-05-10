// supabase/functions/square-create-deposit/index.ts
//
// Square deposit at booking time. Refactored May 2026 to use
// PaymentProvider abstraction.
//
// Why this is Square-specific (no parallel for Stripe):
//   Stripe deposits use create-deposit (a PaymentIntent + Stripe
//   Elements embedded form), not a hosted Checkout link, because the
//   embedded form keeps the client on the booking page. Square has
//   no equivalent embedded primitive without their Web Payments SDK
//   (which is not on the roadmap, see strategic reframe).
//
//   So Square deposits use the hosted Payment Link path.
//   create-deposit and square-create-deposit are intentionally
//   different shapes in the abstraction — one returns a client_secret,
//   the other returns a redirect URL. The booking page handles both.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, respond, getSupabaseClient, loadTherapist,
  getProvider, ProviderError,
} from '../_shared/payment-provider.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      therapist_id, booking_id, amount_cents,
      service_name, therapist_name, client_email, redirect_url,
      // Pay-in-full + tip metadata (Lindsey #2)
      payment_mode, tip_cents,
    } = await req.json();

    console.log('[square-create-deposit] start', { therapist_id, booking_id, amount_cents });

    if (!therapist_id || !booking_id) return respond({ error: 'therapist_id and booking_id required' }, 400);
    if (!amount_cents || amount_cents <= 0) return respond({ error: 'amount_cents must be positive' }, 400);

    const supabase = getSupabaseClient();
    const therapist = await loadTherapist(supabase, therapist_id);

    // Force Square: deposits via this endpoint are Square-only by
    // design. The Stripe path is /create-deposit with a different
    // shape. Calling square-create-deposit on a Stripe-only therapist
    // is a frontend bug; fail loud.
    if (!therapist.square_access_token) {
      return respond({ error: 'Square is not connected on this therapist profile' }, 400);
    }

    const provider = await getProvider(therapist, 'auto');
    if (provider.name !== 'square') {
      const { SquareProvider } = await import('../_shared/providers/square.ts');
      const squareProvider = new SquareProvider();
      return await runSquareDeposit(squareProvider, therapist, {
        booking_id, amount_cents, service_name, therapist_name, client_email, redirect_url,
        payment_mode, tip_cents,
      }, supabase);
    }

    return await runSquareDeposit(provider, therapist, {
      booking_id, amount_cents, service_name, therapist_name, client_email, redirect_url,
      payment_mode, tip_cents,
    }, supabase);

  } catch (e) {
    if (e instanceof ProviderError) {
      console.error('[square-create-deposit] provider error', e.code, e.message);
      return respond({ error: e.message, code: e.code }, 400);
    }
    console.error('[square-create-deposit] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});

async function runSquareDeposit(provider: any, therapist: any, args: any, supabase: any) {
  const therapistName = args.therapist_name || therapist.business_name || therapist.full_name || 'Therapist';
  const isFullPayment = args.payment_mode === 'full';
  const itemName = isFullPayment
    ? `Full payment · ${args.service_name || 'Massage session'}`
    : `Deposit · ${args.service_name || 'Massage session'}`;
  const itemDescription = isFullPayment
    ? `Full payment for ${args.service_name || 'session'} with ${therapistName}`
    : `Deposit for ${args.service_name || 'session'} with ${therapistName}`;

  const result = await provider.createCheckoutLink({
    therapist,
    items: [{
      itemId: `${isFullPayment ? 'full' : 'deposit'}-${args.booking_id}`,
      name: itemName,
      description: itemDescription,
      amountCents: args.amount_cents,
      quantity: 1,
      metadata: {
        booking_id: args.booking_id,
        item_type: isFullPayment ? 'full_payment' : 'deposit',
        payment_mode: args.payment_mode || 'deposit',
        tip_cents: String(args.tip_cents || 0),
      },
    }],
    customer: { name: null, email: args.client_email || 'noemail@example.com', phone: null },
    redirectUrl: args.redirect_url || `https://www.mybodymap.app/${therapist.custom_url}?deposit_complete=1&booking_id=${args.booking_id}`,
    metadata: {
      booking_id: args.booking_id,
      purpose: isFullPayment ? 'full_payment' : 'deposit',
      payment_mode: args.payment_mode || 'deposit',
      tip_cents: String(args.tip_cents || 0),
    },
    mode: 'payment',
  });

  // Persist the order_id on the booking for matching back at redirect.
  await supabase.from('bookings').update({
    square_deposit_order_id: result.paymentRefId,
    square_deposit_link_id: result.providerSessionId,
  }).eq('id', args.booking_id);

  console.log('[square-create-deposit] success', {
    booking_id: args.booking_id, order_id: result.paymentRefId, url: result.url,
  });

  return respond({
    url: result.url,
    order_id: result.paymentRefId,
    payment_link_id: result.providerSessionId,
  });
}
