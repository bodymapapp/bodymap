// supabase/functions/create-cancellation-fee-link/index.ts
//
// Phase 13.6 (HK May 17 2026): generate a Stripe Payment Link for a
// cancellation or no-show fee when the client has no card on file.
//
// Mirrors create-payment-link but writes to cancellation_charges
// instead of session_payments, and the metadata threads a
// cancellation_charge_id so the webhook can find the right row.
//
// Architecture:
//   1. Inserts cancellation_charges row with status='pending' first.
//   2. Creates a Stripe Payment Link with metadata pointing back.
//   3. Returns the URL plus the cancellation_charge_id.
//   4. Caller (CancellationChargeModal) handles SMS/email delivery
//      via sms:/mailto: handlers on the therapist's device.
//
// The booking is NOT marked no_show or cancelled by this function;
// the caller marks the booking separately. This keeps concerns
// separated: this function only handles the FEE side.
//
// Webhook (stripe-payment-link-webhook) was extended to recognize
// metadata.cancellation_charge_id and update cancellation_charges
// instead of session_payments when present.

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
      client_id,
      amount_cents,
      trigger_event,    // 'cancel' | 'reschedule' | 'no_show'
      policy_percent,
      session_price_cents,
      hours_before_appointment,
      policy_snapshot,
    } = await req.json();

    if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);
    if (!booking_id) return respond({ error: 'booking_id required' }, 400);
    if (!amount_cents || amount_cents <= 0) return respond({ error: 'amount_cents required' }, 400);
    if (!trigger_event || !['cancel', 'reschedule', 'no_show'].includes(trigger_event)) {
      return respond({ error: 'trigger_event must be cancel, reschedule, or no_show' }, 400);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Load therapist for Stripe Connect + Square credentials.
    // HK May 31 2026 (Square Parity v1): pulls Square fields so the
    // Square branch below can route to Square Checkout when the
    // therapist is on Square instead of Stripe.
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
    const useStripe = hasStripe;
    const useSquare = !hasStripe && hasSquare;

    // Confirm booking belongs to this therapist.
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('id, therapist_id, client_id, client_name, client_email')
      .eq('id', booking_id)
      .single();
    if (bErr || !booking) return respond({ error: 'booking_not_found' }, 404);
    if (booking.therapist_id !== therapist_id) {
      return respond({ error: 'booking_not_owned_by_therapist' }, 403);
    }

    // Idempotency: if a pending or succeeded cancellation_charges row
    // already exists for this booking, return its existing URL rather
    // than creating a new one. Defense against double-clicks.
    const { data: existing } = await supabase
      .from('cancellation_charges')
      .select('id, status, error_message')
      .eq('booking_id', booking_id)
      .in('status', ['pending', 'succeeded'])
      .maybeSingle();
    if (existing?.status === 'succeeded') {
      return respond({
        error: 'fee_already_paid',
        cancellation_charge_id: existing.id,
      }, 409);
    }

    // Insert the pending cancellation_charges row first. Its id goes
    // in the Stripe metadata.
    const { data: chargeRow, error: cErr } = await supabase
      .from('cancellation_charges')
      .insert({
        booking_id,
        therapist_id,
        client_id: client_id || booking.client_id,
        amount_cents,
        policy_percent: policy_percent || null,
        session_price_cents: session_price_cents || null,
        trigger_event,
        reason_code: 'send_link',
        hours_before_appointment: hours_before_appointment || null,
        status: 'pending',
        policy_snapshot: policy_snapshot || null,
      })
      .select('id')
      .single();
    if (cErr || !chargeRow) {
      console.error('[create-cancellation-fee-link] failed to insert pending row', cErr);
      return respond({ error: 'failed_to_insert_charge_row' }, 500);
    }

    const triggerLabel = trigger_event === 'no_show'
      ? 'No-show fee'
      : trigger_event === 'reschedule'
        ? 'Reschedule fee'
        : 'Cancellation fee';

    // ─── Square branch (HK May 31 2026, Square Parity v1) ────────────
    if (useSquare) {
      const { SquareProvider } = await import('../_shared/providers/square.ts');
      const squareProvider = new SquareProvider(therapist as any);

      const redirectUrl = `https://mybodymap.app/pay-thanks?cc=${chargeRow.id}`;

      try {
        const checkoutResult = await squareProvider.createCheckoutLink({
          therapist: therapist as any,
          items: [{
            itemId: `cancel-fee-${chargeRow.id}`,
            name: triggerLabel,
            amountCents: amount_cents,
            quantity: 1,
            metadata: {
              cancellation_charge_id: chargeRow.id,
              booking_id,
              therapist_id,
              kind: 'cancellation_fee',
            },
          }],
          customer: { email: booking.client_email || '' },
          redirectUrl,
          metadata: {
            cancellation_charge_id: chargeRow.id,
            therapist_id,
            kind: 'cancellation_fee',
          },
          mode: 'payment',
        });

        // Save the Square order id on the pending row for reconciliation.
        await supabase
          .from('cancellation_charges')
          .update({
            processor: 'square',
            square_order_id: checkoutResult.paymentRefId,
          })
          .eq('id', chargeRow.id);

        return respond({
          success: true,
          payment_link_url: checkoutResult.url,
          payment_link_id: checkoutResult.providerSessionId,
          cancellation_charge_id: chargeRow.id,
          provider: 'square',
        });
      } catch (squareErr: any) {
        console.error('[create-cancellation-fee-link] Square error', squareErr?.code, squareErr?.message);
        await supabase.from('cancellation_charges').delete().eq('id', chargeRow.id);
        return respond({
          error: squareErr?.message || 'square_payment_link_failed',
          code: squareErr?.code,
        }, 400);
      }
    }

    // ─── Stripe path (untouched) ─────────────────────────────────────
    if (!STRIPE_SECRET_KEY) return respond({ error: 'stripe_not_configured' }, 500);

    // Build the Stripe Payment Link via direct API.

    const params = new URLSearchParams();
    params.append('line_items[0][price_data][currency]', 'usd');
    params.append('line_items[0][price_data][product_data][name]', triggerLabel);
    params.append('line_items[0][price_data][unit_amount]', String(amount_cents));
    params.append('line_items[0][quantity]', '1');
    // Metadata for the webhook
    params.append('metadata[cancellation_charge_id]', chargeRow.id);
    params.append('metadata[booking_id]', booking_id);
    params.append('metadata[therapist_id]', therapist_id);
    params.append('metadata[kind]', 'cancellation_fee');
    // After-payment confirmation
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
      console.error('[create-cancellation-fee-link] Stripe error', stripeData);
      // Roll back the pending row so we don't have an orphan
      await supabase.from('cancellation_charges').delete().eq('id', chargeRow.id);
      return respond({
        error: stripeData?.error?.message || 'stripe_payment_link_failed',
        code: stripeData?.error?.code,
      }, 400);
    }

    return respond({
      success: true,
      payment_link_url: stripeData.url,
      payment_link_id: stripeData.id,
      cancellation_charge_id: chargeRow.id,
    });

  } catch (e) {
    console.error('[create-cancellation-fee-link] uncaught', e);
    return respond({ error: String((e as any)?.message || e) }, 500);
  }
});

function respond(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
