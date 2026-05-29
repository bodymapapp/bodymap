// supabase/functions/notify-refund-event/index.ts
//
// Fires a refund_issued notification when a session payment is
// refunded. Called from two paths:
//   1. refund-session-payment (in-app refund initiated by therapist)
//   2. stripe-refund-webhook (refund initiated from Stripe Dashboard)
//
// Both paths flip a session_payments row to status='refunded' and
// then call this function with the row id. Fans out to therapist
// (Bell + Email + SMS + Push) and client (Email + SMS).
//
// HK May 18 2026 morning: refunds had zero notification coverage
// in the Phase 14.3 stack. The webhook and in-app function both
// updated the DB silently. Therapist had to check their bell
// drawer manually to know a refund had happened.
//
// Payload:
//   { session_payment_id: string }   (required)
//   { source: 'webhook' | 'in_app' } (optional, for logging only)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyTherapist, notifyClient } from "../_shared/notifications.ts";
import { renderClientEmail } from "../_shared/clientEmail.ts";

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
    const { session_payment_id, source } = await req.json();
    if (!session_payment_id) return respond({ error: 'session_payment_id required' }, 400);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return respond({ error: 'env_not_set' }, 500);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: payment } = await supabase
      .from('session_payments')
      .select('id, therapist_id, client_id, booking_id, amount_cents, tip_cents, payment_method, payment_method_detail, status, paid_at')
      .eq('id', session_payment_id)
      .maybeSingle();

    if (!payment) return respond({ error: 'payment_not_found' }, 404);
    if (payment.status !== 'refunded') {
      return respond({ ok: true, skipped: 'status_not_refunded' });
    }

    const { data: therapist } = await supabase
      .from('therapists')
      .select('id, email, phone, full_name, business_name, custom_url, notification_prefs, twilio_account_sid, twilio_auth_token, twilio_phone_number')
      .eq('id', payment.therapist_id)
      .maybeSingle();
    if (!therapist) return respond({ error: 'therapist_not_found' }, 404);

    const { data: client } = payment.client_id ? await supabase
      .from('clients')
      .select('id, name, email, phone')
      .eq('id', payment.client_id)
      .maybeSingle() : { data: null };

    let booking: any = null;
    if (payment.booking_id) {
      const { data } = await supabase
        .from('bookings')
        .select('id, booking_date, start_time, services(name)')
        .eq('id', payment.booking_id)
        .maybeSingle();
      booking = data;
    }

    const totalCents = (payment.amount_cents || 0) + (payment.tip_cents || 0);
    const dollars = (totalCents / 100).toFixed(2);
    const clientName = (client?.name || 'Client').toString();
    const firstName = clientName.split(' ')[0];
    const businessName = therapist.business_name || therapist.full_name || 'MyBodyMap';

    const isStripe = payment.payment_method?.startsWith('stripe_');
    const methodLabel =
      payment.payment_method === 'stripe_card_on_file' ? (payment.payment_method_detail || 'Card on file')
      : payment.payment_method === 'stripe_card_new' ? (payment.payment_method_detail || 'Card')
      : payment.payment_method === 'stripe_payment_link' ? 'Payment link'
      : payment.payment_method === 'cash' ? 'Cash'
      : payment.payment_method === 'venmo' ? 'Venmo'
      : payment.payment_method === 'zelle' ? 'Zelle'
      : payment.payment_method === 'cashapp' ? 'Cash App'
      : payment.payment_method === 'check' ? 'Check'
      : 'Payment';

    let whenStr = '';
    if (booking?.booking_date && booking?.start_time) {
      const dt = new Date(`${booking.booking_date}T${booking.start_time}`);
      whenStr = isNaN(dt.getTime())
        ? `${booking.booking_date} ${booking.start_time}`
        : dt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    // ─── Therapist fan-out ─────────────────────────────────────────
    const title = `Refunded $${dollars} to ${firstName}`;
    const summary = isStripe
      ? `${methodLabel}${whenStr ? ' (' + whenStr + ' session)' : ''}. The refund will return to the client's card in 5 to 10 business days.`
      : `${methodLabel}${whenStr ? ' (' + whenStr + ' session)' : ''}. Marked refunded; remember to return the ${methodLabel.toLowerCase()} to ${firstName} separately.`;

    const emailHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0D1F17;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#DC2626;margin-bottom:8px;">↩ Refund issued</div>
      <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#2A5741;margin:0 0 6px;">$${dollars} to ${clientName}</h1>
      <p style="font-size:14px;color:#6B7280;margin:0 0 18px;line-height:1.6;">${summary}</p>
      <a href="https://mybodymap.app/dashboard/billing" style="display:inline-block;background:#2A5741;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:13px;font-weight:700;">Open Billing</a>
      <div style="font-size:11px;color:#9CA3AF;margin-top:24px;line-height:1.6;">
        You are getting this because "Refund issued" is on in your notification settings.
      </div>
    </div>
  </div>
</body></html>`;

    const therapistResult = await notifyTherapist({
      supabase, therapist,
      eventType: 'refund_issued',
      title,
      body: summary,
      icon: '↩',
      linkUrl: '/dashboard/billing',
      payload: {
        session_payment_id: payment.id,
        booking_id: payment.booking_id,
        client_id: payment.client_id,
        amount_cents: totalCents,
        source: source || 'unknown',
      },
      emailSubject: `Refund issued: $${dollars} to ${firstName}`,
      emailHtml,
      smsText: `MyBodyMap: refunded $${dollars} to ${firstName}. ${isStripe ? 'Back on their card in 5-10 days.' : 'Return the ' + methodLabel.toLowerCase() + ' separately.'}`,
      bookingId: payment.booking_id,
      clientId: payment.client_id,
    });

    // ─── Client fan-out ────────────────────────────────────────────
    let clientResult = null;
    if (client) {
      // HK May 29 2026: per EMAIL_COPY_SPEC C16. Clean confirmation,
      // shows the refund amount + where it's returning to, NOT marketing.
      const refundReturnPath = isStripe
        ? `card ending ${payment.payment_method_detail || 'on file'}`
        : null;
      const policyNote = isStripe
        ? `The amount will return to your ${refundReturnPath} within 5 to 10 business days. Your card statement will reflect the refund automatically.`
        : `This was paid via ${methodLabel}. ${businessName} will return the funds to you separately.`;

      const clientEmailHtml = renderClientEmail({
        therapist,
        toneEyebrow: 'Refund issued',
        toneEyebrowKind: 'sage',
        title: `$${dollars} refunded`,
        opener: `${businessName} has issued a refund of $${dollars}${booking?.services?.name ? ' for your ' + booking.services.name : ''}${whenStr ? ' on ' + whenStr : ''}.`,
        serviceName: booking?.services?.name || null,
        bookingDate: booking?.booking_date || null,
        startTime: booking?.start_time || null,
        refundAmountCents: totalCents,
        refundedTo: refundReturnPath,
        policyInline: policyNote,
        closingLine: `Questions? Reply to this email and ${businessName} will get back to you.`,
        prefName: 'Refund issued',
      });
      const clientHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Refund $${dollars}</title></head><body style="margin:0;padding:0;background:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0D1F17;"><div style="max-width:520px;margin:0 auto;padding:32px 16px;"><div style="background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,0.06);">${clientEmailHtml}</div></div></body></html>`;

      const clientSms = isStripe
        ? `${businessName}: refunded $${dollars} to your card. Back on the card in 5-10 business days.`
        : `${businessName}: refunded $${dollars}. We'll return the ${methodLabel.toLowerCase()} to you separately.`;

      clientResult = await notifyClient({
        supabase, therapist, client,
        eventType: 'refund_issued',
        emailSubject: `Refund: $${dollars} from ${businessName}`,
        emailHtml: clientHtml,
        smsText: clientSms,
        bookingId: payment.booking_id,
      });
    }

    return respond({ ok: true, therapist_result: therapistResult, client_result: clientResult });
  } catch (e) {
    console.error('[notify-refund-event] error', e);
    return respond({ error: String(e?.message || e) }, 500);
  }
});
