import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// HK May 31 2026 (Square Parity v1): post-payment landing page for
// Square payment links. The client pays at Square's hosted checkout
// and is redirected back here with ?sp=<session_payment_id>. This
// page calls verify-payment-link to confirm with Square and flip the
// row. Then it shows a clean thank-you.
//
// For Stripe payment links, the webhook flips the row server-side and
// the client never lands here. This page is Square-only by design.

const C = {
  forest: '#2A5741',
  sage: '#6B9E80',
  beige: '#F5F0E8',
  white: '#FFFFFF',
  dark: '#1A1A2E',
  gray: '#6B7280',
  amber: '#D97706',
};

export default function PayThanks() {
  const [params] = useSearchParams();
  const sessionPaymentId = params.get('sp');
  const [state, setState] = useState('verifying'); // verifying | succeeded | pending | error
  const [errorMsg, setErrorMsg] = useState(null);
  const [amount, setAmount] = useState(null);

  useEffect(() => {
    if (!sessionPaymentId) {
      setState('error');
      setErrorMsg('Missing payment reference.');
      return;
    }
    let alive = true;
    (async () => {
      try {
        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
        const res = await fetch(`${supabaseUrl}/functions/v1/verify-payment-link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
          },
          body: JSON.stringify({ session_payment_id: sessionPaymentId }),
        });
        const data = await res.json();
        if (!alive) return;
        if (data.error) {
          setState('error');
          setErrorMsg(data.error || 'Verification failed.');
          return;
        }
        if (data.status === 'succeeded') {
          setAmount(data.amount_cents || null);
          setState('succeeded');
          return;
        }
        if (data.status === 'pending') {
          setState('pending');
          return;
        }
        setState('error');
        setErrorMsg('Unexpected response from verification.');
      } catch (e) {
        if (!alive) return;
        setState('error');
        setErrorMsg(String(e?.message || e));
      }
    })();
    return () => { alive = false; };
  }, [sessionPaymentId]);

  const dollars = amount != null ? (amount / 100).toFixed(2) : null;

  return (
    <div style={{
      minHeight: '100vh',
      background: C.beige,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: C.white,
        borderRadius: 24,
        padding: '40px 32px',
        maxWidth: 440,
        width: '100%',
        boxShadow: '0 8px 48px rgba(0,0,0,0.1)',
        textAlign: 'center',
      }}>
        {state === 'verifying' && (
          <>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#F0F9FF', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 28,
            }}>⏳</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, color: C.dark, margin: '0 0 8px' }}>
              Confirming your payment
            </h2>
            <p style={{ color: C.gray, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              One moment while we verify with Square.
            </p>
          </>
        )}

        {state === 'succeeded' && (
          <>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#DCFCE7', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 36,
            }}>✅</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: C.dark, margin: '0 0 8px' }}>
              Payment received
            </h2>
            <p style={{ color: C.gray, fontSize: 14, lineHeight: 1.7, margin: '0 0 8px' }}>
              {dollars
                ? `Thank you. Your $${dollars} payment is confirmed.`
                : 'Thank you. Your payment is confirmed.'}
            </p>
            <p style={{ color: C.gray, fontSize: 12, margin: 0 }}>
              A receipt is on its way to your email.
            </p>
          </>
        )}

        {state === 'pending' && (
          <>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#FEF3C7', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 32,
            }}>⏱️</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: C.dark, margin: '0 0 8px' }}>
              Almost done
            </h2>
            <p style={{ color: C.gray, fontSize: 14, lineHeight: 1.7, margin: '0 0 16px' }}>
              Square is still confirming your payment. This usually takes a few seconds. If you completed payment, you can close this page; your therapist will see it shortly.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: C.forest, color: '#fff', border: 'none',
                borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Check again
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#FEF3C7', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 30,
            }}>💬</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: C.dark, margin: '0 0 8px' }}>
              We couldn't confirm right now
            </h2>
            <p style={{ color: C.gray, fontSize: 14, lineHeight: 1.7, margin: '0 0 8px' }}>
              {errorMsg || 'Your payment may still have gone through.'} Please reply to the email or message that sent you this link if you need help.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
