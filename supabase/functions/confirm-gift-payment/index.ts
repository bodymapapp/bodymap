// supabase/functions/confirm-gift-payment/index.ts
//
// Called by the gift page after the Payment Element confirms the
// charge. Verifies the PaymentIntent really succeeded on the
// therapist's connected account, activates the gift_certificates row,
// and fires the three emails: recipient (reused from
// send-gift-certificate), purchaser receipt, and therapist notice.
//
// Idempotent: safe to call more than once (a second call on an
// already-active gift returns ok without re-charging or re-sending).
// Completion is verified here rather than via a Connect webhook, so it
// works regardless of webhook configuration. Scheduled-future gifts
// hold the recipient email for the delivery cron (Phase 2); the
// purchaser and therapist emails always fire at payment time.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getStripeSecret } from "../_shared/paymentMode.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function money(n: number) { return `$${Number(n).toFixed(0)}`; }
function esc(s: string) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const respond = (data: any) => new Response(JSON.stringify(data), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return respond({ error: 'Server config missing' });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { gift_id, payment_intent_id } = await req.json();
    if (!gift_id) return respond({ error: 'missing_gift' });

    const { data: gift } = await supabase
      .from('gift_certificates').select('*').eq('id', gift_id).maybeSingle();
    if (!gift) return respond({ error: 'gift_not_found' });

    if (gift.status === 'active') {
      return respond({ ok: true, already: true, code: gift.code });
    }

    const { data: therapist } = await supabase
      .from('therapists')
      .select('id, business_name, full_name, email, custom_url, stripe_account_id')
      .eq('id', gift.therapist_id).maybeSingle();
    if (!therapist?.stripe_account_id) return respond({ error: 'therapist_missing' });

    const piId = payment_intent_id || gift.stripe_payment_intent_id;
    if (!piId) return respond({ error: 'no_payment_intent' });

    let STRIPE_SECRET: string;
    try { STRIPE_SECRET = getStripeSecret(); }
    catch (e) { return respond({ error: (e as Error).message }); }

    const piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${piId}`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET}`, 'Stripe-Account': therapist.stripe_account_id },
    });
    const pi = await piRes.json();
    if (!piRes.ok) return respond({ error: 'pi_lookup_failed' });
    if (pi.status !== 'succeeded') return respond({ error: 'not_succeeded', pi_status: pi.status });
    if (Math.round(Number(gift.amount) * 100) !== Number(pi.amount)) {
      return respond({ error: 'amount_mismatch' });
    }

    await supabase.from('gift_certificates')
      .update({ status: 'active', paid_at: new Date().toISOString() })
      .eq('id', gift.id);

    const businessName = therapist.business_name || therapist.full_name || 'Your therapist';
    const bookingLink = therapist.custom_url
      ? `https://mybodymap.app/book/${therapist.custom_url}`
      : 'https://mybodymap.app';
    const recipientFirst = (gift.recipient_name || '').split(' ')[0] || 'your friend';

    // 1) Recipient email: reuse send-gift-certificate. Hold for the
    //    cron if the gift is scheduled for a future date.
    const today = new Date().toISOString().slice(0, 10);
    const sendRecipientNow = !(gift.delivery === 'scheduled' && gift.scheduled_date && gift.scheduled_date > today);
    if (sendRecipientNow && gift.recipient_email) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-gift-certificate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY,
          },
          body: JSON.stringify({ gift_certificate_id: gift.id }),
        });
      } catch (e) { console.error('[confirm-gift-payment] recipient email failed', e); }
    }

    // 2 + 3) Purchaser receipt and therapist notice via Resend.
    if (RESEND_API_KEY) {
      const amt = money(gift.amount);
      const schedNote = (gift.delivery === 'scheduled' && gift.scheduled_date)
        ? `It is scheduled to reach ${esc(recipientFirst)} on ${esc(gift.scheduled_date)}.`
        : `${esc(recipientFirst)} will receive it by email in the next few minutes.`;

      const purchaserHtml = `
        <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1f2a24">
          <h2 style="color:#2A5741;font-weight:600">Your gift is confirmed</h2>
          <p style="font-size:15px;line-height:1.6">Thank you, ${esc(gift.purchaser_name || 'friend')}. You sent a ${amt} gift toward a massage with ${esc(businessName)}. ${schedNote}</p>
          <p style="font-size:15px;line-height:1.6">Gift code: <strong>${esc(gift.code)}</strong>. ${esc(recipientFirst)} can redeem it when they book.</p>
          <p style="font-size:13px;color:#6b7280;line-height:1.6;border-top:1px solid #eee;padding-top:14px;margin-top:18px">
            Sent with MyBodyMap. Are you a massage therapist? You can sell your own gift cards, free, at
            <a href="https://mybodymap.app" style="color:#2A5741">mybodymap.app</a>.
          </p>
        </div>`;

      const therapistHtml = `
        <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1f2a24">
          <h2 style="color:#2A5741;font-weight:600">You sold a ${amt} gift card</h2>
          <p style="font-size:15px;line-height:1.6">${esc(gift.purchaser_name || 'Someone')} just bought a ${amt} gift card for ${esc(gift.recipient_name || 'a recipient')}. The money is already in your account.</p>
          <p style="font-size:15px;line-height:1.6">When ${esc(recipientFirst)} books and redeems code <strong>${esc(gift.code)}</strong>, you gain a new client. Your booking page: <a href="${bookingLink}" style="color:#2A5741">${bookingLink}</a></p>
          <p style="font-size:13px;color:#6b7280;line-height:1.6;border-top:1px solid #eee;padding-top:14px;margin-top:18px">A quiet word: occasions like Mother's Day and the holidays are when gift cards sell most. MyBodyMap can help you send a gift-card note to your clients at the right moment.</p>
        </div>`;

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: `${businessName} via MyBodyMap <reminders@mybodymap.app>`,
            to: gift.purchaser_email,
            subject: `Your gift to ${recipientFirst} is confirmed`,
            html: purchaserHtml,
          }),
        });
      } catch (e) { console.error('[confirm-gift-payment] purchaser email failed', e); }

      if (therapist.email) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
            body: JSON.stringify({
              from: `MyBodyMap <reminders@mybodymap.app>`,
              to: therapist.email,
              subject: `You sold a ${amt} gift card`,
              html: therapistHtml,
            }),
          });
        } catch (e) { console.error('[confirm-gift-payment] therapist email failed', e); }
      }
    }

    return respond({ ok: true, code: gift.code, recipient_emailed: sendRecipientNow });
  } catch (e) {
    return respond({ error: `error: ${(e as any)?.message ?? String(e)}` });
  }
});
