// supabase/functions/notify-booking-event/index.ts
//
// Fires a booking_cancelled or no_show_recorded notification to the
// therapist for the "skip fee, just cancel" path in
// CancellationChargeModal. Distinct from charge-cancellation-fee
// because no money is moving, but the therapist still wants to
// know on their phone that a booking was cancelled or a no-show
// was recorded.
//
// Also handles the case where a therapist runs the basic cancel
// path (no policy, no card) and just flips the booking status; in
// that flow we still want the notification.
//
// Auth: service role (uses the anon key from the caller for CORS
// gating but creates a service-role client internally). Payload is
// validated against the actual booking row before notifying.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyTherapist, notifyClient } from "../_shared/notifications.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const respond = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

  try {
    const { booking_id, event_type, fee_amount_cents, fee_charged, payment_link_url, initiated_by, reschedule_prev, reason } = await req.json();
    if (!booking_id) return respond({ error: 'booking_id required' }, 400);
    // Accepted event_types (expanded May 26 2026 for notification batch):
    //   booking_cancelled  - any path that flips status to cancelled
    //   no_show_recorded   - any path that flips status to no_show
    //   reschedule         - booking date/time changed but still active
    // fee_amount_cents + fee_charged together describe the fee outcome
    // payment_link_url is the Stripe-hosted link for the C12 path
    // initiated_by is 'therapist' or 'client'; gates whether C7 or C8/C9 fires
    // reschedule_prev is { prev_date, prev_time } for the C10 path
    if (event_type !== 'booking_cancelled' && event_type !== 'no_show_recorded' && event_type !== 'reschedule') {
      return respond({ error: 'event_type must be booking_cancelled, no_show_recorded, or reschedule' }, 400);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    // HK May 29 2026: anon key for fan-out gateway auth. The
    // SUPABASE_SERVICE_ROLE_KEY env var in this Supabase project's
    // edge runtime is the legacy non-JWT format which the API gateway
    // rejects with UNAUTHORIZED_INVALID_JWT_FORMAT when used as a
    // Bearer token. The ANON key IS a proper JWT and gateway-accepts
    // it. The function-internal DB client still uses the service-role
    // key because RLS bypass is needed for cross-therapist queries.
    // This matches the pattern used by send-booking-confirmation
    // invocations from the client (BookingModal.fireBookingConfirmation)
    // which have been working without issues.
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return respond({ error: 'env_not_set' }, 500);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // HK May 28 2026: this select previously requested services(name,
    // price_cents) and start_at. The services column is `price` not
    // `price_cents`, and bookings has no start_at (it uses booking_date
    // + start_time). A single bad column makes the whole select fail,
    // so `booking` came back null, the function returned booking_not_
    // found (404) BEFORE any logging or sending, and the fire-and-
    // forget caller swallowed it. Net effect: cancelling a booking sent
    // no email to anyone and logged nothing. Columns now match the
    // known-good select in send-booking-confirmation.
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, therapist_id, client_id, client_name, client_email, client_phone, booking_date, start_time, status, service_id, services(name, price)')
      .eq('id', booking_id)
      .maybeSingle();

    if (!booking) return respond({ error: 'booking_not_found' }, 404);

    const { data: therapist } = await supabase
      .from('therapists')
      .select('id, email, phone, full_name, business_name, custom_url, notification_prefs, twilio_account_sid, twilio_auth_token, twilio_phone_number')
      .eq('id', booking.therapist_id)
      .maybeSingle();

    if (!therapist) return respond({ error: 'therapist_not_found' }, 404);

    const isNoShow = event_type === 'no_show_recorded';
    const isReschedule = event_type === 'reschedule';
    const isCancel = event_type === 'booking_cancelled';
    const clientName = (booking.client_name || 'Client').toString();
    const firstName = clientName.split(' ')[0];

    let whenStr = '';
    if (booking.booking_date && booking.start_time) {
      const dt = new Date(`${booking.booking_date}T${booking.start_time}`);
      whenStr = isNaN(dt.getTime())
        ? `${booking.booking_date} ${booking.start_time}`
        : dt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    // Previous date/time for reschedule trace ("Moved from ...").
    let prevWhenStr = '';
    if (isReschedule && reschedule_prev?.prev_date && reschedule_prev?.prev_time) {
      const pd = new Date(`${reschedule_prev.prev_date}T${reschedule_prev.prev_time}`);
      prevWhenStr = isNaN(pd.getTime())
        ? `${reschedule_prev.prev_date} ${reschedule_prev.prev_time}`
        : pd.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    // ─── Per-event branding + title + summary ────────────────────────
    let title, summary, banner, bannerColor, smsText, mailFootline;
    if (isReschedule) {
      title = `${firstName}'s session was rescheduled`;
      summary = `${clientName}'s session has been moved${prevWhenStr ? ' from ' + prevWhenStr : ''}${whenStr ? ' to ' + whenStr : ''}.`;
      banner = '↻ Booking rescheduled';
      bannerColor = '#0369A1';
      smsText = `MyBodyMap: ${firstName} rescheduled${whenStr ? ' to ' + whenStr : ''}.`;
      mailFootline = '"Booking rescheduled"';
    } else if (isNoShow) {
      title = `${firstName} marked no-show`;
      summary = `${clientName} did not show up${whenStr ? ' for their ' + whenStr + ' session' : ''}.`;
      banner = '🚫 No-show recorded';
      bannerColor = '#92400E';
      mailFootline = '"No-show recorded"';
    } else { // booking_cancelled
      title = `${firstName}'s session was cancelled`;
      summary = `${clientName}'s session${whenStr ? ' on ' + whenStr : ''} was cancelled.`;
      banner = '🗑 Booking cancelled';
      bannerColor = '#DC2626';
      mailFootline = '"Booking cancelled"';
    }

    // ─── Detail box: only show fee row for cancel/no-show, not reschedule ──
    // HK May 29 2026: previously the fee row hardcoded "No fee charged"
    // for the case where notify-booking-event was called before the
    // charge had completed. That produced a contradictory pair of emails
    // when the no-show actually was charged. Now the fee row is only
    // included when this function knows the outcome (fee_charged flag is
    // explicit, OR fee_amount_cents > 0). For reschedule, no fee row.
    const serviceName = (booking as any).services?.name || 'Session';
    const feeCents = typeof fee_amount_cents === 'number' ? fee_amount_cents : 0;
    const showFeeRow = (isCancel || isNoShow) && (fee_charged === true || fee_charged === false);
    const feeLine = (feeCents > 0 && fee_charged)
      ? `$${(feeCents / 100).toFixed(2)} ${isNoShow ? 'no-show' : 'cancellation'} fee charged`
      : 'No fee charged';
    const whoCancelled = initiated_by === 'client' ? clientName : 'You (the therapist)';
    const nowStr = new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    const reasonClean = (reason && String(reason).trim()) ? String(reason).trim() : null;

    const actionLabel = isReschedule ? 'Rescheduled by' : (isNoShow ? 'Recorded by' : 'Cancelled by');
    const timestampLabel = isReschedule ? 'Rescheduled at' : (isNoShow ? 'Recorded at' : 'Cancelled at');

    const detailRows: Array<[string, string] | null> = [
      ['Client', clientName],
      ['Service', serviceName],
      // For reschedule: show "From" and "To". For cancel/no-show: just "Session was".
      isReschedule && prevWhenStr ? ['Previously', prevWhenStr] : null,
      isReschedule
        ? (whenStr ? ['Now scheduled for', whenStr] : null)
        : (whenStr ? ['Session was', whenStr] : null),
      [actionLabel, whoCancelled],
      reasonClean ? ['Reason', reasonClean] : null,
      showFeeRow ? ['Fee', feeLine] : null,
      [timestampLabel, nowStr],
    ];
    const filteredDetailRows = detailRows.filter((r): r is [string, string] => r !== null);

    const detailBoxHtml = `
      <table style="width:100%;border-collapse:collapse;margin:18px 0;background:#FAFAF7;border:1px solid #ECE7DC;border-radius:10px;overflow:hidden;">
        ${filteredDetailRows.map(([label, value], i) => `
          <tr style="${i < filteredDetailRows.length - 1 ? 'border-bottom:1px solid #ECE7DC;' : ''}">
            <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;vertical-align:top;">${label}</td>
            <td style="padding:10px 14px;font-size:14px;color:#1A2E22;text-align:right;">${String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          </tr>`).join('')}
      </table>`;

    const emailHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0D1F17;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${bannerColor};margin-bottom:8px;">${banner}</div>
      <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#2A5741;margin:0 0 6px;">${title}</h1>
      <p style="font-size:14px;color:#6B7280;margin:0 0 4px;line-height:1.6;">${summary}</p>
      ${detailBoxHtml}
      <a href="https://mybodymap.app/dashboard/schedule" style="display:inline-block;background:#2A5741;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:13px;font-weight:700;">Open schedule</a>
      <div style="font-size:11px;color:#9CA3AF;margin-top:24px;line-height:1.6;">
        You are getting this because ${mailFootline} is on in your notification settings.
      </div>
    </div>
  </div>
</body></html>`;

    // HK May 29 2026: for cancellation with a fee, charge-cancellation-fee
    // sends its OWN therapist email after the charge succeeds. To avoid
    // the double-fire HK saw on his C9 test, we skip the cancel/no-show
    // notification here when fee_charged is true and a fee amount was
    // passed; the charge function will emit a single email with the
    // correct fee outcome. If fee_charged is false or undefined, we own
    // the notification.
    const skipBecauseChargeWillFire = (isCancel || isNoShow) && fee_charged === true && feeCents > 0;

    const therapistResult = skipBecauseChargeWillFire ? { skipped: 'fee_charge_will_notify' } : await notifyTherapist({
      supabase, therapist,
      eventType: event_type,
      title,
      body: summary,
      icon: isReschedule ? '↻' : (isNoShow ? '🚫' : '🗑'),
      linkUrl: '/dashboard',
      payload: {
        booking_id,
        client_id: booking.client_id,
        fee_charged: fee_charged === true,
        fee_amount_cents: feeCents,
      },
      emailSubject: title,
      emailHtml,
      smsText: smsText || `MyBodyMap: ${isNoShow ? 'No-show' : 'Cancellation'} for ${firstName}${whenStr ? ' on ' + whenStr : ''}.${feeCents > 0 && fee_charged ? ` $${(feeCents / 100).toFixed(2)} charged.` : ''}`,
      bookingId: booking_id,
      clientId: booking.client_id,
    });

    // ─── Client-side fan-out (no-show only, no fee path) ──────────
    // HK May 17 2026: the polite no-show notice was the highest-impact
    // gap in the audit. Industry data: silence after a no-show recovers
    // ~8% of clients; a warm "we missed you" with a rebook link recovers
    // ~50%. SMS-first per the Journey playbook revision.
    //
    // For the no-fee no-show path (this code path), the message is
    // pure warmth + rebook. No payment request, because no fee was
    // charged. The fee path lives in charge-cancellation-fee and has
    // its own client-side messaging (which we will wire next).
    let clientResult = null;
    if (isNoShow && booking.client_id) {
      // Fetch full client record for the fan-out helper. Booking row
      // has name/email/phone copies but the client table is the
      // source of truth and may have more up-to-date contact info.
      const { data: client } = await supabase
        .from('clients')
        .select('id, name, email, phone')
        .eq('id', booking.client_id)
        .maybeSingle();

      // Use client table if available, fall back to booking copy
      const clientForFanOut = client || {
        id: booking.client_id,
        name: booking.client_name,
        email: booking.client_email,
        phone: booking.client_phone,
      };

      const therapistDisplayName = therapist.business_name || therapist.full_name || 'your therapist';
      const therapistFirstName = (therapist.full_name || 'Your therapist').split(' ')[0];
      const rebookUrl = therapist.custom_url
        ? `https://mybodymap.app/book/${therapist.custom_url}`
        : 'https://mybodymap.app/book';

      // SMS: short, warm, one tap to rebook. ~150 chars target.
      const smsText = `Hi ${(clientForFanOut.name || '').split(' ')[0] || 'there'}, ${therapistFirstName} missed you${whenStr ? ' on ' + whenStr : ''}. Hope everything's okay. Whenever you're ready: ${rebookUrl}`;

      // Email: longer, warmer, includes business name and rebook button.
      // No payment request in this code path (no_fee = true).
      const clientEmailSubject = `We missed you${whenStr ? ' on ' + whenStr : ''}`;
      const clientEmailHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FBFAF4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1F2937;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:16px;padding:36px 30px;box-shadow:0 4px 20px rgba(0,0,0,0.04);border:1px solid #F2EFE4;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6B9E80;margin-bottom:10px;">A note from ${therapistDisplayName}</div>
      <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:#1F4030;margin:0 0 16px;letter-spacing:-0.012em;">We missed you${whenStr ? ' on ' + whenStr : ''}.</h1>
      <p style="font-size:15px;color:#1F2937;margin:0 0 14px;line-height:1.7;">Hi ${(clientForFanOut.name || '').split(' ')[0] || 'there'},</p>
      <p style="font-size:15px;color:#1F2937;margin:0 0 14px;line-height:1.7;">${therapistFirstName} noticed you weren't able to make it to your session${whenStr ? ' on ' + whenStr : ''}. No fee, no fuss. Life happens.</p>
      <p style="font-size:15px;color:#1F2937;margin:0 0 24px;line-height:1.7;">Whenever you're ready to come back, the calendar is open.</p>
      <a href="${rebookUrl}" style="display:inline-block;background:#2A5741;color:#fff;text-decoration:none;padding:13px 28px;border-radius:999px;font-size:14px;font-weight:700;letter-spacing:0.02em;">Book another session →</a>
      <p style="font-size:13px;color:#6B7280;margin:28px 0 0;line-height:1.6;font-style:italic;font-family:Georgia,serif;">Looking forward to seeing you again,<br/>${therapistDisplayName}</p>
    </div>
    <div style="text-align:center;margin-top:18px;font-size:11px;color:#9CA3AF;">
      Sent on behalf of ${therapistDisplayName} via MyBodyMap.
    </div>
  </div>
</body></html>`;

      clientResult = await notifyClient({
        supabase, therapist, client: clientForFanOut,
        eventType: 'no_show_notice_no_fee',
        smsText,
        emailSubject: clientEmailSubject,
        emailHtml: clientEmailHtml,
        bookingId: booking_id,
        respectQuietHours: true,
      });
    }

    // HK May 26 2026: fan out the new client-facing emails after the
    // legacy therapist notification path completes. Non-blocking, no
    // error bubbles up if downstream fails. Routing logic inside the
    // helper picks which of the 7 inline-eligible touchpoints fire
    // based on event_type + payload.
    try {
      await fireDownstreamForBookingEvent(
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY,
        SUPABASE_ANON_KEY,
        event_type,
        booking_id,
        therapist.id,
        {
          initiatedBy: initiated_by,
          feeAmountCents: fee_amount_cents,
          feeCharged: fee_charged,
          paymentLinkUrl: payment_link_url,
          reschedulePrev: reschedule_prev,
          reason: reason,
        },
      );
    } catch (e) {
      console.warn('[notify-booking-event] downstream fan-out warning:', e?.message || e);
    }

    return respond({ ok: true, therapist: therapistResult, client: clientResult });
  } catch (e) {
    console.error('[notify-booking-event] error', e);
    return respond({ error: String(e?.message || e) }, 500);
  }
});

// HK May 26 2026: fan-out helper expanded for the 13-touchpoint
// notification batch. Now handles 7 of the 13 inline (the rest are
// cron-driven). Called inline after therapistResult so a failed
// downstream send does not block the legacy therapist notification.
// All non-blocking; failures logged but never thrown.
//
// Mapping (event_type + payload -> downstream function):
//   booking_cancelled (initiated_by=therapist) -> send-therapist-cancelled (C7)
//   booking_cancelled (initiated_by=client, no fee) -> send-client-cancelled-within-policy (C8)
//   booking_cancelled (initiated_by=client, with fee) -> send-client-cancelled-late (C9)
//   no_show_recorded -> send-no-show-occurred (T12)
//   no_show_recorded (with fee_charged=true) -> send-no-show-charged (C11) ALSO fires to client
//   no_show_recorded (with fee_charged=false + payment_link_url) -> send-no-show-payment-request (C12) ALSO fires
//   reschedule -> send-reschedule-confirmation (C10)
//
// The downstream functions handle their own deduplication via
// notification_log so re-fires are safe.
async function fireDownstreamForBookingEvent(
  supabaseUrl: string,
  serviceKey: string,
  anonKey: string,
  eventType: string,
  bookingId: string,
  therapistId: string,
  options: {
    initiatedBy?: 'therapist' | 'client',
    feeAmountCents?: number,
    feeCharged?: boolean,
    paymentLinkUrl?: string,
    reschedulePrev?: { prev_date?: string, prev_time?: string },
    reason?: string,
  } = {},
) {
  // HK May 29 2026: fan-out gateway auth uses anonKey (a proper JWT)
  // not serviceKey. The serviceKey at this Supabase project is the
  // legacy non-JWT format which the API gateway rejects as
  // UNAUTHORIZED_INVALID_JWT_FORMAT. The function on the other end
  // does its own DB queries with its own SUPABASE_SERVICE_ROLE_KEY,
  // so we don't need to forward the service key here. Fall back to
  // serviceKey if anonKey is unexpectedly empty so the function still
  // attempts the call (and we'll see the failure in notification_log).
  const gatewayToken = anonKey || serviceKey;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${gatewayToken}`,
    'apikey': gatewayToken,
  };
  const targets: Array<{ fn: string, payload: any }> = [];

  if (eventType === 'booking_cancelled') {
    if (options.initiatedBy === 'client') {
      if (options.feeAmountCents && options.feeAmountCents > 0) {
        targets.push({
          fn: 'send-client-cancelled-late',
          payload: {
            booking_id: bookingId,
            fee_amount_cents: options.feeAmountCents,
            fee_charged: options.feeCharged === true,
          },
        });
      } else {
        targets.push({
          fn: 'send-client-cancelled-within-policy',
          payload: { booking_id: bookingId },
        });
      }
    } else {
      // Therapist initiated: client gets the apologetic C7
      targets.push({
        fn: 'send-therapist-cancelled',
        payload: { booking_id: bookingId, reason: options.reason },
      });
    }
  } else if (eventType === 'no_show_recorded') {
    // Always fire T12 (therapist alert) with fee context
    targets.push({
      fn: 'send-no-show-occurred',
      payload: {
        booking_id: bookingId,
        fee_charged: options.feeCharged,
        fee_amount_cents: options.feeAmountCents,
      },
    });
    // If fee was charged successfully, send C11 receipt to client
    if (options.feeAmountCents && options.feeCharged === true) {
      targets.push({
        fn: 'send-no-show-charged',
        payload: {
          booking_id: bookingId,
          fee_amount_cents: options.feeAmountCents,
        },
      });
    }
    // If fee was attempted but failed (or payment link issued), send C12
    if (options.feeAmountCents && options.feeCharged === false && options.paymentLinkUrl) {
      targets.push({
        fn: 'send-no-show-payment-request',
        payload: {
          booking_id: bookingId,
          fee_amount_cents: options.feeAmountCents,
          payment_link_url: options.paymentLinkUrl,
        },
      });
    }
  } else if (eventType === 'reschedule') {
    targets.push({
      fn: 'send-reschedule-confirmation',
      payload: {
        booking_id: bookingId,
        prev_date: options.reschedulePrev?.prev_date,
        prev_time: options.reschedulePrev?.prev_time,
      },
    });
  }

  // HK May 29 2026: each fan-out fetch is observed via console.log AND
  // via a notification_log row for visibility into silent failures.
  // The previous Promise.allSettled approach swallowed every error
  // including 503s, timeouts, and JSON parse failures from the target
  // function. send-reschedule-confirmation went 12 days without
  // logging a single client row and we had zero diagnostic. Now each
  // call records its own outcome in notification_log under a
  // 'fan_out_' notification_type, with the HTTP status code, so
  // future regressions become a SQL query away from root cause.
  const supabase = createClient(supabaseUrl, serviceKey);
  await Promise.allSettled(targets.map(async (t) => {
    const startedAt = Date.now();
    let status = -1;
    let errorMsg: string | null = null;
    let bodyPreview: string | null = null;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/${t.fn}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(t.payload),
      });
      status = res.status;
      const text = await res.text().catch(() => '');
      bodyPreview = text ? text.slice(0, 300) : null;
      if (!res.ok) errorMsg = `${t.fn} returned ${res.status}: ${bodyPreview}`;
    } catch (e: any) {
      errorMsg = `${t.fn} fetch threw: ${e?.message || String(e)}`;
    }
    const ms = Date.now() - startedAt;
    console.log(`[notify-booking-event fan-out] ${t.fn} ${status} (${ms}ms)`, errorMsg || 'ok');
    // Log the fan-out attempt itself so we can audit silent failures.
    try {
      await supabase.from('notification_log').insert({
        therapist_id: therapistId,
        client_id: null,
        booking_id: t.payload?.booking_id || bookingId,
        notification_type: `fan_out_${t.fn}`,
        audience: 'system',
        channel: 'http',
        recipient: t.fn,
        status: status === 200 ? 'sent' : status === -1 ? 'failed' : `http_${status}`,
        error_message: errorMsg,
        subject: null,
      });
    } catch (_e) { /* logging failure must not break the parent function */ }
  }));
}
