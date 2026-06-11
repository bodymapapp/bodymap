// src/pages/MyVisits.jsx
//
// Passwordless client portal. The client lands here from a magic link in
// email (?t=token) or enters their email to be sent one. No password, no
// DB session. All data comes from the client-portal edge function (service
// role, own data only, therapist-private fields stripped server-side).
//
// Stage 1: read-only. The page reuses the real therapist client-page
// components (ProfileSection chrome, PatternsCard body map, PreferencesCard)
// so it is the same design system, not a lookalike. Edit + verify is Stage 2.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import ProfileSection from '../components/ClientProfile/ProfileSection';
import ClientProfile from '../components/ClientProfile';
import PatternsCard from '../components/ClientProfile/PatternsCard';
import PreferencesCard from '../components/ClientProfile/PreferencesCard';
import { C, F, initials, avatarColor } from '../components/ClientProfile/tokens';

const TOKEN_KEY = 'mbm_portal_token';

const page = { minHeight: '100vh', background: C.cream, fontFamily: F.sans, color: C.ink };
const wrap = { maxWidth: 620, margin: '0 auto', padding: '22px 16px 80px' };

function fmtDate(iso) {
  if (!iso) return '';
  const d = iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function fmtMonthYear(iso) {
  if (!iso) return '';
  const d = iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function composeAddress(c) {
  const l = [c.address_line1, c.address_line2].filter(Boolean).join(', ');
  const cityLine = [c.city, c.state].filter(Boolean).join(', ');
  const tail = [cityLine, c.zip].filter(Boolean).join(' ');
  return [l, tail].filter(Boolean).join(' · ');
}

// Read-only field row, matching the PreferencesCard Row style: tiny
// uppercase muted label, value below in forest sans.
const Row = ({ label, children }) => (
  <div style={{ padding: '11px 0', borderBottom: `1px solid ${C.lineSoft}` }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: F.sans, marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 14, color: C.forest, fontFamily: F.sans, fontWeight: 500 }}>
      {children || <span style={{ color: C.muted, fontWeight: 400, fontStyle: 'italic' }}>Not set</span>}
    </div>
  </div>
);

const linkStyle = { fontSize: 12.5, fontWeight: 600, color: C.sage, cursor: 'pointer', textDecoration: 'none' };

export default function MyVisits() {
  const [mode, setMode] = useState('loading'); // loading | email | sent | portal
  const [data, setData] = useState(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState({ visits: true, about: true, medical: false, preferences: false, agreement: false, membership: false });
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const load = useCallback(async (t) => {
    setMode('loading');
    try {
      const res = await supabase.functions.invoke('client-portal', { body: { op: 'profile', token: t } });
      if (res?.data?.ok) {
        localStorage.setItem(TOKEN_KEY, t);
        setData(res.data);
        setMode('portal');
        return;
      }
    } catch (_e) { /* fall through */ }
    localStorage.removeItem(TOKEN_KEY);
    setMode('email');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('t');
    const t = urlToken || localStorage.getItem(TOKEN_KEY);
    if (t) {
      if (urlToken) window.history.replaceState({}, '', '/my-visits');
      load(t);
    } else {
      setMode('email');
    }
  }, [load]);

  const requestLink = async () => {
    if (!email.includes('@')) return;
    setBusy(true);
    try { await supabase.functions.invoke('client-portal', { body: { op: 'request-link', email } }); }
    catch (_e) { /* always same confirmation */ }
    setBusy(false);
    setMode('sent');
  };

  const signOut = () => { localStorage.removeItem(TOKEN_KEY); setData(null); setEmail(''); setMode('email'); };

  if (mode === 'loading') {
    return <div style={page}><div style={wrap}><p style={{ fontSize: 16, color: C.inkSoft }}>One moment, loading your account.</p></div></div>;
  }

  if (mode === 'email' || mode === 'sent') {
    return (
      <div style={page}><div style={wrap}>
        <h1 style={{ fontFamily: F.serif, fontSize: 34, fontWeight: 600, color: C.forest, margin: '6px 0 12px' }}>Your account</h1>
        {mode === 'email' ? (
          <>
            <p style={{ fontSize: 15.5, color: C.inkSoft, margin: '0 0 20px', lineHeight: 1.55 }}>
              Enter the email you use with your therapist and we will send you a private link. No password to remember.
            </p>
            <div style={{ background: C.paper, border: `1px solid ${C.lineFaint}`, borderRadius: 12, padding: 18, boxShadow: '0 1px 2px rgba(31,58,44,0.04)' }}>
              <input type="email" inputMode="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') requestLink(); }}
                placeholder="you@example.com"
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 17, padding: '13px 15px', border: `1px solid ${C.lineFaint}`, borderRadius: 10, marginBottom: 12, fontFamily: F.sans, color: C.forest, outline: 'none' }} />
              <button onClick={requestLink} disabled={busy || !email.includes('@')}
                style={{ width: '100%', fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: F.sans, background: busy || !email.includes('@') ? C.muted : C.sage, border: 'none', borderRadius: 10, padding: '13px', cursor: busy ? 'default' : 'pointer' }}>
                {busy ? 'Sending...' : 'Email me my link'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ background: C.paper, border: `1px solid ${C.lineFaint}`, borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(31,58,44,0.04)' }}>
            <h2 style={{ fontFamily: F.serif, fontSize: 24, fontWeight: 600, color: C.forest, margin: '0 0 8px' }}>Check your email</h2>
            <p style={{ fontSize: 15, color: C.inkSoft, margin: 0, lineHeight: 1.55 }}>
              If that email is on file with your therapist, a link to your account is on its way. It can take a minute or two to arrive.
            </p>
          </div>
        )}
      </div></div>
    );
  }

  // mode === 'portal' - reuse the real ClientProfile page in read-only
  // client view. Fed by the edge profile op via previewProfile, so it
  // renders the full page (header, stat strip, body map, sections) with
  // no therapist session and no fetch. clientView strips the private parts.
  const profileData = data?.profile || null;
  const therapistData = data?.therapist || null;
  if (!profileData) {
    return (
      <div style={page}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 18px', fontSize: 14, color: C.muted }}>
          We could not load your page just now. Please try the link in your email again.
        </div>
      </div>
    );
  }
  return (
    <div style={{ minHeight: '100vh', background: C.cream }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 0' }}>
          <span style={{ fontFamily: F.serif, fontSize: 16, fontWeight: 600, color: C.forest }}>
            {therapistData?.name || 'MyBodyMap'}
          </span>
          <button onClick={signOut} style={{ fontSize: 13, color: C.muted, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontFamily: F.sans }}>Sign out</button>
        </div>
        <ClientProfile previewProfile={profileData} therapist={therapistData} clientView />
      </div>
    </div>
  );
}
