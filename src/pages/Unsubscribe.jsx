// Public unsubscribe page. No login required. Authenticated via HMAC-signed
// token in query string (?token=...). Calls the /unsubscribe edge function,
// shows a confirmation state, and lets the user optionally share a reason.
//
// CAN-SPAM requires: clear unsubscribe action, no login barrier, honored
// within 10 business days (we honor instantly), and works for at least
// 30 days after send (the token has no expiry).

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const C = {
  cream: '#FFF9F3',
  forest: '#2A5741',
  sage: '#6B9E80',
  dark: '#1F2937',
  gray: '#6B7280',
  light: '#E8E4DC',
  rise: '#2A7F5F',
  fall: '#B44A3A',
};

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [status, setStatus] = useState('ready'); // 'ready' | 'sending' | 'done' | 'already' | 'error'
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // On mount, do a lightweight verify by calling the function without a
  // reason — the function is idempotent, so hitting it here just flips the
  // flag and confirms the token. A second submit with a reason updates the
  // reason if provided.
  //
  // Actually, we don't want to auto-flip on mount. The user should click
  // Confirm. Otherwise simply previewing an email (which some clients do to
  // unfurl links) would unsubscribe them. Stay polite: mount shows the form,
  // click flips the flag.

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('This unsubscribe link is missing its token. Please click the link directly from the email.');
    }
  }, [token]);

  const submit = async () => {
    if (!token || status === 'sending') return;
    setStatus('sending');
    setErrorMsg('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ token, reason: reason.trim() || null }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setStatus('error');
        setErrorMsg(data?.error || 'Something went wrong. Please try again.');
        return;
      }
      setEmail(data.email || '');
      setStatus(data.already_unsubscribed ? 'already' : 'done');
    } catch (e) {
      setStatus('error');
      setErrorMsg(e?.message || 'Network error. Please try again.');
    }
  };

  const card = (children) => (
    <div style={{
      minHeight: '100vh',
      background: C.cream,
      padding: '48px 20px',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        maxWidth: 480,
        width: '100%',
        background: '#fff',
        border: `1.5px solid ${C.light}`,
        borderRadius: 16,
        padding: '36px 32px',
        boxShadow: '0 4px 20px rgba(26, 38, 32, 0.06)',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
          color: C.sage, textTransform: 'uppercase', marginBottom: 10,
        }}>
          🌿 MyBodyMap
        </div>
        {children}
        <div style={{
          marginTop: 32, paddingTop: 20, borderTop: `1px solid ${C.light}`,
          fontSize: 11, color: C.gray, lineHeight: 1.6,
        }}>
          BodyMap LLC, 30 N Gould St Ste R, Sheridan, WY 82801
          <div style={{ marginTop: 4 }}>
            <a href="https://mybodymap.app" style={{ color: C.sage, textDecoration: 'none' }}>mybodymap.app</a>
          </div>
        </div>
      </div>
    </div>
  );

  if (status === 'error') {
    return card(
      <div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: C.dark, margin: '0 0 12px' }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: C.gray, lineHeight: 1.6, margin: 0 }}>
          {errorMsg}
        </p>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 20 }}>
          If you keep getting this error, email us at <a href="mailto:hello@mybodymap.app" style={{ color: C.forest }}>hello@mybodymap.app</a> and we'll unsubscribe you by hand.
        </p>
      </div>
    );
  }

  if (status === 'done' || status === 'already') {
    return card(
      <div>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', background: '#E8F5EE',
          color: C.rise, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 800, marginBottom: 16,
        }}>✓</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: C.dark, margin: '0 0 12px' }}>
          {status === 'already' ? "You're already unsubscribed" : "You're unsubscribed"}
        </h1>
        <p style={{ fontSize: 14, color: C.gray, lineHeight: 1.7, margin: 0 }}>
          {email ? <>We won't send marketing emails to <strong style={{ color: C.dark }}>{email}</strong> anymore.</> : "We won't send you marketing emails anymore."}
        </p>
        <p style={{ fontSize: 13, color: C.gray, lineHeight: 1.7, marginTop: 12 }}>
          You'll still get transactional messages (things like booking confirmations and password resets) because you're a MyBodyMap user.
        </p>
        <p style={{ fontSize: 13, color: C.gray, lineHeight: 1.7, marginTop: 16 }}>
          Changed your mind or this was a mistake? Reply to any MyBodyMap email and we'll turn it back on.
        </p>
      </div>
    );
  }

  // Default: show the form
  return card(
    <div>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: C.dark, margin: '0 0 12px' }}>
        Unsubscribe from MyBodyMap emails?
      </h1>
      <p style={{ fontSize: 14, color: C.gray, lineHeight: 1.7, margin: '0 0 20px' }}>
        We'll stop sending you marketing emails. You'll still get transactional messages (like booking confirmations) since you have an account.
      </p>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 700,
        color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: 6,
      }}>
        Mind telling us why? (Optional)
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Too many emails, not relevant, not using MyBodyMap anymore..."
        rows={3}
        maxLength={500}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: `1.5px solid ${C.light}`,
          borderRadius: 8,
          fontSize: 14,
          fontFamily: 'Georgia, serif',
          lineHeight: 1.5,
          boxSizing: 'border-box',
          resize: 'vertical',
          marginBottom: 16,
        }}
      />
      <button
        onClick={submit}
        disabled={status === 'sending' || !token}
        style={{
          width: '100%',
          background: status === 'sending' ? C.gray : C.forest,
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 10,
          border: 'none',
          fontSize: 15,
          fontWeight: 700,
          cursor: status === 'sending' ? 'wait' : 'pointer',
          marginBottom: 8,
        }}
      >
        {status === 'sending' ? 'Unsubscribing...' : 'Confirm unsubscribe'}
      </button>
      <div style={{ textAlign: 'center', fontSize: 12, color: C.gray, marginTop: 6 }}>
        <a href="https://mybodymap.app" style={{ color: C.gray }}>Never mind, take me back</a>
      </div>
    </div>
  );
}
