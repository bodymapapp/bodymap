// booking-approval edge function.
//
// Therapist taps Approve or Decline on a pending-approval booking
// from their dashboard. This function:
//   1. Verifies caller is the booking's therapist (auth via JWT email
//      lookup against the therapists table)
//   2. On approve: if the booking has card-on-file saved at booking time
//      AND a deposit was queued (Phase 25b: approval + deposit both on),
//      charges the deposit off_session via chargeSavedCard before flipping
//      status. On charge success status becomes 'confirmed'; on charge
//      failure status becomes 'pending-deposit' and the client gets a
//      recovery payment-link email. Without saved card or queued deposit,
//      status flips directly to 'confirmed' (legacy approval-only flow).
//   3. On decline: status flips to 'cancelled', no charge.
//   4. Sends a Joy-voiced email to the client confirming the outcome and
//      a notification to the therapist when a deposit was collected or
//      a charge failed.
//
// Body: { booking_id, action: 'approve' | 'decline', reason?: string }
//
// Auth: JWT in Authorization header. Function deploys with default
// (verify-jwt enabled).
//
// Phase 25b (May 25 2026): silent revenue loss bug discovered with
// Candice Peek. When both require_approval + deposit_enabled were on,
// booking-approval used to set status='confirmed' without ever charging
// the deposit. This function now closes that loop by pre-collecting
// card-on-file at booking time (see BookingPage.js cardOnFileRequired
// gate Phase 25b branch) and charging off_session on approve.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatDateAndTime(booking: any) {
  const bookingDate = new Date(booking.booking_date + 'T12:00:00');
  const dateStr = bookingDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const [h, m] = booking.start_time.split(':').map(Number);
  const timeStr = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  return { dateStr, timeStr };
}

async function sendResendEmail(apiKey: string, payload: Record<string, any>) {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('[booking-approval] resend send failed', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const respond = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return respond({ error: 'Server misconfigured' }, 500);
    }

    // Pull caller email from JWT (Supabase has already verified the JWT).
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    let callerEmail = '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      callerEmail = (payload?.email || '').toLowerCase();
    } catch {
      return respond({ error: 'Invalid token' }, 401);
    }
    if (!callerEmail) return respond({ error: 'No caller email' }, 401);

    const body = await req.json().catch(() => ({}));
    const { booking_id, action, reason } = body || {};
    if (!booking_id) return respond({ error: 'Missing booking_id' }, 400);
    if (action !== 'approve' && action !== 'decline') {
      return respond({ error: 'action must be approve or decline' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Load booking + therapist + service.
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        *,
        therapists(id, full_name, business_name, custom_url, email, stripe_account_id, deposit_percent),
        services(name, duration, price)
      `)
      .eq('id', booking_id)
      .single();

    if (!booking) return respond({ error: 'Booking not found' }, 404);

    // Verify the caller is the therapist who owns this booking.
    if ((booking.therapists?.email || '').toLowerCase() !== callerEmail) {
      return respond({ error: 'Not authorized for this booking' }, 403);
    }

    if (booking.status !== 'pending-approval') {
      return respond({ error: `Booking is not pending approval (status: ${booking.status})` }, 400);
    }

    const therapist = booking.therapists;
    const service = booking.services;
    const therapistName = therapist?.business_name || therapist?.full_name || 'Your therapist';
    const therapistFirst = (therapist?.full_name || '').split(' ')[0] || 'your therapist';
    const firstName = (booking.client_name || '').split(' ')[0] || 'there';
    const { dateStr, timeStr } = formatDateAndTime(booking);
    const intakeUrl = `https://www.mybodymap.app/${therapist?.custom_url}`;
    const bookAgainUrl = `https://www.mybodymap.app/book/${therapist?.custom_url}`;

    // ─── Phase 25b: detect approve+deposit case ───────────────────
    //
    // The booking row carries a snapshot of the card-on-file captured at
    // booking time (BookingPage.js sets card_on_file_payment_method_id +
    // card_on_file_customer_id when therapist has approval+deposit both
    // on). If both are present AND deposit_amount > 0, this is a Phase 25b
    // approve-and-charge case. Otherwise it's a legacy approval-only flow
    // (just flip status, no charge).
    const isApproveDepositCase =
      action === 'approve' &&
      !!booking.card_on_file_payment_method_id &&
      !!booking.card_on_file_customer_id &&
      Number(booking.deposit_amount || 0) > 0;

    let chargeOutcome: 'none' | 'succeeded' | 'failed' = 'none';
    let chargeError: string | null = null;
    let chargePaymentIntentId: string | null = null;
    let sessionPaymentId: string | null = null;

    // ─── Run the off_session charge BEFORE flipping status ────────
    //
    // Order matters: if the charge fails we want status to be
    // 'pending-deposit' (recovery path), not 'confirmed' (which would
    // leave the client thinking they're booked while the deposit silently
    // never landed). On success status becomes 'confirmed'.
    if (isApproveDepositCase) {
      const stripeAccountId = therapist?.stripe_account_id;
      const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
      const amountCents = Number(booking.deposit_amount);

      if (!stripeAccountId || !STRIPE_SECRET) {
        chargeOutcome = 'failed';
        chargeError = 'Stripe not configured on therapist account';
      } else {
        // Write pending session_payments row BEFORE charging so a crash
        // mid-call leaves audit trail. Mirrors charge-cancellation-fee
        // and create-payment-link patterns.
        try {
          const { data: pendingRow } = await supabase
            .from('session_payments')
            .insert({
              booking_id,
              therapist_id: therapist.id,
              client_id: booking.client_id,
              amount_cents: amountCents,
              tip_cents: 0,
              payment_method: 'stripe_card_on_file',
              payment_method_detail: 'Off-session deposit charge on approval',
              status: 'pending',
              created_by_therapist_id: therapist.id,
            })
            .select('id')
            .single();
          sessionPaymentId = pendingRow?.id || null;
        } catch (e) {
          console.warn('[booking-approval] failed to insert pending session_payments', e);
        }

        // Fire the off_session PaymentIntent on the connected account.
        // Mirrors StripeProvider.chargeSavedCard inline so we don't have
        // to bring in the full provider abstraction for one call.
        const idempotencyKey = `approve-deposit-${booking_id}`;
        const piBody = new URLSearchParams({
          amount: String(amountCents),
          currency: 'usd',
          customer: booking.card_on_file_customer_id,
          payment_method: booking.card_on_file_payment_method_id,
          confirm: 'true',
          off_session: 'true',
          description: `Deposit on approval, ${service?.name || 'session'} with ${therapistName}`,
          receipt_email: booking.client_email || '',
          'metadata[booking_id]': booking_id,
          'metadata[therapist_id]': therapist.id,
          'metadata[client_id]': booking.client_id || '',
          'metadata[trigger]': 'approve_deposit',
          'metadata[idempotency_key]': idempotencyKey,
        });

        try {
          const res = await fetch('https://api.stripe.com/v1/payment_intents', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${STRIPE_SECRET}`,
              'Stripe-Account': stripeAccountId,
              'Idempotency-Key': idempotencyKey,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: piBody,
          });
          const pi = await res.json();

          if (res.ok && pi.status === 'succeeded') {
            chargeOutcome = 'succeeded';
            chargePaymentIntentId = pi.id;
            if (sessionPaymentId) {
              await supabase
                .from('session_payments')
                .update({
                  status: 'succeeded',
                  paid_at: new Date().toISOString(),
                  stripe_payment_intent_id: pi.id,
                })
                .eq('id', sessionPaymentId);
            }
          } else {
            chargeOutcome = 'failed';
            chargeError = pi.error?.message || pi.last_payment_error?.message || `Charge status: ${pi.status}`;
            if (sessionPaymentId) {
              await supabase
                .from('session_payments')
                .update({
                  status: 'failed',
                  stripe_payment_intent_id: pi.id || null,
                  payment_method_detail: `Off-session deposit charge failed: ${String(chargeError).slice(0, 400)}`,
                })
                .eq('id', sessionPaymentId);
            }
          }
        } catch (e: any) {
          chargeOutcome = 'failed';
          chargeError = e?.message || String(e);
          if (sessionPaymentId) {
            await supabase
              .from('session_payments')
              .update({
                status: 'failed',
                payment_method_detail: `Off-session deposit charge error: ${String(chargeError).slice(0, 400)}`,
              })
              .eq('id', sessionPaymentId);
          }
        }
      }
    }

    // ─── Decide final status ──────────────────────────────────────
    //
    // approve + no deposit case (legacy)          → confirmed
    // approve + deposit + charge succeeded         → confirmed (deposit paid)
    // approve + deposit + charge failed            → pending-deposit (recovery)
    // decline                                       → cancelled
    let newStatus: string;
    if (action === 'decline') {
      newStatus = 'cancelled';
    } else if (chargeOutcome === 'failed') {
      newStatus = 'pending-deposit';
    } else {
      newStatus = 'confirmed';
    }

    const updates: Record<string, any> = {
      status: newStatus,
      approval_action_at: new Date().toISOString(),
    };
    if (action === 'decline' && reason) {
      updates.decline_reason = String(reason).slice(0, 500);
    }
    if (chargeOutcome === 'succeeded') {
      updates.deposit_paid = true;
      // Note: full payment audit lives in session_payments (status + paid_at +
      // stripe_payment_intent_id columns there). No matching columns added
      // to bookings table to keep the migration surface small.
    }

    const { error: updateErr } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', booking_id);

    if (updateErr) return respond({ error: updateErr.message }, 500);

    // ─── Email the client ──────────────────────────────────────────
    if (RESEND_API_KEY && booking.client_email) {
      let subject = '';
      let html = '';

      if (action === 'approve' && chargeOutcome === 'succeeded') {
        // Phase 25b happy path: approved AND deposit charged.
        const depositDollars = (Number(booking.deposit_amount) / 100).toFixed(0);
        subject = `Your request is confirmed: ${dateStr} at ${timeStr}`;
        html = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#F5F0E8;">
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
<div style="background:linear-gradient(135deg,#2A5741 0%,#4B8A6A 100%);padding:28px 24px;text-align:center;">
  <div style="color:rgba(255,255,255,0.85);font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">🌿 Confirmed and paid</div>
  <div style="color:#fff;font-family:Georgia,serif;font-size:22px;font-weight:700;">Your session is on the books</div>
</div>
<div style="padding:28px 28px 20px;">
  <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 14px;">Hi ${firstName},</p>
  <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 14px;">Good news. ${therapistFirst} has approved your request and your $${depositDollars} deposit has been charged to the card you saved.</p>
  <div style="background:#F0F7F4;border-radius:12px;padding:18px 20px;margin:18px 0;">
    <div style="font-size:12px;font-weight:700;color:#2A5741;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:6px;">Your session</div>
    <div style="font-size:15px;color:#1F2937;line-height:1.6;"><strong>${dateStr}</strong> at <strong>${timeStr}</strong>${service?.name ? `<br>${service.name} (${service.duration || 60} min)` : ''}</div>
  </div>
  <div style="background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:12px;padding:18px 20px;margin:18px 0;">
    <div style="font-size:11px;font-weight:700;color:#92400E;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:6px;">Please fill your intake before your session</div>
    <div style="font-size:13px;color:#78350F;line-height:1.6;margin-bottom:12px;">It takes about a minute and helps ${therapistFirst} prepare for you.</div>
    <a href="${intakeUrl}" style="display:inline-block;background:#2A5741;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:700;">Open intake form →</a>
  </div>
  <p style="font-size:13px;color:#6B7280;line-height:1.6;margin:16px 0 0;">A receipt for the $${depositDollars} deposit has been sent separately. Need to reschedule? Just reply to this email.</p>
</div>
<p style="font-size:11px;color:#9CA3AF;text-align:center;margin:24px 0 16px;">Sent with care by ${therapistName} via MyBodyMap</p>
</div></body></html>`;
      } else if (action === 'approve' && chargeOutcome === 'failed') {
        // Phase 25b recovery path: approved but charge failed.
        const depositDollars = (Number(booking.deposit_amount) / 100).toFixed(0);
        subject = `Action needed: complete your deposit for ${dateStr}`;
        html = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#F5F0E8;">
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
<div style="background:linear-gradient(135deg,#B87840 0%,#D4A373 100%);padding:28px 24px;text-align:center;">
  <div style="color:rgba(255,255,255,0.9);font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">🌿 Almost confirmed</div>
  <div style="color:#fff;font-family:Georgia,serif;font-size:22px;font-weight:700;">Your deposit needs a quick fix</div>
</div>
<div style="padding:28px 28px 20px;">
  <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 14px;">Hi ${firstName},</p>
  <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 14px;">${therapistFirst} has approved your request for <strong>${dateStr}</strong> at <strong>${timeStr}</strong>. We tried to charge the $${depositDollars} deposit to the card you saved, but it did not go through.</p>
  <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 14px;">This usually means the card has expired, the bank declined the charge, or there's a hold on the card. Please reach out to ${therapistFirst} to send a fresh payment link, or reply to this email and we'll help.</p>
  <p style="font-size:13px;color:#6B7280;line-height:1.6;margin:18px 0 0;">Your time slot is held while we sort this out. No action from you means the booking will not be finalized.</p>
</div>
<p style="font-size:11px;color:#9CA3AF;text-align:center;margin:24px 0 16px;">Sent with care by ${therapistName} via MyBodyMap</p>
</div></body></html>`;
      } else if (action === 'approve') {
        // Legacy approve without deposit (no card on file captured at booking).
        subject = `Your request is confirmed: ${dateStr} at ${timeStr}`;
        html = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#F5F0E8;">
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
<div style="background:linear-gradient(135deg,#2A5741 0%,#4B8A6A 100%);padding:28px 24px;text-align:center;">
  <div style="color:rgba(255,255,255,0.85);font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">🌿 Confirmed</div>
  <div style="color:#fff;font-family:Georgia,serif;font-size:22px;font-weight:700;">Your session is on the books</div>
</div>
<div style="padding:28px 28px 20px;">
  <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 14px;">Hi ${firstName},</p>
  <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 18px;">Good news. ${therapistFirst} has confirmed your request. Your session is on <strong>${dateStr}</strong> at <strong>${timeStr}</strong>${service?.name ? `, ${service.name} (${service.duration || 60} min)` : ''}.</p>
  <div style="background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:12px;padding:18px 20px;margin:22px 0;">
    <div style="font-size:11px;font-weight:700;color:#92400E;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:6px;">Please fill your intake before your session</div>
    <div style="font-size:13px;color:#78350F;line-height:1.6;margin-bottom:12px;">It takes about a minute and helps ${therapistFirst} prepare for you.</div>
    <a href="${intakeUrl}" style="display:inline-block;background:#2A5741;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:700;">Open intake form →</a>
  </div>
  <p style="font-size:13px;color:#6B7280;line-height:1.6;margin:16px 0 0;">Need to reschedule? Just reply to this email.</p>
</div>
<p style="font-size:11px;color:#9CA3AF;text-align:center;margin:24px 0 16px;">Sent with care by ${therapistName} via MyBodyMap</p>
</div></body></html>`;
      } else {
        // Decline path, unchanged from prior implementation.
        subject = `An update on your request with ${therapistName}`;
        const reasonBlock = (action === 'decline' && reason)
          ? `<div style="background:#F9FAFB;border-left:3px solid #D1D5DB;padding:14px 16px;margin:18px 0;border-radius:6px;"><div style="font-size:12px;color:#6B7280;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">A note from ${therapistFirst}</div><div style="font-size:14px;color:#374151;line-height:1.7;">${String(reason).replace(/[<>]/g, '').slice(0, 500)}</div></div>`
          : '';
        html = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#F5F0E8;">
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
<div style="background:linear-gradient(135deg,#6B7280 0%,#9CA3AF 100%);padding:28px 24px;text-align:center;">
  <div style="color:rgba(255,255,255,0.85);font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">🌿 An update</div>
  <div style="color:#fff;font-family:Georgia,serif;font-size:22px;font-weight:700;">A note about your request</div>
</div>
<div style="padding:28px 28px 20px;">
  <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 14px;">Hi ${firstName},</p>
  <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px;">Thank you for reaching out to ${therapistName}. Unfortunately ${therapistFirst} is not able to take on this booking. Your request for ${dateStr} at ${timeStr} has not been confirmed and no payment was taken.</p>
  ${reasonBlock}
  <p style="font-size:14px;color:#374151;line-height:1.7;margin:18px 0 8px;">If you would like to try a different time or service, you can browse the booking page anytime.</p>
  <p style="text-align:center;margin:22px 0 8px;">
    <a href="${bookAgainUrl}" style="display:inline-block;background:#2A5741;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:700;">View available times</a>
  </p>
</div>
<p style="font-size:11px;color:#9CA3AF;text-align:center;margin:24px 0 16px;">Sent with care by ${therapistName} via MyBodyMap</p>
</div></body></html>`;
      }

      await sendResendEmail(RESEND_API_KEY, {
        from: 'MyBodyMap <sessions@mybodymap.app>',
        to: [booking.client_email],
        bcc: ['bodymapdemo@gmail.com'],
        subject,
        html,
      });
    }

    // ─── Email the therapist when a deposit was collected or failed ───
    //
    // Quiet on the no-deposit approve path and on decline (those flow
    // through the normal status-change side-effects). For Phase 25b we
    // surface the charge outcome so the therapist knows whether money
    // actually moved.
    if (RESEND_API_KEY && therapist?.email && chargeOutcome !== 'none') {
      const depositDollars = (Number(booking.deposit_amount) / 100).toFixed(0);
      if (chargeOutcome === 'succeeded') {
        const subject = `Deposit collected: $${depositDollars} from ${booking.client_name || 'client'}`;
        const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#F5F0E8;">
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
<div style="background:linear-gradient(135deg,#2A5741 0%,#4B8A6A 100%);padding:24px;text-align:center;">
  <div style="color:rgba(255,255,255,0.85);font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">🌿 Deposit collected</div>
  <div style="color:#fff;font-family:Georgia,serif;font-size:20px;font-weight:700;">$${depositDollars} from ${booking.client_name || 'client'}</div>
</div>
<div style="padding:24px;">
  <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 12px;">You approved <strong>${booking.client_name || 'this client'}</strong> for <strong>${dateStr}</strong> at <strong>${timeStr}</strong>${service?.name ? `, ${service.name}` : ''}.</p>
  <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 12px;">The $${depositDollars} deposit was charged automatically to their card on file. The booking is now confirmed and the client has been notified.</p>
  <p style="font-size:13px;color:#6B7280;line-height:1.6;margin:14px 0 0;">No action needed from you.</p>
</div>
</div></body></html>`;
        await sendResendEmail(RESEND_API_KEY, {
          from: 'MyBodyMap <hello@mybodymap.app>',
          to: [therapist.email],
          subject,
          html,
        });
      } else if (chargeOutcome === 'failed') {
        const subject = `Approved, but deposit charge failed for ${booking.client_name || 'client'}`;
        const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#F5F0E8;">
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
<div style="background:linear-gradient(135deg,#B87840 0%,#D4A373 100%);padding:24px;text-align:center;">
  <div style="color:rgba(255,255,255,0.9);font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">🌿 Deposit charge failed</div>
  <div style="color:#fff;font-family:Georgia,serif;font-size:20px;font-weight:700;">Booking held, deposit pending</div>
</div>
<div style="padding:24px;">
  <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 12px;">You approved <strong>${booking.client_name || 'this client'}</strong> for <strong>${dateStr}</strong> at <strong>${timeStr}</strong>${service?.name ? `, ${service.name}` : ''}.</p>
  <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 12px;">The $${depositDollars} deposit could not be charged from their saved card. Common reasons: card expired, bank declined, or insufficient funds.</p>
  <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 12px;">The booking is now in <strong>pending-deposit</strong> status. The client received a recovery email. You can send a fresh payment link from the booking detail when you're ready.</p>
  <p style="font-size:12px;color:#6B7280;line-height:1.6;margin:14px 0 0;">Stripe error: ${(chargeError || 'Unknown').slice(0, 240)}</p>
</div>
</div></body></html>`;
        await sendResendEmail(RESEND_API_KEY, {
          from: 'MyBodyMap <hello@mybodymap.app>',
          to: [therapist.email],
          subject,
          html,
        });
      }
    }

    return respond({
      ok: true,
      status: newStatus,
      charge_outcome: chargeOutcome,
      charge_error: chargeError,
      payment_intent_id: chargePaymentIntentId,
      session_payment_id: sessionPaymentId,
    });
  } catch (e: any) {
    return respond({ error: e?.message || String(e) }, 500);
  }
});
