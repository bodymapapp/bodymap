// supabase/functions/notify-payment-event/index.ts
//
// Fires a payment_received notification when a therapist captures
// money for a session. Called fire-and-forget from the client side
// after a successful session_payments insert.
//
// HK May 18 2026 morning: zero notifications fired across all the
// payment events tested in the Phase 12-14 marathon. Root cause:
// CheckoutModal and MarkAsPaidModal insert into session_payments
// directly from the browser, with no fire path after. This function
// fills that gap.
//
// Fans out to therapist (Bell + Email + SMS + Push) and to client
// (Email + SMS) per their notification_prefs.
//
// Auth: anon key with --no-verify-jwt at deploy. The endpoint is
// safe to expose because it only acts on existing session_payments
// rows the caller can already see via RLS; it doesn't accept
// arbitrary therapist_id or amount input.
//
// Payload:
//   { session_payment_id: string }   (required)
//
// Response:
//   { ok: true, therapist_result, client_result }
//   { error: '...' }                (4xx/5xx)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyTherapist, notifyClient } from "../_shared/notifications.ts";
import { renderClientEmailDoc } from "../_shared/clientEmail.ts";
import { resolveClientName, resolveClientFirstName } from "../_shared/clientName.ts";

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
    const { session_payment_id } = await req.json();
    if (!session_payment_id) return respond({ error: 'session_payment_id required' }, 400);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return respond({ error: 'env_not_set' }, 500);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Load the payment row + linked booking + linked client + therapist.
    const { data: payment } = await supabase
      .from('session_payments')
      .select('id, therapist_id, client_id, booking_id, amount_cents, tip_cents, payment_method, payment_method_detail, status, paid_at')
      .eq('id', session_payment_id)
      .maybeSingle();

    if (!payment) return respond({ error: 'payment_not_found' }, 404);
    if (payment.status !== 'succeeded') {
      return respond({ ok: true, skipped: 'status_not_succeeded' });
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
        .select('id, booking_date, start_time, client_name, client_email, services(name)')
        .eq('id', payment.booking_id)
        .maybeSingle();
      booking = data;
    }

    // Format what + when + how much
    const totalCents = (payment.amount_cents || 0) + (payment.tip_cents || 0);
    const dollars = (totalCents / 100).toFixed(2);
    const tipDollars = ((payment.tip_cents || 0) / 100).toFixed(2);
    const hasTip = (payment.tip_cents || 0) > 0;
    // HK May 31 2026: prefer booking.client_name over client.name. The
    // therapist typed booking.client_name at booking time; clients.name
    // may have drifted (merged records, lapse fixtures sharing emails).
    const clientName = resolveClientName(booking, client, 'Client');
    const firstName = resolveClientFirstName(booking, client, 'Client');
    const businessName = therapist.business_name || therapist.full_name || 'MyBodyMap';

    let whenStr = '';
    if (booking?.booking_date && booking?.start_time) {
      const dt = new Date(`${booking.booking_date}T${booking.start_time}`);
      whenStr = isNaN(dt.getTime())
        ? `${booking.booking_date} ${booking.start_time}`
        : dt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    const methodLabel =
      payment.payment_method === 'stripe_card_on_file' ? (payment.payment_method_detail || 'Card on file')
      : payment.payment_method === 'stripe_card_new' ? (payment.payment_method_detail || 'New card')
      : payment.payment_method === 'stripe_payment_link' ? 'Payment link'
      // HK May 31 2026 (Square Parity v1): Square method labels.
      // Before this, Square charges showed as "Other" in receipts.
      : payment.payment_method === 'square_card_on_file' ? (payment.payment_method_detail || 'Square card on file')
      : payment.payment_method === 'square_card_new' ? (payment.payment_method_detail || 'Square card')
      : payment.payment_method === 'square_payment_link' ? 'Square payment link'
      : payment.payment_method === 'cash' ? 'Cash'
      : payment.payment_method === 'venmo' ? 'Venmo'
      : payment.payment_method === 'zelle' ? 'Zelle'
      : payment.payment_method === 'cashapp' ? 'Cash App'
      : payment.payment_method === 'check' ? 'Check'
      : 'Payment';

    // ─── Therapist fan-out ─────────────────────────────────────────
    const title = `${firstName} paid $${dollars}`;
    const summary = `${methodLabel}${whenStr ? ' for ' + whenStr : ''}${hasTip ? ` (includes $${tipDollars} tip)` : ''}.`;

    // HK May 29 2026: therapist payment receipt was bland (one line).
    // Build a real detail box with service, when, method, tip, total.
    const serviceName = booking?.services?.name || 'Session';
    const therapistDetailRows: Array<[string, string]> = [];
    therapistDetailRows.push(['From', clientName]);
    therapistDetailRows.push(['Service', serviceName]);
    if (whenStr) therapistDetailRows.push(['Session', whenStr]);
    therapistDetailRows.push(['Method', methodLabel]);
    if (hasTip) therapistDetailRows.push(['Tip', `$${tipDollars}`]);
    therapistDetailRows.push(['Total', `$${dollars}`]);
    const therapistDetailBox = `
      <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#FAFAF7;border:1px solid #ECE7DC;border-radius:10px;overflow:hidden;">
        ${therapistDetailRows.map(([label, value], i) => `
          <tr style="${i < therapistDetailRows.length - 1 ? 'border-bottom:1px solid #ECE7DC;' : ''}">
            <td style="padding:9px 14px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;">${label}</td>
            <td style="padding:9px 14px;font-size:14px;color:#1A2E22;text-align:right;font-weight:${label === 'Total' ? '700' : '500'};">${String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          </tr>`).join('')}
      </table>`;

    const emailHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0D1F17;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#2A5741;margin-bottom:8px;">💚 Payment received</div>
      <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#2A5741;margin:0 0 6px;">$${dollars} from ${clientName}</h1>
      <p style="font-size:14px;color:#6B7280;margin:0 0 4px;line-height:1.6;">${methodLabel}${whenStr ? ' &middot; ' + whenStr : ''}${hasTip ? ' &middot; tip $' + tipDollars : ''}</p>
      ${therapistDetailBox}
      <a href="https://mybodymap.app/dashboard/billing" style="display:inline-block;background:#2A5741;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:13px;font-weight:700;">Open Billing</a>
      <div style="font-size:11px;color:#9CA3AF;margin-top:24px;line-height:1.6;">
        You are getting this because "Payment received" is on in your notification settings.
      </div>
    </div>
  </div>
</body></html>`;

    const therapistResult = await notifyTherapist({
      supabase, therapist,
      eventType: 'payment_received',
      title,
      body: summary,
      icon: '💚',
      linkUrl: '/dashboard/billing',
      payload: {
        session_payment_id: payment.id,
        booking_id: payment.booking_id,
        client_id: payment.client_id,
        amount_cents: totalCents,
        payment_method: payment.payment_method,
      },
      emailSubject: `Payment received: $${dollars} from ${firstName}`,
      emailHtml,
      smsText: `MyBodyMap: $${dollars} from ${firstName}${whenStr ? ' for ' + whenStr : ''}. ${methodLabel}.`,
      bookingId: payment.booking_id,
      clientId: payment.client_id,
    });

    // ─── Client fan-out (receipt-style) ────────────────────────────
    let clientResult = null;
    if (client) {
      const serviceName = booking?.services?.name || 'your session';
      const clientFirst = resolveClientFirstName(booking, client, 'there');
      const therapistFirst = (therapist?.full_name || businessName).split(' ')[0];

      // HK May 29 2026: per EMAIL_COPY_SPEC C13. Clean receipt, NOT
      // marketing, full breakdown so the client has a real invoice in
      // their inbox they can forward to an HSA/FSA admin if needed.
      const extraRows: Array<{ label: string, value: string }> = [];
      extraRows.push({ label: 'Method', value: methodLabel });
      if (hasTip) extraRows.push({ label: 'Tip', value: `$${tipDollars}` });
      extraRows.push({ label: 'Total', value: `$${dollars}` });

      const clientEmailHtml = renderClientEmailDoc(
        `Receipt: $${dollars} payment to ${businessName}`,
        {
          therapist,
          toneEyebrow: 'Receipt',
          toneEyebrowKind: 'sage',
          title: `Thank you, ${clientFirst}`,
          opener: `${businessName} has received your payment of $${dollars}${whenStr ? ' for your ' + serviceName + ' on ' + whenStr : ''}. Here's your receipt.`,
          serviceName,
          bookingDate: booking?.booking_date || null,
          startTime: booking?.start_time || null,
          extraFactRows: extraRows,
          closingLine: `Questions about this charge? Just reply to this email.`,
          prefName: 'Payment receipt',
        },
        `Your receipt for $${dollars}`
      );

      clientResult = await notifyClient({
        supabase, therapist, client,
        eventType: 'payment_received',
        emailSubject: `Receipt: $${dollars} payment to ${businessName}`,
        emailHtml: clientEmailHtml,
        smsText: `${businessName}: thanks for $${dollars} payment${whenStr ? ' for ' + whenStr : ''}. Receipt sent to your email.`,
        bookingId: payment.booking_id,
      });
    }

    return respond({ ok: true, therapist_result: therapistResult, client_result: clientResult });
  } catch (e) {
    console.error('[notify-payment-event] error', e);
    return respond({ error: String(e?.message || e) }, 500);
  }
});
