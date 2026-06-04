// src/components/RefundModal.jsx
//
// Phase 14.3b (HK May 17 2026): in-app refund flow for a session
// payment. Triggered from either the Smart Billing payment row or
// from the schedule slide-over paid state.
//
// Two flows:
//   - Full refund (primary): one tap, refunds the entire paid amount
//   - Custom amount: reveals an input where therapist enters a
//     partial refund amount
//
// On confirm, calls refund-session-payment edge function which issues
// a Stripe refund and flips the row to status='refunded' locally.
// On success, closes the modal and calls onRefunded so the parent
// can refresh.

import React, { useState } from 'react';
import ResultScreen from './ResultScreen';

const C = {
  forest: '#2A5741',
  forestDeep: '#1F4030',
  cream: '#FAF5EE',
  text: '#1F3A2C',
  muted: '#6B7280',
  light: '#E8E4DC',
  red: '#DC2626',
  redLight: '#FEE2E2',
  redDark: '#991B1B',
};

export default function RefundModal({
  payment,         // session_payments row { id, amount_cents, tip_cents, payment_method, client_name }
  therapist,
  onClose,
  onRefunded,
}) {
  const fullAmountCents = (payment?.amount_cents || 0) + (payment?.tip_cents || 0);
  const fullAmountDollars = (fullAmountCents / 100).toFixed(2);
  const clientName = payment?.client_name || 'this client';
  // HK May 31 2026: branch on online-card vs offline. Online-card =
  // Stripe OR Square; both have a refund API and the edge function
  // (refund-session-payment) routes by provider internally. Offline =
  // cash, venmo, zelle, cashapp, check, other; modal just flips the
  // local row to status='refunded' and the therapist returns funds
  // outside the app.
  // Previously this only recognized stripe_*, so all Square refunds
  // silently dropped into the offline path and never hit Square's API.
  const isStripe = payment?.payment_method && payment.payment_method.startsWith('stripe_');
  const isSquare = payment?.payment_method && payment.payment_method.startsWith('square_');
  const isOnlineCard = isStripe || isSquare;
  const processorName = isSquare ? 'Square' : 'Stripe';
  const methodLabel = (() => {
    const m = payment?.payment_method;
    if (m === 'cash') return 'Cash';
    if (m === 'venmo') return 'Venmo';
    if (m === 'zelle') return 'Zelle';
    if (m === 'cashapp') return 'Cash App';
    if (m === 'check') return 'Check';
    if (m === 'other') return 'Other';
    return 'Card';
  })();

  const [step, setStep] = useState('confirm'); // 'confirm' | 'custom' | 'processing' | 'done' | 'error'
  // HK Jun 3 2026: display-only. Records the amount actually refunded so the
  // done screen shows the correct figure on partial refunds. Does not affect
  // the refund itself.
  const [refundedCents, setRefundedCents] = useState(fullAmountCents);
  const [customAmount, setCustomAmount] = useState(fullAmountDollars);
  const [errorMsg, setErrorMsg] = useState(null);
  const [errorCode, setErrorCode] = useState('');

  async function issueRefund(amountCents) {
    setStep('processing');
    setErrorMsg(null);
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      const body = {
        session_payment_id: payment.id,
        therapist_id: therapist.id,
        // For offline payments, instruct the edge function to skip
        // the Stripe / Square API call and just update the local row.
        offline_only: !isOnlineCard,
      };
      if (amountCents && amountCents !== fullAmountCents) {
        body.refund_amount_cents = amountCents;
      }
      const res = await fetch(`${supabaseUrl}/functions/v1/refund-session-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const code = data.error || '';
        setErrorCode(code);
        throw new Error(data.detail || code || 'Refund failed');
      }
      setRefundedCents(amountCents || fullAmountCents);
      setStep('done');
      onRefunded?.(data);
    } catch (e) {
      setErrorMsg(String(e?.message || e));
      setStep('error');
    }
  }

  // HK Jun 1 2026: mark a payment refunded locally when the original
  // processor can no longer be reached (e.g. it was charged on Stripe
  // and the therapist has since disconnected Stripe and moved to
  // Square). The money is returned out-of-band in that processor's
  // own dashboard; this just reconciles MyBodyMap's record.
  async function markRefundedLocally(amountCents) {
    setStep('processing');
    setErrorMsg(null);
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      const body = {
        session_payment_id: payment.id,
        therapist_id: therapist.id,
        offline_only: true,
      };
      if (amountCents && amountCents !== fullAmountCents) body.refund_amount_cents = amountCents;
      const res = await fetch(`${supabaseUrl}/functions/v1/refund-session-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.detail || data.error || 'Could not mark refunded');
      setRefundedCents(amountCents || fullAmountCents);
      setStep('done');
      onRefunded?.(data);
    } catch (e) {
      setErrorMsg(String(e?.message || e));
      setStep('error');
    }
  }

  const customCents = Math.round((parseFloat(customAmount) || 0) * 100);
  const customValid = customCents > 0 && customCents <= fullAmountCents;

  return (
    <>
      <div onClick={step === 'processing' ? undefined : onClose} style={{
        position: 'fixed', inset: 0, height: '100dvh',
        background: 'rgba(0,0,0,0.45)', zIndex: 1100,
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(420px, 92vw)', maxHeight: '88vh', overflowY: 'auto',
        background: '#fff', borderRadius: 16, zIndex: 1101,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        {step === 'confirm' && (
          <>
            <div style={{ padding: '20px 22px 14px', borderBottom: `1px solid ${C.light}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
                Refund
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.forest, fontFamily: 'Georgia, serif' }}>
                {isOnlineCard
                  ? `Refund $${fullAmountDollars} to ${clientName}?`
                  : `Mark $${fullAmountDollars} as refunded?`}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
                {isOnlineCard
                  ? `${processorName} returns the full amount to the client's card in 5 to 10 business days. This cannot be undone.`
                  : `This was paid via ${methodLabel}. The platform will mark it refunded; you'll need to return the ${methodLabel.toLowerCase()} to ${clientName} separately.`}
              </div>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => issueRefund(fullAmountCents)}
                  style={{
                    background: C.forest, color: '#fff', border: 'none',
                    borderRadius: 10, padding: '14px 18px', fontSize: 15, fontWeight: 700,
                    cursor: 'pointer',
                  }}>
                  {isOnlineCard ? `Refund full $${fullAmountDollars}` : `Mark $${fullAmountDollars} refunded`}
                </button>
                <button onClick={() => setStep('custom')}
                  style={{
                    background: 'transparent', color: C.forest,
                    border: `1.5px solid ${C.light}`,
                    borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                  Custom amount
                </button>
                <button onClick={onClose}
                  style={{
                    background: 'transparent', color: C.muted,
                    border: 'none', padding: '10px 16px', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                  Don't refund
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'custom' && (
          <>
            <div style={{ padding: '20px 22px 14px', borderBottom: `1px solid ${C.light}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
                Refund · Custom amount
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.forest, fontFamily: 'Georgia, serif' }}>
                Refund a partial amount
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
                Original payment was ${fullAmountDollars}.
              </div>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
                Refund amount
              </div>
              <div style={{
                display: 'flex', alignItems: 'center',
                background: '#fff', border: `1.5px solid ${C.light}`,
                borderRadius: 10, padding: '10px 14px', marginBottom: 14,
              }}>
                <span style={{ color: C.muted, fontSize: 18, marginRight: 6 }}>$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value.replace(/[^\d.]/g, ''))}
                  onFocus={e => e.target.select()}
                  style={{
                    flex: 1, border: 'none', outline: 'none',
                    fontSize: 18, fontWeight: 700, color: C.text,
                    background: 'transparent',
                  }}
                />
              </div>
              {!customValid && customAmount !== '' && (
                <div style={{ fontSize: 12, color: C.redDark, marginBottom: 10 }}>
                  {customCents <= 0 ? 'Enter a positive amount.' : `Cannot exceed $${fullAmountDollars}.`}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => issueRefund(customCents)}
                  disabled={!customValid}
                  style={{
                    background: customValid ? C.forest : C.muted,
                    color: '#fff', border: 'none',
                    borderRadius: 10, padding: '14px 18px', fontSize: 15, fontWeight: 700,
                    cursor: customValid ? 'pointer' : 'not-allowed',
                    opacity: customValid ? 1 : 0.5,
                  }}>
                  Refund ${(customCents/100).toFixed(2)}
                </button>
                <button onClick={() => setStep('confirm')}
                  style={{
                    background: 'transparent', color: C.muted,
                    border: 'none', padding: '10px 16px', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                  Back
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>
              Issuing refund...
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              Please don't close this window.
            </div>
          </div>
        )}

        {step === 'done' && (
          <ResultScreen
            variant="refund"
            amount={`$${(refundedCents / 100).toFixed(2)}`}
            amountColor="#6D28D9"
            headline={isOnlineCard ? 'Refund issued' : 'Marked as refunded'}
            subline={isOnlineCard
              ? `The refund will appear on the client's card in 5 to 10 business days.`
              : `Remember to return the ${methodLabel.toLowerCase()} to ${clientName}.`}
            primary={{ label: 'Done', onClick: onClose }}
          />
        )}

        {step === 'error' && (() => {
          // HK Jun 1 2026: turn raw error codes into plain language and,
          // when the original processor is no longer connected, offer to
          // reconcile the record locally instead of dead-ending.
          const disconnectedProcessor =
            errorCode === 'stripe_not_connected_for_therapist' ||
            errorCode === 'square_not_connected_for_therapist' ||
            errorCode === 'no_square_payment_id';
          const wasStripe = errorCode === 'stripe_not_connected_for_therapist';
          const friendly = disconnectedProcessor
            ? `This payment was taken through ${wasStripe ? 'Stripe' : 'Square'}, which is not connected right now. Refund it in your ${wasStripe ? 'Stripe' : 'Square'} dashboard, then mark it refunded here so your records match.`
            : (errorMsg || 'Refund failed.');
          return (
          <div style={{ padding: '24px' }}>
            <div style={{
              background: C.redLight, border: `1px solid #FCA5A5`,
              borderRadius: 10, padding: '12px 14px', marginBottom: 14,
              fontSize: 13, color: C.redDark, lineHeight: 1.5,
            }}>
              {friendly}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {disconnectedProcessor && (
                <button onClick={() => markRefundedLocally(fullAmountCents)}
                  style={{
                    background: C.forest, color: '#fff', border: 'none',
                    borderRadius: 10, padding: '13px 16px', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer',
                  }}>
                  Mark refunded here
                </button>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                {!disconnectedProcessor && (
                  <button onClick={() => setStep('confirm')}
                    style={{
                      flex: 1,
                      background: C.forest, color: '#fff', border: 'none',
                      borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 700,
                      cursor: 'pointer',
                    }}>
                    Try again
                  </button>
                )}
                <button onClick={onClose}
                  style={{
                    flex: 1,
                    background: 'transparent', color: C.text,
                    border: `1.5px solid ${C.light}`,
                    borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                  Close
                </button>
              </div>
            </div>
          </div>
          );
        })()}
      </div>
    </>
  );
}
