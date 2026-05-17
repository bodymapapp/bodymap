// src/components/CancellationChargeModal.jsx
//
// Modal shown when a therapist cancels a booking. Computes the fee
// based on the therapist's policy + how many hours before the
// appointment the cancellation is happening, shows the calculated
// fee, and gives the therapist three actions:
//
//   - Charge fee + cancel booking
//   - Skip fee + cancel booking ("waive this one")
//   - Don't cancel
//
// Calls charge-cancellation-fee edge function which routes to
// whichever processor (Stripe or Square) holds the client's
// card-on-file.
//
// Open-question default behavior:
//   - If client has no card on file: only "Skip + Cancel" is shown
//     (no charge possible)
//   - If policy is disabled: only "Cancel booking" is shown
//   - If within fee window: default action is "Charge", but the
//     therapist can switch to skip (waive) explicitly

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getStripePublishableKey } from '../lib/paymentMode';

const C = {
  forest: '#2A5741',
  sage: '#6B9E80',
  cream: '#FAF5EE',
  text: '#1F3A2C',
  muted: '#6B7280',
  light: '#E8E4DC',
  red: '#EF4444',
  redDark: '#991B1B',
  amber: '#F59E0B',
  amberDark: '#92400E',
};

// Compute the fee in cents based on the therapist's policy and how
// many hours before the appointment the cancellation is happening.
//
// The policy shape (matches what's saved on therapist.cancellation_policy):
//   {
//     enabled: bool,
//     tiers: [
//       { hours_before: 24, percent: 0 },
//       { hours_before: 2, percent: 50 },
//       { hours_before: 0, percent: 100 },
//     ],
//     no_show_percent: 100,
//   }
//
// Returns { feeCents, percent, tierUsed, reason }.
function computeFee({ policy, sessionPriceCents, hoursBefore, isNoShow }) {
  if (!policy?.enabled) {
    return { feeCents: 0, percent: 0, tierUsed: null, reason: 'policy_disabled' };
  }

  if (isNoShow) {
    const percent = Number(policy.no_show_percent ?? 100);
    return {
      feeCents: Math.round((sessionPriceCents * percent) / 100),
      percent,
      tierUsed: 'no_show',
      reason: 'no_show',
    };
  }

  // Find the first tier where hours_before <= hoursBefore. Tiers
  // ordered from largest hours_before to smallest in saved policy.
  const tiers = (policy.tiers || []).slice().sort((a, b) => b.hours_before - a.hours_before);
  const tier = tiers.find((t) => hoursBefore < t.hours_before)
    || tiers[tiers.length - 1]
    || { hours_before: 0, percent: 100 };
  const percent = Number(tier.percent || 0);
  return {
    feeCents: Math.round((sessionPriceCents * percent) / 100),
    percent,
    tierUsed: tier,
    reason: 'late_cancel',
  };
}

function formatPrice(cents) {
  if (!cents || cents <= 0) return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatHours(hours) {
  if (hours == null) return '';
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  if (hours < 24) return `${hours.toFixed(1)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}

export default function CancellationChargeModal({
  booking,           // booking row (id, start_at, etc.)
  client,            // client row (for card-on-file inspection)
  therapist,         // therapist row (policy, processor)
  sessionPriceCents, // numeric, in cents
  isNoShow,          // bool: if true, treat as no-show vs late cancel
  onClose,
  onCancelled,       // called after booking marked cancelled (regardless of charge)
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // step: 'confirm' | 'charging' | 'done' | 'enter_card' | 'link_sent'
  const [step, setStep] = useState('confirm');
  const [chargeResult, setChargeResult] = useState(null);
  // Phase 13.6 (HK May 17 2026): payment link state when therapist
  // chooses "Send payment link" instead of charging on card or skipping.
  const [paymentLinkUrl, setPaymentLinkUrl] = useState(null);
  // Phase 13.7 (HK May 17 2026): delivery picker: SMS / Email / Both.
  // Default to whichever channel the client actually has.
  const [linkDelivery, setLinkDelivery] = useState('sms');

  const policy = therapist?.cancellation_policy || {};
  const startAt = booking?.start_at ? new Date(booking.start_at) : null;
  const hoursBefore = startAt
    ? Math.max(0, (startAt.getTime() - Date.now()) / (1000 * 60 * 60))
    : 0;

  const fee = useMemo(
    () => computeFee({ policy, sessionPriceCents: sessionPriceCents || 0, hoursBefore, isNoShow }),
    [policy, sessionPriceCents, hoursBefore, isNoShow]
  );

  // Detect card-on-file across both processors.
  // Phase 13.6 fix (HK May 17 2026): the previous check looked for
  // client.stripe_payment_method_id which is not the schema column
  // name. The actual column is just payment_method_id (set on the
  // clients table by save-card). card_last4 has to also be present
  // for the UI to show 'Visa 4242' style detail; we require both.
  const hasStripeCard = !!(client?.stripe_customer_id && client?.payment_method_id && client?.card_last4);
  const hasSquareCard = !!(client?.square_customer_id && client?.square_card_id);
  const hasCardOnFile = hasStripeCard || hasSquareCard;
  const cardProcessor = hasStripeCard ? 'stripe' : (hasSquareCard ? 'square' : null);
  const cardLast4 = client?.card_last4 || '????';
  const cardBrand = client?.card_brand || 'card';

  const canCharge = fee.feeCents > 0 && hasCardOnFile && policy.enabled;

  // Phase 13.7 (HK May 17 2026): smart default for link delivery
  // channel. Prefer SMS when phone exists, else email. If neither
  // is present we still default to SMS (the UI will hide buttons
  // for channels the client doesn't have).
  const clientPhone = client?.phone || booking?.client_phone;
  const clientEmail = client?.email || booking?.client_email;
  useEffect(() => {
    if (clientPhone) setLinkDelivery('sms');
    else if (clientEmail) setLinkDelivery('email');
  }, [clientPhone, clientEmail]);

  // Phase 13.6 (HK May 17 2026): Stripe Elements for the mini card-entry
  // form (used when no card on file but therapist wants to charge now).
  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const cardElRef = useRef(null);
  const cardDivRef = useRef(null);
  const [stripeReady, setStripeReady] = useState(false);

  useEffect(() => {
    if (step !== 'enter_card') return;
    let alive = true;
    const init = async () => {
      if (!window.Stripe) {
        await new Promise(resolve => {
          const s = document.createElement('script');
          s.src = 'https://js.stripe.com/v3/';
          s.onload = resolve;
          document.head.appendChild(s);
        });
      }
      if (!alive || !cardDivRef.current) return;
      const stripeAccountId = therapist?.stripe_account_id;
      stripeRef.current = window.Stripe(
        getStripePublishableKey(),
        stripeAccountId ? { stripeAccount: stripeAccountId } : {}
      );
      elementsRef.current = stripeRef.current.elements();
      cardElRef.current = elementsRef.current.create('card', {
        hidePostalCode: true,
        disableLink: true,
        style: {
          base: {
            fontSize: '16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: C.text,
            iconColor: C.forest,
            '::placeholder': { color: C.muted },
          },
          invalid: { color: C.red, iconColor: C.red },
        },
      });
      cardElRef.current.on('ready', () => { if (alive) setStripeReady(true); });
      cardElRef.current.mount(cardDivRef.current);
    };
    init();
    return () => {
      alive = false;
      try { if (cardElRef.current) cardElRef.current.destroy(); } catch (_e) {}
      setStripeReady(false);
    };
  }, [step, therapist?.stripe_account_id]);

  async function chargeAndCancel() {
    setBusy(true);
    setError(null);
    setStep('charging');
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/charge-cancellation-fee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          booking_id: booking.id,
          therapist_id: therapist.id,
          fee_amount_cents: fee.feeCents,
          reason: isNoShow ? 'no_show' : 'cancel',
          policy_snapshot: { ...policy, computed: fee },
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(`Charge failed: ${data.error}. Booking was NOT cancelled.`);
        setStep('confirm');
        setBusy(false);
        return;
      }
      // Now mark the booking. No-show preserves the distinction
      // from a cancellation; Timeline + reporting already recognise
      // 'no_show' as a separate status.
      const newStatus = isNoShow ? 'no_show' : 'cancelled';
      await supabase.from('bookings').update({ status: newStatus }).eq('id', booking.id);
      setChargeResult(data);
      setStep('done');
      setBusy(false);
    } catch (e) {
      setError(`Charge failed: ${String(e)}. Booking was NOT cancelled.`);
      setStep('confirm');
      setBusy(false);
    }
  }

  // Phase 13.6 (HK May 17 2026): generate a Stripe payment link the
  // therapist can text/email to the client. Creates a pending
  // cancellation_charges row immediately so the dashboard shows it
  // as "fee owed." Marks the booking as no_show/cancelled. When
  // the client pays the link, the webhook flips the row to succeeded.
  async function sendPaymentLink() {
    setBusy(true);
    setError(null);
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/create-cancellation-fee-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          therapist_id: therapist.id,
          booking_id: booking.id,
          client_id: booking.client_id || client?.id,
          amount_cents: fee.feeCents,
          trigger_event: isNoShow ? 'no_show' : 'cancel',
          policy_percent: fee.percent,
          session_price_cents: sessionPriceCents,
          hours_before_appointment: hoursBefore,
          policy_snapshot: { ...policy, computed: fee },
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(`Could not create payment link: ${data.error}. Booking was NOT marked.`);
        setBusy(false);
        return;
      }

      // Mark the booking. Even though the fee is unpaid (pending), the
      // booking event happened. Recording it lets the schedule reflect
      // reality immediately.
      const newStatus = isNoShow ? 'no_show' : 'cancelled';
      await supabase.from('bookings').update({ status: newStatus }).eq('id', booking.id);

      setPaymentLinkUrl(data.payment_link_url);
      setStep('link_sent');
      setBusy(false);
    } catch (e) {
      setError(`Could not create payment link: ${String(e)}. Booking was NOT marked.`);
      setBusy(false);
    }
  }

  // Phase 13.6 (HK May 17 2026): inline card entry path. Used when
  // no card is on file but the therapist has the client's card in
  // hand (rare but real). Flow:
  //   1. Insert pending cancellation_charges row
  //   2. save-card: find-or-create Stripe customer, get SetupIntent
  //   3. confirmCardSetup: attach card, get payment_method_id
  //   4. charge-cancellation-fee: charge the saved card
  //   5. Mark the booking
  async function chargeWithNewCard() {
    if (!stripeRef.current || !cardElRef.current) {
      setError('Card form not ready. Please wait.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

      // Step 1: ensure client_id is set so save-card has somewhere to
      // attach the Stripe customer.
      const clientIdForSave = booking.client_id || client?.id;
      if (!clientIdForSave) throw new Error('Client record missing on this booking.');

      // Step 2: save-card to get SetupIntent.
      const saveCardRes = await fetch(`${supabaseUrl}/functions/v1/save-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          stripe_account_id: therapist.stripe_account_id,
          client_id: clientIdForSave,
          client_email: client?.email || booking.client_email,
          client_name: client?.name || booking.client_name,
          therapist_id: therapist.id,
        }),
      });
      const saveCardData = await saveCardRes.json();
      if (saveCardData.error) throw new Error(saveCardData.error);
      const { client_secret, customer_id } = saveCardData;
      if (!client_secret || !customer_id) throw new Error('Card setup did not initialize.');

      // Step 3: confirmCardSetup to attach the card to the customer.
      const { error: setupErr, setupIntent } = await stripeRef.current.confirmCardSetup(client_secret, {
        payment_method: { card: cardElRef.current },
      });
      if (setupErr) throw new Error(setupErr.message);
      if (setupIntent?.status !== 'succeeded') throw new Error('Card setup did not complete.');
      const paymentMethodId = setupIntent.payment_method;

      // Step 4: fetch card details via the get-payment-method edge function
      // (same as the CheckoutModal pattern) and persist on clients.
      try {
        const pmRes = await fetch(`${supabaseUrl}/functions/v1/get-payment-method`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
          },
          body: JSON.stringify({
            stripe_account_id: therapist.stripe_account_id,
            payment_method_id: paymentMethodId,
          }),
        });
        const pmDetails = await pmRes.json().catch(() => null);
        await supabase.from('clients').update({
          stripe_customer_id: customer_id,
          payment_method_id: paymentMethodId,
          card_last4: pmDetails?.last4 || null,
          card_brand: pmDetails?.brand || null,
          card_saved_at: new Date().toISOString(),
        }).eq('id', clientIdForSave);
      } catch (_e) {
        // Non-blocking: still proceed with the charge. The card will
        // self-heal on next CheckoutModal load if details missing.
      }

      // Step 5: charge-cancellation-fee. This writes the
      // cancellation_charges row itself.
      const chargeRes = await fetch(`${supabaseUrl}/functions/v1/charge-cancellation-fee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          booking_id: booking.id,
          therapist_id: therapist.id,
          fee_amount_cents: fee.feeCents,
          reason: isNoShow ? 'no_show' : 'cancel',
          policy_snapshot: { ...policy, computed: fee },
        }),
      });
      const chargeData = await chargeRes.json();
      if (chargeData.error) {
        setError(`Charge failed: ${chargeData.error}. Booking was NOT marked.`);
        setBusy(false);
        return;
      }

      // Step 6: mark the booking
      const newStatus = isNoShow ? 'no_show' : 'cancelled';
      await supabase.from('bookings').update({ status: newStatus }).eq('id', booking.id);

      setChargeResult(chargeData);
      setStep('done');
      setBusy(false);
    } catch (e) {
      setError(`Charge failed: ${String(e?.message || e)}. Booking was NOT marked.`);
      setBusy(false);
    }
  }

  async function skipAndCancel() {
    setBusy(true);
    try {
      const newStatus = isNoShow ? 'no_show' : 'cancelled';
      await supabase.from('bookings').update({ status: newStatus }).eq('id', booking.id);

      // Notify the therapist that the booking was cancelled / marked
      // no-show. Non-blocking: the booking is already cancelled, so
      // we don't want a notification hiccup to surface to the UI.
      try {
        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
        fetch(`${supabaseUrl}/functions/v1/notify-booking-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
          },
          body: JSON.stringify({
            booking_id: booking.id,
            event_type: isNoShow ? 'no_show_recorded' : 'booking_cancelled',
          }),
        }).catch(() => { /* non-blocking */ });
      } catch (_notifyErr) { /* non-blocking */ }

      setBusy(false);
      onCancelled?.();
      onClose();
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  function handleDone() {
    onCancelled?.();
    onClose();
  }

  return (
    <>
      <div onClick={busy ? undefined : onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400,
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(440px, 92vw)', maxHeight: '88vh', overflowY: 'auto',
        background: '#fff', borderRadius: 16, zIndex: 401,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        {step === 'confirm' && (
          <>
            <div style={{ padding: '20px 22px 14px', borderBottom: `1px solid ${C.light}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.sage, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
                {isNoShow ? 'No-show' : 'Cancel booking'}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.forest, fontFamily: 'Georgia, serif' }}>
                {fee.feeCents > 0
                  ? (isNoShow ? 'Charge a no-show fee?' : 'Charge a cancellation fee?')
                  : (isNoShow ? 'Mark this booking as no-show' : 'Cancel this booking')}
              </div>
              {startAt && !isNoShow && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                  Appointment is {formatHours(hoursBefore)} away.
                </div>
              )}
            </div>

            <div style={{ padding: '18px 22px' }}>
              {/* Policy calculation breakdown */}
              {policy.enabled && fee.feeCents > 0 && (
                <div style={{
                  background: C.cream, border: `1px solid ${C.light}`,
                  borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 12,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: C.muted }}>Session price</span>
                    <span style={{ color: C.text, fontWeight: 600 }}>{formatPrice(sessionPriceCents)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: C.muted }}>
                      Policy ({isNoShow ? 'no-show' : `within ${fee.tierUsed?.hours_before ?? 0} hours`})
                    </span>
                    <span style={{ color: C.text, fontWeight: 600 }}>{fee.percent}%</span>
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    paddingTop: 8, borderTop: `1px dashed ${C.light}`,
                    fontSize: 14,
                  }}>
                    <span style={{ color: C.text, fontWeight: 700 }}>Fee</span>
                    <span style={{ color: C.forest, fontWeight: 800 }}>{formatPrice(fee.feeCents)}</span>
                  </div>
                </div>
              )}

              {/* Card-on-file context */}
              {fee.feeCents > 0 && hasCardOnFile && (
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
                  Will charge {cardBrand.toUpperCase()} ending in {cardLast4} via {cardProcessor === 'square' ? 'Square' : 'Stripe'}.
                </div>
              )}

              {fee.feeCents > 0 && !hasCardOnFile && (
                <div style={{
                  background: '#FEF3C7', border: `1.5px solid ${C.amber}`,
                  borderRadius: 10, padding: '10px 12px', marginBottom: 14,
                  fontSize: 12, color: C.amberDark, lineHeight: 1.5,
                }}>
                  This client does not have a card on file. Choose how to collect the {formatPrice(fee.feeCents)} fee:
                </div>
              )}

              {!policy.enabled && (
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
                  Cancellation policy is disabled, so no fee applies.
                </div>
              )}

              {error && (
                <div style={{
                  background: '#FEE2E2', border: `1px solid #FCA5A5`,
                  borderRadius: 8, padding: '8px 10px', marginBottom: 12,
                  fontSize: 12, color: C.redDark, lineHeight: 1.5,
                }}>
                  {error}
                </div>
              )}

              {/* Action buttons. Phase 13.6 (HK May 17 2026): three
                  charge paths now. When card-on-file: existing charge
                  flow. When no card BUT fee due: offer send-link AND
                  inline card entry. When no fee: just mark/skip. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {canCharge && (
                  <button onClick={chargeAndCancel} disabled={busy}
                    style={{
                      background: C.forest, color: '#fff', border: 'none',
                      borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 700,
                      cursor: busy ? 'wait' : 'pointer',
                    }}>
                    Charge {formatPrice(fee.feeCents)} + {isNoShow ? 'Mark no-show' : 'Cancel'}
                  </button>
                )}

                {fee.feeCents > 0 && !hasCardOnFile && policy.enabled && (
                  <>
                    <button onClick={sendPaymentLink} disabled={busy}
                      style={{
                        background: C.forest, color: '#fff', border: 'none',
                        borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 700,
                        cursor: busy ? 'wait' : 'pointer',
                      }}>
                      Send payment link for {formatPrice(fee.feeCents)}
                    </button>
                    <button onClick={() => { setError(null); setStep('enter_card'); }} disabled={busy}
                      style={{
                        background: '#fff', color: C.forest,
                        border: `1.5px solid ${C.forest}`,
                        borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600,
                        cursor: busy ? 'wait' : 'pointer',
                      }}>
                      Enter card now
                    </button>
                  </>
                )}

                <button onClick={skipAndCancel} disabled={busy}
                  style={{
                    background: '#fff', color: C.text,
                    border: `1.5px solid ${C.light}`,
                    borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600,
                    cursor: busy ? 'wait' : 'pointer',
                  }}>
                  {fee.feeCents > 0
                    ? (isNoShow ? 'Skip fee + Mark no-show' : 'Skip fee + Cancel')
                    : (isNoShow ? 'Mark no-show' : 'Cancel booking')}
                </button>
                <button onClick={onClose} disabled={busy}
                  style={{
                    background: 'transparent', color: C.muted,
                    border: 'none', padding: '8px 16px', fontSize: 12, fontWeight: 600,
                    cursor: busy ? 'wait' : 'pointer',
                  }}>
                  {isNoShow ? 'Don\'t mark' : 'Don\'t cancel'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Phase 13.6: inline card entry view. Reached via 'Enter card now'. */}
        {step === 'enter_card' && (
          <>
            <div style={{ padding: '20px 22px 14px', borderBottom: `1px solid ${C.light}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.sage, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
                {isNoShow ? 'No-show' : 'Cancel'} · Enter card
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.forest, fontFamily: 'Georgia, serif' }}>
                Charge {formatPrice(fee.feeCents)} on a new card
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                The card will also be saved for future visits.
              </div>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <div ref={cardDivRef}
                style={{
                  background: '#fff', border: `1.5px solid ${C.light}`,
                  borderRadius: 10, padding: '14px 12px', marginBottom: 14,
                  minHeight: 46,
                }} />
              {error && (
                <div style={{
                  background: '#FEE2E2', border: `1px solid #FCA5A5`,
                  borderRadius: 8, padding: '8px 10px', marginBottom: 12,
                  fontSize: 12, color: C.redDark, lineHeight: 1.5,
                }}>
                  {error}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={chargeWithNewCard} disabled={busy || !stripeReady}
                  style={{
                    background: stripeReady ? C.forest : C.muted,
                    color: '#fff', border: 'none',
                    borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 700,
                    cursor: (busy || !stripeReady) ? 'wait' : 'pointer',
                  }}>
                  {busy ? 'Charging…' : `Charge ${formatPrice(fee.feeCents)}`}
                </button>
                <button onClick={() => { setError(null); setStep('confirm'); }} disabled={busy}
                  style={{
                    background: 'transparent', color: C.muted,
                    border: 'none', padding: '8px 16px', fontSize: 12, fontWeight: 600,
                    cursor: busy ? 'wait' : 'pointer',
                  }}>
                  Back
                </button>
              </div>
            </div>
          </>
        )}

        {/* Phase 13.6: link-sent view. After 'Send payment link' succeeds,
            show the URL plus sms:/mailto: buttons so the therapist can
            deliver it. Booking is already marked at this point. */}
        {step === 'link_sent' && (
          <>
            <div style={{ padding: '20px 22px 14px', borderBottom: `1px solid ${C.light}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.sage, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
                {isNoShow ? 'No-show' : 'Cancel'} · Payment link
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.forest, fontFamily: 'Georgia, serif' }}>
                Link created. Send it now.
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                Booking marked. Fee status: pending until paid.
              </div>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <div style={{
                background: C.cream, border: `1px solid ${C.light}`,
                borderRadius: 8, padding: '10px 12px', marginBottom: 14,
                fontSize: 12, color: C.text, wordBreak: 'break-all',
              }}>
                {paymentLinkUrl}
              </div>

              {/* Phase 13.7: SMS / Email / Both segmented picker.
                  Only options the client has contact info for are
                  enabled. Selecting one updates which Send button(s)
                  appear below. */}
              {(clientPhone || clientEmail) && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 6,
                  background: '#fff',
                  border: `1.5px solid ${C.light}`,
                  borderRadius: 10,
                  padding: 4,
                  marginBottom: 14,
                }}>
                  {[
                    { id: 'sms',   label: 'SMS',   available: !!clientPhone },
                    { id: 'email', label: 'Email', available: !!clientEmail },
                    { id: 'both',  label: 'Both',  available: !!(clientPhone && clientEmail) },
                  ].map(opt => {
                    const isActive = linkDelivery === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={!opt.available}
                        onClick={() => setLinkDelivery(opt.id)}
                        style={{
                          background: isActive ? C.forest : 'transparent',
                          color: !opt.available ? C.muted : isActive ? '#fff' : C.text,
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 10px',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: opt.available ? 'pointer' : 'not-allowed',
                          opacity: opt.available ? 1 : 0.4,
                        }}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(linkDelivery === 'sms' || linkDelivery === 'both') && clientPhone && (
                  <a href={`sms:${clientPhone}?body=${encodeURIComponent(`Hi, here's the link to pay your ${isNoShow ? 'no-show' : 'cancellation'} fee: ${paymentLinkUrl}`)}`}
                    style={{
                      background: C.forest, color: '#fff',
                      textDecoration: 'none', textAlign: 'center',
                      borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 700,
                    }}>
                    Open SMS to send
                  </a>
                )}
                {(linkDelivery === 'email' || linkDelivery === 'both') && clientEmail && (
                  <a href={`mailto:${clientEmail}?subject=${encodeURIComponent(`Payment for ${isNoShow ? 'no-show' : 'cancellation'} fee`)}&body=${encodeURIComponent(`Hi, here's the link to pay your ${isNoShow ? 'no-show' : 'cancellation'} fee: ${paymentLinkUrl}`)}`}
                    style={{
                      background: linkDelivery === 'both' ? '#fff' : C.forest,
                      color: linkDelivery === 'both' ? C.forest : '#fff',
                      border: linkDelivery === 'both' ? `1.5px solid ${C.forest}` : 'none',
                      textDecoration: 'none', textAlign: 'center',
                      borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: linkDelivery === 'both' ? 600 : 700,
                    }}>
                    Open email to send
                  </a>
                )}
                <button onClick={() => { navigator.clipboard.writeText(paymentLinkUrl); }}
                  style={{
                    background: '#fff', color: C.text,
                    border: `1.5px solid ${C.light}`,
                    borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                  Copy link
                </button>
                <button onClick={() => { onCancelled?.(); onClose(); }}
                  style={{
                    background: 'transparent', color: C.muted,
                    border: 'none', padding: '8px 16px', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                  Done
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'charging' && (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>
              Charging {formatPrice(fee.feeCents)}…
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              Please don't close this window.
            </div>
          </div>
        )}

        {step === 'done' && chargeResult && (
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#DCFCE7', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', fontSize: 28, color: '#16A34A',
            }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.forest, fontFamily: 'Georgia, serif', marginBottom: 6 }}>
              Charged {formatPrice(chargeResult.amount_cents)}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 18, lineHeight: 1.5 }}>
              {isNoShow ? 'No-show recorded.' : 'Booking cancelled.'}
              {chargeResult.last4
                ? ` The client will see the charge on their ${(chargeResult.brand || 'card').toUpperCase()} ending in ${chargeResult.last4}.`
                : ' Charge captured.'}
            </div>
            <button onClick={handleDone}
              style={{
                background: C.forest, color: '#fff', border: 'none',
                borderRadius: 10, padding: '10px 24px', fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
              }}>
              Done
            </button>
          </div>
        )}
      </div>
    </>
  );
}
