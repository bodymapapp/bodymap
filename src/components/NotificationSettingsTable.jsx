// src/components/NotificationSettingsTable.jsx
//
// Mockup B production build (HK chose May 26 2026): unified single
// table, stage rows as dividers, with a brief 'why' line under each
// touchpoint so the therapist understands why each notification
// exists for client or therapist wellbeing.
//
// Replaces the prior collapsible-card version. Faster scan, no
// click-to-discover, all 30 touchpoints visible in one table.
//
// Design principles:
// - Single table, stages as gray-band rows
// - Each touchpoint: title + when + why (3 lines)
// - Email toggle per row (live), SMS + Push grayed with Coming Soon
// - Master toggles + Pause All in a quick controls strip above
// - Mobile: rows stack as cards
//
// HK May 26 2026: 'we have to talk briefly about why that notification
// is needed for either therapist or client growth and well being'

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

// ── Reusable bits ─────────────────────────────────────────────

function Pill({ children, tone = 'sage' }) {
  const bg = tone === 'gold' ? C.goldBg : tone === 'rose' ? C.roseBg : tone === 'mute' ? C.creamAlt : C.sageBg;
  const fg = tone === 'gold' ? C.goldInk : tone === 'rose' ? C.rose : tone === 'mute' ? C.inkSoft : C.forestSoft;
  return (
    <span style={{
      display: 'inline-block',
      background: bg, color: fg,
      padding: '2px 8px', borderRadius: 12,
      fontSize: 10, fontWeight: 700,
      letterSpacing: '0.6px', textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function Toggle({ on, onChange, disabled, size = 'normal' }) {
  const w = size === 'sm' ? 32 : 38;
  const h = size === 'sm' ? 18 : 22;
  const knob = size === 'sm' ? 14 : 18;
  return (
    <label
      style={{
        position: 'relative', display: 'inline-block',
        width: w, height: h,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1,
      }}>
      <input
        type="checkbox"
        checked={on}
        disabled={disabled}
        onChange={(e) => { if (!disabled) onChange(e.target.checked); }}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
      <span style={{
        position: 'absolute', inset: 0,
        background: on ? C.sageDeep : C.lineMute,
        borderRadius: 22,
        transition: 'background 0.15s ease',
      }}>
        <span style={{
          position: 'absolute',
          left: on ? w - knob - 2 : 2, top: 2,
          width: knob, height: knob,
          background: C.white, borderRadius: '50%',
          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
          transition: 'left 0.15s ease',
        }} />
      </span>
    </label>
  );
}

// ── Quick controls strip ─────────────────────────────────────

function MasterToggle({ label, note, enabledAt, onChange, saving }) {
  const isOn = !!enabledAt;
  const dateLabel = enabledAt ? new Date(enabledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <div style={{
      background: isOn ? C.sageBg : C.creamAlt,
      border: `1px solid ${isOn ? C.sage : C.lineFaint}`,
      borderRadius: 10, padding: '12px 14px',
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{ paddingTop: 1 }}>
        <Toggle on={isOn} onChange={onChange} disabled={saving} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: C.forestSoft,
          marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
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
          fontSize: 11, color: C.inkSoft, lineHeight: 1.5,
        }}>
          {note}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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

  // Group touchpoints by stage in the journey order, then build a
  // flat list of [stage_header, ...touchpoints, stage_header, ...]
  // for the single unified table.
  const groupedTouchpoints = useMemo(() => {
    return JOURNEY_STAGES.map(stage => {
      const items = NOTIFICATION_SPEC.filter(t => (TOUCHPOINT_TO_STAGE[t.id] || 'off_ramps') === stage.key);
      return { stage, items };
    }).filter(g => g.items.length > 0);
  }, []);

  const totalActive = useMemo(() => {
    let count = 0;
    for (const tp of NOTIFICATION_SPEC) {
      const tpPrefs = prefs?.[tp.audience]?.[tp.id] || defaultPrefsForTouchpoint(tp.id);
      if (tpPrefs.email !== false) count++;
    }
    return count;
  }, [prefs]);

  const isStageMasterOff = (stage) => {
    return stage.masterToggleKey && !enabledAts[stage.masterToggleKey];
  };

  if (loading) {
    return <div style={{ padding: 24, color: C.inkSoft, fontSize: 14 }}>Loading your notification preferences...</div>;
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Hero */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{
          fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700,
          color: C.forest, letterSpacing: '-0.2px', margin: '0 0 4px',
        }}>Your notifications</h2>
        <p style={{ fontSize: 13, color: C.inkSoft, margin: 0, lineHeight: 1.55 }}>
          Every message your clients and you receive, in one table. Read the philosophy at <a href="/docs/CLIENT_LIFETIME_JOURNEY.html" style={{ color: C.forestSoft }}>Journey →</a>
        </p>
      </div>

      {/* Pause All banner (when paused) */}
      {paused && (
        <div style={{
          background: C.roseBg, border: `1px solid ${C.rose}`,
          borderRadius: 10, padding: '12px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.rose, marginBottom: 2 }}>All notifications paused</div>
            <div style={{ fontSize: 11, color: C.inkSoft }}>No emails will go out to clients or to you until you resume.</div>
          </div>
          <button
            type="button"
            onClick={togglePauseAll}
            disabled={saving}
            style={{
              background: C.rose, color: C.white, border: 'none',
              padding: '7px 13px', borderRadius: 8,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>Resume</button>
        </div>
      )}

      {/* Quick controls strip: stats + Pause All + master toggles */}
      <div style={{
        background: C.creamCard, borderRadius: 12, padding: 16, marginBottom: 18,
        border: `1px solid ${C.lineFaint}`,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
            <div>
              <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Georgia, serif', color: C.forestSoft }}>{totalActive}</span>
              <span style={{ fontSize: 13, color: C.inkSoft, marginLeft: 4 }}>of {NOTIFICATION_SPEC.length} active</span>
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
                color: C.ink, padding: '7px 13px', borderRadius: 8,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>Pause all</button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {JOURNEY_STAGES.filter(s => s.masterToggleKey).map(stage => (
            <MasterToggle
              key={stage.masterToggleKey}
              label={stage.masterToggleLabel}
              note={stage.masterToggleNote}
              enabledAt={enabledAts[stage.masterToggleKey]}
              onChange={(v) => toggleMaster(stage.masterToggleKey, v)}
              saving={saving}
            />
          ))}
          <MasterToggle
            label="Renewal alerts for memberships"
            note="When ON, you get a heads-up email 7 days before a membership auto-renews. Only applies to memberships created after you turn this on, never retroactive."
            enabledAt={enabledAts.renewal_alerts_enabled_at}
            onChange={(v) => toggleMaster('renewal_alerts_enabled_at', v)}
            saving={saving}
          />
        </div>
      </div>

      {/* THE TABLE */}
      {isMobile ? (
        // Mobile: stacked row cards with stage dividers
        <div>
          {groupedTouchpoints.map(({ stage, items }) => {
            const masterOff = isStageMasterOff(stage);
            return (
              <div key={stage.key}>
                <div style={{
                  background: C.creamCard, padding: '10px 14px',
                  borderRadius: '10px 10px 0 0', marginTop: 14,
                  fontFamily: 'Georgia, serif', fontWeight: 700,
                  fontSize: 14, color: C.forestDark,
                }}>
                  {stage.label}
                  <span style={{ fontFamily: '-apple-system, sans-serif', fontWeight: 400, fontSize: 11, color: C.inkSoft, marginLeft: 8 }}>
                    {stage.eyebrow}
                  </span>
                </div>
                <div style={{ background: C.white, border: `1px solid ${C.lineFaint}`, borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
                  {items.map((spec, idx) => {
                    const tpPrefs = prefs?.[spec.audience]?.[spec.id] || defaultPrefsForTouchpoint(spec.id);
                    const emailOn = tpPrefs.email !== false;
                    return (
                      <div key={spec.id} style={{
                        padding: '12px 14px',
                        borderTop: idx > 0 ? `1px solid ${C.lineFaint}` : 'none',
                        opacity: masterOff ? 0.55 : 1,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                              <Pill tone={spec.audience === 'client' ? 'sage' : 'mute'}>
                                {spec.audience === 'client' ? 'Client' : 'You'}
                              </Pill>
                              <span style={{
                                fontSize: 10, fontWeight: 700, color: spec.series === 'C' ? C.sage : C.forestSoft,
                                fontFamily: 'Georgia, serif', fontStyle: 'italic',
                                letterSpacing: '0.4px',
                              }}>{spec.id}</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.forestDark }}>{spec.title}</span>
                            </div>
                            {spec.when && (
                              <div style={{ fontSize: 11, color: C.inkMute, marginBottom: 4 }}>{spec.when}</div>
                            )}
                            {spec.why && (
                              <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, fontStyle: 'italic' }}>{spec.why}</div>
                            )}
                          </div>
                          <div style={{ paddingTop: 2 }}>
                            <Toggle
                              on={emailOn && !masterOff}
                              onChange={(v) => togglePref(spec, 'email', v)}
                              disabled={masterOff}
                              size="sm"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Desktop: unified table
        <div style={{
          background: C.white, border: `1px solid ${C.lineFaint}`,
          borderRadius: 12, overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.creamCard }}>
                <th style={{
                  padding: '10px 16px', textAlign: 'left',
                  fontSize: 10, fontWeight: 700, color: C.inkMute,
                  letterSpacing: '0.8px', textTransform: 'uppercase',
                }}>Touchpoint</th>
                <th style={{
                  padding: '10px 8px', textAlign: 'center',
                  fontSize: 10, fontWeight: 700, color: C.inkMute,
                  letterSpacing: '0.8px', textTransform: 'uppercase', width: 70,
                }}>Audience</th>
                <th style={{
                  padding: '10px 8px', textAlign: 'center',
                  fontSize: 10, fontWeight: 700, color: C.inkMute,
                  letterSpacing: '0.8px', textTransform: 'uppercase', width: 70,
                }}>Email</th>
                <th style={{
                  padding: '10px 8px', textAlign: 'center',
                  fontSize: 10, fontWeight: 700, color: C.inkMute,
                  letterSpacing: '0.8px', textTransform: 'uppercase', width: 90,
                }}>SMS</th>
                <th style={{
                  padding: '10px 8px', textAlign: 'center',
                  fontSize: 10, fontWeight: 700, color: C.inkMute,
                  letterSpacing: '0.8px', textTransform: 'uppercase', width: 90,
                }}>Push</th>
              </tr>
            </thead>
            <tbody>
              {groupedTouchpoints.map(({ stage, items }) => {
                const masterOff = isStageMasterOff(stage);
                const activeCount = items.filter(t => {
                  if (masterOff) return false;
                  const tpPrefs = prefs?.[t.audience]?.[t.id] || defaultPrefsForTouchpoint(t.id);
                  return tpPrefs.email !== false;
                }).length;
                return (
                  <React.Fragment key={stage.key}>
                    <tr>
                      <td colSpan={5} style={{
                        background: C.creamCard,
                        padding: '10px 16px',
                        fontFamily: 'Georgia, serif',
                        fontWeight: 700,
                        color: C.forestDark,
                        fontSize: 14,
                        borderTop: `1px solid ${C.lineFaint}`,
                      }}>
                        {stage.label}
                        <span style={{
                          fontFamily: '-apple-system, sans-serif',
                          fontWeight: 400, color: C.inkSoft, fontSize: 11,
                          marginLeft: 10,
                        }}>
                          {stage.eyebrow} · {activeCount} of {items.length} active
                          {masterOff && ` · master toggle off`}
                        </span>
                      </td>
                    </tr>
                    {items.map(spec => {
                      const tpPrefs = prefs?.[spec.audience]?.[spec.id] || defaultPrefsForTouchpoint(spec.id);
                      const emailOn = tpPrefs.email !== false;
                      const showsSms = spec.channels?.includes('sms');
                      const showsPush = spec.channels?.includes('push');
                      return (
                        <tr key={spec.id} style={{
                          borderTop: `1px solid ${C.lineFaint}`,
                          opacity: masterOff ? 0.55 : 1,
                        }}>
                          <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                              <span style={{
                                fontSize: 10, fontWeight: 700, color: spec.series === 'C' ? C.sage : C.forestSoft,
                                fontFamily: 'Georgia, serif', fontStyle: 'italic',
                                letterSpacing: '0.4px',
                              }}>{spec.id}</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.forestDark }}>
                                {spec.title}
                              </span>
                            </div>
                            {spec.when && (
                              <div style={{ fontSize: 11, color: C.inkMute, marginBottom: 4 }}>{spec.when}</div>
                            )}
                            {spec.why && (
                              <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, fontStyle: 'italic', maxWidth: 480 }}>
                                {spec.why}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                            <Pill tone={spec.audience === 'client' ? 'sage' : 'mute'}>
                              {spec.audience === 'client' ? 'Client' : 'You'}
                            </Pill>
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <Toggle
                              on={emailOn && !masterOff}
                              onChange={(v) => togglePref(spec, 'email', v)}
                              disabled={masterOff}
                            />
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                            {showsSms ? (
                              <div title="SMS coming soon">
                                <Toggle on={false} disabled />
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: C.inkMute }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                            {showsPush ? (
                              <div title="Push coming soon">
                                <Toggle on={false} disabled />
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: C.inkMute }}>-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Foot: how this is different */}
      <div style={{
        marginTop: 18, padding: '14px 16px',
        background: C.sageBg, border: `1px solid ${C.sage}`,
        borderRadius: 10, fontSize: 12, color: C.forestSoft, lineHeight: 1.55,
      }}>
        <strong>How this is different.</strong> Most platforms hand you a flat list of toggles with no explanation. We show you what each notification does for your client's wellbeing or your practice, so you can choose with intent. Master toggles include safety gates so turning anything on never sweeps your existing client history.
      </div>
    </div>
  );
}
