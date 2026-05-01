// booking-approval edge function.
//
// Therapist taps Approve or Decline on a pending-approval booking
// from their dashboard. This function:
//   1. Verifies caller is the booking's therapist (auth via JWT email
//      lookup against the therapists table)
//   2. Updates booking status: 'confirmed' on approve, 'cancelled' on decline
//   3. Sends a Joy-voiced email to the client confirming the outcome
//
// Body: { booking_id, action: 'approve' | 'decline', reason?: string }
//
// Auth: JWT in Authorization header. Function deploys with default
// (verify-jwt enabled).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
        therapists(id, full_name, business_name, custom_url, email),
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

    const newStatus = action === 'approve' ? 'confirmed' : 'cancelled';
    const updates: Record<string, any> = {
      status: newStatus,
      approval_action_at: new Date().toISOString(),
    };
    if (action === 'decline' && reason) {
      updates.decline_reason = String(reason).slice(0, 500);
    }

    const { error: updateErr } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', booking_id);

    if (updateErr) return respond({ error: updateErr.message }, 500);

    // Send Joy-voiced email to client.
    if (RESEND_API_KEY && booking.client_email) {
      const therapist = booking.therapists;
      const service = booking.services;
      const therapistName = therapist?.business_name || therapist?.full_name || 'Your therapist';
      const therapistFirst = (therapist?.full_name || '').split(' ')[0] || 'your therapist';
      const firstName = (booking.client_name || '').split(' ')[0] || 'there';

      const bookingDate = new Date(booking.booking_date + 'T12:00:00');
      const dateStr = bookingDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const [h, m] = booking.start_time.split(':').map(Number);
      const timeStr = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;

      const intakeUrl = `https://www.mybodymap.app/${therapist?.custom_url}`;
      const bookAgainUrl = `https://www.mybodymap.app/book/${therapist?.custom_url}`;

      let subject = '';
      let html = '';

      if (action === 'approve') {
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

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'MyBodyMap <sessions@mybodymap.app>',
            to: [booking.client_email],
            bcc: ['bodymapdemo@gmail.com'],
            subject,
            html,
          }),
        });
      } catch (e) { /* never block the status update on email failure */ }
    }

    return respond({ ok: true, status: newStatus });
  } catch (e: any) {
    return respond({ error: e?.message || String(e) }, 500);
  }
});
