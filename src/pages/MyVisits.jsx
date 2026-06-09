// src/pages/MyVisits.jsx
//
// Passwordless client portal (Phase 1). A client lands here from a magic
// link in email (?t=token) or enters their email to be sent one. No
// password, no account. All data comes from the client-portal edge
// function (service role, own data only); the client never gets a
// database session. Designed to the 70-year-old-friendly standard:
// large text, big buttons, plain language, no clutter.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const C = {
  forest: '#2A5741',
  cream: '#FBF8F1',
  ink: '#1F3A2C',
  inkSoft: '#4B5563',
  line: 'rgba(31,58,44,0.12)',
  sageBg: '#EEF4EF',
};

const TOKEN_KEY = 'mbm_portal_token';

export default function MyVisits() {
  const [token, setToken] = useState('');
  const [mode, setMode] = useState('loading'); // loading | email | sent | visits
  const [data, setData] = useState(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (t) => {
    setMode('loading');
    try {
      const res = await supabase.functions.invoke('client-portal', { body: { op: 'load', token: t } });
      if (res?.data?.ok) {
        localStorage.setItem(TOKEN_KEY, t);
        setData(res.data);
        setToken(t);
        setMode('visits');
        return;
      }
    } catch (_e) { /* fall through to email */ }
    localStorage.removeItem(TOKEN_KEY);
    setMode('email');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('t');
    const saved = localStorage.getItem(TOKEN_KEY);
    const t = urlToken || saved;
    if (t) {
      // Clean the token out of the address bar after capturing it.
      if (urlToken) window.history.replaceState({}, '', '/my-visits');
      load(t);
    } else {
      setMode('email');
    }
  }, [load]);

  const requestLink = async () => {
    if (!email.includes('@')) return;
    setBusy(true);
    try {
      await supabase.functions.invoke('client-portal', { body: { op: 'request-link', email } });
    } catch (_e) { /* always show the same confirmation */ }
    setBusy(false);
    setMode('sent');
  };

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    setData(null);
    setToken('');
    setEmail('');
    setMode('email');
  };

  const Shell = ({ children }) => (
    <div style={{ minHeight: '100vh', background: C.cream, fontFamily: 'Georgia, serif', color: C.ink }}>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <span style={{ fontSize: 26 }}>🌿</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: C.forest }}>MyBodyMap</span>
        </div>
        {children}
      </div>
    </div>
  );

  if (mode === 'loading') {
    return <Shell><p style={{ fontSize: 18, color: C.inkSoft }}>One moment, loading your visits.</p></Shell>;
  }

  if (mode === 'email') {
    return (
      <Shell>
        <h1 style={{ fontSize: 30, lineHeight: 1.2, margin: '0 0 12px' }}>Your visits</h1>
        <p style={{ fontSize: 18, color: C.inkSoft, margin: '0 0 24px' }}>
          Enter the email you use with your therapist and we will send you a private link. No password to remember.
        </p>
        <input
          type="email" inputMode="email" autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') requestLink(); }}
          placeholder="you@example.com"
          style={{
            width: '100%', boxSizing: 'border-box', fontSize: 20, padding: '16px 18px',
            border: `2px solid ${C.line}`, borderRadius: 12, marginBottom: 16, fontFamily: 'inherit',
          }}
        />
        <button onClick={requestLink} disabled={busy || !email.includes('@')}
          style={{
            width: '100%', fontSize: 20, fontWeight: 700, color: '#fff',
            background: busy || !email.includes('@') ? '#9CB0A0' : C.forest,
            border: 'none', borderRadius: 12, padding: '16px 18px', cursor: 'pointer', fontFamily: 'inherit',
          }}>
          {busy ? 'Sending...' : 'Email me my link'}
        </button>
      </Shell>
    );
  }

  if (mode === 'sent') {
    return (
      <Shell>
        <h1 style={{ fontSize: 28, lineHeight: 1.2, margin: '0 0 12px' }}>Check your email</h1>
        <p style={{ fontSize: 18, color: C.inkSoft, margin: '0 0 10px' }}>
          If that email is on file with your therapist, a link to your visits is on its way. It can take a minute or two to arrive.
        </p>
        <p style={{ fontSize: 16, color: C.inkSoft }}>
          You can close this page. Open the link from your email whenever you are ready.
        </p>
      </Shell>
    );
  }

  // mode === 'visits'
  const { name, upcoming = [], past = [] } = data || {};
  const bookUrl = (b) => (b.therapist_url ? `/book/${b.therapist_url}` : null);
  const manageUrl = (b) => (b.therapist_url ? `/book/${b.therapist_url}/manage?b=${b.id}` : null);
  const needForms = upcoming.filter((b) => b.needs_forms && b.therapist_url);

  const Btn = ({ href, children, solid }) => (
    <a href={href} style={{
      display: 'inline-block', textDecoration: 'none', fontSize: 16, fontWeight: 700,
      color: solid ? '#fff' : C.forest, background: solid ? C.forest : '#fff',
      border: `2px solid ${C.forest}`, borderRadius: 10, padding: '11px 18px', marginRight: 10, marginTop: 8,
    }}>{children}</a>
  );

  const Card = ({ b, showManage }) => (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: '18px 18px', marginBottom: 14 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{b.date}{b.time ? ` at ${b.time}` : ''}</div>
      <div style={{ fontSize: 17, color: C.inkSoft }}>{b.service} with {b.therapist_name}</div>
      <div>
        {bookUrl(b) && <Btn href={bookUrl(b)} solid>Book again</Btn>}
        {showManage && manageUrl(b) && <Btn href={manageUrl(b)}>Manage</Btn>}
      </div>
    </div>
  );

  return (
    <Shell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
        <h1 style={{ fontSize: 30, lineHeight: 1.2, margin: 0 }}>{name ? `Hello, ${name}` : 'Your visits'}</h1>
        <button onClick={signOut} style={{ background: 'none', border: 'none', color: C.inkSoft, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>Sign out</button>
      </div>

      {needForms.length > 0 && (
        <div style={{ background: C.sageBg, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 18px', marginBottom: 22 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Forms to sign</div>
          <p style={{ fontSize: 16, color: C.inkSoft, margin: '0 0 6px' }}>
            A few of your upcoming visits still need your forms. Open the visit to review and sign.
          </p>
          {needForms.map((b) => (
            <a key={b.id} href={manageUrl(b)} style={{ display: 'block', fontSize: 16, fontWeight: 700, color: C.forest, marginTop: 8 }}>
              {b.date} with {b.therapist_name} →
            </a>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 20, color: C.inkSoft, fontWeight: 700, margin: '0 0 12px' }}>Upcoming</h2>
      {upcoming.length === 0
        ? <p style={{ fontSize: 17, color: C.inkSoft, marginBottom: 24 }}>You have no upcoming visits booked. Use Book again below to schedule your next one.</p>
        : upcoming.map((b) => <Card key={b.id} b={b} showManage />)}

      {past.length > 0 && (
        <>
          <h2 style={{ fontSize: 20, color: C.inkSoft, fontWeight: 700, margin: '28px 0 12px' }}>Past visits</h2>
          {past.map((b) => <Card key={b.id} b={b} />)}
        </>
      )}
    </Shell>
  );
}
