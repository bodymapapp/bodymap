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
import { renderClientEmailDoc } from "../_shared/clientEmail.ts";
import { formatApptDateTime } from "../_shared/emailTemplate.ts";

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
// HK May 29 2026 (consolidation rebuild): the previous HTTP fan-out
// from this function to send-X edge functions broke on May 17 when
// Supabase tightened gateway JWT validation. The service-role key
// became invalid as a Bearer token while still valid for DB access.
// SUPABASE_ANON_KEY env var is not auto-provided in this project so
// the fan-out had no working Bearer to use.
//
// Rebuilt to do all client-side notifications INLINE. We already
// loaded the booking, therapist, and client to send the therapist
// notification. We just need to render the client version of each
// channel (email/SMS/push) and call notifyClient(). This eliminates
// the entire gateway hop and fixes 9 broken client notification
// types in one shot.
//
// Helper: clientEmailContentFor(eventType, ctx) returns a
// {subject, html, smsText} bundle. Each event type's copy lives in
// one place. The original send-X functions remain on disk for cron
// use; their HTTP fan-out is no longer invoked from here.
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
  const supabase = createClient(supabaseUrl, serviceKey);

  // Single canonical fetch of everything we need to render client
  // notifications. notifyTherapist above already did its own fetch
  // so this is a small additional round-trip; we could optimize by
  // hoisting it but readability wins for now.
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select(`
      id, client_id, booking_date, start_time, service_id,
      services(name, duration),
      location:therapist_locations(name, street1, street2, city, state, postal_code),
      therapists(id, full_name, business_name, custom_url, email, notification_prefs),
      clients(id, name, email, phone, sms_opted_out_at, outreach_unsubscribed_at)
    `)
    .eq('id', bookingId)
    .single();

  if (bErr || !booking) {
    console.warn('[notify-booking-event inline] booking lookup failed',
      bErr?.message || 'no rows', 'booking_id:', bookingId);
    return;
  }

  const therapist = booking.therapists;
  const client = booking.clients;
  if (!client) {
    console.warn('[notify-booking-event inline] no client on booking', bookingId);
    return;
  }

  const content = clientEmailContentFor(eventType, {
    booking, therapist, client, options,
  });
  if (!content) {
    // No client-facing notification for this event type (e.g.
    // therapist-only events) or content builder returned null.
    return;
  }

  try {
    await notifyClient({
      supabase,
      therapist,
      client,
      eventType: content.notificationType,
      emailSubject: content.subject,
      emailHtml: content.html,
      smsText: content.smsText,
      bookingId: booking.id,
    });
  } catch (e: any) {
    console.error('[notify-booking-event inline] notifyClient threw', e?.message || e);
    // Log directly so the failure is visible.
    try {
      await supabase.from('notification_log').insert({
        therapist_id: therapistId,
        client_id: client.id,
        booking_id: booking.id,
        notification_type: content.notificationType,
        audience: 'client',
        channel: 'email',
        recipient: client.email || null,
        status: 'failed',
        error_message: `inline send threw: ${e?.message || String(e)}`,
        subject: content.subject,
      });
    } catch (_e2) { /* log of log failed */ }
  }
}

// ───────────────────────────────────────────────────────────────────
// clientEmailContentFor: returns the per-event copy bundle for the
// client-facing notification. Centralizes the subject/eyebrow/title/
// opener/CTA copy that used to live in 9 separate send-X functions.
// Returns null when the event type has no client-facing notification.
// ───────────────────────────────────────────────────────────────────
function clientEmailContentFor(eventType: string, ctx: {
  booking: any,
  therapist: any,
  client: any,
  options: any,
}) {
  const { booking, therapist, client, options } = ctx;
  const serviceName = booking.services?.name || 'Massage session';
  const serviceDuration = booking.services?.duration || null;
  const loc = booking.location;
  const locationAddr = loc ? [loc.street1, loc.street2, [loc.city, loc.state].filter(Boolean).join(", "), loc.postal_code].filter(Boolean).join(", ") : null;
  const therapistFirst = (therapist?.full_name || therapist?.business_name || 'Your therapist').split(' ')[0];
  const businessName = therapist?.business_name || 'MyBodyMap';
  // HK May 29 2026: strip parenthetical/bracketed annotations from
  // names before showing them. Real-world client names sometimes
  // include things like "Joy Test [C15-90d]" (HK's test markers) or
  // "Sandra (referral from Lisa)" (therapist's own note). We don't
  // want "Hi [C15-90d]" or "Hi (referral" in the email subject line.
  const cleanName = (raw: string | null | undefined): string => {
    if (!raw) return '';
    return raw
      .replace(/\[[^\]]*\]/g, '')   // strip [...]
      .replace(/\([^)]*\)/g, '')    // strip (...)
      .replace(/\s+/g, ' ')         // collapse whitespace
      .trim();
  };
  // HK May 31 2026: precedence flipped. Was preferring client.name over
  // booking.client_name; that produced "Lapse Test" receipts when the
  // booking actually said "Joy Client". The therapist typed
  // booking.client_name at booking time and that is the truth for
  // THIS session, regardless of how clients.name has drifted since.
  const clientNameClean = cleanName(booking.client_name) || cleanName(client.name) || 'there';
  const clientFirst = clientNameClean.split(' ')[0] || 'there';
  const whenStr = formatApptDateTime(booking.booking_date, booking.start_time);
  const whenDate = whenStr.split(' at ')[0];
  const bookingUrl = `https://mybodymap.app/book/${therapist?.custom_url}`;
  // HK May 29 2026: manage URL is the client-facing page where they
  // can view + cancel a specific booking. Was using a non-existent
  // ?reschedule=<id> param on the public booking page which 404'd to
  // the regular booking flow. /book/<slug>/manage?b=<uuid> is the
  // canonical pattern (matches Cal.com / Calendly magic links).
  const manageUrl = `https://mybodymap.app/book/${therapist?.custom_url}/manage?b=${booking.id}`;
  const feeDollars = options.feeAmountCents ? (options.feeAmountCents / 100).toFixed(2) : '0.00';

  if (eventType === 'reschedule') {
    const subject = `Your session has been moved to ${whenStr}`;
    return {
      notificationType: 'reschedule_confirmation',
      subject,
      html: renderClientEmailDoc(subject, {
        therapist,
        toneEyebrow: 'Session rescheduled',
        toneEyebrowKind: 'gold',
        title: `Your session is now ${whenDate}`,
        opener: `Hi ${clientFirst}, your ${serviceName} with ${therapistFirst} has been moved to a new time. Here are the new details.`,
        serviceName,
        bookingDate: booking.booking_date,
        startTime: booking.start_time,
        durationMin: serviceDuration,
        locationAddress: locationAddr,
        previousDate: options.reschedulePrev?.prev_date || null,
        previousTime: options.reschedulePrev?.prev_time || null,
        primaryCta: { label: 'View or cancel this booking', href: manageUrl },
        closingLine: `If this new time does not work, you can cancel from the link above or reply to this email and I will sort it out.`,
        prefName: 'Booking rescheduled',
      }, `Your session is now ${whenStr}.`),
      smsText: `${businessName}: your ${serviceName} has been moved to ${whenStr}. See you then. Manage: ${manageUrl}`,
    };
  }

  if (eventType === 'booking_cancelled') {
    if (options.initiatedBy === 'therapist') {
      const subject = `${therapistFirst} had to cancel ${whenDate}'s session`;
      return {
        notificationType: 'therapist_cancelled',
        subject,
        html: renderClientEmailDoc(subject, {
          therapist,
          toneEyebrow: 'Session cancelled',
          toneEyebrowKind: 'rose',
          title: `${therapistFirst} had to cancel`,
          opener: `Hi ${clientFirst}, I'm so sorry to send this. I have to cancel your ${serviceName} that we had scheduled. I know rearranging your day for this isn't nothing, and I appreciate your patience with me.${options.reason ? ` (${options.reason})` : ''}`,
          serviceName,
          bookingDate: booking.booking_date,
          startTime: booking.start_time,
          durationMin: serviceDuration,
          primaryCta: { label: 'Find another time', href: bookingUrl },
          closingLine: `Thank you for understanding. If you have any questions, just reply to this email and I'll get back to you personally.`,
          prefName: 'Cancelled by therapist',
        }, `${therapistFirst} cancelled your session on ${whenDate}.`),
        smsText: `${businessName}: I had to cancel your ${serviceName} on ${whenDate}. Sorry for the inconvenience. Book another time: ${bookingUrl}`,
      };
    }
    // Client-initiated cancellation
    if (options.feeAmountCents && options.feeAmountCents > 0) {
      // Late cancel with fee
      const subject = `Your cancellation and fee receipt`;
      return {
        notificationType: 'client_cancelled_late',
        subject,
        html: renderClientEmailDoc(subject, {
          therapist,
          toneEyebrow: 'Cancellation confirmed',
          toneEyebrowKind: 'gold',
          title: `Your cancellation is confirmed`,
          opener: `Hi ${clientFirst}, we've cancelled your ${serviceName}. Because this came in close to the appointment time, the cancellation fee per my policy applies. Sharing the receipt below.`,
          serviceName,
          bookingDate: booking.booking_date,
          startTime: booking.start_time,
          extraFactRows: [{ label: 'Fee', value: `$${feeDollars}` }],
          primaryCta: { label: 'Book another time', href: bookingUrl },
          closingLine: `If you have any questions about the fee, please reply to this email.`,
          prefName: 'Cancelled, fee applied',
        }, `Cancellation confirmed, $${feeDollars} fee charged.`),
        smsText: `${businessName}: cancellation confirmed for ${whenDate}. $${feeDollars} fee applied. Receipt emailed.`,
      };
    }
    // Within-policy cancel, no fee
    const subject = `Your cancellation is confirmed`;
    return {
      notificationType: 'client_cancelled_within_policy',
      subject,
      html: renderClientEmailDoc(subject, {
        therapist,
        toneEyebrow: 'Cancellation confirmed',
        toneEyebrowKind: 'sage',
        title: `Your cancellation is confirmed`,
        opener: `Hi ${clientFirst}, we've cancelled your ${serviceName}. No fee was charged, no need to explain. Whenever the timing works for you again, I'd love to see you.`,
        serviceName,
        bookingDate: booking.booking_date,
        startTime: booking.start_time,
        primaryCta: { label: 'Book another time', href: bookingUrl },
        closingLine: `Take care.`,
        prefName: 'Cancelled, no fee',
      }, `Your ${serviceName} on ${whenDate} is cancelled.`),
      smsText: `${businessName}: your ${serviceName} on ${whenDate} is cancelled. No fee. Book again when you're ready: ${bookingUrl}`,
    };
  }

  if (eventType === 'no_show_recorded') {
    if (options.feeAmountCents && options.feeCharged === true) {
      const subject = `About your missed session on ${whenDate}`;
      return {
        notificationType: 'no_show_charged',
        subject,
        html: renderClientEmailDoc(subject, {
          therapist,
          toneEyebrow: 'About your missed session',
          toneEyebrowKind: 'gold',
          title: `About your missed session`,
          opener: `Hi ${clientFirst}, I held your time and was looking forward to seeing you. Since you didn't make it, per the cancellation policy a fee has been charged to your card on file. Sharing the receipt here so you have it.`,
          serviceName,
          bookingDate: booking.booking_date,
          startTime: booking.start_time,
          extraFactRows: [{ label: 'Fee', value: `$${feeDollars}` }],
          primaryCta: { label: 'Book another session', href: bookingUrl },
          closingLine: `If this was a misunderstanding or something came up, please reply to this email and I'll get back to you.`,
          prefName: 'No-show fee receipt',
        }, `No-show fee of $${feeDollars} charged.`),
        smsText: `${businessName}: missed ${whenDate}'s ${serviceName}. $${feeDollars} fee charged per policy. Receipt emailed.`,
      };
    }
    if (options.feeAmountCents && options.feeCharged === false && options.paymentLinkUrl) {
      const subject = `About your missed session on ${whenDate}`;
      return {
        notificationType: 'no_show_payment_request',
        subject,
        html: renderClientEmailDoc(subject, {
          therapist,
          toneEyebrow: 'About your missed session',
          toneEyebrowKind: 'gold',
          title: `About your missed session`,
          opener: `Hi ${clientFirst}, I held your time and was looking forward to seeing you. Since you couldn't make it, the no-show fee per my cancellation policy applies. There's no card on file to charge, so here's a link to take care of it whenever you have a moment.`,
          serviceName,
          bookingDate: booking.booking_date,
          startTime: booking.start_time,
          extraFactRows: [{ label: 'Fee', value: `$${feeDollars}` }],
          primaryCta: { label: `Pay $${feeDollars} now`, href: options.paymentLinkUrl },
          secondaryCta: { label: 'Book another session', href: bookingUrl },
          closingLine: `Once paid, you're all set. If you have any questions, just reply to this email.`,
          prefName: 'No-show payment request',
        }, `$${feeDollars} no-show fee due.`),
        smsText: `${businessName}: missed ${whenDate}'s ${serviceName}. $${feeDollars} fee due. Pay: ${options.paymentLinkUrl}`,
      };
    }
    // No-show without fee: no client notification (silent on client side
    // per HK design memo, to preserve trust when no money is owed).
    return null;
  }

  // Unknown / no-op event type
  return null;
}
