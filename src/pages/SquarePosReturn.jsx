// src/pages/SquarePosReturn.jsx
//
// Square Point of Sale hands control back here after a Tap to Pay charge.
// We confirm the transaction server-side (square-pos-reconcile) and only
// then tell the therapist it is recorded. If anything cannot be confirmed,
// we say so plainly and offer a way back, never a dead end and never a
// false "paid".

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  parseSquarePosReturn,
  readSquarePosPending,
  clearSquarePosPending,
} from '../lib/squarePos';

const SAGE = '#2A5741';
const SAGE_SOFT = '#5B7551';

export default function SquarePosReturn() {
  const navigate = useNavigate();
  const ranRef = useRef(false);
  const [phase, setPhase] = useState('confirming'); // confirming | done | unconfirmed | cancelled
  const [amountCents, setAmountCents] = useState(0);
  const [pending, setPending] = useState(null);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      const ctx = readSquarePosPending();
      setPending(ctx);
      const result = parseSquarePosReturn(window.location.search);

      // Square reported the customer cancelled or the charge did not go
      // through. Nothing to record.
      if (!result || result.errorCode || !result.ok || !result.transactionId) {
        setPhase('cancelled');
        return;
      }

      if (!ctx || !ctx.booking_id) {
        // We lost the booking context (different tab, cleared storage).
        // The charge may still be fine in Square; ask the therapist to
        // check rather than guess.
        setPhase('unconfirmed');
        return;
      }

      try {
        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
        const { data: { session } } = await supabase.auth.getSession();
        const userToken = session?.access_token || anonKey;

        const res = await fetch(`${supabaseUrl}/functions/v1/square-pos-reconcile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
            'apikey': anonKey,
          },
          body: JSON.stringify({
            booking_id: ctx.booking_id,
            client_id: ctx.client_id || null,
            transaction_id: result.transactionId,
          }),
        });
        const data = await res.json().catch(() => null);

        if (data?.ok) {
          setAmountCents(data.amount_cents || ctx.amount_cents || 0);
          setPhase('done');
          clearSquarePosPending();
        } else {
          setPhase('unconfirmed');
        }
      } catch {
        setPhase('unconfirmed');
      }
    })();
  }, []);

  const backToBooking = () => {
    const id = pending?.booking_id;
    clearSquarePosPending();
    if (id) navigate(`/dashboard/schedule/booking/${id}`);
    else navigate('/dashboard');
  };

  const wrap = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: '#FAF8F4',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };
  const card = {
    width: '100%',
    maxWidth: 380,
    background: '#fff',
    border: '1px solid #ECE6DC',
    borderRadius: 18,
    padding: '28px 22px',
    textAlign: 'center',
    boxShadow: '0 8px 30px rgba(31,64,48,0.08)',
  };
  const primaryBtn = {
    width: '100%',
    background: SAGE,
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 18,
  };

  let icon = '⏳';
  let title = 'Confirming with Square...';
  let body = 'One moment while we check that the payment went through.';
  if (phase === 'done') {
    icon = '✓';
    title = `Payment recorded · $${(amountCents / 100).toFixed(2)}`;
    body = 'Square confirmed the charge and it is saved on this booking.';
  } else if (phase === 'cancelled') {
    icon = '○';
    title = 'No payment was taken';
    body = 'The charge was cancelled or did not complete. Nothing was recorded. You can try again from the booking.';
  } else if (phase === 'unconfirmed') {
    icon = '!';
    title = 'We could not confirm this yet';
    body = 'The charge may have gone through in your Square app. Please open Square to check before charging again, so the client is not charged twice.';
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{
          width: 56, height: 56, borderRadius: 999, margin: '0 auto 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 700, color: '#fff',
          background: phase === 'done' ? SAGE : phase === 'unconfirmed' ? '#C98A2B' : '#9AA39C',
        }}>{icon}</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 21, color: '#1F4030', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 14, color: SAGE_SOFT, lineHeight: 1.55 }}>{body}</div>
        {phase !== 'confirming' && (
          <button style={primaryBtn} onClick={backToBooking}>Back to the booking</button>
        )}
      </div>
    </div>
  );
}
