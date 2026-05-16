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

import React, { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

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
  isNoShow,          // bool — if true, treat as no-show vs late cancel
  onClose,
  onCancelled,       // called after booking marked cancelled (regardless of charge)
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('confirm'); // 'confirm' | 'charging' | 'done'
  const [chargeResult, setChargeResult] = useState(null);

  const policy = therapist?.cancellation_policy || {};
  const startAt = booking?.start_at ? new Date(booking.start_at) : null;
  const hoursBefore = startAt
    ? Math.max(0, (startAt.getTime() - Date.now()) / (1000 * 60 * 60))
    : 0;

  const fee = useMemo(
    () => computeFee({ policy, sessionPriceCents: sessionPriceCents || 0, hoursBefore, isNoShow }),
    [policy, sessionPriceCents, hoursBefore, isNoShow]
  );

  // Detect card-on-file across both processors
  const hasStripeCard = !!(client?.stripe_customer_id && client?.stripe_payment_method_id);
  const hasSquareCard = !!(client?.square_customer_id && client?.square_card_id);
  const hasCardOnFile = hasStripeCard || hasSquareCard;
  const cardProcessor = hasStripeCard ? 'stripe' : (hasSquareCard ? 'square' : null);
  const cardLast4 = client?.card_last4 || '????';
  const cardBrand = client?.card_brand || 'card';

  const canCharge = fee.feeCents > 0 && hasCardOnFile && policy.enabled;

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
                {fee.feeCents > 0 ? 'Charge a cancellation fee?' : 'Cancel this booking'}
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
                  This client does not have a card on file, so the fee cannot be charged automatically. You can still cancel the booking.
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

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {canCharge && (
                  <button onClick={chargeAndCancel} disabled={busy}
                    style={{
                      background: C.forest, color: '#fff', border: 'none',
                      borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 700,
                      cursor: busy ? 'wait' : 'pointer',
                    }}>
                    Charge {formatPrice(fee.feeCents)} + Cancel
                  </button>
                )}
                <button onClick={skipAndCancel} disabled={busy}
                  style={{
                    background: '#fff', color: C.text,
                    border: `1.5px solid ${C.light}`,
                    borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600,
                    cursor: busy ? 'wait' : 'pointer',
                  }}>
                  {canCharge ? 'Skip fee + Cancel' : 'Cancel booking'}
                </button>
                <button onClick={onClose} disabled={busy}
                  style={{
                    background: 'transparent', color: C.muted,
                    border: 'none', padding: '8px 16px', fontSize: 12, fontWeight: 600,
                    cursor: busy ? 'wait' : 'pointer',
                  }}>
                  Don't cancel
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
              Booking cancelled. The client will see the charge on their {cardBrand.toUpperCase()} ending in {cardLast4}.
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
