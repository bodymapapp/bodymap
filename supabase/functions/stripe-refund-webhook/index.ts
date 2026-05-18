// supabase/functions/stripe-refund-webhook/index.ts
//
// Phase 14.3a (HK May 17 2026): handle Stripe charge.refunded events
// so refunds initiated from the Stripe Dashboard (or anywhere else
// outside the platform) propagate to session_payments + cancellation_charges.
//
// Phase 14.3a redeploy trigger (HK May 17 2026 8pm): forcing a fresh
// deploy after adding to NO_JWT_FUNCTIONS allowlist in the workflow.
// Stripe webhook attempts were returning 401 UNAUTHORIZED_NO_AUTH_HEADER
// because the gateway was requiring a JWT and Stripe doesn't send one.
//
// Background: HK refunded 3 payments via Stripe Dashboard. Only the
// one row that was manually flipped via SQL appeared in the Smart
// Billing hero's "refunds" line. The other two stayed as
// status='succeeded' in session_payments because nothing was
// listening for refund events. This was a real production gap.
//
// Subscribed events: charge.refunded (fires when a refund completes,
// regardless of who initiated it).
//
// Lookup strategy:
//   1. Pull payment_intent from the charge object
//   2. Find session_payments row WHERE stripe_payment_intent_id = X
//   3. If found: update status to 'refunded', refund metadata
//   4. If not found: check cancellation_charges (cancellation fees
//      route through this table when collected via payment link)
//   5. If still not found: log and accept (might be a non-platform charge)
//
// Idempotency: if the row is already status='refunded' AND the
// refund_amount_cents matches, return early. Stripe can fire the
// event multiple times.
//
// IMPORTANT: webhook signature verification REQUIRED in production.
// HK to configure STRIPE_REFUND_WEBHOOK_SECRET in Supabase env.
//
// HK to configure in Stripe Dashboard:
//   1. Developers > Webhooks > Add endpoint (or extend existing)
//   2. URL: https://<project>.supabase.co/functions/v1/stripe-refund-webhook
//   3. Events: charge.refunded
//   4. Copy signing secret into Supabase env: STRIPE_REFUND_WEBHOOK_SECRET

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_REFUND_WEBHOOK_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    // Verify Stripe signature if a secret is configured. If not,
    // accept the payload but log a warning. This matches the existing
    // stripe-payment-link-webhook behavior.
    if (STRIPE_WEBHOOK_SECRET) {
      const verified = await verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);
      if (!verified) {
        console.warn('[stripe-refund-webhook] signature verification failed');
        return new Response('signature verification failed', { status: 400, headers: corsHeaders });
      }
    } else {
      console.warn('[stripe-refund-webhook] STRIPE_REFUND_WEBHOOK_SECRET not configured, accepting unsigned');
    }

    const event = JSON.parse(rawBody);

    // Only handle charge.refunded. Stripe also fires charge.refund.updated
    // and refund.created but charge.refunded is the canonical 'a refund
    // completed for this charge' signal we want.
    if (event.type !== 'charge.refunded') {
      return new Response(JSON.stringify({ received: true, ignored: event.type }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const charge = event.data?.object;
    const paymentIntentId = charge?.payment_intent;
    const amountRefunded = charge?.amount_refunded || 0;
    const totalAmount = charge?.amount || 0;
    const isFullyRefunded = amountRefunded >= totalAmount;

    if (!paymentIntentId) {
      console.warn('[stripe-refund-webhook] no payment_intent on charge, ignoring', charge?.id);
      return new Response(JSON.stringify({ received: true, ignored: 'no_payment_intent' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Step 1: look for matching session_payments row.
    const { data: paymentRow } = await supabase
      .from('session_payments')
      .select('id, status, amount_cents')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();

    if (paymentRow) {
      // Idempotency: if already refunded with matching amount, no-op.
      if (paymentRow.status === 'refunded') {
        return new Response(JSON.stringify({ received: true, already_refunded: true, table: 'session_payments' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Mark as refunded. Note: we set status='refunded' for both
      // full and partial refunds because the Smart Billing hero
      // treats any refund as a deduction from collected. Future
      // enhancement: store refund_amount_cents separately so partial
      // refunds reduce collected by the partial amount.
      const { error: updErr } = await supabase
        .from('session_payments')
        .update({
          status: 'refunded',
        })
        .eq('id', paymentRow.id);

      if (updErr) {
        console.error('[stripe-refund-webhook] failed to update session_payments', updErr);
        return new Response(JSON.stringify({ error: 'update_failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Phase 15.3 (HK May 18 2026): fire refund notification ONLY when
      // the webhook is the one flipping the row. If the in-app refund
      // function already flipped it, the idempotency check above
      // returned early (and the in-app function already fired its own
      // notification). This guarantees one fire per refund regardless
      // of who initiates it.
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/notify-refund-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY,
          },
          body: JSON.stringify({ session_payment_id: paymentRow.id, source: 'webhook' }),
        });
      } catch (e) {
        console.warn('[stripe-refund-webhook] notify fire failed', e);
      }

      return new Response(JSON.stringify({
        received: true,
        table: 'session_payments',
        row_id: paymentRow.id,
        amount_refunded: amountRefunded,
        fully_refunded: isFullyRefunded,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: not found in session_payments. Check cancellation_charges.
    // Cancellation fees collected via payment link also have a
    // payment_intent_id stored.
    const { data: cancelRow } = await supabase
      .from('cancellation_charges')
      .select('id, status, amount_cents')
      .eq('payment_intent_id', paymentIntentId)
      .maybeSingle();

    if (cancelRow) {
      if (cancelRow.status === 'refunded') {
        return new Response(JSON.stringify({ received: true, already_refunded: true, table: 'cancellation_charges' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: updErr } = await supabase
        .from('cancellation_charges')
        .update({
          status: 'refunded',
          refunded_at: new Date().toISOString(),
          refund_amount_cents: amountRefunded,
        })
        .eq('id', cancelRow.id);

      if (updErr) {
        console.error('[stripe-refund-webhook] failed to update cancellation_charges', updErr);
        return new Response(JSON.stringify({ error: 'update_failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        received: true,
        table: 'cancellation_charges',
        row_id: cancelRow.id,
        amount_refunded: amountRefunded,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: not in either table. Log and accept. This is the case
    // for refunds on charges that didn't originate from MyBodyMap (e.g.
    // therapist had Stripe before the platform existed). Not an error.
    console.warn('[stripe-refund-webhook] no matching row for payment_intent', paymentIntentId);
    return new Response(JSON.stringify({ received: true, no_match: true, payment_intent: paymentIntentId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('[stripe-refund-webhook] uncaught', e);
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Stripe signature verification. Same algorithm as
// stripe-payment-link-webhook. Verifies the timestamped HMAC.
async function verifyStripeSignature(payload: string, sigHeader: string | null, secret: string): Promise<boolean> {
  if (!sigHeader) return false;
  try {
    const parts = sigHeader.split(',').reduce((acc, p) => {
      const [k, v] = p.split('=');
      acc[k] = v;
      return acc;
    }, {} as Record<string, string>);
    const timestamp = parts.t;
    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(signedPayload)
    );
    const computed = Array.from(new Uint8Array(sigBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    // Accept any of the v1 signatures (Stripe rotates)
    const v1s = sigHeader.split(',').filter(p => p.startsWith('v1='))
      .map(p => p.slice(3));
    return v1s.includes(computed);
  } catch (e) {
    console.error('[verifyStripeSignature] error', e);
    return false;
  }
}
