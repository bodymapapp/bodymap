// supabase/functions/square-payment-link-webhook/index.ts
//
// HK May 31 2026 (Square Parity v1.1): server-side webhook handler for
// Square payments. Closes the v1 gap where Square pay-links relied on
// the client returning to /pay-thanks to flip the row to succeeded.
// When the client closes the Square tab without returning, the
// browser-based confirmation never fires; with this webhook in place,
// Square itself notifies us server-to-server and we flip the row no
// matter what the client's browser did.
//
// Mirrors stripe-payment-link-webhook's shape:
//   1. Verify HMAC-SHA256 signature header (x-square-hmacsha256-signature)
//      against SQUARE_WEBHOOK_SIGNATURE_KEY env var
//   2. Handle payment.updated events where payment.status === 'COMPLETED'
//   3. Match payment.order_id to our session_payments.square_order_id
//      (saved when the pay-link was created) OR cancellation_charges.square_order_id
//   4. Idempotent: if the row is already succeeded, no-op
//   5. Fire notify-payment-event so the client receipt + therapist
//      notification fan out (same as Stripe path)
//
// HK to configure in Square Developer Dashboard:
//   1. Webhooks > Add subscription
//   2. URL: https://<project>.supabase.co/functions/v1/square-payment-link-webhook
//   3. Event: payment.updated
//   4. Copy signature key into Supabase env: SQUARE_WEBHOOK_SIGNATURE_KEY
//
// Square's signature is computed as base64(HMAC-SHA256(signature_key,
// notification_url + raw_body)). The notification_url MUST exactly
// match what's configured in the dashboard. We pull it from
// SQUARE_WEBHOOK_URL env (HK sets to the exact URL configured above).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-square-hmacsha256-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SQUARE_WEBHOOK_SIGNATURE_KEY = Deno.env.get('SQUARE_WEBHOOK_SIGNATURE_KEY');
    const SQUARE_WEBHOOK_URL = Deno.env.get('SQUARE_WEBHOOK_URL');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const rawBody = await req.text();
    const signature = req.headers.get('x-square-hmacsha256-signature');

    // Signature verification. If a key is configured, verification is
    // mandatory; mismatched signatures are rejected. If not configured
    // (dev mode bootstrap), accept the payload with a warning so we
    // can wire and test before HK has finished the dashboard step.
    if (SQUARE_WEBHOOK_SIGNATURE_KEY) {
      if (!SQUARE_WEBHOOK_URL) {
        console.error('[square-payment-link-webhook] SQUARE_WEBHOOK_URL not configured; cannot verify');
        return new Response('webhook_url_missing', { status: 500, headers: corsHeaders });
      }
      const verified = await verifySquareSignature(rawBody, signature, SQUARE_WEBHOOK_URL, SQUARE_WEBHOOK_SIGNATURE_KEY);
      if (!verified) {
        console.warn('[square-payment-link-webhook] signature verification failed');
        return new Response('signature_verification_failed', { status: 400, headers: corsHeaders });
      }
    } else {
      console.warn('[square-payment-link-webhook] SQUARE_WEBHOOK_SIGNATURE_KEY not configured, accepting unsigned');
    }

    const event = JSON.parse(rawBody);

    // We only care about payment.updated where the payment completed.
    // Square also fires payment.created and other lifecycle events; we
    // ignore those.
    if (event.type !== 'payment.updated') {
      return jsonOk({ received: true, ignored: event.type });
    }

    const payment = event?.data?.object?.payment;
    if (!payment) {
      return jsonOk({ received: true, ignored: 'no_payment_object' });
    }
    if (payment.status !== 'COMPLETED') {
      return jsonOk({ received: true, ignored: `status_${payment.status}` });
    }

    const orderId = payment.order_id;
    const paymentId = payment.id;
    if (!orderId || !paymentId) {
      return jsonOk({ received: true, ignored: 'missing_ids' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ─── Match: session_payments first, then cancellation_charges ──
    const { data: paymentRow } = await supabase
      .from('session_payments')
      .select('id, status, booking_id, therapist_id')
      .eq('square_order_id', orderId)
      .maybeSingle();

    if (paymentRow) {
      // HK Jun 3 2026: only a PENDING payment-link row should be promoted
      // to succeeded by this webhook. Previously this skipped only when the
      // row was already 'succeeded', so a post-refund payment.updated event
      // (the payment stays COMPLETED with refunded money) overwrote a
      // 'refunded' row back to 'succeeded', wiping the refund and blocking
      // the refund notification. Treat succeeded, refunded, voided and
      // failed as terminal and leave them untouched.
      if (paymentRow.status !== 'pending') {
        return jsonOk({ received: true, already_processed: true, kind: 'session_payment', id: paymentRow.id, status: paymentRow.status });
      }

      const cardDetail = formatCardDetail(payment);

      const { error: updErr } = await supabase
        .from('session_payments')
        .update({
          status: 'succeeded',
          paid_at: new Date().toISOString(),
          square_payment_id: paymentId,
          payment_method_detail: cardDetail,
        })
        .eq('id', paymentRow.id);

      if (updErr) {
        console.error('[square-payment-link-webhook] session_payments update failed', updErr);
        return jsonError(updErr.message);
      }

      // Fire client receipt + therapist notification. Same shape as the
      // Stripe webhook fan-out so the rest of the system can't tell
      // the difference.
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/notify-payment-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            session_payment_id: paymentRow.id,
            booking_id: paymentRow.booking_id,
            therapist_id: paymentRow.therapist_id,
            event_type: 'payment_succeeded',
          }),
        });
      } catch (notifyErr) {
        console.warn('[square-payment-link-webhook] notify-payment-event fan-out warning:', (notifyErr as any)?.message || notifyErr);
      }

      return jsonOk({ received: true, marked_paid: paymentRow.id, kind: 'session_payment' });
    }

    // ─── cancellation_charges branch ────────────────────────────────
    const { data: ccRow } = await supabase
      .from('cancellation_charges')
      .select('id, status')
      .eq('square_order_id', orderId)
      .maybeSingle();

    if (ccRow) {
      if (ccRow.status === 'succeeded') {
        return jsonOk({ received: true, already_processed: true, kind: 'cancellation_charge', id: ccRow.id });
      }

      await supabase
        .from('cancellation_charges')
        .update({
          status: 'succeeded',
          succeeded_at: new Date().toISOString(),
          square_payment_id: paymentId,
        })
        .eq('id', ccRow.id);

      return jsonOk({ received: true, marked_paid: ccRow.id, kind: 'cancellation_charge' });
    }

    // No matching row. This is normal for payments not initiated via
    // our pay-link flow (e.g. Square card-on-file charges from the
    // app; those persist square_payment_id at charge time and don't
    // need this webhook).
    return jsonOk({ received: true, ignored: 'no_match', order_id: orderId });

  } catch (e) {
    console.error('[square-payment-link-webhook] uncaught', e);
    return jsonError(String((e as any)?.message || e));
  }
});

function jsonOk(body: any) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function jsonError(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Format a friendly card detail string from the Square payment object.
function formatCardDetail(payment: any): string {
  const cd = payment?.card_details?.card;
  if (!cd) return 'Square card';
  const brand = (cd.card_brand || '').toString();
  const last4 = (cd.last_4 || '').toString();
  if (brand && last4) {
    // Square brand strings: 'VISA', 'MASTERCARD', 'AMERICAN_EXPRESS', etc.
    const pretty = brand
      .toLowerCase()
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return `${pretty} ${last4}`;
  }
  return 'Square card';
}

// Square's webhook signature is base64(HMAC-SHA256(signature_key,
// notification_url + raw_body)). https://developer.squareup.com/docs/webhooks/step3validate
async function verifySquareSignature(body: string, signature: string | null, notificationUrl: string, signatureKey: string): Promise<boolean> {
  if (!signature) return false;
  const encoder = new TextEncoder();
  const stringToSign = notificationUrl + body;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signatureKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
  // Square sends signature base64-encoded.
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}
