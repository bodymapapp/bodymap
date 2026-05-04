// src/components/CycleScheduling.jsx
//
// Cycle-aligned scheduling settings panel. Optional feature for therapists
// who plan their work around their menstrual cycle phases.
//
// When the master toggle is ON, the public booking page filters services
// to only those tagged for the therapist's current cycle phase. The client
// never sees phase names — they just see fewer or different services on
// certain days. This keeps the therapist's cycle info private.
//
// Defaults are pre-filled (28-day cycle with standard cycle-syncing
// community ranges). The therapist can customize the ranges if her cycle
// behaves differently. Same UX pattern as service prices/durations:
// sensible defaults already there, editable inline.
//
// Phase-tagging happens in ServicesAndAvailability (separate file) — this
// component handles the master toggle, cycle dates, and ranges only.

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { phaseFromDate, defaultPhaseRanges } from '../lib/cycleScheduling';

const C = {
  forest: '#2A5741',
  sage:   '#5C7A4F',
  ink:    '#1F2937',
  gray:   '#6B7280',
  light:  '#E5E7EB',
  cream:  '#FAF6EE',
  beige:  '#F5EFE0',
  rose:   '#A87468',
};

// Phase metadata: human label, soft swatch color, brief description.
// Order matters — display in cycle order.
const PHASES = [
  { key: 'menstrual',  label: 'Menstrual',  color: '#C99488', desc: 'Days 1–5 typically. Rest, gentler work.' },
  { key: 'follicular', label: 'Follicular', color: '#D4A578', desc: 'Days 6–13. Energy returning, deeper work.' },
  { key: 'ovulatory',  label: 'Ovulatory',  color: '#9DAA85', desc: 'Days 14–17. Peak energy, full schedule.' },
  { key: 'luteal',     label: 'Luteal',     color: '#A87468', desc: 'Days 18–end. Winding down, gentler work.' },
];

export default function CycleScheduling({ therapist }) {
  const [enabled, setEnabled] = useState(!!therapist?.cycle_scheduling_enabled);
  const [startDate, setStartDate] = useState(therapist?.cycle_start_date || '');
  const [avgLength, setAvgLength] = useState(therapist?.cycle_avg_length || 28);
  const [overrides, setOverrides] = useState(therapist?.cycle_phase_overrides || null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  // Compute default phase ranges live from current cycle length so the
  // therapist sees the math update as she changes the input.
  const defaults = defaultPhaseRanges(avgLength);
  const effective = overrides || defaults;

  // Save with debounce when any input changes.
  const save = useCallback(async (patch) => {
    if (!therapist?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('therapists')
      .update(patch)
      .eq('id', therapist.id);
    setSaving(false);
    if (error) {
      console.error('CycleScheduling save failed:', error);
      return;
    }
    setSavedAt(Date.now());
  }, [therapist?.id]);

  // Persist toggle changes immediately. Other inputs save on blur.
  useEffect(() => {
    if (enabled !== !!therapist?.cycle_scheduling_enabled) {
      save({ cycle_scheduling_enabled: enabled });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Show "today you are in: X" so therapist sees what clients will see.
  let currentPhase = null;
  if (enabled && startDate && avgLength) {
    try {
      currentPhase = phaseFromDate(new Date(), startDate, avgLength, effective);
    } catch { /* no-op */ }
  }

  const handleAdvancedChange = (key, value) => {
    const v = parseInt(value, 10);
    if (Number.isNaN(v)) return;
    const next = { ...effective, [key]: v };
    setOverrides(next);
    save({ cycle_phase_overrides: next });
  };

  const resetRanges = () => {
    setOverrides(null);
    save({ cycle_phase_overrides: null });
  };

  return (
    <div style={{ padding: '4px 4px' }}>
      <p style={{ fontSize: 12, color: C.gray, margin: '0 0 14px 0', lineHeight: 1.5 }}>
        Many practitioners align their work with their menstrual cycle. When you turn this on, your booking page will only show the services you have tagged for the phase you are in that day. Clients never see your cycle info, just the services available that week.
      </p>

      {/* Master toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px',
        background: enabled ? '#F0FDF4' : '#F9FAFB',
        border: `1.5px solid ${enabled ? '#86EFAC' : C.light}`,
        borderRadius: 10,
        marginBottom: 14,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
            Cycle-aligned scheduling
          </div>
          <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
            {enabled ? 'On — your services are filtered by phase' : 'Off — all services shown every day'}
          </div>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          aria-label={enabled ? 'Turn off cycle scheduling' : 'Turn on cycle scheduling'}
          style={{
            position: 'relative',
            width: 48, height: 26,
            borderRadius: 999,
            background: enabled ? C.forest : '#D1D5DB',
            border: 'none', cursor: 'pointer',
            transition: 'background 0.18s',
            flexShrink: 0,
          }}>
          <span style={{
            position: 'absolute',
            top: 3, left: enabled ? 25 : 3,
            width: 20, height: 20, borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.18s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}/>
        </button>
      </div>

      {enabled && (
        <>
          {/* Cycle inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 4 }}>
                When did your last cycle start?
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onBlur={() => save({ cycle_start_date: startDate || null })}
                style={{
                  width: '100%', maxWidth: 200,
                  padding: '8px 10px',
                  border: `1.5px solid ${C.light}`,
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: 'system-ui',
                }}
              />
              <p style={{ fontSize: 11, color: C.gray, margin: '4px 0 0 0' }}>
                Day 1 is the first day of your period. Update this each month so the math stays accurate.
              </p>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 4 }}>
                How long is your cycle on average?
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min="18" max="60"
                  value={avgLength}
                  onChange={(e) => setAvgLength(parseInt(e.target.value, 10) || 28)}
                  onBlur={() => save({ cycle_avg_length: avgLength })}
                  style={{
                    width: 80,
                    padding: '8px 10px',
                    border: `1.5px solid ${C.light}`,
                    borderRadius: 8,
                    fontSize: 14,
                    fontFamily: 'system-ui',
                  }}
                />
                <span style={{ fontSize: 13, color: C.gray }}>days (most are 28)</span>
              </div>
            </div>
          </div>

          {/* Today's phase indicator */}
          {currentPhase && (
            <div style={{
              padding: '10px 14px',
              background: C.cream,
              border: `1px solid ${C.beige}`,
              borderRadius: 10,
              marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{
                display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                background: PHASES.find(p => p.key === currentPhase.phase)?.color || C.sage,
              }}/>
              <div style={{ fontSize: 12, color: C.ink }}>
                Today you are in: <strong style={{ textTransform: 'capitalize' }}>{currentPhase.phase}</strong> phase, day {currentPhase.day} of {avgLength}
              </div>
            </div>
          )}

          {/* Advanced phase ranges */}
          <div style={{ marginTop: 6 }}>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'transparent', border: 'none',
                padding: 0, color: C.forest, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', textDecoration: 'underline',
              }}>
              {showAdvanced ? '− Hide phase day ranges' : '+ Customize phase day ranges (advanced)'}
            </button>

            {showAdvanced && (
              <div style={{
                marginTop: 10,
                padding: 12,
                background: '#FAFAFA',
                border: `1px dashed ${C.light}`,
                borderRadius: 10,
              }}>
                <p style={{ fontSize: 11, color: C.gray, margin: '0 0 10px 0', lineHeight: 1.5 }}>
                  Default ranges are pre-filled based on your cycle length. Adjust if your phases run shorter or longer.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { key: 'menstrual_end',  label: 'Menstrual ends on day',  color: PHASES[0].color },
                    { key: 'follicular_end', label: 'Follicular ends on day', color: PHASES[1].color },
                    { key: 'ovulatory_end',  label: 'Ovulatory ends on day',  color: PHASES[2].color },
                  ].map(({ key, label, color }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                        background: color, flexShrink: 0,
                      }}/>
                      <label style={{ fontSize: 12, color: C.ink, flex: 1 }}>{label}</label>
                      <input
                        type="number"
                        min="1" max={avgLength - 1}
                        value={effective[key] || ''}
                        onChange={(e) => handleAdvancedChange(key, e.target.value)}
                        style={{
                          width: 64,
                          padding: '6px 8px',
                          border: `1.5px solid ${C.light}`,
                          borderRadius: 8,
                          fontSize: 13, fontFamily: 'system-ui',
                          textAlign: 'center',
                        }}
                      />
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.7 }}>
                    <span style={{
                      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                      background: PHASES[3].color, flexShrink: 0,
                    }}/>
                    <span style={{ fontSize: 12, color: C.ink, flex: 1 }}>Luteal runs to end of cycle (day {avgLength})</span>
                  </div>
                </div>
                {overrides && (
                  <button onClick={resetRanges} style={{
                    marginTop: 10,
                    background: 'transparent', border: 'none',
                    color: C.gray, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', textDecoration: 'underline',
                    padding: 0,
                  }}>
                    Reset to defaults
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Reminder to tag services */}
          <div style={{
            marginTop: 14,
            padding: '10px 14px',
            background: '#FFF8E1',
            border: '1px solid #F0E5C0',
            borderRadius: 10,
            fontSize: 12, color: '#6B5A2A', lineHeight: 1.5,
          }}>
            ✨ Next step: in <strong>Services & hours</strong> above, tag each service with the phases it should appear in. Services with no phases tagged will show every day.
          </div>

          {(saving || savedAt) && (
            <div style={{ fontSize: 11, color: C.gray, marginTop: 10, textAlign: 'right' }}>
              {saving ? 'Saving…' : '✓ Saved'}
            </div>
          )}
        </>
      )}
    </div>
  );
}
