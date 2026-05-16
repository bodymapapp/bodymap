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
import { notifyTherapist } from "../_shared/notifications.ts";

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
    const { booking_id, event_type } = await req.json();
    if (!booking_id) return respond({ error: 'booking_id required' }, 400);
    if (event_type !== 'booking_cancelled' && event_type !== 'no_show_recorded') {
      return respond({ error: 'event_type must be booking_cancelled or no_show_recorded' }, 400);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return respond({ error: 'env_not_set' }, 500);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, therapist_id, client_id, client_name, client_email, start_at, booking_date, start_time, status')
      .eq('id', booking_id)
      .maybeSingle();

    if (!booking) return respond({ error: 'booking_not_found' }, 404);

    const { data: therapist } = await supabase
      .from('therapists')
      .select('id, email, phone, full_name, business_name, notification_prefs, twilio_account_sid, twilio_auth_token, twilio_phone_number')
      .eq('id', booking.therapist_id)
      .maybeSingle();

    if (!therapist) return respond({ error: 'therapist_not_found' }, 404);

    const isNoShow = event_type === 'no_show_recorded';
    const clientName = (booking.client_name || 'Client').toString();
    const firstName = clientName.split(' ')[0];

    let whenStr = '';
    if (booking.start_at) {
      whenStr = new Date(booking.start_at).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      });
    } else if (booking.booking_date && booking.start_time) {
      const dt = new Date(`${booking.booking_date}T${booking.start_time}`);
      whenStr = isNaN(dt.getTime())
        ? `${booking.booking_date} ${booking.start_time}`
        : dt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    const title = isNoShow
      ? `${firstName} marked no-show`
      : `${firstName} cancelled`;
    const summary = isNoShow
      ? `${clientName} did not show up${whenStr ? ' for ' + whenStr : ''}. No fee was charged.`
      : `${clientName}'s session${whenStr ? ' for ' + whenStr : ''} was cancelled. No fee was charged.`;

    const emailHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0D1F17;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${isNoShow ? '#92400E' : '#DC2626'};margin-bottom:8px;">${isNoShow ? '🚫 No-show recorded' : '🗑 Booking cancelled'}</div>
      <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#2A5741;margin:0 0 6px;">${title}</h1>
      <p style="font-size:14px;color:#6B7280;margin:0 0 18px;line-height:1.6;">${summary}</p>
      <a href="https://mybodymap.app/dashboard" style="display:inline-block;background:#2A5741;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:13px;font-weight:700;">Open Dashboard</a>
      <div style="font-size:11px;color:#9CA3AF;margin-top:24px;line-height:1.6;">
        You are getting this because "${isNoShow ? 'No-show recorded' : 'Booking cancelled'}" is on in your notification settings.
      </div>
    </div>
  </div>
</body></html>`;

    const result = await notifyTherapist({
      supabase, therapist,
      eventType: event_type,
      title,
      body: summary,
      icon: isNoShow ? '🚫' : '🗑',
      linkUrl: '/dashboard',
      payload: {
        booking_id,
        client_id: booking.client_id,
        no_fee: true,
      },
      emailSubject: title,
      emailHtml,
      smsText: `MyBodyMap: ${isNoShow ? 'No-show' : 'Cancellation'} for ${firstName}${whenStr ? ' on ' + whenStr : ''}. No fee.`,
      bookingId: booking_id,
      clientId: booking.client_id,
    });

    return respond({ ok: true, result });
  } catch (e) {
    console.error('[notify-booking-event] error', e);
    return respond({ error: String(e?.message || e) }, 500);
  }
});
