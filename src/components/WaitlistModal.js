import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function WaitlistModal({ isOpen, onClose, interest }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) {
      setErrorMsg('Please enter your name and email.');
      return;
    }
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    const { error } = await supabase.from('waitlist').insert([{ name: name.trim(), email: email.trim(), interest }]);
    if (error) {
      setStatus('error');
      setErrorMsg('Something went wrong. Please try again.');
    } else {
      setStatus('success');
    }
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setStatus('idle');
    setErrorMsg('');
    onClose();
  };

  const C = {
    forest: '#2A5741',
    sage: '#6B9E80',
    beige: '#F5F0E8',
    darkGray: '#1A1A2E',
    gray: '#6B7280',
    lightGray: '#E8E4DC',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={handleClose}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '48px 40px', maxWidth: '480px', width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>

        {status === 'success' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌿</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: '700', color: C.forest, marginBottom: '12px' }}>You are on the list.</h2>
            <p style={{ fontSize: '16px', color: C.gray, lineHeight: '1.7', marginBottom: '32px' }}>
              We will reach out to you personally when {interest} is ready. Thank you for believing in what we are building.
            </p>
            <button onClick={handleClose} style={{ background: C.forest, color: 'white', border: 'none', padding: '14px 32px', borderRadius: '8px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: '700', color: C.forest, margin: '0 0 8px 0' }}>Join the Waitlist</h2>
                <p style={{ fontSize: '15px', color: C.gray, margin: 0 }}>{interest} — we will reach out when it is ready.</p>
              </div>
              <button onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: '22px', color: C.gray, cursor: 'pointer', padding: '0 0 0 16px', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: C.darkGray, display: 'block', marginBottom: '6px' }}>Your Name</label>
                <input
                  type="text"
                  placeholder="Sarah Johnson"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', border: `1px solid ${C.lightGray}`, borderRadius: '8px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: C.darkGray, display: 'block', marginBottom: '6px' }}>Email Address</label>
                <input
                  type="email"
                  placeholder="sarah@yourstudio.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  style={{ width: '100%', padding: '12px 16px', border: `1px solid ${C.lightGray}`, borderRadius: '8px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {errorMsg && <p style={{ fontSize: '14px', color: '#DC2626', marginBottom: '16px' }}>{errorMsg}</p>}

            <button
              onClick={handleSubmit}
              disabled={status === 'loading'}
              style={{ width: '100%', background: C.forest, color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '15px', fontWeight: '700', cursor: status === 'loading' ? 'not-allowed' : 'pointer', opacity: status === 'loading' ? 0.7 : 1 }}
            >
              {status === 'loading' ? 'Saving...' : 'Notify Me When Ready →'}
            </button>

            <p style={{ fontSize: '12px', color: C.gray, textAlign: 'center', marginTop: '12px' }}>
              No spam. Just one email when it launches.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
