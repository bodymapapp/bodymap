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

      // Also load the canonical Joy Client row (one with phone set)
      const { data: c } = await supabase
        .from('clients')
        .select('id, name, email, phone')
        .eq('email', 'bodymap01@gmail.com')
        .not('phone', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
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
    if (!window.confirm(`Fire all ${NOTIFICATION_SPEC.length} test notifications for ${therapist.full_name} to ${client.name}? You'll receive a flood of test messages on every channel.`)) {
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
            <div style={{ fontSize: 12, color: COLORS.inkSoft, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
              Therapist: <strong>{therapist.full_name || therapist.email}</strong> (<code>{therapist.id.slice(0, 8)}</code>)
              {therapist.twilio_phone_number ? ` · Twilio: ${therapist.twilio_phone_number}` : ' · Twilio NOT configured'}
              {client ? ` · Client: ${client.name} (${client.phone || 'no phone'})` : ' · Client not loaded'}
            </div>
          )}

          {/* Auto-fire CTA */}
          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={fireAll}
              disabled={firing || !therapist || !client}
              style={{
                background: firing ? COLORS.inkSoft : (therapist && client ? `linear-gradient(135deg, ${COLORS.forestDeep}, ${COLORS.forest})` : '#D1D5DB'),
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                padding: '12px 22px',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.02em',
                cursor: (firing || !therapist || !client) ? 'not-allowed' : 'pointer',
                boxShadow: (therapist && client && !firing) ? '0 2px 8px rgba(42, 87, 65, 0.22)' : 'none',
              }}>
              {firing ? 'Firing all 28 touchpoints…' : '🧪 Run full compliance test'}
            </button>
            {fireResult && (
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
                  return (
                    <th key={`${col.audience}-${col.channel}`} style={{
                      padding: '10px 6px 8px',
                      borderBottom: `2px solid ${COLORS.border}`,
                      borderLeft: isClientBoundary ? `2px solid ${COLORS.border}` : 'none',
                      background: COLORS.cream,
                      textAlign: 'center',
                      minWidth: 90,
                      verticalAlign: 'top',
                    }}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        color: col.audience === 'therapist' ? COLORS.forest : COLORS.sage,
                        marginBottom: 6,
                      }}>
                        {col.short}
                      </div>
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
                              title="Client push notifications require a separate booking-page PWA subscription flow. Queued in BLOCK_PLAN."
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
