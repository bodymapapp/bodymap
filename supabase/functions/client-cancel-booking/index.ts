// client-cancel-booking
//
// HK May 29 2026: client-initiated cancellation from the public
// manage page at /book/:slug/manage?b=<uuid>. Determines whether the
// cancellation lands inside or outside the therapist's cancellation
// fee window, updates the booking status, fires the right client-side
// confirmation email (C8 within-policy / C9 late + fee), AND notifies
// the therapist via notify-booking-event so they see the change in
// Schedule with the proper trace.
//
// Auth model: the booking_id is a UUID v4 (~122 bits of entropy).
// The client has the link from a prior email or SMS. No additional
// token verification today; the booking_id itself is the magic link.
// Same pattern Cal.com / Calendly use. Can be hardened later with a
// per-booking cancel_token if needed.
//
// Payload: { booking_id: string, reason?: string }
// Response: { ok, fee_charged, fee_amount_cents, status }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { booking_id, reason } = await req.json().catch(() => ({}));
    if (!booking_id) return j({ error: 'booking_id required' }, 400);

    // Pull the booking + therapist policy to decide the fee window.
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select(`
        id, status, booking_date, start_time,
        client_id, client_name, client_email, client_phone,
        therapist_id, service_id,
        services(name, price),
        therapists(
          id, full_name, business_name, custom_url, email,
          cancellation_policy_enabled, cancellation_policy, cancellation_policy_text,
          cancellation_fee_hours, cancellation_fee_amount_cents
        )
      `)
      .eq('id', booking_id)
      .single();
    if (bErr || !booking) return j({ error: 'booking_not_found' }, 404);

    // Refuse if already terminated.
    if (['cancelled', 'no_show'].includes(booking.status)) {
      return j({ error: 'already_cancelled', current_status: booking.status }, 409);
    }

    const therapist = (booking as any).therapists;
    const now = new Date();
    const apptStart = new Date(`${booking.booking_date}T${booking.start_time}`);
    const hoursUntil = (apptStart.getTime() - now.getTime()) / 3_600_000;

    const policyEnabled = !!therapist?.cancellation_policy_enabled;
    const feeHours = Number(therapist?.cancellation_fee_hours || 24);
    const feeAmountCents = Number(therapist?.cancellation_fee_amount_cents || 0);
    const isLate = policyEnabled && feeAmountCents > 0 && hoursUntil < feeHours;

    // For v1, we DO NOT auto-charge the card here. The therapist still
    // owns the fee decision; we just mark the booking cancelled with a
    // flag for the therapist to review in Schedule. The therapist can
    // charge from the booking panel afterward. This keeps the auth model
    // simple (no payment auth on a public link).

    const { error: updErr } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        // Reuse cancellation_charge_reason as the cancellation reason
        // field even when no charge fires. notification_log captures
        // initiated_by='client' for the WHO audit trail, so we don't
        // need a separate cancelled_by column.
        cancellation_charge_reason: (reason || '').trim().slice(0, 500) || null,
      })
      .eq('id', booking_id);
    if (updErr) return j({ error: 'update_failed', detail: updErr.message }, 500);

    // Fire C8 / C9 (client-side confirmation) and notify-booking-event
    // (therapist + Schedule trace). Both are fire-and-forget; failure
    // to log a notification should not block the cancellation itself.
    const clientFnName = isLate ? 'send-client-cancelled-late' : 'send-client-cancelled-within-policy';
    Promise.allSettled([
      supabase.functions.invoke(clientFnName, {
        body: {
          booking_id,
          fee_amount_cents: isLate ? feeAmountCents : 0,
          fee_charged: false, // therapist will collect manually if applicable
          reason: (reason || '').trim() || null,
        },
      }),
      supabase.functions.invoke('notify-booking-event', {
        body: {
          booking_id,
          event_type: 'booking_cancelled',
          initiated_by: 'client',
          reason: (reason || '').trim() || null,
          fee_charged: false,
          fee_amount_cents: isLate ? feeAmountCents : 0,
        },
      }),
    ]).catch(() => { /* non-blocking */ });

    return j({
      ok: true,
      status: 'cancelled',
      fee_applies: isLate,
      fee_amount_cents: isLate ? feeAmountCents : 0,
    });
  } catch (e) {
    console.error('[client-cancel-booking] error', e);
    return j({ error: 'unexpected', detail: String((e as any)?.message || e) }, 500);
  }
});

function j(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
