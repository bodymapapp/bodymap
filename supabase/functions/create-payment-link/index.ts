// supabase/functions/create-payment-link/index.ts
//
// Phase 12: Create a Stripe Payment Link for a session.
//
// Candice request: 'how would they pay the therapist... this link is
// gone once the massage is booked.' This function answers that. The
// therapist taps Checkout > Send pay link on the calendar slide-over,
// enters amount + optional tip, picks SMS or email delivery, and we
// generate a one-time Stripe Payment Link the client can pay from
// their phone.
//
// Architecture decisions:
//   1. Stripe-only. Payment Links are a Stripe product; Square has
//      its own equivalent but we don't need parity for v1.
//   2. Creates a session_payments row with status='pending' immediately,
//      so the UI can show 'Link sent, waiting for payment' on the
//      booking. The webhook flips status='succeeded' + paid_at when
//      the client actually pays.
//   3. Metadata threading: we put booking_id + session_payment_id +
//      therapist_id in the Stripe PaymentLink metadata. The webhook
//      reads this back to know which row to update.
//   4. Tip handling: amount_cents and tip_cents are both passed as
//      line items. Stripe handles the math.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      therapist_id,
      booking_id,
      // Phase 19.4 (HK May 18 2026): subscription mode. Pass either
      // booking_id OR (member_subscription_id + member_subscription_renewal_id).
      // The session_payments row is keyed to whichever path is used.
      member_subscription_id,
      member_subscription_renewal_id,
      amount_cents,
      tip_cents = 0,
      service_name = 'Massage session',
      client_email,
    } = await req.json();

    if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);
    // Mode validation: exactly one of booking_id or member_subscription_id.
    const isSubscriptionMode = !!member_subscription_id;
    if (!booking_id && !member_subscription_id) {
      return respond({ error: 'booking_id or member_subscription_id required' }, 400);
    }
    if (booking_id && member_subscription_id) {
      return respond({ error: 'booking_id and member_subscription_id are mutually exclusive' }, 400);
    }
    if (!amount_cents || amount_cents <= 0) return respond({ error: 'amount_cents required' }, 400);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Load therapist for stripe_account_id (Stripe Connect)
    // HK May 31 2026 (Square Parity v1): also load Square credentials
    // so we can route to Square Checkout when the therapist is on
    // Square instead of Stripe. Auto-policy: prefer Stripe when both
    // are connected, fall back to Square. Identical to the deposit
    // flow.
    const { data: therapist, error: tErr } = await supabase
      .from('therapists')
      .select('id, stripe_account_id, stripe_account_connected, square_access_token, square_location_id, square_merchant_id, square_connected, full_name, business_name, custom_url')
      .eq('id', therapist_id)
      .single();
    if (tErr || !therapist) return respond({ error: 'therapist_not_found' }, 404);

    const hasStripe = !!(therapist.stripe_account_id && therapist.stripe_account_connected);
    const hasSquare = !!(therapist.square_access_token && therapist.square_connected);
    if (!hasStripe && !hasSquare) {
      return respond({ error: 'no_payment_processor_connected' }, 400);
    }

    // Booking mode: load booking row for client info + ownership check.
    // Subscription mode: load subscription row for client info + ownership.
    let clientId: string | null = null;
    let chargeContextLabel = service_name;
    if (isSubscriptionMode) {
      const { data: sub, error: sErr } = await supabase
        .from('member_subscriptions')
        .select('id, therapist_id, client_id, monthly_price, membership:memberships(name)')
        .eq('id', member_subscription_id)
        .single();
      if (sErr || !sub) return respond({ error: 'subscription_not_found' }, 404);
      if (sub.therapist_id !== therapist_id) {
        return respond({ error: 'subscription_not_owned_by_therapist' }, 403);
      }
      clientId = sub.client_id;
      const planName = (sub as any).membership?.name || 'Membership';
      chargeContextLabel = `${planName} renewal`;
    } else {
      const { data: booking, error: bErr } = await supabase
        .from('bookings')
        .select('id, therapist_id, client_id, client_name, client_email')
        .eq('id', booking_id)
        .single();
      if (bErr || !booking) return respond({ error: 'booking_not_found' }, 404);
      if (booking.therapist_id !== therapist_id) {
        return respond({ error: 'booking_not_owned_by_therapist' }, 403);
      }
      clientId = booking.client_id;
    }

    // Pick the provider. Prefer Stripe when both are connected so the
    // existing Stripe path runs unchanged. Square is only used when
    // Stripe is not connected.
    const useStripe = hasStripe;
    const useSquare = !hasStripe && hasSquare;

    // Create the pending session_payments row FIRST. We need its id
    // for the provider metadata so the webhook or verify step can find
    // this row when the client pays. The booking_id XOR
    // member_subscription_id constraint enforced by the migration
    // means exactly one of the two FK columns is set.
    const { data: paymentRow, error: pErr } = await supabase
      .from('session_payments')
      .insert({
        booking_id: booking_id || null,
        member_subscription_id: member_subscription_id || null,
        member_subscription_renewal_id: member_subscription_renewal_id || null,
        therapist_id,
        client_id: clientId,
        amount_cents,
        tip_cents,
        payment_method: useStripe ? 'stripe_payment_link' : 'square_payment_link',
        status: 'pending',
        paid_at: null,
        created_by_therapist_id: therapist_id,
      })
      .select('id')
      .single();
    if (pErr || !paymentRow) {
      console.error('[create-payment-link] failed to insert payment row', pErr);
      return respond({ error: 'failed_to_insert_payment_row' }, 500);
    }

    // ─── Square branch (HK May 31 2026, Square Parity v1) ────────────
    // Square Checkout API. Same shape outcome as Stripe Payment Link:
    // the therapist gets a URL to send to the client; the client pays
    // on Square's hosted page; the row stays pending until either the
    // client returns to the thanks redirect (verify-payment-link
    // confirms and flips the row) OR the therapist manually marks
    // paid. Webhook-driven auto-confirmation is a future enhancement.
    if (useSquare) {
      const { SquareProvider } = await import('../_shared/providers/square.ts');
      const squareProvider = new SquareProvider(therapist as any);

      const totalCents = amount_cents + tip_cents;
      const redirectUrl = `https://mybodymap.app/pay-thanks?sp=${paymentRow.id}`;

      try {
        const checkoutResult = await squareProvider.createCheckoutLink({
          therapist: therapist as any,
          items: [
            {
              itemId: `pay-link-${paymentRow.id}`,
              name: chargeContextLabel,
              amountCents: amount_cents,
              quantity: 1,
              metadata: {
                session_payment_id: paymentRow.id,
                booking_id: booking_id || '',
                member_subscription_id: member_subscription_id || '',
                therapist_id,
              },
            },
            ...(tip_cents > 0 ? [{
              itemId: `pay-link-tip-${paymentRow.id}`,
              name: 'Tip',
              amountCents: tip_cents,
              quantity: 1,
              metadata: { session_payment_id: paymentRow.id, kind: 'tip' },
            }] : []),
          ],
          customer: {
            email: client_email || '',
          },
          redirectUrl,
          metadata: {
            session_payment_id: paymentRow.id,
            therapist_id,
          },
          mode: 'payment',
        });

        // Save the Square link/order ids on the pending row so
        // verify-payment-link can look up by either, and the receipt
        // can show the Square dashboard order on reconciliation.
        await supabase
          .from('session_payments')
          .update({
            square_order_id: checkoutResult.paymentRefId,
            payment_method_detail: checkoutResult.url,
          })
          .eq('id', paymentRow.id);

        return respond({
          success: true,
          payment_link_url: checkoutResult.url,
          payment_link_id: checkoutResult.providerSessionId,
          session_payment_id: paymentRow.id,
          provider: 'square',
        });
      } catch (squareErr: any) {
        console.error('[create-payment-link] Square error', squareErr?.code, squareErr?.message);
        // Roll back the pending row so we don't leave an orphan
        await supabase.from('session_payments').delete().eq('id', paymentRow.id);
        return respond({
          error: squareErr?.message || 'square_payment_link_failed',
          code: squareErr?.code,
        }, 400);
      }
    }

    // ─── Stripe path (untouched) ─────────────────────────────────────
    if (!STRIPE_SECRET_KEY) return respond({ error: 'stripe_not_configured' }, 500);

    // Build Stripe Payment Link via direct API call (no SDK).
    // Two line items: the session amount and the tip (if any), each
    // as inline price_data so we don't need to pre-create products.
    const lineItems: any[] = [
      {
        'price_data[currency]': 'usd',
        'price_data[product_data][name]': chargeContextLabel,
        'price_data[unit_amount]': String(amount_cents),
        'quantity': '1',
      },
    ];
    if (tip_cents > 0) {
      lineItems.push({
        'price_data[currency]': 'usd',
        'price_data[product_data][name]': 'Tip',
        'price_data[unit_amount]': String(tip_cents),
        'quantity': '1',
      });
    }

    // Stripe API uses application/x-www-form-urlencoded for nested
    // params. Build the body manually.
    const params = new URLSearchParams();
    lineItems.forEach((item, idx) => {
      Object.entries(item).forEach(([k, v]) => {
        params.append(`line_items[${idx}][${k}]`, v as string);
      });
    });
    // Metadata so the webhook can find this row
    params.append('metadata[session_payment_id]', paymentRow.id);
    if (booking_id) {
      params.append('metadata[booking_id]', booking_id);
    }
    if (member_subscription_id) {
      params.append('metadata[member_subscription_id]', member_subscription_id);
    }
    if (member_subscription_renewal_id) {
      params.append('metadata[member_subscription_renewal_id]', member_subscription_renewal_id);
    }
    params.append('metadata[therapist_id]', therapist_id);
    // After-payment redirect to a 'thanks' page on the therapist site
    params.append('after_completion[type]', 'hosted_confirmation');
    params.append('after_completion[hosted_confirmation][custom_message]',
      `Thank you. Your payment to ${therapist.business_name || therapist.full_name || 'your therapist'} was received.`);

    const stripeRes = await fetch('https://api.stripe.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Account': therapist.stripe_account_id,
      },
      body: params.toString(),
    });

    const stripeData = await stripeRes.json();
    if (!stripeRes.ok) {
      console.error('[create-payment-link] Stripe error', stripeData);
      // Roll back the pending row so we don't have an orphan
      await supabase.from('session_payments').delete().eq('id', paymentRow.id);
      return respond({
        error: stripeData?.error?.message || 'stripe_payment_link_failed',
        code: stripeData?.error?.code,
      }, 400);
    }

    // Save the Stripe payment link id on our pending row
    await supabase
      .from('session_payments')
      .update({
        stripe_payment_link_id: stripeData.id,
        payment_method_detail: stripeData.url,
      })
      .eq('id', paymentRow.id);

    return respond({
      success: true,
      payment_link_url: stripeData.url,
      payment_link_id: stripeData.id,
      session_payment_id: paymentRow.id,
    });

  } catch (e) {
    console.error('[create-payment-link] uncaught', e);
    return respond({ error: String((e as any)?.message || e) }, 500);
  }
});

function respond(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
