// supabase/functions/stripe-payment-link-webhook/index.ts
//
// Phase 12: Webhook handler for Stripe Payment Links.
//
// Stripe POSTs here when a checkout session backing one of our
// payment links completes. We pull the metadata we put on the
// link (session_payment_id, booking_id, therapist_id) and mark
// the session_payments row as paid.
//
// IMPORTANT: webhook signature verification is REQUIRED in
// production. Stripe signs every webhook with STRIPE_WEBHOOK_SECRET.
// We verify the signature before trusting the payload.
//
// HK to configure in Stripe Dashboard:
//   1. Developers > Webhooks > Add endpoint
//   2. URL: https://<project>.supabase.co/functions/v1/stripe-payment-link-webhook
//   3. Events: checkout.session.completed
//   4. Copy signing secret into Supabase env: STRIPE_WEBHOOK_SECRET
//
// NOTE: this webhook is on the PLATFORM Stripe account, but the
// PaymentLinks were created using Stripe-Account header (Connect).
// Stripe sends webhooks to the platform for Connect events too, with
// the connected account id in the 'account' field of the event.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_PAYMENT_LINK_WEBHOOK_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    // Verify Stripe signature if a secret is configured. If not
    // configured (dev mode), log a warning and accept the payload.
    if (STRIPE_WEBHOOK_SECRET) {
      const verified = await verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);
      if (!verified) {
        console.warn('[stripe-payment-link-webhook] signature verification failed');
        return new Response('signature verification failed', { status: 400, headers: corsHeaders });
      }
    } else {
      console.warn('[stripe-payment-link-webhook] STRIPE_PAYMENT_LINK_WEBHOOK_SECRET not configured, accepting unsigned');
    }

    const event = JSON.parse(rawBody);

    // We only handle checkout.session.completed. Stripe also fires
    // checkout.session.async_payment_succeeded for bank transfers etc;
    // we ignore those for now since we only accept cards on payment links.
    if (event.type !== 'checkout.session.completed') {
      return new Response(JSON.stringify({ received: true, ignored: event.type }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const session = event.data?.object;
    const metadata = session?.metadata || {};
    const sessionPaymentId = metadata.session_payment_id;
    const cancellationChargeId = metadata.cancellation_charge_id;
    const bookingId = metadata.booking_id;

    if (!sessionPaymentId && !cancellationChargeId) {
      console.warn('[stripe-payment-link-webhook] no session_payment_id or cancellation_charge_id in metadata, ignoring', metadata);
      return new Response(JSON.stringify({ received: true, ignored: 'no_metadata' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Phase 13.6 (HK May 17 2026): branch by metadata kind. Cancellation
    // fee link payments update cancellation_charges; regular session
    // payments update session_payments. Same Stripe webhook handles both.
    if (cancellationChargeId) {
      const { data: chargeRow } = await supabase
        .from('cancellation_charges')
        .select('id, status')
        .eq('id', cancellationChargeId)
        .single();

      if (!chargeRow) {
        console.warn('[stripe-payment-link-webhook] cancellation_charges row not found', cancellationChargeId);
        return new Response(JSON.stringify({ received: true, ignored: 'cc_row_not_found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (chargeRow.status === 'succeeded') {
        return new Response(JSON.stringify({ received: true, already_processed: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const paymentIntentId = session.payment_intent;
      await supabase
        .from('cancellation_charges')
        .update({
          status: 'succeeded',
          succeeded_at: new Date().toISOString(),
          payment_intent_id: paymentIntentId || null,
        })
        .eq('id', cancellationChargeId);

      return new Response(JSON.stringify({ received: true, kind: 'cancellation_fee', charge_id: cancellationChargeId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Session payment branch below (unchanged).

    // Pull the existing row to compute the card detail
    const { data: paymentRow } = await supabase
      .from('session_payments')
      .select('id, status')
      .eq('id', sessionPaymentId)
      .single();

    if (!paymentRow) {
      console.warn('[stripe-payment-link-webhook] session_payment row not found', sessionPaymentId);
      return new Response(JSON.stringify({ received: true, ignored: 'row_not_found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (paymentRow.status === 'succeeded') {
      // Idempotency: already processed
      return new Response(JSON.stringify({ received: true, already_processed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pull the payment intent for card details
    const paymentIntentId = session.payment_intent;
    let cardDetail = 'Card';
    if (paymentIntentId) {
      try {
        const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
        const connectedAccount = event.account;
        const piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}?expand[]=charges.data.payment_method_details`, {
          headers: {
            'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
            ...(connectedAccount ? { 'Stripe-Account': connectedAccount } : {}),
          },
        });
        const pi = await piRes.json();
        const charge = pi?.charges?.data?.[0];
        const last4 = charge?.payment_method_details?.card?.last4;
        const brand = charge?.payment_method_details?.card?.brand;
        if (last4 && brand) {
          cardDetail = `${brand[0].toUpperCase()}${brand.slice(1)} ${last4}`;
        }
      } catch (e) {
        console.warn('[stripe-payment-link-webhook] failed to fetch PI details', e);
      }
    }

    // Mark the row as succeeded
    const { error: updErr } = await supabase
      .from('session_payments')
      .update({
        status: 'succeeded',
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId || null,
        stripe_charge_id: session.payment_intent ? null : null,
        payment_method_detail: cardDetail,
      })
      .eq('id', sessionPaymentId);

    if (updErr) {
      console.error('[stripe-payment-link-webhook] failed to update', updErr);
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Phase 19.4 (HK May 18 2026): if this session_payment is for a
    // membership renewal (member_subscription_renewal_id set on the
    // row by the create-payment-link request), resolve the renewal
    // as paid. Defensive: the column may not exist pre-migration.
    try {
      const { data: paidRow } = await supabase
        .from('session_payments')
        .select('member_subscription_renewal_id, therapist_id')
        .eq('id', sessionPaymentId)
        .maybeSingle();
      if (paidRow?.member_subscription_renewal_id) {
        await supabase.from('member_subscription_renewals').update({
          status: 'paid',
          resolved_at: new Date().toISOString(),
          resolved_by_therapist_id: paidRow.therapist_id,
          session_payment_id: sessionPaymentId,
        }).eq('id', paidRow.member_subscription_renewal_id);
      }
    } catch (rErr) {
      console.warn('[stripe-payment-link-webhook] renewal resolution failed (non-blocking):', rErr);
    }

    // Phase 28b (HK Jun 9 2026): if this payment is for a package, record
    // the Stripe payment id on the package_purchases row so a later refund
    // can find the charge. The package was created active when the link
    // was sent, so we only stamp the payment id and do not change status
    // (avoids reactivating a package the therapist may have cancelled).
    try {
      const { data: pkgPayRow } = await supabase
        .from('session_payments')
        .select('package_purchase_id')
        .eq('id', sessionPaymentId)
        .maybeSingle();
      if (pkgPayRow?.package_purchase_id) {
        await supabase.from('package_purchases').update({
          stripe_payment_id: paymentIntentId || null,
        }).eq('id', pkgPayRow.package_purchase_id);
      }
    } catch (pkgErr) {
      console.warn('[stripe-payment-link-webhook] package stamp failed (non-blocking):', pkgErr);
    }

    return new Response(JSON.stringify({ received: true, marked_paid: sessionPaymentId, booking_id: bookingId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('[stripe-payment-link-webhook] uncaught', e);
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// HMAC-SHA256 signature verification per Stripe's spec.
// https://stripe.com/docs/webhooks/signatures
async function verifyStripeSignature(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;

  // Stripe signature header format: "t=1234567890,v1=abc...,v0=def..."
  const parts = signature.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts.t;
  const expectedSig = parts.v1;
  if (!timestamp || !expectedSig) return false;

  // Reject events older than 5 minutes (replay attack protection)
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (age > 300) return false;

  const signedPayload = `${timestamp}.${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const sigHex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Timing-safe comparison
  if (sigHex.length !== expectedSig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < sigHex.length; i++) {
    mismatch |= sigHex.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  return mismatch === 0;
}
