// src/pages/MyVisits.jsx
//
// Passwordless client portal (Phase 1). A client lands here from a magic
// link in email (?t=token) or enters their email to be sent one. No
// password, no account. All data comes from the client-portal edge
// function (service role, own data only); the client never gets a
// database session. Designed to match the intake: warm cream, sage
// accents, soft cards, large friendly type, plain language.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const C = {
  bg: '#F0EAD9',
  cardBg: '#FDFAF3',
  green: '#2A5741',
  sage: '#6B9E80',
  sagePale: '#D0E8D8',
  sageMid: '#A8CDBA',
  text: '#1C3024',
  textMid: '#4A6154',
  textLight: '#7A9485',
  border: '#DDD5C0',
  shadow: 'rgba(42,87,65,0.10)',
  formsBg: '#FBEFD6',
  formsInk: '#8A5A1E',
  white: '#FFFFFF',
};
const F = {
  display: "'Cormorant Garamond', Georgia, serif",
  body: "'Nunito', 'Helvetica Neue', sans-serif",
};

const TOKEN_KEY = 'mbm_portal_token';

// Presentational pieces at module scope so their identity is stable across
// renders. Defining them inside the component remounts the subtree on every
// keystroke, which dropped the email field's focus and closed the keyboard.
const Shell = ({ children }) => (
  <div style={{ minHeight: '100vh', background: C.bg, fontFamily: F.body, color: C.text }}>
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '26px 18px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 24 }}>
        <span style={{ fontSize: 24 }}>🌿</span>
        <span style={{ fontFamily: F.display, fontSize: 26, fontWeight: 700, color: C.green }}>MyBodyMap</span>
      </div>
      {children}
    </div>
  </div>
);

const bookUrl = (b) => (b.therapist_url ? `/book/${b.therapist_url}` : null);
const manageUrl = (b) => (b.therapist_url ? `/book/${b.therapist_url}/manage?b=${b.id}` : null);

const Btn = ({ href, onClick, children, variant = 'outline', disabled }) => {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    textDecoration: 'none', fontFamily: F.body, fontSize: 14.5, fontWeight: 700,
    borderRadius: 11, padding: '10px 16px', cursor: disabled ? 'default' : 'pointer',
    border: '1.5px solid', whiteSpace: 'nowrap',
  };
  const tone = variant === 'solid'
    ? { color: '#fff', background: C.green, borderColor: C.green }
    : variant === 'sage'
      ? { color: '#fff', background: C.sage, borderColor: C.sage }
      : { color: C.green, background: 'transparent', borderColor: C.sageMid };
  const style = { ...base, ...tone, ...(disabled ? { opacity: 0.55 } : null) };
  if (href) return <a href={href} style={style}>{children}</a>;
  return <button onClick={onClick} disabled={disabled} style={style}>{children}</button>;
};

const VisitCard = ({ b, showActions }) => (
  <div style={{
    background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 16,
    padding: '16px 18px', marginBottom: 13, boxShadow: `0 2px 10px ${C.shadow}`,
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
      <div>
        <div style={{ fontFamily: F.display, fontSize: 23, fontWeight: 700, color: C.text, lineHeight: 1.15 }}>{b.date}</div>
        {b.time && <div style={{ fontFamily: F.body, fontSize: 15, color: C.green, fontWeight: 800, marginTop: 1 }}>{b.time}</div>}
        <div style={{ fontFamily: F.body, fontSize: 14, color: C.textMid, marginTop: 5 }}>{b.service} with {b.therapist_name}</div>
      </div>
      {showActions && b.needs_forms && (
        <span style={{
          display: 'inline-block', fontSize: 12, fontWeight: 800, color: C.formsInk,
          background: C.formsBg, borderRadius: 999, padding: '3px 11px', whiteSpace: 'nowrap',
        }}>Forms to sign</span>
      )}
    </div>
    {showActions && (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 14 }}>
        {b.needs_forms && manageUrl(b) && <Btn href={manageUrl(b)} variant="sage">Review and sign</Btn>}
        {bookUrl(b) && <Btn href={bookUrl(b)} variant="solid">Book again</Btn>}
        {!b.needs_forms && manageUrl(b) && <Btn href={manageUrl(b)} variant="outline">Reschedule</Btn>}
      </div>
    )}
  </div>
);

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

  if (mode === 'loading') {
    return <Shell><p style={{ fontSize: 17, color: C.textMid }}>One moment, loading your visits.</p></Shell>;
  }

  if (mode === 'email') {
    const ready = email.includes('@');
    return (
      <Shell>
        <h1 style={{ fontFamily: F.display, fontSize: 34, lineHeight: 1.15, margin: '0 0 10px', color: C.text }}>Your visits</h1>
        <p style={{ fontSize: 16, color: C.textMid, margin: '0 0 22px', lineHeight: 1.55 }}>
          Enter the email you use with your therapist and we will send you a private link. No password to remember.
        </p>
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, boxShadow: `0 2px 10px ${C.shadow}` }}>
          <input
            type="email" inputMode="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') requestLink(); }}
            placeholder="you@example.com"
            style={{
              width: '100%', boxSizing: 'border-box', fontSize: 18, padding: '14px 16px',
              border: `1.5px solid ${C.sageMid}`, borderRadius: 12, marginBottom: 12,
              fontFamily: F.body, color: C.text, background: C.white, outline: 'none',
            }}
          />
          <button onClick={requestLink} disabled={busy || !ready}
            style={{
              width: '100%', fontSize: 17, fontWeight: 800, color: '#fff', fontFamily: F.body,
              background: busy || !ready ? C.sageMid : C.green,
              border: 'none', borderRadius: 12, padding: '14px 16px', cursor: busy || !ready ? 'default' : 'pointer',
            }}>
            {busy ? 'Sending...' : 'Email me my link'}
          </button>
        </div>
      </Shell>
    );
  }

  if (mode === 'sent') {
    return (
      <Shell>
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 20px', boxShadow: `0 2px 10px ${C.shadow}` }}>
          <div style={{ fontSize: 30, marginBottom: 6 }}>📬</div>
          <h1 style={{ fontFamily: F.display, fontSize: 28, lineHeight: 1.15, margin: '0 0 10px', color: C.text }}>Check your email</h1>
          <p style={{ fontSize: 16, color: C.textMid, margin: '0 0 10px', lineHeight: 1.55 }}>
            If that email is on file with your therapist, a link to your visits is on its way. It can take a minute or two to arrive.
          </p>
          <p style={{ fontSize: 14.5, color: C.textLight, margin: 0, lineHeight: 1.55 }}>
            You can close this page and open the link from your email whenever you are ready.
          </p>
        </div>
      </Shell>
    );
  }

  // mode === 'visits'
  const { name, upcoming = [], past = [] } = data || {};
  const formsCount = upcoming.filter((b) => b.needs_forms && b.therapist_url).length;

  return (
    <Shell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
        <h1 style={{ fontFamily: F.display, fontSize: 32, lineHeight: 1.1, margin: 0, color: C.text }}>
          {name ? `Hello, ${name}` : 'Your visits'}
        </h1>
        <button onClick={signOut} style={{ background: 'none', border: 'none', color: C.textLight, fontSize: 14, cursor: 'pointer', fontFamily: F.body, textDecoration: 'underline', flexShrink: 0 }}>Sign out</button>
      </div>

      {formsCount > 0 && (
        <div style={{ background: C.formsBg, border: '1px solid #EAD4A6', borderRadius: 14, padding: '13px 16px', marginBottom: 20 }}>
          <p style={{ fontSize: 15, color: C.formsInk, margin: 0, lineHeight: 1.5, fontWeight: 600 }}>
            {formsCount === 1
              ? 'One upcoming visit still needs your forms. Tap Review and sign on it below.'
              : `${formsCount} upcoming visits still need your forms. Tap Review and sign on each one below.`}
          </p>
        </div>
      )}

      <h2 style={{ fontFamily: F.body, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', color: C.textLight, fontWeight: 800, margin: '0 0 12px' }}>Upcoming</h2>
      {upcoming.length === 0
        ? (
          <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 18px', marginBottom: 24, boxShadow: `0 2px 10px ${C.shadow}` }}>
            <p style={{ fontSize: 15.5, color: C.textMid, margin: 0, lineHeight: 1.55 }}>You have no upcoming visits booked yet. When you are ready, use Book again on a past visit below to schedule your next one.</p>
          </div>
        )
        : upcoming.map((b) => <VisitCard key={b.id} b={b} showActions />)}

      {past.length > 0 && (
        <>
          <h2 style={{ fontFamily: F.body, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', color: C.textLight, fontWeight: 800, margin: '28px 0 12px' }}>Past visits</h2>
          {past.map((b) => <VisitCard key={b.id} b={b} showActions={false} />)}
        </>
      )}
    </Shell>
  );
}
