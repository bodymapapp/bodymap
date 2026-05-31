// supabase/functions/verify-payment-link/index.ts
//
// HK May 31 2026 (Square Parity v1): post-payment verification for
// Square payment links. The Stripe equivalent uses webhooks
// (stripe-payment-link-webhook) which fire server-side regardless of
// whether the client returns to a redirect. Square in this v1 uses
// the redirect-back pattern: the client lands on /pay-thanks?sp=<id>
// and that page calls this endpoint to confirm the payment.
//
// Limitations of this approach (acknowledged for v1):
//   - If the client closes the Square hosted tab without returning,
//     the row stays 'pending'. The therapist can mark it paid manually
//     from the booking once they see the money in their Square
//     dashboard. A future enhancement is a server-side Square
//     webhook that closes this loop automatically.
//
// Body: { session_payment_id: string }
// Returns:
//   { success: true, status: 'succeeded' | 'pending' | 'failed', amount_cents }
//   { error: '...' }
//
// Safe to call repeatedly: if the row is already 'succeeded', returns
// idempotently.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, respond, getSupabaseClient, ProviderError,
} from '../_shared/payment-provider.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { session_payment_id } = await req.json();
    if (!session_payment_id) return respond({ error: 'session_payment_id required' }, 400);

    const supabase = getSupabaseClient();

    const { data: row, error: rErr } = await supabase
      .from('session_payments')
      .select('id, therapist_id, status, payment_method, amount_cents, tip_cents, square_order_id, square_payment_id, booking_id')
      .eq('id', session_payment_id)
      .single();
    if (rErr || !row) return respond({ error: 'payment_not_found' }, 404);

    // Idempotency: if already succeeded, return current state.
    if (row.status === 'succeeded') {
      return respond({
        success: true,
        status: 'succeeded',
        amount_cents: (row.amount_cents || 0) + (row.tip_cents || 0),
        already_recorded: true,
      });
    }

    // This endpoint only handles Square payment links. Stripe links
    // are confirmed by stripe-payment-link-webhook server-side.
    if (row.payment_method !== 'square_payment_link') {
      return respond({
        error: 'wrong_payment_method',
        detail: `This endpoint only verifies Square payment links. Row payment_method is ${row.payment_method}.`,
      }, 400);
    }

    if (!row.square_order_id) {
      return respond({ error: 'no_square_order_id_on_row' }, 400);
    }

    // Load therapist for Square credentials
    const { data: therapist } = await supabase
      .from('therapists')
      .select('id, square_access_token, square_location_id, square_merchant_id, square_connected')
      .eq('id', row.therapist_id)
      .single();
    if (!therapist?.square_access_token) {
      return respond({ error: 'square_not_connected_for_therapist' }, 400);
    }

    // Verify the order via the provider abstraction.
    const { SquareProvider } = await import('../_shared/providers/square.ts');
    const provider = new SquareProvider(therapist as any);

    let verifyResult;
    try {
      verifyResult = await provider.verifyCheckout({
        therapist: therapist as any,
        paymentRefId: row.square_order_id,
      });
    } catch (e: any) {
      if (e instanceof ProviderError) {
        console.error('[verify-payment-link] Square verify error', e.code, e.message);
        return respond({ error: e.message, code: e.code }, 400);
      }
      throw e;
    }

    if (!verifyResult.paid) {
      // Still pending or failed. Don't flip the row; let the therapist
      // mark paid manually if they confirm payment elsewhere.
      return respond({
        success: true,
        status: 'pending',
        detail: 'Square has not confirmed payment yet. If you completed payment, please contact the therapist or wait a few minutes and refresh.',
      });
    }

    // Paid. Flip the row to succeeded + capture the Square payment id
    // for the refund path.
    const squarePaymentId = (verifyResult as any).paymentId
      || (verifyResult.lineItems?.[0] as any)?.paymentId
      || null;

    const { error: updErr } = await supabase
      .from('session_payments')
      .update({
        status: 'succeeded',
        paid_at: new Date().toISOString(),
        square_payment_id: squarePaymentId,
      })
      .eq('id', session_payment_id);

    if (updErr) {
      console.error('[verify-payment-link] update failed after Square confirmed paid', updErr);
      return respond({
        error: 'update_failed',
        detail: 'Square confirmed payment but the row could not be updated. Please refresh and try again.',
      }, 500);
    }

    // Fire payment notification (fire-and-forget).
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
      const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      await fetch(`${SUPABASE_URL}/functions/v1/notify-payment-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
        },
        body: JSON.stringify({ session_payment_id }),
      });
    } catch (e) {
      console.warn('[verify-payment-link] notify fire failed', e);
    }

    return respond({
      success: true,
      status: 'succeeded',
      amount_cents: (row.amount_cents || 0) + (row.tip_cents || 0),
    });
  } catch (e: any) {
    console.error('[verify-payment-link] uncaught', e);
    return respond({ error: String(e?.message || e) }, 500);
  }
});
