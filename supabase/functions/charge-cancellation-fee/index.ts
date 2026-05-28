// supabase/functions/charge-cancellation-fee/index.ts
//
// Charges a cancellation fee against a client's card-on-file when
// the therapist cancels (or the client no-shows) within the policy's
// fee window.
//
// Routes through PaymentProvider, so works with both Stripe and
// Square card-on-file equally. The card was saved at booking time
// via init-card-setup; we look up which processor saved it and
// route to that one's chargeSavedCard().
//
// Idempotency: stable key 'cancel-{booking_id}' so a network retry
// won't double-charge. Both Stripe and Square honor the key on
// their respective endpoints.
//
// Audit: writes a row to cancellation_charges before AND after the
// provider call. The 'pending' row before is created so a crash
// mid-charge leaves an audit trail; the row gets updated to
// 'succeeded' or 'failed' after the provider returns.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, respond, getSupabaseClient, loadTherapist,
  ProviderError,
} from '../_shared/payment-provider.ts';
import { notifyTherapist } from '../_shared/notifications.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      booking_id,
      therapist_id,
      // The fee amount in cents the therapist already calculated +
      // confirmed in the UI. We accept it as input rather than
      // recomputing here so the therapist sees exactly what they're
      // agreeing to charge.
      fee_amount_cents,
      // 'late_cancel' | 'reschedule' | 'no_show', written to audit row
      reason,
      // Snapshot of the policy at cancellation time, for audit
      policy_snapshot,
    } = await req.json();

    if (!booking_id) return respond({ error: 'booking_id required' }, 400);
    if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);
    if (!fee_amount_cents || fee_amount_cents <= 0) {
      return respond({ error: 'fee_amount_cents must be positive' }, 400);
    }

    const supabase = getSupabaseClient();
    const therapist = await loadTherapist(supabase, therapist_id);

    // Load the booking + client to find the card-on-file.
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('therapist_id', therapist_id)
      .single();
    if (!booking) return respond({ error: 'booking_not_found' }, 404);

    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', booking.client_id)
      .single();
    if (!client) return respond({ error: 'client_not_found_on_booking' }, 404);

    // Idempotency: if a successful charge for this booking already
    // exists, return it instead of charging again. Defense against
    // double-clicks.
    const { data: existing } = await supabase
      .from('cancellation_charges')
      .select('*')
      .eq('booking_id', booking_id)
      .eq('status', 'succeeded')
      .maybeSingle();
    if (existing) {
      return respond({
        ok: true, idempotent: true,
        charge_id: existing.id,
        payment_ref_id: existing.payment_intent_id,
        amount_cents: existing.amount_cents,
      });
    }

    // Determine which processor saved the card. Prefer Stripe if both
    // exist (matches the auto-policy elsewhere). The clients row
    // populates one of these pairs at save-card time:
    //   stripe_customer_id + payment_method_id (Stripe)
    //   square_customer_id + square_card_id   (Square)
    let processor: 'stripe' | 'square';
    let providerCustomerId: string | null;
    let providerCardId: string | null;
    if (client.stripe_customer_id && client.payment_method_id) {
      processor = 'stripe';
      providerCustomerId = client.stripe_customer_id;
      providerCardId = client.payment_method_id;
    } else if (client.square_customer_id && client.square_card_id) {
      processor = 'square';
      providerCustomerId = client.square_customer_id;
      providerCardId = client.square_card_id;
    } else {
      return respond({
        error: 'no_card_on_file',
        detail: 'Client does not have a card on file with either Stripe or Square. The cancellation policy fee cannot be charged automatically.',
      }, 400);
    }

    // Build the right provider directly (not via getProvider auto)
    // since we know which one saved this specific card.
    let provider;
    if (processor === 'stripe') {
      const { StripeProvider } = await import('../_shared/providers/stripe.ts');
      provider = new StripeProvider();
    } else {
      const { SquareProvider } = await import('../_shared/providers/square.ts');
      provider = new SquareProvider(therapist);
    }

    // Capability check
    const cap = provider.getCapability('chargeSavedCard');
    if (cap.status === 'unsupported') {
      return respond({
        error: `${processor} does not support charging saved cards in this version`,
        code: 'capability_unsupported',
      }, 400);
    }

    // Write a 'pending' audit row BEFORE charging. If the function
    // crashes mid-call, this row remains as evidence the charge was
    // attempted and we can reconcile later.
    const idempotencyKey = `cancel-${booking_id}`;
    const { data: pendingRow } = await supabase
      .from('cancellation_charges')
      .insert({
        therapist_id,
        booking_id,
        client_id: client.id,
        amount_cents: fee_amount_cents,
        trigger_event: reason || 'cancel',
        status: 'pending',
        processor,
        idempotency_key: idempotencyKey,
        policy_snapshot: policy_snapshot || null,
      })
      .select('id')
      .single();

    // Charge through the abstraction
    let chargeResult;
    try {
      chargeResult = await provider.chargeSavedCard({
        therapist,
        providerCustomerId,
        providerCardId,
        amountCents: fee_amount_cents,
        idempotencyKey,
        description: `${reason === 'no_show' ? 'No-show fee' : 'Late cancellation fee'} per policy`,
        receiptEmail: client.email || undefined,
      });
    } catch (chargeErr) {
      // Update the pending row to 'failed' for audit
      const errMsg = chargeErr instanceof Error ? chargeErr.message : String(chargeErr);

      // ─── Stale customer / payment_method recovery ────────────────
      //
      // Stripe scopes Customers and PaymentMethods per connected
      // account. If a therapist's row was ever moved between Stripe
      // accounts (Express account switch, May 15 2026 architectural
      // migration to verified Daya Gupta), the IDs we cached on the
      // client row no longer exist in the current account's
      // namespace. Symptom: ProviderError code='resource_missing'
      // with a message mentioning 'customer' or 'payment_method'.
      //
      // Recovery differs from create-deposit because the client is
      // not present to re-enter a card. So we cannot auto-retry the
      // charge. What we CAN do, defensively:
      //   1. Clear the stale Stripe IDs from the client row so the
      //      next time the client books, save-card-on-booking
      //      naturally creates fresh IDs on the current account.
      //   2. Mark this cancellation charge failed with a specific
      //      'stripe_resource_orphan' marker for ops + audit.
      //   3. Return a friendlier code so callers can show the
      //      therapist a clear explanation rather than a raw
      //      Stripe error.
      const isStaleResource =
        processor === 'stripe' &&
        chargeErr instanceof ProviderError &&
        chargeErr.code === 'resource_missing' &&
        /customer|payment_method|cus_|pm_/i.test(chargeErr.message || '');

      if (isStaleResource) {
        console.warn(`[charge-cancellation-fee] Stale Stripe resource for client ${client.id} on therapist ${therapist_id}; clearing cached IDs.`);
        try {
          await supabase
            .from('clients')
            .update({
              stripe_customer_id: null,
              payment_method_id: null,
              card_saved_at: null,
            })
            .eq('id', client.id);
        } catch (cleanupErr) {
          console.warn('[charge-cancellation-fee] cleanup failed', cleanupErr);
        }
      }

      await supabase
        .from('cancellation_charges')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          error_message: (isStaleResource ? '[stripe_resource_orphan] ' : '') + errMsg.slice(0, 480),
        })
        .eq('id', pendingRow?.id);

      if (isStaleResource) {
        return respond({
          error: 'The card on file for this client was set up before a Stripe account migration and no longer exists on the current account. We have cleared the stale reference; the client will be asked to save a fresh card on their next booking. No fee was charged.',
          code: 'stripe_resource_orphan',
          charge_id: pendingRow?.id,
        }, 400);
      }

      if (chargeErr instanceof ProviderError) {
        return respond({ error: chargeErr.message, code: chargeErr.code, charge_id: pendingRow?.id }, 400);
      }
      throw chargeErr;
    }

    if (!chargeResult.paid) {
      await supabase
        .from('cancellation_charges')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          error_message: 'provider returned not paid',
        })
        .eq('id', pendingRow?.id);
      return respond({ error: 'charge_not_completed', charge_id: pendingRow?.id }, 502);
    }

    // Mark succeeded. payment_intent_id was Stripe-only originally;
    // we now store ANY provider's payment ref id in this column
    // (Stripe payment_intent id, Square payment id). The column name
    // stays for backward compat with existing rows.
    await supabase
      .from('cancellation_charges')
      .update({
        status: 'succeeded',
        succeeded_at: new Date().toISOString(),
        payment_intent_id: chargeResult.paymentRefId,
      })
      .eq('id', pendingRow?.id);

    console.log('[charge-cancellation-fee] success', {
      booking_id, processor, payment_ref_id: chargeResult.paymentRefId,
      amount_cents: chargeResult.amountCents,
    });

    // ─── Notify therapist: booking_cancelled or no_show_recorded ────
    //
    // The notification reflects what just happened from the therapist's
    // perspective (a cancel or a no-show), not what we did with the fee.
    // The fee amount is embedded in the body so they see the money side
    // in the same message.
    //
    // Non-blocking: any notification failure is logged but never
    // propagated, because the charge already succeeded and the response
    // to the UI must not be derailed by an email hiccup.
    try {
      const isNoShow = reason === 'no_show';
      const eventType = isNoShow ? 'no_show_recorded' : 'booking_cancelled';
      const clientName = (client.name || 'Client').toString();
      const firstName = clientName.split(' ')[0];
      const feeUsd = ((chargeResult.amountCents || 0) / 100).toFixed(2);
      // HK May 28 2026: bookings has no start_at column (it uses
      // booking_date + start_time). Reading booking.start_at left this
      // undefined, so the charge email showed a blank date. Build the
      // display time from the real columns instead.
      let startDt = null;
      if (booking.booking_date && booking.start_time) {
        const d = new Date(`${booking.booking_date}T${booking.start_time}`);
        startDt = isNaN(d.getTime()) ? null : d;
      }
      const whenStr = startDt
        ? startDt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : (booking.booking_date && booking.start_time ? `${booking.booking_date} ${booking.start_time}` : '');

      const title = isNoShow
        ? `${firstName} marked no-show, $${feeUsd} charged`
        : `${firstName} cancelled, $${feeUsd} charged`;
      const summary = isNoShow
        ? `${clientName} did not show up for ${whenStr}. Your no-show policy fee of $${feeUsd} was charged to the card on file.`
        : `${clientName}'s session for ${whenStr} was cancelled. Your late-cancel policy fee of $${feeUsd} was charged to the card on file.`;

      const emailHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0D1F17;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${isNoShow ? '#92400E' : '#DC2626'};margin-bottom:8px;">${isNoShow ? '🚫 No-show recorded' : '🗑 Booking cancelled'}</div>
      <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#2A5741;margin:0 0 6px;">${title}</h1>
      <p style="font-size:14px;color:#6B7280;margin:0 0 18px;line-height:1.6;">${summary}</p>
      <a href="https://mybodymap.app/dashboard/billing" style="display:inline-block;background:#2A5741;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:13px;font-weight:700;">Open Billing</a>
      <div style="font-size:11px;color:#9CA3AF;margin-top:24px;line-height:1.6;">
        You are getting this because "${isNoShow ? 'No-show recorded' : 'Booking cancelled'}" is on in your notification settings.
      </div>
    </div>
  </div>
</body></html>`;

      await notifyTherapist({
        supabase, therapist,
        eventType,
        title,
        body: summary,
        icon: isNoShow ? '🚫' : '🗑',
        linkUrl: '/dashboard/billing',
        payload: {
          booking_id,
          client_id: client.id,
          fee_cents: chargeResult.amountCents,
          payment_ref_id: chargeResult.paymentRefId,
          reason,
        },
        emailSubject: title,
        emailHtml,
        smsText: `MyBodyMap: ${isNoShow ? 'No-show' : 'Cancellation'} for ${firstName} on ${whenStr}. $${feeUsd} charged.`,
        bookingId: booking_id,
        clientId: client.id,
      });
    } catch (notifyErr) {
      console.warn('[charge-cancellation-fee] notify failed (non-blocking):', notifyErr);
    }

    return respond({
      ok: true,
      processor,
      charge_id: pendingRow?.id,
      payment_ref_id: chargeResult.paymentRefId,
      amount_cents: chargeResult.amountCents,
      capability_warnings: cap.status === 'limited' ? cap.limitations : undefined,
    });

  } catch (e) {
    if (e instanceof ProviderError) {
      console.error('[charge-cancellation-fee] provider error', e.code, e.message);
      return respond({ error: e.message, code: e.code }, 400);
    }
    console.error('[charge-cancellation-fee] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
