// src/pages/StripeDebug.jsx
//
// Gated by FounderRoute to HK only. Shows the raw Stripe account
// state for the signed-in founder so we can stop guessing what
// Stripe is doing.
//
// HK May 15 2026: 'I want to solve this problem fast but fully 100%
// foolproof.'
//
// Surfaces:
//   - therapist row's stripe_account_id, stripe_account_connected
//   - Stripe API response: charges_enabled, payouts_enabled,
//     details_submitted, requirements (currently_due, eventually_due,
//     past_due), disabled_reason
//   - Stripe-side raw JSON dump for copy-paste sharing
//   - Force-set connected button (escape hatch if Stripe's check is
//     wrong)
//   - Wipe stripe_account_id button (start over with a fresh
//     account)
//   - Resume button (mints a fresh Account Link to the same account
//     and redirects in the same tab)

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = 'https://rmnqfrljoknmellbnpiy.supabase.co';

const C = {
  bg: '#0B1F17',
  panel: '#13261E',
  panelAlt: '#0F2018',
  ink: '#E8F0EC',
  inkSoft: '#A8BFB5',
  amber: '#F3D88E',
  red: '#FCA5A5',
  green: '#86EFAC',
  border: '#1F3A2C',
  forest: '#2A5741',
};

export default function StripeDebug() {
  return <StripeDebugInner embedded={false} />;
}

// Embeddable variant. The FounderHub page uses this so the debug
// surface lives alongside the rest of the founder operating system
// instead of being a separate route.
export function StripeDebugEmbedded() {
  return <StripeDebugInner embedded={true} />;
}

function StripeDebugInner({ embedded = false }) {
  const { user, therapist } = useAuth();
  const navigate = useNavigate();
  const [diag, setDiag] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionPending, setActionPending] = useState(null);
  const [platformAccounts, setPlatformAccounts] = useState(null);
  const [loadingPlatform, setLoadingPlatform] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'diagnose', therapist_id: therapist?.id }),
      });
      setDiag(await res.json());
    } catch (e) { setError(String(e?.message || e)); }
    finally { setLoading(false); }
  }

  async function loadPlatformAccounts() {
    setLoadingPlatform(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'list_platform_accounts', therapist_id: therapist?.id }),
      });
      const data = await res.json();
      setPlatformAccounts(data.accounts || []);
    } catch (e) { alert('Could not load platform accounts: ' + String(e?.message || e)); }
    finally { setLoadingPlatform(false); }
  }

  async function attachAccount(targetAccountId) {
    if (!window.confirm(`Attach ${targetAccountId} to your therapist row? This replaces your current stripe_account_id.`)) return;
    setActionPending('attach:' + targetAccountId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'attach_account', therapist_id: therapist?.id, account_id: targetAccountId }),
      });
      const data = await res.json();
      if (data.ok) {
        alert(`Attached. Ready: ${data.ready ? 'YES' : 'NO'}`);
        load();
      } else {
        alert('Attach failed: ' + (data.error || JSON.stringify(data)));
      }
    } catch (e) { alert('Attach error: ' + String(e?.message || e)); }
    finally { setActionPending(null); }
  }

  async function forceMarkConnected() {
    if (!diag?.account_id) return;
    setActionPending('force_connect');
    const { error: e } = await supabase
      .from('therapists')
      .update({ stripe_account_connected: true, stripe_account_ready_at: new Date().toISOString() })
      .eq('id', therapist.id);
    setActionPending(null);
    if (e) { alert('Failed: ' + e.message); return; }
    alert('Force-set stripe_account_connected = true.');
    load();
  }

  async function wipeAccount() {
    if (!window.confirm('This will clear stripe_account_id. The Stripe-side account remains but MyBodyMap will create a new one when you tap Connect Stripe again. Continue?')) return;
    setActionPending('wipe');
    const { error: e } = await supabase
      .from('therapists')
      .update({ stripe_account_id: null, stripe_account_connected: false })
      .eq('id', therapist.id);
    setActionPending(null);
    if (e) { alert('Failed: ' + e.message); return; }
    alert('Cleared.');
    load();
  }

  async function resumeOnboarding() {
    setActionPending('resume');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'resume_onboarding', therapist_id: therapist?.id }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      alert('Could not resume: ' + (data.error || JSON.stringify(data)));
    } catch (e) { alert('Resume failed: ' + String(e?.message || e)); }
    finally { setActionPending(null); }
  }

  useEffect(() => { if (therapist?.id) load(); }, [therapist?.id]);

  return <StripeDebugBody
    user={user}
    therapist={therapist}
    diag={diag}
    loading={loading}
    error={error}
    actionPending={actionPending}
    platformAccounts={platformAccounts}
    loadingPlatform={loadingPlatform}
    load={load}
    loadPlatformAccounts={loadPlatformAccounts}
    attachAccount={attachAccount}
    forceMarkConnected={forceMarkConnected}
    wipeAccount={wipeAccount}
    resumeOnboarding={resumeOnboarding}
    onBack={() => navigate('/dashboard')}
    standalone={!embedded}
  />;
}

function StripeDebugBody({
  user, therapist, diag, loading, error, actionPending,
  platformAccounts, loadingPlatform,
  load, loadPlatformAccounts, attachAccount,
  forceMarkConnected, wipeAccount, resumeOnboarding,
  onBack, standalone,
}) {
  return (
    <div style={{ minHeight: standalone ? '100vh' : 0, background: standalone ? C.bg : 'transparent', color: C.ink, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: standalone ? '32px 20px' : 0 }}>
      <div style={{ maxWidth: standalone ? 820 : '100%', margin: '0 auto' }}>
        {standalone && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, margin: 0, color: C.ink }}>
              Stripe Debug
            </h1>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={load} style={btnStyle()}>Refresh</button>
              <button onClick={onBack} style={btnStyle()}>Back to Dashboard</button>
            </div>
          </div>
        )}
        {!standalone && (
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={load} style={btnStyle()}>Refresh</button>
          </div>
        )}

        <div style={{ background: standalone ? C.panel : '#0F2018', border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.amber, marginBottom: 10 }}>
            Your auth context
          </div>
          <Row label="Email" value={user?.email || '(none)'} />
          <Row label="Therapist ID" value={therapist?.id || '(loading)'} mono />
          <Row label="Business name" value={therapist?.business_name || '(not set)'} />
          <Row label="stripe_account_id (DB)" value={therapist?.stripe_account_id || '(null)'} mono />
          <Row label="stripe_account_connected (DB)" value={String(therapist?.stripe_account_connected ?? '(null)')} tone={therapist?.stripe_account_connected ? 'green' : 'amber'} />
        </div>

        {loading && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, textAlign: 'center', color: C.inkSoft }}>
            Querying Stripe...
          </div>
        )}

        {error && (
          <div style={{ background: C.panel, border: `1px solid ${C.red}`, borderRadius: 12, padding: 18, marginBottom: 16, color: C.red, fontSize: 13 }}>
            Error: {error}
          </div>
        )}

        {diag && diag.status === 'no_account' && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.amber, marginBottom: 10 }}>
              No Stripe Account
            </div>
            <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.6 }}>
              {diag.message}
            </div>
          </div>
        )}

        {diag && diag.status === 'stripe_lookup_failed' && (
          <div style={{ background: C.panel, border: `1px solid ${C.red}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.red, marginBottom: 10 }}>
              Stripe lookup failed
            </div>
            <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.6 }}>
              {diag.stripe_error}
            </div>
          </div>
        )}

        {diag && diag.status === 'ok' && (
          <>
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.amber, marginBottom: 10 }}>
                Stripe says
              </div>
              <Row label="Account ID" value={diag.account_id} mono />
              <Row label="charges_enabled" value={String(diag.charges_enabled)} tone={diag.charges_enabled ? 'green' : 'red'} />
              <Row label="payouts_enabled" value={String(diag.payouts_enabled)} tone={diag.payouts_enabled ? 'green' : 'red'} />
              <Row label="details_submitted" value={String(diag.details_submitted)} tone={diag.details_submitted ? 'green' : 'red'} />
              <Row label="disabled_reason" value={diag.requirements_disabled_reason || '(none)'} tone={diag.requirements_disabled_reason ? 'red' : 'green'} />
            </div>

            <Section title={`currently_due (${diag.requirements_currently_due.length})`}
                     items={diag.requirements_currently_due}
                     emptyText="(nothing currently due, Stripe says this account is up to date)" />

            <Section title={`past_due (${diag.requirements_past_due.length})`}
                     items={diag.requirements_past_due}
                     tone={diag.requirements_past_due.length > 0 ? 'red' : 'default'}
                     emptyText="(nothing past due)" />

            <Section title={`eventually_due (${diag.requirements_eventually_due.length})`}
                     items={diag.requirements_eventually_due}
                     emptyText="(nothing eventually due)" />

            <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>
              <strong style={{ color: C.amber }}>Interpretation:</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                <li>If all three booleans are <strong style={{ color: C.green }}>true</strong> and the DB says false, hit Force-set connected below.</li>
                <li>If charges_enabled is false but the requirements lists are all empty, Stripe is hung on something behind the scenes; tap Wipe and start over.</li>
                <li>If requirements_currently_due has items, Resume Onboarding lets you fill them in Stripe.</li>
                <li>If past_due has items, Stripe is about to block charges; complete them ASAP.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <button onClick={resumeOnboarding} disabled={actionPending === 'resume'} style={btnStyle('primary')}>
                {actionPending === 'resume' ? 'Opening Stripe...' : 'Resume Onboarding'}
              </button>
              {!diag.connected_in_db && diag.charges_enabled && diag.payouts_enabled && diag.details_submitted && (
                <button onClick={forceMarkConnected} disabled={actionPending === 'force_connect'} style={btnStyle('warn')}>
                  {actionPending === 'force_connect' ? 'Saving...' : 'Force-set connected'}
                </button>
              )}
              <button onClick={wipeAccount} disabled={actionPending === 'wipe'} style={btnStyle('danger')}>
                {actionPending === 'wipe' ? 'Wiping...' : 'Wipe Stripe Account ID'}
              </button>
            </div>
          </>
        )}

        {/* Platform accounts: list ALL Stripe accounts under our
            Connect platform so HK can manually attach a specific
            one to the current therapist. Helpful when the email
            auto-match in get_oauth_url did not catch the right
            account, OR when HK is fixing a different therapist's
            connection by impersonation. */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.amber }}>
              Platform accounts (manual attach)
            </div>
            <button onClick={loadPlatformAccounts} disabled={loadingPlatform} style={btnStyle()}>
              {loadingPlatform ? 'Loading...' : (platformAccounts ? 'Refresh list' : 'Load list')}
            </button>
          </div>
          {!platformAccounts && (
            <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.55 }}>
              Click Load list to see every Express account under the MyBodyMap platform. You can attach any of them to your current therapist row with one click. Useful when an Enabled account exists in Stripe but the wrong account got attached.
            </div>
          )}
          {platformAccounts && (
            <div style={{ maxHeight: 360, overflowY: 'auto', borderRadius: 8 }}>
              {platformAccounts.length === 0 ? (
                <div style={{ fontSize: 12, color: C.inkSoft }}>No accounts on the platform.</div>
              ) : (
                <table style={{ width: '100%', fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: C.panelAlt, color: C.inkSoft }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Account ID</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Display Name</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Email</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px' }}>Ready</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platformAccounts.map((a) => {
                      const isCurrent = a.id === diag?.account_id;
                      const ready = a.charges_enabled && a.payouts_enabled && a.details_submitted;
                      return (
                        <tr key={a.id} style={{ background: isCurrent ? '#0F2018' : 'transparent', borderTop: `1px solid ${C.border}` }}>
                          <td style={{ padding: '6px 8px', color: C.ink, wordBreak: 'break-all' }}>
                            {a.id}
                            {isCurrent && <span style={{ marginLeft: 6, color: C.amber, fontWeight: 700 }}>← current</span>}
                          </td>
                          <td style={{ padding: '6px 8px', color: C.ink }}>{a.display_name || '(none)'}</td>
                          <td style={{ padding: '6px 8px', color: C.inkSoft }}>{a.email || '(none)'}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <span style={{ color: ready ? C.green : C.red, fontWeight: 700 }}>
                              {ready ? '✓' : '✗'}
                            </span>
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                            <button
                              onClick={() => attachAccount(a.id)}
                              disabled={isCurrent || actionPending === 'attach:' + a.id}
                              style={{
                                ...btnStyle(ready ? 'primary' : undefined),
                                fontSize: 10,
                                padding: '4px 8px',
                                opacity: isCurrent ? 0.5 : 1,
                                cursor: isCurrent ? 'default' : 'pointer',
                              }}
                            >
                              {actionPending === 'attach:' + a.id ? '...' : (isCurrent ? 'Current' : 'Attach')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {diag && (
          <details style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
            <summary style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.inkSoft, cursor: 'pointer' }}>
              Raw response (copy / paste)
            </summary>
            <pre style={{ marginTop: 12, fontSize: 11, color: C.ink, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 400, overflow: 'auto' }}>
              {JSON.stringify(diag, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono, tone = 'default' }) {
  const toneColor = tone === 'green' ? C.green : tone === 'amber' ? C.amber : tone === 'red' ? C.red : C.ink;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
      <div style={{ color: C.inkSoft, fontFamily: 'system-ui, sans-serif' }}>{label}</div>
      <div style={{
        color: toneColor,
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'system-ui, sans-serif',
        wordBreak: 'break-all',
        textAlign: 'right',
        maxWidth: '60%',
      }}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, items, tone, emptyText }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${tone === 'red' ? C.red : C.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: tone === 'red' ? C.red : C.amber, marginBottom: 10 }}>
        {title}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: C.inkSoft, fontStyle: 'italic' }}>{emptyText}</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.ink, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
          {items.map((item, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function btnStyle(variant = 'default') {
  const base = {
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
  };
  if (variant === 'primary') return { ...base, background: C.forest, color: '#fff' };
  if (variant === 'warn')    return { ...base, background: C.amber, color: '#000' };
  if (variant === 'danger')  return { ...base, background: '#7F1D1D', color: '#fff' };
  return { ...base, background: 'transparent', color: C.ink, border: `1px solid ${C.border}` };
}
