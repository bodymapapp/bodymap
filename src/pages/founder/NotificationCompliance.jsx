// src/pages/founder/NotificationCompliance.jsx
//
// The matrix view. Rows = touchpoints from NOTIFICATION_SPEC.
// Columns = channels per audience (T-Bell, T-Email, T-SMS,
// C-Email, C-SMS). Each cell colored by combining latest
// notification_log status + confirmed_at.
//
// HK May 17 2026: 'I am not clear on what you are turning green
// automatically which you should but I will need to confirm the
// text and email right? And there should be identical columns
// for therapist and client and yes on checkboxes where I am
// confirming.'
//
// Cell colors:
//   red       never fired (no log row)
//   orange    fired but failed/skipped downstream
//   yellow    fired successfully, you haven't confirmed receipt yet
//   green     fired AND you ticked "yes I received it"
//   purple    you ticked but no successful log row, suspicious
//
// Click a cell to open the side panel with:
//   - Last log row (recipient, body snippet, error, timestamp)
//   - Checkbox to mark confirmed (writes confirmed_at + confirmed_by)
//   - Reminder of the SMS/email rationale from the spec

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  NOTIFICATION_SPEC,
  ALL_CHANNELS_BY_AUDIENCE,
  CLIENT_PUSH_STATUS,
  cellState,
} from '../../lib/notificationSpec';

const COLORS = {
  forest: '#2A5741',
  forestDeep: '#1F4030',
  sage: '#6B9E80',
  cream: '#FBFAF4',
  border: '#E8E4DC',
  ink: '#1F2937',
  inkSoft: '#6B7280',
  inkFade: '#9CA3AF',
  red: '#DC2626',
  redSoft: '#FEE2E2',
  orange: '#D97706',
  orangeSoft: '#FED7AA',
  yellow: '#CA8A04',
  yellowSoft: '#FEF3C7',
  green: '#16A34A',
  greenSoft: '#D1FAE5',
  purple: '#7C3AED',
  purpleSoft: '#EDE9FE',
};

const CELL_COLORS = {
  red:    { bg: COLORS.redSoft,    fg: COLORS.red,    icon: '✗' },
  orange: { bg: COLORS.orangeSoft, fg: COLORS.orange, icon: '!' },
  yellow: { bg: COLORS.yellowSoft, fg: COLORS.yellow, icon: '~' },
  green:  { bg: COLORS.greenSoft,  fg: COLORS.green,  icon: '✓' },
  purple: { bg: COLORS.purpleSoft, fg: COLORS.purple, icon: '?' },
};

export default function NotificationCompliance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [therapist, setTherapist] = useState(null);
  const [client, setClient] = useState(null);
  const [logsByKey, setLogsByKey] = useState({});  // key: `${eventType}__${audience}__${channel}` → latest log row
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState(null);
  const [firing, setFiring] = useState(false);
  const [fireResult, setFireResult] = useState(null);
  const [bulkConfirming, setBulkConfirming] = useState(null);  // tracks which column is being bulk-confirmed

  // ─── Resolve "Joy Therapist" since this dashboard is keyed to a
  // specific therapist for testing. Defaults to the logged-in
  // founder's own therapist row. ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from('therapists')
        .select('id, email, full_name, business_name, custom_url, twilio_phone_number, phone')
        .eq('email', 'bodymapdemo@gmail.com')
        .maybeSingle();
      if (!cancelled) setTherapist(data || null);

      // Also load the canonical Joy Client row. Prefer one with a
      // phone set (for SMS testing), fall back to any row by email
      // so the button is never blocked when the phoned version is
      // missing. HK May 26 2026: previously this returned null when
      // no row had a phone, which silently disabled the fire button.
      let c = null;
      const { data: withPhone } = await supabase
        .from('clients')
        .select('id, name, email, phone')
        .eq('email', 'bodymap01@gmail.com')
        .not('phone', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (withPhone) {
        c = withPhone;
      } else {
        const { data: anyJoy } = await supabase
          .from('clients')
          .select('id, name, email, phone')
          .eq('email', 'bodymap01@gmail.com')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        c = anyJoy;
      }
      if (!cancelled) setClient(c || null);
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  // ─── Fetch latest log row per (eventType, audience, channel) ───
  const refreshLogs = useCallback(async () => {
    if (!therapist?.id) return;
    setLoading(true);

    // Pull all log rows for this therapist, recent first. We compute
    // "latest per cell" in JS rather than 25 separate SQL queries.
    const { data, error } = await supabase
      .from('notification_log')
      .select('id, notification_type, audience, channel, recipient, status, error_message, body_snippet, subject, sent_at, confirmed_at, confirmed_by')
      .eq('therapist_id', therapist.id)
      .order('sent_at', { ascending: false })
      .limit(500);

    if (error) {
      console.warn('notification_log fetch error', error);
      setLoading(false);
      return;
    }

    const byKey = {};
    for (const row of data || []) {
      const key = `${row.notification_type}__${row.audience}__${row.channel}`;
      // Keep the LATEST row only (rows are already ordered desc).
      if (!byKey[key]) byKey[key] = row;
    }
    setLogsByKey(byKey);
    setLoading(false);
  }, [therapist?.id]);

  useEffect(() => { refreshLogs(); }, [refreshLogs]);

  // ─── Confirm receipt for a single log row ──────────────────────
  async function confirmReceipt(logId) {
    if (!logId) return;
    const { error } = await supabase
      .from('notification_log')
      .update({
        confirmed_at: new Date().toISOString(),
        confirmed_by: user?.id || null,
      })
      .eq('id', logId);
    if (error) {
      alert(`Could not confirm: ${error.message}`);
      return;
    }
    await refreshLogs();
  }

  async function unconfirmReceipt(logId) {
    if (!logId) return;
    const { error } = await supabase
      .from('notification_log')
      .update({ confirmed_at: null, confirmed_by: null })
      .eq('id', logId);
    if (error) {
      alert(`Could not unconfirm: ${error.message}`);
      return;
    }
    await refreshLogs();
  }

  // ─── Auto-fire all touchpoints via the founder edge function ───
  async function fireAll() {
    if (!therapist?.id || !client?.id) {
      alert('Therapist or client account not loaded. Cannot run auto-fire.');
      return;
    }
    // HK May 26 2026: was window.confirm, now uses inline confirm pattern
    // via state. First tap arms; second tap fires. State resets on
    // anything else.
    if (firing !== 'arm_full') {
      setFiring('arm_full');
      setFireResult(null);
      return;
    }
    setFiring(true);
    setFireResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        alert('No auth token. Re-login and retry.');
        setFiring(false);
        return;
      }
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
      const res = await fetch(`${supabaseUrl}/functions/v1/founder-fire-all-notifications`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          therapist_id: therapist.id,
          client_id: client.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Auto-fire failed: ${data.error || 'unknown'}`);
        setFiring(false);
        return;
      }
      setFireResult(data);
      // Poll for log updates over the next 10 seconds while sends complete
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 1000));
        await refreshLogs();
      }
    } catch (e) {
      alert(`Auto-fire error: ${e.message}`);
    } finally {
      setFiring(false);
    }
  }

  // HK May 26 2026: dedicated firing for the May 26 batch (12 new
  // edge functions with real warm templates, not the synthetic
  // notifyTherapist/notifyClient helpers from fireAll). Calls each
  // new function directly with realistic payload, shows per-fire
  // pass/fail inline. Email-only until SMS infra ships.
  async function fireMay26Batch() {
    if (!therapist?.id || !client?.id) {
      alert('Therapist or client account not loaded. Cannot run.');
      return;
    }
    if (firing !== 'arm_may26') {
      setFiring('arm_may26');
      setFireResult(null);
      return;
    }
    setFiring(true);
    setFireResult(null);

    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) {
      alert('No auth token. Re-login and retry.');
      setFiring(false);
      return;
    }
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    // Find the latest Joy demo booking. Most event-driven functions
    // need a real booking_id with the right therapist+client linkage.
    const { data: latest } = await supabase
      .from('bookings')
      .select('id, booking_date, start_time, status')
      .eq('therapist_id', therapist.id)
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const bookingId = latest?.id;
    if (!bookingId) {
      setFireResult({ batch: 'may26', error: 'No Joy demo booking found. Create one first.', results: [] });
      setFiring(false);
      return;
    }

    const tests = [
      { id: 'C3',  fn: 'send-intake-reminder',                payload: { booking_id: bookingId },                                                                                          label: 'C3 Intake reminder' },
      { id: 'C4',  fn: 'send-reminder-48h',                    payload: { booking_id: bookingId },                                                                                          label: 'C4 48h reminder' },
      { id: 'C7',  fn: 'send-therapist-cancelled',             payload: { booking_id: bookingId, reason: 'Test fire from compliance dashboard. I caught a cold and need to reschedule.' }, label: 'C7 Therapist cancelled' },
      { id: 'C8',  fn: 'send-client-cancelled-within-policy',  payload: { booking_id: bookingId },                                                                                          label: 'C8 Client cancelled (no fee)' },
      { id: 'C9',  fn: 'send-client-cancelled-late',           payload: { booking_id: bookingId, fee_amount_cents: 5000, fee_charged: true },                                              label: 'C9 Client cancelled late (fee charged)' },
      { id: 'C10', fn: 'send-reschedule-confirmation',         payload: { booking_id: bookingId, prev_date: '2026-05-20', prev_time: '10:00:00' },                                          label: 'C10 Reschedule confirmation' },
      { id: 'C11', fn: 'send-no-show-charged',                 payload: { booking_id: bookingId, fee_amount_cents: 7500, charge_id: 'ch_test_compliance' },                                 label: 'C11 No-show charged' },
      { id: 'C12', fn: 'send-no-show-payment-request',         payload: { booking_id: bookingId, fee_amount_cents: 7500, payment_link_url: 'https://buy.stripe.com/test_compliance_link' }, label: 'C12 No-show payment request' },
      { id: 'T12', fn: 'send-no-show-occurred',                payload: { booking_id: bookingId, fee_charged: true, fee_amount_cents: 7500 },                                              label: 'T12 No-show alert to therapist' },
      { id: 'C14', fn: 'send-lapse-nudge',                     payload: { client_id: client.id },                                                                                           label: 'C14 Lapse nudge (gated)' },
      { id: 'C15', fn: 'send-lapse-final-nudge',               payload: { client_id: client.id },                                                                                           label: 'C15 Lapse final nudge (gated)' },
      { id: 'T10', fn: 'send-lapse-signal',                    payload: { therapist_id: therapist.id },                                                                                     label: 'T10 Lapse signal (gated)' },
    ];

    const results = [];
    for (const t of tests) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/${t.fn}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(t.payload),
        });
        const data = await res.json().catch(() => ({}));
        results.push({
          id: t.id,
          label: t.label,
          fn: t.fn,
          http: res.status,
          status: data.status || (res.ok ? 'sent' : 'failed'),
          reason: data.reason || data.error || null,
          ok: res.ok,
        });
      } catch (e) {
        results.push({
          id: t.id,
          label: t.label,
          fn: t.fn,
          http: 0,
          status: 'error',
          reason: String(e?.message || e),
          ok: false,
        });
      }
      // 400ms throttle to be polite to Resend (5 req/sec limit)
      await new Promise(r => setTimeout(r, 400));
    }

    setFireResult({ batch: 'may26', results, booking_id: bookingId });
    setFiring(false);
    await refreshLogs();
  }

  // ─── Bulk-confirm all yellow cells in a column ─────────────────
  async function bulkConfirmColumn(col) {
    // Find every log row matching this audience+channel where
    // status='sent' AND confirmed_at IS NULL
    const matchingLogs = Object.values(logsByKey).filter(log =>
      log.audience === col.audience &&
      log.channel === col.channel &&
      log.status === 'sent' &&
      !log.confirmed_at
    );
    if (matchingLogs.length === 0) {
      alert(`No yellow cells to confirm in ${col.short}.`);
      return;
    }
    if (!window.confirm(`Mark ${matchingLogs.length} ${col.short} notifications as received? You can untick individual cells afterward.`)) {
      return;
    }
    setBulkConfirming(`${col.audience}-${col.channel}`);
    const now = new Date().toISOString();
    const ids = matchingLogs.map(l => l.id);
    const { error } = await supabase
      .from('notification_log')
      .update({ confirmed_at: now, confirmed_by: user?.id || null })
      .in('id', ids);
    setBulkConfirming(null);
    if (error) {
      alert(`Bulk confirm failed: ${error.message}`);
      return;
    }
    await refreshLogs();
  }

  // ─── Render ───────────────────────────────────────────────────
  if (!user) {
    return <div style={{ padding: 40 }}>Sign in first.</div>;
  }

  // Build column header: [T-Bell, T-Email, T-SMS, C-Email, C-SMS]
  // We render the same five columns for every row. A cell with
  // n/a (the row's audience doesn't apply to that column) renders
  // as dim grey, not red.
  const COLS = [
    ...ALL_CHANNELS_BY_AUDIENCE.therapist.map(c => ({ ...c, audience: 'therapist' })),
    ...ALL_CHANNELS_BY_AUDIENCE.client.map(c => ({ ...c, audience: 'client' })),
  ];

  return (
    <div style={{ background: COLORS.cream, minHeight: '100vh', padding: '24px 16px 80px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => navigate('/founder')}
            style={{
              background: 'transparent',
              border: `1px solid ${COLORS.border}`,
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 12,
              color: COLORS.inkSoft,
              cursor: 'pointer',
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            ← Founder hub
          </button>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontWeight: 400,
            fontSize: 36,
            color: COLORS.forestDeep,
            letterSpacing: '-0.012em',
            margin: '0 0 8px',
          }}>
            Notification Compliance
          </h1>
          <p style={{ fontSize: 14, color: COLORS.inkSoft, lineHeight: 1.65, margin: '0 0 12px', maxWidth: 760 }}>
            Every touchpoint from <strong>docs/NOTIFICATION_MAP.md</strong> mapped to every channel (Bell, Push, Email, SMS for therapist; Email, SMS, Push for client). Color reflects the latest notification_log row + your confirmation status. Tap "Run full compliance test" below to fire every touchpoint at once.
          </p>
          {therapist && (
            <div style={{
              background: '#fff',
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: '14px 18px',
              marginTop: 4,
              fontSize: 12,
            }}>
              <div style={{ fontWeight: 700, color: COLORS.forestDeep, marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 10 }}>
                Sender & destinations
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', rowGap: 4, columnGap: 12 }}>
                <div style={{ color: COLORS.inkSoft, fontWeight: 600 }}>Twilio sender:</div>
                <div style={{ color: COLORS.ink }}><code>{therapist.twilio_phone_number || '(not configured)'}</code> <span style={{ color: COLORS.inkFade, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>(platform "From" number, never receives)</span></div>

                <div style={{ color: COLORS.inkSoft, fontWeight: 600, paddingTop: 6, borderTop: `1px solid ${COLORS.border}`, marginTop: 4 }}>T-SMS to:</div>
                <div style={{ color: COLORS.ink, paddingTop: 6, borderTop: `1px solid ${COLORS.border}`, marginTop: 4 }}><code>{therapist.phone || '(not set)'}</code> <span style={{ color: COLORS.inkFade, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>(Joy Therapist's personal phone, where platform alerts land)</span></div>

                <div style={{ color: COLORS.inkSoft, fontWeight: 600 }}>T-Email to:</div>
                <div style={{ color: COLORS.ink }}><code>{therapist.email}</code></div>

                <div style={{ color: COLORS.inkSoft, fontWeight: 600 }}>T-Bell to:</div>
                <div style={{ color: COLORS.ink }}>bell drawer on Joy Therapist dashboard</div>

                <div style={{ color: COLORS.inkSoft, fontWeight: 600 }}>T-Push to:</div>
                <div style={{ color: COLORS.ink }}>devices subscribed via dashboard Settings</div>

                <div style={{ color: COLORS.inkSoft, fontWeight: 600, paddingTop: 6, borderTop: `1px solid ${COLORS.border}`, marginTop: 4 }}>C-SMS to:</div>
                <div style={{ color: COLORS.ink, paddingTop: 6, borderTop: `1px solid ${COLORS.border}`, marginTop: 4 }}><code>{client?.phone || '(client not loaded)'}</code> <span style={{ color: COLORS.inkFade, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>(Joy Client's phone)</span></div>

                <div style={{ color: COLORS.inkSoft, fontWeight: 600 }}>C-Email to:</div>
                <div style={{ color: COLORS.ink }}><code>{client?.email || '(client not loaded)'}</code></div>

                <div style={{ color: COLORS.inkSoft, fontWeight: 600 }}>C-Push:</div>
                <div style={{ color: COLORS.inkFade, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>queued (requires client login, see BLOCK_PLAN Macro #2)</div>
              </div>
            </div>
          )}

          {/* Auto-fire CTAs */}
          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Load-state indicator so HK can see immediately if button is disabled
                because therapist or client didn't load */}
            {(!therapist || !client) && (
              <div style={{
                width: '100%',
                fontSize: 12,
                color: '#92400E',
                background: '#FEF3C7',
                border: '1px solid #C9A84C',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 8,
              }}>
                {!therapist && !client && 'Therapist + client not loaded. Try refreshing.'}
                {therapist && !client && 'Joy therapist OK, but Joy client (bodymap01@gmail.com) row missing. Cannot fire.'}
                {!therapist && client && 'Joy client OK, but Joy therapist (bodymapdemo@gmail.com) row missing. Cannot fire.'}
              </div>
            )}
            <button
              type="button"
              onClick={fireMay26Batch}
              disabled={firing === true || !therapist || !client}
              style={{
                background: firing === true ? COLORS.inkSoft
                  : firing === 'arm_may26' ? COLORS.gold
                  : (therapist && client ? `linear-gradient(135deg, ${COLORS.forestDeep}, ${COLORS.forest})` : '#D1D5DB'),
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                padding: '12px 22px',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.02em',
                cursor: (firing === true || !therapist || !client) ? 'not-allowed' : 'pointer',
                boxShadow: (therapist && client && firing !== true) ? '0 2px 8px rgba(42, 87, 65, 0.22)' : 'none',
              }}>
              {firing === true && 'Firing 12 May 26 emails...'}
              {firing === 'arm_may26' && 'Tap again to confirm fire'}
              {!firing && '🧪 Fire May 26 batch (real templates)'}
              {firing === 'arm_full' && '🧪 Fire May 26 batch (real templates)'}
            </button>

            <button
              type="button"
              onClick={fireAll}
              disabled={firing === true || !therapist || !client}
              style={{
                background: firing === true ? COLORS.inkSoft
                  : firing === 'arm_full' ? COLORS.gold
                  : '#fff',
                color: firing === 'arm_full' ? '#fff' : COLORS.ink,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 999,
                padding: '10px 18px',
                fontSize: 12,
                fontWeight: 700,
                cursor: (firing === true || !therapist || !client) ? 'not-allowed' : 'pointer',
              }}>
              {firing === true && 'Firing all touchpoints...'}
              {firing === 'arm_full' && 'Tap again to confirm full sweep'}
              {!firing && 'Full compliance sweep (legacy, all 28)'}
              {firing === 'arm_may26' && 'Full compliance sweep (legacy, all 28)'}
            </button>

            {fireResult && fireResult.batch !== 'may26' && (
              <div style={{
                fontSize: 12,
                color: COLORS.ink,
                background: COLORS.greenSoft,
                border: `1px solid ${COLORS.green}`,
                borderRadius: 999,
                padding: '6px 14px',
                fontWeight: 600,
              }}>
                ✓ Fired {fireResult.fired_count} of {fireResult.total}
                {fireResult.error_count > 0 && `, ${fireResult.error_count} errors`}
              </div>
            )}
          </div>

          {/* May 26 batch results panel */}
          {fireResult && fireResult.batch === 'may26' && (
            <div style={{
              marginTop: 14,
              background: '#fff',
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: 14,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: COLORS.inkSoft,
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10,
              }}>
                May 26 batch results
                {fireResult.booking_id && (
                  <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, marginLeft: 8, fontStyle: 'italic' }}>
                    booking: {fireResult.booking_id.slice(0, 8)}...
                  </span>
                )}
              </div>
              {fireResult.error && (
                <div style={{ color: '#991B1B', fontSize: 13, padding: 8, background: '#FEF2F2', borderRadius: 8 }}>
                  {fireResult.error}
                </div>
              )}
              {fireResult.results && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {fireResult.results.map(r => {
                    const sent = r.status === 'sent' && r.ok;
                    const skipped = r.status === 'skipped';
                    const failed = !sent && !skipped;
                    const dotColor = sent ? '#16A34A' : skipped ? '#D97706' : '#DC2626';
                    return (
                      <div key={r.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '6px 8px', borderRadius: 6,
                        fontSize: 12,
                      }}>
                        <span style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: dotColor, flexShrink: 0,
                        }} />
                        <span style={{ fontWeight: 700, color: COLORS.forestDeep, minWidth: 36 }}>{r.id}</span>
                        <span style={{ color: COLORS.ink, flex: 1, minWidth: 0 }}>{r.label}</span>
                        <span style={{
                          color: sent ? '#166534' : skipped ? '#92400E' : '#991B1B',
                          fontWeight: 600,
                          fontSize: 11,
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                        }}>{r.status}</span>
                        {r.reason && (
                          <span style={{ color: COLORS.inkSoft, fontSize: 11, fontStyle: 'italic' }}>{r.reason}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{
                marginTop: 10, padding: '8px 10px', background: COLORS.cream,
                borderRadius: 6, fontSize: 11, color: COLORS.inkSoft, lineHeight: 1.55,
              }}>
                Check inboxes: <strong>{client?.email}</strong> for C-series, <strong>{therapist?.email}</strong> for T12. Lapse rows (C14, C15, T10) will show 'skipped' unless Joy has lapse_checkins_enabled_at set in the therapists table.
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{
          background: '#fff',
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 20,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          fontSize: 12,
        }}>
          {Object.entries(CELL_COLORS).map(([key, c]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22, height: 22,
                borderRadius: 6,
                background: c.bg,
                color: c.fg,
                fontWeight: 700,
                fontSize: 13,
              }}>{c.icon}</span>
              <span style={{ color: COLORS.ink, fontWeight: 600, textTransform: 'capitalize' }}>{key}</span>
              <span style={{ color: COLORS.inkSoft }}>
                {key === 'red'    && 'never fired'}
                {key === 'orange' && 'failed/skipped'}
                {key === 'yellow' && 'sent, unconfirmed'}
                {key === 'green'  && 'verified'}
                {key === 'purple' && 'confirmed, no log'}
              </span>
            </div>
          ))}
          <button
            type="button"
            onClick={refreshLogs}
            style={{
              marginLeft: 'auto',
              background: COLORS.forest,
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* SIMPLE MATRIX (HK May 28 2026): one row per touchpoint with a
            quick visual on email/SMS/push status from the last 7 days of
            notification_log. Above the detailed compliance matrix below,
            which can still be used for deep inspection. */}
        <SimpleNotificationMatrix logsByKey={logsByKey} loading={loading} />

        {/* Matrix */}
        <div style={{
          background: '#fff',
          border: `1px solid ${COLORS.border}`,
          borderRadius: 14,
          overflowX: 'auto',
        }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900, fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '14px 16px', borderBottom: `2px solid ${COLORS.border}`, background: COLORS.cream, fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: COLORS.inkSoft, position: 'sticky', left: 0 }}>
                  Touchpoint
                </th>
                {COLS.map((col, idx) => {
                  const firstClient = ALL_CHANNELS_BY_AUDIENCE.client[0].channel;
                  const isClientBoundary = col.audience === 'client' && col.channel === firstClient;
                  // Count yellow (sent, unconfirmed) cells in this column
                  const yellowCount = NOTIFICATION_SPEC.reduce((n, spec) => {
                    if (spec.audience !== col.audience) return n;
                    if (!spec.channels.includes(col.channel)) return n;
                    const key = `${spec.eventType}__${col.audience}__${col.channel}`;
                    const log = logsByKey[key];
                    return (log?.status === 'sent' && !log?.confirmed_at) ? n + 1 : n;
                  }, 0);
                  // Compute destination for this column so HK can see at a glance
                  // where messages land. T-SMS goes to therapist.phone (not the
                  // Twilio sender), T-Email to therapist.email, T-Bell to the
                  // bell drawer (no external destination), T-Push to whichever
                  // device(s) the therapist has subscribed for PWA push. Client
                  // columns follow the same logic for the client side.
                  let destination = null;
                  if (col.audience === 'therapist') {
                    if (col.channel === 'app_alert') destination = 'bell drawer';
                    else if (col.channel === 'email') destination = therapist?.email || null;
                    else if (col.channel === 'sms') destination = therapist?.phone || '(not set)';
                    else if (col.channel === 'push') destination = 'subscribed devices';
                  } else if (col.audience === 'client') {
                    if (col.channel === 'email') destination = client?.email || null;
                    else if (col.channel === 'sms') destination = client?.phone || '(not set)';
                    else if (col.channel === 'push') destination = 'queued';
                  }
                  return (
                    <th key={`${col.audience}-${col.channel}`} style={{
                      padding: '10px 6px 8px',
                      borderBottom: `2px solid ${COLORS.border}`,
                      borderLeft: isClientBoundary ? `2px solid ${COLORS.border}` : 'none',
                      background: COLORS.cream,
                      textAlign: 'center',
                      minWidth: 100,
                      verticalAlign: 'top',
                    }}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        color: col.audience === 'therapist' ? COLORS.forest : COLORS.sage,
                        marginBottom: 2,
                      }}>
                        {col.short}
                      </div>
                      {destination && (
                        <div title={`Destination for ${col.short}: ${destination}`} style={{
                          fontSize: 9,
                          fontStyle: 'italic',
                          fontFamily: 'Georgia, serif',
                          color: COLORS.inkFade,
                          marginBottom: 5,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 120,
                        }}>
                          → {destination}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => bulkConfirmColumn(col)}
                        disabled={yellowCount === 0 || bulkConfirming}
                        title={yellowCount > 0 ? `Confirm all ${yellowCount} yellow cell${yellowCount === 1 ? '' : 's'} in this column` : 'No yellow cells to confirm'}
                        style={{
                          background: yellowCount > 0 ? COLORS.green : '#F3F4F6',
                          color: yellowCount > 0 ? '#fff' : COLORS.inkFade,
                          border: 'none',
                          borderRadius: 999,
                          padding: '3px 9px',
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: yellowCount > 0 ? 'pointer' : 'not-allowed',
                          letterSpacing: '0.02em',
                        }}>
                        {yellowCount > 0 ? `✓ ${yellowCount}` : '-'}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_SPEC.map((spec, rowIdx) => {
                const isOddRow = rowIdx % 2 === 1;
                return (
                  <tr key={spec.id} style={{ background: isOddRow ? '#FAFAF7' : '#fff' }}>
                    <td style={{ padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`, position: 'sticky', left: 0, background: 'inherit' }}>
                      <div style={{ fontWeight: 700, color: COLORS.forestDeep, fontSize: 13, marginBottom: 2 }}>
                        <span style={{ color: spec.series === 'C' ? COLORS.sage : COLORS.forest, marginRight: 8, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{spec.id}</span>
                        {spec.title}
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.inkSoft, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
                        {spec.when}
                      </div>
                    </td>
                    {COLS.map((col) => {
                      const applies = spec.audience === col.audience && spec.channels.includes(col.channel);
                      if (!applies) {
                        return (
                          <td key={`${spec.id}-${col.audience}-${col.channel}`} style={{
                            padding: '12px 8px',
                            borderBottom: `1px solid ${COLORS.border}`,
                            borderLeft: col.audience === 'client' && col.channel === ALL_CHANNELS_BY_AUDIENCE.client[0].channel ? `2px solid ${COLORS.border}` : 'none',
                            textAlign: 'center',
                            color: COLORS.inkFade,
                            fontSize: 11,
                          }}>
                            n/a
                          </td>
                        );
                      }
                      const key = `${spec.eventType}__${col.audience}__${col.channel}`;
                      const latestLog = logsByKey[key] || null;

                      // Special case: C-Push is queued (not yet built).
                      // Render as dimmed "queued" badge instead of a fired cell.
                      const isClientPush = col.audience === 'client' && col.channel === 'push' && CLIENT_PUSH_STATUS === 'queued';
                      if (isClientPush) {
                        return (
                          <td key={`${spec.id}-${col.audience}-${col.channel}`} style={{
                            padding: '8px',
                            borderBottom: `1px solid ${COLORS.border}`,
                            borderLeft: col.audience === 'client' && col.channel === ALL_CHANNELS_BY_AUDIENCE.client[0].channel ? `2px solid ${COLORS.border}` : 'none',
                            textAlign: 'center',
                          }}>
                            <span
                              title="Client push is on hold until a client login exists. Clients without an account have nothing installed to receive push to. See BLOCK_PLAN Macro #2 (Optional client portal)."
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 38, height: 38,
                                border: `1.5px dashed ${COLORS.inkFade}`,
                                borderRadius: 8,
                                background: '#F9FAFB',
                                color: COLORS.inkFade,
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: '0.04em',
                              }}>queued</span>
                          </td>
                        );
                      }

                      const state = cellState({
                        latestLog,
                        anyConfirmed: !!latestLog?.confirmed_at,
                      });
                      const cellColor = CELL_COLORS[state.color] || CELL_COLORS.red;
                      const isSelected = selectedCell?.specId === spec.id && selectedCell?.colKey === `${col.audience}-${col.channel}`;
                      return (
                        <td key={`${spec.id}-${col.audience}-${col.channel}`} style={{
                          padding: '8px',
                          borderBottom: `1px solid ${COLORS.border}`,
                          borderLeft: col.audience === 'client' && col.channel === ALL_CHANNELS_BY_AUDIENCE.client[0].channel ? `2px solid ${COLORS.border}` : 'none',
                          textAlign: 'center',
                        }}>
                          <button
                            type="button"
                            onClick={() => setSelectedCell({
                              specId: spec.id,
                              colKey: `${col.audience}-${col.channel}`,
                              spec, col, latestLog, state,
                            })}
                            title={state.tooltip}
                            aria-label={`${spec.id} ${col.short}: ${state.label}`}
                            style={{
                              width: 38, height: 38,
                              border: isSelected ? `2px solid ${COLORS.forestDeep}` : `1.5px solid ${cellColor.fg}`,
                              borderRadius: 8,
                              background: cellColor.bg,
                              color: cellColor.fg,
                              fontWeight: 700,
                              fontSize: 16,
                              cursor: 'pointer',
                              transition: 'transform 0.1s',
                            }}
                            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.92)'; }}
                            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                          >
                            {cellColor.icon}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footnote */}
        <div style={{ marginTop: 16, fontSize: 12, color: COLORS.inkFade, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
          Click any cell to see the latest log row and confirm receipt. The matrix only shows the latest send per cell; full history lives in the notification_log table.
        </div>
      </div>

      {/* ─── Side panel ──────────────────────────────────────────── */}
      {selectedCell && (
        <CellDetail
          selected={selectedCell}
          onClose={() => setSelectedCell(null)}
          onConfirm={() => confirmReceipt(selectedCell.latestLog?.id)}
          onUnconfirm={() => unconfirmReceipt(selectedCell.latestLog?.id)}
        />
      )}
    </div>
  );
}

// ─── Side panel component ─────────────────────────────────────────
function CellDetail({ selected, onClose, onConfirm, onUnconfirm }) {
  const { spec, col, latestLog, state } = selected;
  const cellColor = CELL_COLORS[state.color] || CELL_COLORS.red;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(31, 64, 48, 0.4)',
          zIndex: 100,
        }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 420,
        maxWidth: '100vw',
        background: '#fff',
        boxShadow: '-12px 0 32px rgba(31, 64, 48, 0.15)',
        zIndex: 101,
        padding: 28,
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: COLORS.sage, marginBottom: 6 }}>
              {spec.series === 'C' ? 'Client journey' : 'Therapist journey'} · {col.short}
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 22, color: COLORS.forestDeep, letterSpacing: '-0.012em', lineHeight: 1.2 }}>
              {spec.id}. {spec.title}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#fff',
              border: `1px solid ${COLORS.border}`,
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 12,
              color: COLORS.inkSoft,
              cursor: 'pointer',
              fontWeight: 600,
            }}>
            Close
          </button>
        </div>

        {/* Spec info */}
        <div style={{ background: COLORS.cream, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: COLORS.inkSoft, marginBottom: 4 }}>When it fires</div>
          <div style={{ fontSize: 14, color: COLORS.ink, marginBottom: 10 }}>{spec.when}</div>
          {spec.smsRationale && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: COLORS.inkSoft, marginBottom: 4 }}>Why this channel</div>
              <div style={{ fontSize: 14, color: COLORS.ink, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{spec.smsRationale}</div>
            </>
          )}
        </div>

        {/* Current state */}
        <div style={{
          background: cellColor.bg,
          border: `1.5px solid ${cellColor.fg}`,
          borderRadius: 10,
          padding: 16,
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{
              width: 30, height: 30,
              borderRadius: 8,
              background: '#fff',
              color: cellColor.fg,
              fontWeight: 700,
              fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1.5px solid ${cellColor.fg}`,
            }}>{cellColor.icon}</span>
            <div style={{ fontSize: 15, fontWeight: 700, color: cellColor.fg }}>{state.label}</div>
          </div>
          <div style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.5 }}>{state.tooltip}</div>
        </div>

        {/* Latest log row */}
        {latestLog ? (
          <div style={{ background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: COLORS.inkSoft, marginBottom: 10 }}>
              Latest log row
            </div>
            <KV k="When" v={new Date(latestLog.sent_at).toLocaleString()} />
            <KV k="Recipient" v={latestLog.recipient || '—'} />
            <KV k="Status" v={latestLog.status} />
            {latestLog.subject && <KV k="Subject" v={latestLog.subject} />}
            {latestLog.body_snippet && <KV k="Body snippet" v={latestLog.body_snippet} mono />}
            {latestLog.error_message && <KV k="Error" v={latestLog.error_message} mono />}
            {latestLog.confirmed_at && (
              <KV k="Confirmed" v={`${new Date(latestLog.confirmed_at).toLocaleString()}`} />
            )}
          </div>
        ) : (
          <div style={{ background: COLORS.redSoft, border: `1px solid ${COLORS.red}`, borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13, color: COLORS.ink }}>
            No notification_log row exists for this touchpoint × channel. The event has never fired (or the eventType in the firing code doesn't match the spec). To test: trigger the underlying event in the app, then refresh this dashboard.
          </div>
        )}

        {/* Confirmation controls */}
        {latestLog && (
          <div style={{ marginBottom: 16 }}>
            {!latestLog.confirmed_at ? (
              <button
                type="button"
                onClick={onConfirm}
                style={{
                  width: '100%',
                  background: COLORS.green,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '14px 18px',
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '0.01em',
                  cursor: 'pointer',
                }}>
                ✓ Yes, I received this on {col.short}
              </button>
            ) : (
              <button
                type="button"
                onClick={onUnconfirm}
                style={{
                  width: '100%',
                  background: '#fff',
                  color: COLORS.red,
                  border: `1.5px solid ${COLORS.red}`,
                  borderRadius: 10,
                  padding: '14px 18px',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}>
                Unmark confirmation
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function KV({ k, v, mono = false }) {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 13, marginBottom: 6, alignItems: 'baseline' }}>
      <div style={{ width: 90, color: COLORS.inkSoft, fontWeight: 600, flexShrink: 0 }}>{k}</div>
      <div style={{
        color: COLORS.ink,
        flex: 1,
        fontFamily: mono ? 'SF Mono, Monaco, Consolas, monospace' : 'inherit',
        fontSize: mono ? 12 : 13,
        wordBreak: 'break-word',
      }}>{v}</div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// SimpleNotificationMatrix
// ───────────────────────────────────────────────────────────────────────────
// HK May 28 2026: the full compliance matrix above is dense and never quite
// gave HK a clean PASS/FAIL read while testing. This simple view sits at the
// top of /founder/notifications: one row per touchpoint, three columns
// (Email / SMS / Push), color-coded by the latest notification_log status.
// HK confirms PASS manually by inbox after each test; the cell colors are
// just to show whether the function fired AT ALL.
//
// Cell key:
//   sent       -> green, with timestamp tooltip
//   skipped    -> gray (gated by pref, quiet hours, no_subscription, etc)
//   failed     -> red, with error tooltip
//   no log row -> white "untested"
//
// In-app bell (app_alert) is not shown here; the goal is the three channels
// HK actually verifies in inboxes/phone.

function SimpleNotificationMatrix({ logsByKey, loading }) {
  const CHANNELS = ['email', 'sms', 'push'];
  const PALETTE = {
    sent:     { bg: '#DCFCE7', border: '#86EFAC', fg: '#14532D', label: '✓' },
    skipped:  { bg: '#F3F4F6', border: '#D1D5DB', fg: '#4B5563', label: '–' },
    failed:   { bg: '#FEE2E2', border: '#FCA5A5', fg: '#7F1D1D', label: '✕' },
    untested: { bg: '#FFFFFF', border: '#E5E7EB', fg: '#9CA3AF', label: '·' },
  };

  function cellFor(spec, channel) {
    if (!spec.channels.includes(channel)) {
      return { state: 'untested', tone: PALETTE.untested, hint: 'Not used for this touchpoint' };
    }
    const key = `${spec.eventType}__${spec.audience}__${channel}`;
    const log = logsByKey?.[key];
    if (!log) return { state: 'untested', tone: PALETTE.untested, hint: 'No log row yet' };
    const tone = PALETTE[log.status] || PALETTE.untested;
    const when = log.sent_at ? new Date(log.sent_at).toLocaleString() : '';
    const hint = `${log.status}${log.error_message ? ': ' + log.error_message : ''}${when ? '\nLast: ' + when : ''}`;
    return { state: log.status, tone, hint };
  }

  // Aggregate the "Fired" cell across the three channels for this spec:
  // sent if any sent, failed if any failed, skipped if any skipped, else untested.
  function firedStateFor(spec) {
    let any = null;
    for (const ch of CHANNELS) {
      if (!spec.channels.includes(ch)) continue;
      const key = `${spec.eventType}__${spec.audience}__${ch}`;
      const log = logsByKey?.[key];
      if (!log) continue;
      // priority: failed > sent > skipped
      if (log.status === 'failed') return { tone: PALETTE.failed, log, channel: ch };
      if (log.status === 'sent') any = any || { tone: PALETTE.sent, log, channel: ch };
      if (log.status === 'skipped') any = any || { tone: PALETTE.skipped, log, channel: ch };
    }
    if (!any) return { tone: PALETTE.untested, log: null, channel: null };
    return any;
  }

  // localStorage-backed PASS/FAIL + notes per touchpoint. Keyed by spec.id so
  // it survives refresh while HK works through 30 bookings.
  const STORAGE_KEY = 'mbm.notif_verify.v1';
  const [verify, setVerify] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (_) { return {}; }
  });
  function setRow(id, patch) {
    setVerify(prev => {
      const next = { ...prev, [id]: { ...(prev[id] || {}), ...patch } };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (_) {}
      return next;
    });
  }
  function clearAll() {
    setVerify({});
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${COLORS.border}`,
      borderRadius: 14,
      padding: 0,
      marginBottom: 14,
      overflowX: 'auto',
    }}>
      <div style={{
        padding: '14px 18px 10px',
        borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, marginBottom: 4 }}>
            Notification check
          </div>
          <div style={{ fontSize: 12.5, color: COLORS.inkSoft, lineHeight: 1.5 }}>
            One row per touchpoint. "Fired" is auto from notification_log (just so we know it tried). "Landed" is you ticking after you actually saw the email or text. "Notes" is for copy issues or anything off. Your ticks and notes save locally.
          </div>
        </div>
        <button
          onClick={clearAll}
          style={{
            background: '#fff', border: `1px solid ${COLORS.border}`,
            borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600,
            color: COLORS.inkSoft, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
          Clear ticks
        </button>
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '10px 16px', borderBottom: `2px solid ${COLORS.border}`, background: COLORS.cream, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: COLORS.inkSoft }}>
              Touchpoint
            </th>
            <th style={{ textAlign: 'center', padding: '10px 8px', borderBottom: `2px solid ${COLORS.border}`, background: COLORS.cream, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: COLORS.inkSoft, width: 90 }}>
              Fired
            </th>
            <th style={{ textAlign: 'center', padding: '10px 8px', borderBottom: `2px solid ${COLORS.border}`, background: COLORS.cream, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: COLORS.inkSoft, width: 110 }}>
              Landed
            </th>
            <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `2px solid ${COLORS.border}`, background: COLORS.cream, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: COLORS.inkSoft }}>
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {NOTIFICATION_SPEC.map(spec => {
            const fired = firedStateFor(spec);
            const row = verify[spec.id] || {};
            const landed = row.landed || null; // 'yes' | 'no' | null
            const when = fired.log?.sent_at ? new Date(fired.log.sent_at).toLocaleString() : '';
            const firedHint = fired.log
              ? `${fired.log.status}${fired.log.error_message ? ': ' + fired.log.error_message : ''}\nChannel: ${fired.channel}\nLast: ${when}`
              : 'No log row yet';
            return (
              <tr key={spec.id}>
                <td style={{ padding: '8px 16px', borderBottom: `1px solid ${COLORS.border}`, fontSize: 13, verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 600, color: COLORS.ink }}>
                    <span style={{ color: COLORS.inkSoft, fontWeight: 500, marginRight: 6 }}>{spec.id}</span>
                    {spec.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: 2 }}>
                    <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 8 }}>{spec.audience}</span>
                    {spec.when}
                  </div>
                </td>
                <td title={firedHint} style={{
                  padding: '8px 8px',
                  textAlign: 'center',
                  borderBottom: `1px solid ${COLORS.border}`,
                  verticalAlign: 'top',
                }}>
                  <span style={{
                    display: 'inline-block', minWidth: 30, padding: '4px 8px',
                    background: fired.tone.bg, border: `1px solid ${fired.tone.border}`,
                    color: fired.tone.fg, borderRadius: 6, fontSize: 13, fontWeight: 700,
                  }}>{fired.tone.label}</span>
                </td>
                <td style={{
                  padding: '8px 8px',
                  textAlign: 'center',
                  borderBottom: `1px solid ${COLORS.border}`,
                  verticalAlign: 'top',
                }}>
                  <div style={{ display: 'inline-flex', gap: 4 }}>
                    <button
                      onClick={() => setRow(spec.id, { landed: landed === 'yes' ? null : 'yes' })}
                      title="Yes, email/SMS landed"
                      style={{
                        background: landed === 'yes' ? '#DCFCE7' : '#fff',
                        border: `1.5px solid ${landed === 'yes' ? '#16A34A' : COLORS.border}`,
                        color: landed === 'yes' ? '#14532D' : COLORS.inkSoft,
                        borderRadius: 6, padding: '4px 9px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}>✓</button>
                    <button
                      onClick={() => setRow(spec.id, { landed: landed === 'no' ? null : 'no' })}
                      title="No, did not land"
                      style={{
                        background: landed === 'no' ? '#FEE2E2' : '#fff',
                        border: `1.5px solid ${landed === 'no' ? '#DC2626' : COLORS.border}`,
                        color: landed === 'no' ? '#7F1D1D' : COLORS.inkSoft,
                        borderRadius: 6, padding: '4px 9px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}>✕</button>
                  </div>
                </td>
                <td style={{
                  padding: '8px 12px',
                  borderBottom: `1px solid ${COLORS.border}`,
                  verticalAlign: 'top',
                }}>
                  <input
                    type="text"
                    value={row.notes || ''}
                    onChange={e => setRow(spec.id, { notes: e.target.value })}
                    placeholder="copy issue, missing info, anything off"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      border: `1px solid ${COLORS.border}`, borderRadius: 6,
                      padding: '6px 9px', fontSize: 12.5, color: COLORS.ink,
                      fontFamily: 'inherit', outline: 'none', background: '#FAFAF7',
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {loading && (
        <div style={{ padding: '8px 18px', fontSize: 12, color: COLORS.inkSoft, borderTop: `1px solid ${COLORS.border}` }}>
          Refreshing…
        </div>
      )}
    </div>
  );
}
