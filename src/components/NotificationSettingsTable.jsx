// src/components/NotificationSettingsTable.jsx
//
// World-class notification settings UI, grouped by the 6 stages from
// the Client Lifetime Journey playbook. Replaces NotificationPrefsCard.
//
// Design principles:
// - 6 collapsed stage groups, expand to reveal touchpoints
// - SMS and Push columns visible but grayed with 'Coming soon' so
//   therapists see the roadmap
// - Master toggles for the 3 gated features (Intake reminders, Lapse
//   check-ins, Renewal alerts) prominent at the top
// - Pause All button for vacation mode
// - Each row: optimistic toggle with save indicator
// - Mobile-responsive: columns collapse to vertical card on phone
//
// HK May 26 2026 sign-off: aligned with the published article at
// /docs/CLIENT_LIFETIME_JOURNEY.html so the UI is a continuation of
// the philosophy, not a separate operational thing.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { NOTIFICATION_SPEC } from '../lib/notificationSpec';
import {
  JOURNEY_STAGES,
  TOUCHPOINT_TO_STAGE,
  defaultPrefsForTouchpoint,
} from '../lib/notificationStages';

const C = {
  forest: '#1C2B22',
  forestDark: '#1F2937',
  forestSoft: '#2A5741',
  sage: '#6B9E80',
  sageBg: '#EEF3EE',
  sageDeep: '#4A7A5C',
  cream: '#F9F5EE',
  creamAlt: '#FAFAF7',
  creamCard: '#F3EEE2',
  gold: '#C9A84C',
  goldBg: '#FAF3DC',
  goldInk: '#92660E',
  ink: '#3D4F43',
  inkSoft: '#6B7F72',
  inkMute: '#9CA3AF',
  lineFaint: '#E8E0D0',
  lineMute: '#D6D1C2',
  white: '#FFFFFF',
  rose: '#9F1239',
  roseBg: '#FDF2F2',
};

// ── Helpers ─────────────────────────────────────────────────────

function Pill({ children, tone = 'sage' }) {
  const bg = tone === 'gold' ? C.goldBg : tone === 'rose' ? C.roseBg : tone === 'mute' ? C.creamAlt : C.sageBg;
  const fg = tone === 'gold' ? C.goldInk : tone === 'rose' ? C.rose : tone === 'mute' ? C.inkMute : C.forestSoft;
  return (
    <span style={{
      display: 'inline-block',
      background: bg, color: fg,
      padding: '3px 9px', borderRadius: 20,
      fontSize: 10, fontWeight: 700,
      letterSpacing: '0.6px', textTransform: 'uppercase',
    }}>{children}</span>
  );
}

function Toggle({ on, onChange, disabled, dimReason }) {
  // iOS-style toggle. Dim + tooltip when disabled.
  return (
    <label
      title={disabled ? (dimReason || 'Unavailable') : (on ? 'On' : 'Off')}
      style={{
        position: 'relative', display: 'inline-block',
        width: 38, height: 22,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
      }}>
      <input
        type="checkbox"
        checked={on}
        disabled={disabled}
        onChange={(e) => { if (!disabled) onChange(e.target.checked); }}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
      <span style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: on ? C.sageDeep : C.lineMute,
        borderRadius: 22,
        transition: 'background 0.15s ease',
      }}>
        <span style={{
          position: 'absolute',
          left: on ? 18 : 2, top: 2,
          width: 18, height: 18,
          background: C.white, borderRadius: '50%',
          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
          transition: 'left 0.15s ease',
        }} />
      </span>
    </label>
  );
}

// ── Master toggle row ─────────────────────────────────────────

function MasterToggleRow({ label, note, enabledAt, onChange, saving }) {
  const isOn = !!enabledAt;
  const dateLabel = enabledAt ? new Date(enabledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <div style={{
      background: isOn ? C.sageBg : C.creamAlt,
      border: `1px solid ${isOn ? C.sage : C.lineFaint}`,
      borderRadius: 12, padding: '14px 16px',
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{ paddingTop: 1 }}>
        <Toggle on={isOn} onChange={onChange} disabled={saving} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: C.forestSoft,
          marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {label}
          {isOn && dateLabel && (
            <span style={{
              fontSize: 11, fontWeight: 500, color: C.inkSoft,
              letterSpacing: 0,
            }}>since {dateLabel}</span>
          )}
        </div>
        <div style={{
          fontSize: 12, color: C.inkSoft, lineHeight: 1.5,
        }}>
          {note}
        </div>
      </div>
    </div>
  );
}

// ── Row ─────────────────────────────────────────────────────

function TouchpointRow({ spec, prefs, onTogglePref, masterToggleOff, isMobile }) {
  const tpPrefs = prefs?.[spec.audience]?.[spec.id] || defaultPrefsForTouchpoint(spec.id);
  const emailOn = tpPrefs.email !== false;
  const isSmsExpected = spec.channels?.includes('sms');
  const isPushExpected = spec.channels?.includes('push');

  // Audience badge
  const audiencePill = spec.audience === 'client'
    ? <Pill tone="sage">Client</Pill>
    : <Pill tone="mute">You</Pill>;

  if (isMobile) {
    return (
      <div style={{
        padding: '14px 0',
        borderBottom: `1px solid ${C.lineFaint}`,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {audiencePill}
              <span style={{ fontSize: 14, fontWeight: 600, color: C.forestDark }}>{spec.title}</span>
            </div>
            {spec.when && (
              <div style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.45 }}>{spec.when}</div>
            )}
          </div>
          <div style={{ paddingTop: 2 }}>
            <Toggle
              on={emailOn && !masterToggleOff}
              onChange={(v) => onTogglePref(spec, 'email', v)}
              disabled={masterToggleOff}
              dimReason="Enable the master toggle above"
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Pill tone="mute">📧 Email {emailOn && !masterToggleOff ? 'on' : 'off'}</Pill>
          {isSmsExpected && <Pill tone="mute">💬 SMS coming soon</Pill>}
          {isPushExpected && <Pill tone="mute">🔔 Push coming soon</Pill>}
        </div>
      </div>
    );
  }

  return (
    <tr style={{ borderBottom: `1px solid ${C.lineFaint}` }}>
      <td style={{ padding: '14px 12px', verticalAlign: 'top' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          {audiencePill}
          <span style={{ fontSize: 14, fontWeight: 600, color: C.forestDark }}>{spec.title}</span>
        </div>
        {spec.when && (
          <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>{spec.when}</div>
        )}
      </td>
      <td style={{ padding: '14px 8px', verticalAlign: 'middle', textAlign: 'center', width: 70 }}>
        <Toggle
          on={emailOn && !masterToggleOff}
          onChange={(v) => onTogglePref(spec, 'email', v)}
          disabled={masterToggleOff}
          dimReason="Enable the master toggle above"
        />
      </td>
      <td style={{ padding: '14px 8px', verticalAlign: 'middle', textAlign: 'center', width: 90 }}>
        {isSmsExpected ? (
          <Toggle on={false} disabled dimReason="SMS coming soon" />
        ) : (
          <span style={{ fontSize: 11, color: C.inkMute }}>-</span>
        )}
      </td>
      <td style={{ padding: '14px 8px', verticalAlign: 'middle', textAlign: 'center', width: 90 }}>
        {isPushExpected ? (
          <Toggle on={false} disabled dimReason="Push coming soon" />
        ) : (
          <span style={{ fontSize: 11, color: C.inkMute }}>-</span>
        )}
      </td>
    </tr>
  );
}

// ── Stage group ─────────────────────────────────────────────

function StageGroup({ stage, touchpoints, prefs, expanded, onToggle, onTogglePref, masterToggleOff, isMobile }) {
  const activeCount = useMemo(() => touchpoints.filter(t => {
    const tpPrefs = prefs?.[t.audience]?.[t.id] || defaultPrefsForTouchpoint(t.id);
    return tpPrefs.email !== false;
  }).length, [touchpoints, prefs]);

  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.lineFaint}`,
      borderRadius: 14,
      marginBottom: 12,
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '18px 20px',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontFamily: 'inherit',
        }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
            <h3 style={{
              margin: 0, fontFamily: "Georgia, serif",
              fontSize: 18, fontWeight: 700, color: C.forest,
              letterSpacing: '-0.2px',
            }}>{stage.label}</h3>
            <span style={{ fontSize: 12, color: C.inkSoft }}>
              · {stage.eyebrow}
            </span>
          </div>
          {!expanded && (
            <div style={{ fontSize: 12, color: C.inkSoft }}>
              {activeCount} of {touchpoints.length} active
              {masterToggleOff && ` · master toggle off`}
            </div>
          )}
          {expanded && (
            <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.5, marginTop: 4 }}>
              {stage.description}
            </div>
          )}
        </div>
        <div style={{
          fontSize: 18, color: C.sage,
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s ease',
        }}>⌄</div>
      </button>

      {expanded && (
        <div style={{ padding: isMobile ? '0 16px 16px' : '0 8px 8px' }}>
          {isMobile ? (
            <div>{touchpoints.map(t => (
              <TouchpointRow key={t.id} spec={t} prefs={prefs} onTogglePref={onTogglePref} masterToggleOff={masterToggleOff} isMobile />
            ))}</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.inkMute, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Touchpoint</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: C.inkMute, letterSpacing: '0.8px', textTransform: 'uppercase', width: 70 }}>Email</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: C.inkMute, letterSpacing: '0.8px', textTransform: 'uppercase', width: 90 }}>SMS</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: C.inkMute, letterSpacing: '0.8px', textTransform: 'uppercase', width: 90 }}>Push</th>
                </tr>
              </thead>
              <tbody>
                {touchpoints.map(t => (
                  <TouchpointRow key={t.id} spec={t} prefs={prefs} onTogglePref={onTogglePref} masterToggleOff={masterToggleOff} />
                ))}
              </tbody>
            </table>
          )}
          {!isMobile && (
            <div style={{
              fontSize: 11, color: C.inkMute, padding: '10px 12px 4px',
              fontStyle: 'italic',
            }}>
              SMS and Push delivery for client notifications is coming soon, after the client portal ships.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────

export default function NotificationSettingsTable({ therapist }) {
  const [prefs, setPrefs] = useState({});
  const [enabledAts, setEnabledAts] = useState({
    intake_reminders_enabled_at: null,
    lapse_checkins_enabled_at: null,
    renewal_alerts_enabled_at: null,
  });
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({ first_contact: false, first_session: false, becoming_regular: false, lifetime_client: false, off_ramps: false, lapse_return: false });
  const [isMobile, setIsMobile] = useState(false);

  // Track viewport
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load prefs + opt-in timestamps
  useEffect(() => {
    if (!therapist?.id) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('therapists')
        .select('notification_prefs, intake_reminders_enabled_at, lapse_checkins_enabled_at, renewal_alerts_enabled_at, notifications_paused')
        .eq('id', therapist.id)
        .maybeSingle();
      if (!alive) return;
      setPrefs(data?.notification_prefs || {});
      setEnabledAts({
        intake_reminders_enabled_at: data?.intake_reminders_enabled_at || null,
        lapse_checkins_enabled_at: data?.lapse_checkins_enabled_at || null,
        renewal_alerts_enabled_at: data?.renewal_alerts_enabled_at || null,
      });
      setPaused(!!data?.notifications_paused);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [therapist?.id]);

  const togglePref = useCallback(async (spec, channel, value) => {
    // Optimistic update
    const next = JSON.parse(JSON.stringify(prefs || {}));
    if (!next[spec.audience]) next[spec.audience] = {};
    if (!next[spec.audience][spec.id]) next[spec.audience][spec.id] = defaultPrefsForTouchpoint(spec.id);
    next[spec.audience][spec.id][channel] = value;
    setPrefs(next);
    await supabase.from('therapists').update({ notification_prefs: next }).eq('id', therapist.id);
  }, [prefs, therapist?.id]);

  const toggleMaster = useCallback(async (column, value) => {
    setSaving(true);
    const newValue = value ? new Date().toISOString() : null;
    setEnabledAts(prev => ({ ...prev, [column]: newValue }));
    await supabase.from('therapists').update({ [column]: newValue }).eq('id', therapist.id);
    setSaving(false);
  }, [therapist?.id]);

  const togglePauseAll = useCallback(async () => {
    setSaving(true);
    const newValue = !paused;
    setPaused(newValue);
    await supabase.from('therapists').update({ notifications_paused: newValue }).eq('id', therapist.id);
    setSaving(false);
  }, [paused, therapist?.id]);

  const totalActive = useMemo(() => {
    let count = 0;
    for (const tp of NOTIFICATION_SPEC) {
      const tpPrefs = prefs?.[tp.audience]?.[tp.id] || defaultPrefsForTouchpoint(tp.id);
      if (tpPrefs.email !== false) count++;
    }
    return count;
  }, [prefs]);

  if (loading) {
    return <div style={{ padding: 24, color: C.inkSoft, fontSize: 14 }}>Loading your notification preferences...</div>;
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Hero */}
      <div style={{ marginBottom: 22 }}>
        <h2 style={{
          fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 700,
          color: C.forest, letterSpacing: '-0.3px', margin: '0 0 6px',
        }}>Your notifications</h2>
        <p style={{ fontSize: 13, color: C.inkSoft, margin: 0, lineHeight: 1.55 }}>
          Built around the journey clients take with you, from first contact to lifetime relationship. Read the full playbook at <a href="/docs/CLIENT_LIFETIME_JOURNEY.html" style={{ color: C.forestSoft }}>Journey →</a>
        </p>
      </div>

      {/* Pause All banner */}
      {paused && (
        <div style={{
          background: C.roseBg, border: `1px solid ${C.rose}`,
          borderRadius: 12, padding: '14px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.rose, marginBottom: 2 }}>All notifications paused</div>
            <div style={{ fontSize: 12, color: C.inkSoft }}>No emails will go out to clients or to you until you resume.</div>
          </div>
          <button
            type="button"
            onClick={togglePauseAll}
            disabled={saving}
            style={{
              background: C.rose, color: C.white, border: 'none',
              padding: '8px 14px', borderRadius: 8,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>Resume</button>
        </div>
      )}

      {/* Summary + master controls */}
      <div style={{
        background: C.creamCard, borderRadius: 14, padding: 20, marginBottom: 22,
        border: `1px solid ${C.lineFaint}`,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.inkMute, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 4 }}>Quick controls</div>
            <div style={{ fontSize: 13, color: C.ink }}>
              <strong style={{ color: C.forestSoft }}>{totalActive}</strong> of {NOTIFICATION_SPEC.length} touchpoints active
            </div>
          </div>
          {!paused && (
            <button
              type="button"
              onClick={togglePauseAll}
              disabled={saving}
              title="Pause all notifications, useful when you're on vacation"
              style={{
                background: C.white, border: `1px solid ${C.lineMute}`,
                color: C.ink, padding: '8px 14px', borderRadius: 8,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>Pause all</button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {JOURNEY_STAGES.filter(s => s.masterToggleKey).map(stage => (
            <MasterToggleRow
              key={stage.masterToggleKey}
              label={stage.masterToggleLabel}
              note={stage.masterToggleNote}
              enabledAt={enabledAts[stage.masterToggleKey]}
              onChange={(v) => toggleMaster(stage.masterToggleKey, v)}
              saving={saving}
            />
          ))}
          <MasterToggleRow
            label="Renewal alerts for memberships"
            note="When ON, you get a heads-up email 7 days before a membership auto-renews. Only applies to memberships created after you turn this on, never retroactive."
            enabledAt={enabledAts.renewal_alerts_enabled_at}
            onChange={(v) => toggleMaster('renewal_alerts_enabled_at', v)}
            saving={saving}
          />
        </div>
      </div>

      {/* Stage groups */}
      {JOURNEY_STAGES.map(stage => {
        const stageTouchpoints = NOTIFICATION_SPEC.filter(t => (TOUCHPOINT_TO_STAGE[t.id] || 'off_ramps') === stage.key);
        if (stageTouchpoints.length === 0) return null;
        const masterToggleOff = stage.masterToggleKey && !enabledAts[stage.masterToggleKey];
        return (
          <StageGroup
            key={stage.key}
            stage={stage}
            touchpoints={stageTouchpoints}
            prefs={prefs}
            expanded={!!expanded[stage.key]}
            onToggle={() => setExpanded(prev => ({ ...prev, [stage.key]: !prev[stage.key] }))}
            onTogglePref={togglePref}
            masterToggleOff={masterToggleOff}
            isMobile={isMobile}
          />
        );
      })}

      {/* Foot note */}
      <div style={{
        marginTop: 18, padding: '14px 16px',
        background: C.sageBg, border: `1px solid ${C.sage}`,
        borderRadius: 10, fontSize: 12, color: C.forestSoft, lineHeight: 1.55,
      }}>
        <strong>How this is different.</strong> Most platforms hand you a flat list of toggles. We organize around the journey your clients actually take with you, with safety gates so turning anything on never sweeps your existing client history. You decide when each piece of the relationship starts.
      </div>
    </div>
  );
}
