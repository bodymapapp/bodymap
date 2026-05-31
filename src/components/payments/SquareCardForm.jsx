// src/components/payments/SquareCardForm.jsx
//
// HK May 31 2026: extracted from BookingPage's inline
// SquareCardSetupForm so CheckoutModal can use the same Square Web
// Payments SDK pattern without duplicating ~150 lines.
//
// USAGE PATTERNS
//
// Two callers, two slightly different needs:
//
// 1. BookingPage: client saves card on file BEFORE the session.
//    Use SquareCardForm with mode="save". On Save button, tokenize
//    and call save-card-on-booking-token edge function which
//    attaches the card to the customer for future charges.
//
// 2. CheckoutModal: therapist charges a NEW card right now (no
//    save needed). Use SquareCardForm with mode="charge". On Pay
//    button, tokenize and pass the nonce to onTokenized so the
//    parent can call square-charge-card with source_id=token.
//
// In both cases the parent receives the tokenized result via the
// onTokenized callback. The parent decides what to do with it.
//
// PROPS
//   clientSecret: required. JSON-encoded {applicationId, locationId,
//                 customerId} from the init-card-setup edge function.
//   buttonLabel:  what the action button says ("Save card", "Charge $X")
//   buttonDisabled: outer disable flag (e.g. mandate not agreed)
//   onTokenized:  called with the raw Square token result on tap
//   onError:      called with a string message on any error
//
// NOTE on style.fontFamily: see comment in init() below. Square
// rejects most CSS font-family strings.

import React, { useEffect, useRef, useState } from 'react';

export default function SquareCardForm({
  clientSecret,
  buttonLabel = 'Save card',
  buttonDisabled = false,
  onTokenized,
  onError,
  showSecurityLine = true,
}) {
  const cardRef = useRef(null);
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [parseError, setParseError] = useState(null);

  let parsed = null;
  try {
    parsed = clientSecret ? JSON.parse(clientSecret) : null;
  } catch (e) {
    if (!parseError) setParseError(String(e));
  }

  useEffect(() => {
    if (!parsed?.applicationId || !parsed?.locationId || !containerRef.current) return;
    let alive = true;

    const init = async () => {
      if (!window.Square) {
        const isSandbox = (parsed.applicationId || '').startsWith('sandbox-');
        const sdkUrl = isSandbox
          ? 'https://sandbox.web.squarecdn.com/v1/square.js'
          : 'https://web.squarecdn.com/v1/square.js';
        try {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = sdkUrl;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Failed to load Square SDK'));
            document.head.appendChild(s);
          });
        } catch (e) {
          if (alive && onError) onError(`Could not load Square card form. ${e.message}`);
          return;
        }
      }
      if (!alive) return;
      if (!window.Square) {
        if (onError) onError('Square SDK loaded but window.Square is undefined.');
        return;
      }
      if (!containerRef.current) return;

      try {
        const payments = window.Square.payments(parsed.applicationId, parsed.locationId);
        // Square Web Payments SDK rejects most CSS font-family values.
        // Tested both system-ui and quoted real-font lists, both fail
        // with 'Invalid style value for property fontFamily.' Leaving
        // fontFamily unset so Square uses its default; minor visual
        // mismatch inside the embedded iframe is acceptable.
        const card = await payments.card({
          style: {
            input: { fontSize: '16px', color: '#1A1A2E' },
            '.input-container': { borderRadius: '10px', borderColor: '#E5E5E5' },
          },
        });
        await card.attach(containerRef.current);
        cardRef.current = card;
        if (alive) setReady(true);
      } catch (e) {
        if (alive && onError) onError(`Could not load card form: ${e?.message || String(e)}`);
      }
    };

    init();
    return () => {
      alive = false;
      try { if (cardRef.current) cardRef.current.destroy(); } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed?.applicationId, parsed?.locationId]);

  const submit = async () => {
    if (!cardRef.current || processing || buttonDisabled) return;
    setProcessing(true);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== 'OK') {
        const msg = result.errors?.[0]?.message || 'Card tokenization failed';
        if (onError) onError(msg);
        setProcessing(false);
        return;
      }
      if (onTokenized) {
        // Parent handles what to do with the token (save it, charge it,
        // both). Parent also resolves "still processing" via setProcessing
        // when its async work completes.
        await onTokenized(result.token, {
          billingContact: result.details?.billing,
          card: result.details?.card,
        });
      }
    } catch (e) {
      if (onError) onError(String(e?.message || e));
    } finally {
      setProcessing(false);
    }
  };

  if (parseError) {
    return (
      <div style={{ padding: 14, background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 10, color: '#991B1B', fontSize: 13 }}>
        Could not initialize Square card form. Please refresh and try again.
      </div>
    );
  }

  return (
    <div>
      <div ref={containerRef} style={{ minHeight: 60, padding: '14px', border: '1.5px solid #E5E5E5', borderRadius: 10, background: '#FAFAFA' }} />
      {!ready && <div style={{ textAlign: 'center', padding: '12px 0 4px', color: '#6B7280', fontSize: 13 }}>Loading…</div>}
      <button
        onClick={submit}
        disabled={!ready || processing || buttonDisabled}
        style={{
          width: '100%',
          marginTop: 14,
          background: !ready || processing || buttonDisabled ? '#7B9E89' : '#2A5741',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          padding: '15px',
          fontSize: 15,
          fontWeight: 700,
          cursor: !ready || processing || buttonDisabled ? 'default' : 'pointer',
        }}
      >
        {processing ? 'Processing…' : buttonLabel}
      </button>
      {showSecurityLine && (
        <p style={{ fontSize: 11, color: '#6B7280', textAlign: 'center', marginTop: 10 }}>
          🔒 Secured by Square
        </p>
      )}
    </div>
  );
}
