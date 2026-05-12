// src/pages/VerifyPhone.jsx
//
// Phone verification page. Reached two ways:
//   1. New signups: redirected here after account creation, hard-gated
//      from the dashboard until verified
//   2. Existing therapists: tap "Verify phone" on the soft banner that
//      appears on the dashboard for unverified accounts
//
// The page calls the phone-verify edge function:
//   - On mount: calls 'start' to trigger the SMS
//   - On submit: calls 'check' with the entered 6-digit code
//
// UX details:
//   - Masked phone shown for confirmation ("we texted +1 (555) ***-1234")
//   - 60-second resend cooldown so the therapist can ask Twilio to send
//     another code if the first one did not arrive
//   - "Change number" link to edit the phone before retrying
//   - Auto-submit on 6 digits entered (no Enter required)

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import BMLogo from '../components/BMLogo';

const C = {
  cream: '#F9F5EE',
  forest: '#1C2B22',
  sage: '#4A6B54',
  sageBg: '#EEF3EE',
  gold: '#C9A84C',
  goldBg: '#FAF3DC',
  ink: '#3D4F43',
  inkSoft: '#6B7F72',
  white: '#FFFFFF',
  rose: '#FCE5E0',
  roseInk: '#991B1B',
  roseBorder: '#FECACA',
  lineFaint: '#E8E0D0',
};

export default function VerifyPhone() {
  const navigate = useNavigate();
  const [therapist, setTherapist] = useState(null);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('starting'); // starting | ready | checking | success | error
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const codeInputRef = useRef(null);

  // Format a phone string for display while typing
  const formatPhoneInput = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  };

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }
      const { data: row } = await supabase
        .from('therapists')
        .select('id, phone, phone_verified_at, full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (!row) { navigate('/login'); return; }
      if (row.phone_verified_at) {
        // Already verified, go to dashboard
        navigate('/dashboard');
        return;
      }
      setTherapist(row);
      if (row.phone) {
        setNewPhone(formatPhoneInput(row.phone));
        // Auto-start verification on mount
        await sendCode(row.phone);
      } else {
        // No phone on file (edge case), prompt to enter it
        setEditingPhone(true);
        setStatus('ready');
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cooldown tick for the resend button
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(phoneOverride) {
    setStatus('starting');
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/phone-verify`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ mode: 'start', phone: phoneOverride }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.message || data.error || 'Could not send code. Try again.');
        setStatus('error');
        return;
      }
      setMaskedPhone(data.masked || '');
      setStatus('ready');
      setCooldown(60);
      setEditingPhone(false);
      // Auto-focus the code input
      setTimeout(() => codeInputRef.current?.focus(), 100);
    } catch (err) {
      setError('Could not send code. Check your connection and try again.');
      setStatus('error');
    }
  }

  async function checkCode(codeValue) {
    if (!codeValue || codeValue.length < 4) return;
    setStatus('checking');
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/phone-verify`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ mode: 'check', code: codeValue }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.message || 'That code was not correct. Please try again.');
        setStatus('ready');
        setCode('');
        codeInputRef.current?.focus();
        return;
      }
      setStatus('success');
      // Brief pause to show the success state, then route to dashboard
      // (or the intended post-verify destination set by Signup).
      setTimeout(() => {
        const dest = localStorage.getItem('postVerifyPhoneRedirect');
        if (dest) localStorage.removeItem('postVerifyPhoneRedirect');
        navigate(dest || '/dashboard');
      }, 1200);
    } catch (err) {
      setError('Could not check code. Try again.');
      setStatus('ready');
    }
  }

  // Auto-submit when 6 digits entered. Twilio Verify default code length is 6.
  const handleCodeChange = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(v);
    if (v.length === 6) checkCode(v);
  };

  async function handleChangePhone() {
    const digits = newPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Please enter a 10-digit phone number, or include the country code.');
      return;
    }
    // Persist the new phone on the therapist row before starting
    const { error: upErr } = await supabase
      .from('therapists')
      .update({ phone: newPhone, phone_verified_at: null })
      .eq('id', therapist.id);
    if (upErr) {
      setError('Could not save phone number. Try again.');
      return;
    }
    await sendCode(newPhone);
  }

  if (!therapist && status === 'starting') {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'center', color: C.inkSoft }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <BMLogo size={36} variant="dark" showWordmark={false} />
        </div>

        <h1 style={titleStyle}>
          {status === 'success' ? 'Phone verified.' : 'Verify your phone'}
        </h1>

        {status !== 'success' && (
          <p style={subtitleStyle}>
            {editingPhone
              ? "Enter the phone number we should text. We will send a 6-digit code to confirm it is yours."
              : (status === 'starting'
                  ? 'Sending code...'
                  : (
                    <>
                      We texted a 6-digit code to <strong>{maskedPhone || 'your phone'}</strong>. Enter it below to confirm.
                    </>
                  )
                )
            }
          </p>
        )}

        {status === 'success' && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: C.sage, color: 'white',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 12, boxShadow: '0 4px 12px rgba(74,107,84,0.3)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p style={{ color: C.ink, fontSize: 14 }}>Sending you to your dashboard...</p>
          </div>
        )}

        {error && status !== 'success' && (
          <div style={errorBoxStyle}>{error}</div>
        )}

        {editingPhone && status !== 'success' && (
          <div style={{ marginTop: 18 }}>
            <label style={labelStyle}>PHONE NUMBER</label>
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(formatPhoneInput(e.target.value))}
              placeholder="(555) 123-4567"
              style={inputStyle}
              autoFocus
            />
            <button
              type="button"
              onClick={handleChangePhone}
              disabled={status === 'starting'}
              style={primaryButtonStyle}>
              {status === 'starting' ? 'Sending...' : 'Send me the code'}
            </button>
          </div>
        )}

        {!editingPhone && status !== 'success' && (
          <div style={{ marginTop: 18 }}>
            <label style={labelStyle}>6-DIGIT CODE</label>
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={handleCodeChange}
              placeholder="123456"
              maxLength={6}
              disabled={status === 'starting' || status === 'checking'}
              style={{
                ...inputStyle,
                fontSize: 28, fontWeight: 700,
                letterSpacing: '0.4em',
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
            {status === 'checking' && (
              <div style={{ marginTop: 10, textAlign: 'center', color: C.inkSoft, fontSize: 13 }}>
                Checking...
              </div>
            )}

            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <button
                type="button"
                onClick={() => sendCode()}
                disabled={cooldown > 0 || status === 'starting'}
                style={{
                  background: 'transparent', border: 'none',
                  color: cooldown > 0 ? C.inkSoft : C.sage,
                  fontWeight: 600, fontSize: 13,
                  cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
                  padding: '6px 0',
                }}>
                {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
              </button>
              <button
                type="button"
                onClick={() => { setEditingPhone(true); setCode(''); setError(''); }}
                style={{
                  background: 'transparent', border: 'none',
                  color: C.sage, fontWeight: 600, fontSize: 13,
                  cursor: 'pointer', padding: '6px 0',
                }}>
                Change number
              </button>
            </div>
          </div>
        )}

        {status !== 'success' && (
          <div style={{
            marginTop: 24, paddingTop: 18,
            borderTop: `1px solid ${C.lineFaint}`,
            fontSize: 12, color: C.inkSoft, lineHeight: 1.55, textAlign: 'center',
          }}>
            Standard SMS rates apply. We only use this number to verify you
            and to contact you about your practice.
          </div>
        )}
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: '100vh',
  background: C.cream,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 20px',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
};

const cardStyle = {
  width: '100%',
  maxWidth: 420,
  background: C.white,
  borderRadius: 16,
  padding: '32px 28px',
  boxShadow: '0 8px 28px rgba(28,43,34,0.08)',
  border: `1px solid ${C.lineFaint}`,
};

const titleStyle = {
  fontFamily: "'Fraunces', Georgia, serif",
  fontSize: 24,
  fontWeight: 500,
  color: C.forest,
  margin: '0 0 6px',
  textAlign: 'center',
  letterSpacing: '-0.3px',
};

const subtitleStyle = {
  fontSize: 14,
  color: C.ink,
  lineHeight: 1.55,
  margin: 0,
  textAlign: 'center',
};

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: C.inkSoft,
  marginBottom: 6,
  letterSpacing: '0.5px',
};

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: `1.5px solid ${C.lineFaint}`,
  borderRadius: 10,
  fontSize: 16,
  boxSizing: 'border-box',
  outline: 'none',
  fontFamily: 'inherit',
  background: C.white,
};

const primaryButtonStyle = {
  width: '100%',
  marginTop: 14,
  padding: '12px 16px',
  background: C.forest,
  color: 'white',
  border: 'none',
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  letterSpacing: '0.2px',
};

const errorBoxStyle = {
  marginTop: 16,
  padding: '10px 12px',
  background: C.rose,
  border: `1px solid ${C.roseBorder}`,
  borderRadius: 8,
  color: C.roseInk,
  fontSize: 13,
  lineHeight: 1.5,
};
