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
  const [open, setOpen] = useState({ patterns: true, visits: true, about: false, medical: false, preferences: false, agreement: false, membership: false });
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

  // mode === 'portal'
  const { client = {}, visits = {}, patterns, totalSessions = 0, preferences, memberships = [], packages = [] } = data || {};
  const upcoming = visits.upcoming || [];
  const past = visits.past || [];
  const needForms = upcoming.some((b) => b.needs_forms);
  const name = client.name || 'Your account';
  const manageUrl = (b) => (b.therapist_url ? `/book/${b.therapist_url}/manage?b=${b.id}` : null);
  const bookUrl = (b) => (b.therapist_url ? `/book/${b.therapist_url}` : null);
  let ord = 0;

  const VisitRow = ({ b, isUpcoming }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '13px 0', borderBottom: `1px solid ${C.lineSoft}` }}>
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: C.forest }}>{b.date}</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{b.time ? b.time + ' · ' : ''}{b.service} with {b.therapist_name}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
        {isUpcoming && b.needs_forms && manageUrl(b) && <a href={manageUrl(b)} style={{ ...linkStyle, color: C.amber }}>Review and sign</a>}
        {bookUrl(b) && <a href={bookUrl(b)} style={linkStyle}>Book again</a>}
      </div>
    </div>
  );

  return (
    <div style={page}><div style={wrap}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <div style={{ width: 58, height: 58, borderRadius: '50%', background: avatarColor(name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 21, flexShrink: 0, fontFamily: F.sans }}>{initials(name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: F.serif, fontSize: 30, fontWeight: 600, color: C.forest, margin: 0, lineHeight: 1.05 }}>{name}</h1>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, fontSize: 11, fontWeight: 600, color: C.sage, background: C.sageBg, border: '1px solid #DCEBE1', borderRadius: 999, padding: '3px 9px' }}>Your private page</span>
        </div>
        <button onClick={signOut} style={{ fontSize: 13, color: C.muted, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontFamily: F.sans, flexShrink: 0 }}>Sign out</button>
      </div>
      <div style={{ height: 1, background: C.lineFaint, margin: '16px 0 18px' }} />

      {needForms && (
        <div style={{ display: 'flex', gap: 11, alignItems: 'center', background: C.amberBg, border: '1px solid #F1DCA0', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          <span style={{ fontSize: 13.5, color: '#92660E', lineHeight: 1.45 }}>Some upcoming visits still need your forms. Open a visit below to review and sign.</span>
        </div>
      )}

      {/* Body patterns — the real heatmap */}
      <ProfileSection accent="patterns" title="Your body, over time" order={ord++} isOpen={open.patterns} onToggle={() => toggle('patterns')}>
        <PatternsCard patterns={patterns} totalSessions={totalSessions} />
      </ProfileSection>

      {/* Visits */}
      <ProfileSection accent="visits" title="Upcoming and past" trailingLabel={`${upcoming.length} upcoming`} order={ord++} isOpen={open.visits} onToggle={() => toggle('visits')}>
        {upcoming.length === 0 && past.length === 0
          ? <p style={{ fontSize: 14, color: C.inkSoft, margin: '6px 0' }}>No visits yet.</p>
          : (
            <>
              {upcoming.length > 0 && <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted, margin: '4px 0 2px' }}>Upcoming</div>}
              {upcoming.map((b) => <VisitRow key={b.id} b={b} isUpcoming />)}
              {past.length > 0 && <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted, margin: '14px 0 2px' }}>Past</div>}
              {past.map((b) => <VisitRow key={b.id} b={b} isUpcoming={false} />)}
            </>
          )}
      </ProfileSection>

      {/* Client info */}
      <ProfileSection accent="about" title="Your details" order={ord++} isOpen={open.about} onToggle={() => toggle('about')}>
        <Row label="Name">{client.name}</Row>
        <Row label="Email">{client.email}</Row>
        <Row label="Phone">{client.phone}</Row>
        <Row label="Alternate phone">{client.alt_phone}</Row>
        <Row label="Birthday">{fmtDate(client.birthday)}</Row>
        <Row label="Gender">{client.gender}</Row>
        <Row label="Address">{composeAddress(client)}</Row>
        <Row label="Emergency contact">{client.emergency_contact}</Row>
        <Row label="How you found us">{client.referral_source}</Row>
        <Row label="Client since">{fmtMonthYear(client.customer_since)}</Row>
      </ProfileSection>

      {/* Medical (the client's own health) */}
      <ProfileSection accent="medical" title="Your health" order={ord++} isOpen={open.medical} onToggle={() => toggle('medical')}>
        <Row label="Health conditions">{client.health_conditions}</Row>
        <Row label="Allergies">{client.allergies}</Row>
        <Row label="Medications">{client.medications}</Row>
        <Row label="Areas to avoid">{client.areas_to_avoid}</Row>
      </ProfileSection>

      {/* Preferences — real card */}
      <ProfileSection accent="preferences" title="Your preferences" order={ord++} isOpen={open.preferences} onToggle={() => toggle('preferences')}>
        <PreferencesCard preferences={preferences} />
      </ProfileSection>

      {/* Agreement */}
      <ProfileSection accent="agreement" title="Your forms" order={ord++} isOpen={open.agreement} onToggle={() => toggle('agreement')}>
        <Row label="Client agreement and consent">
          {client.agreement_signed_at
            ? <span style={{ color: C.sage }}>Signed {fmtDate(client.agreement_signed_at)}</span>
            : <span style={{ color: C.amber }}>Needs your signature</span>}
        </Row>
        {!client.agreement_signed_at && upcoming[0] && manageUrl(upcoming[0]) && (
          <div style={{ marginTop: 12 }}>
            <a href={manageUrl(upcoming[0])} style={{ display: 'inline-flex', color: '#fff', background: C.sage, borderRadius: 9, padding: '9px 15px', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>Review and sign</a>
          </div>
        )}
      </ProfileSection>

      {/* Memberships and packages */}
      {(memberships.length > 0 || packages.length > 0) && (
        <ProfileSection accent="membership" title="What you have" order={ord++} isOpen={open.membership} onToggle={() => toggle('membership')}>
          {packages.map((p, i) => (
            <Row key={'p' + i} label={p.name}>{p.remaining} of {p.purchased} sessions remaining{p.purchased_at ? ` · since ${fmtMonthYear(p.purchased_at)}` : ''}</Row>
          ))}
          {memberships.map((m, i) => (
            <Row key={'m' + i} label={m.name}>{m.status}{typeof m.credits === 'number' ? ` · ${m.credits} credits` : ''}</Row>
          ))}
        </ProfileSection>
      )}
    </div></div>
  );
}
