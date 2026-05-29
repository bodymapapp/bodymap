// src/components/RecurringRulePanel.jsx
//
// HK May 29 2026: rebuild of the recurring booking UX. Beats Outlook
// on coverage AND simplicity for the 70yo solo LMT persona.
//
// Capabilities (vs Outlook):
//   interval:        every N units                           ✓ (matches Outlook)
//   unit:            Day | Week | Month                      ✓ (Outlook also Year, we drop it)
//   days-of-week:    multi-select pills when unit=Week       ✓ (matches Outlook)
//   end mode:        After N sessions OR On specific date    ✓ (matches Outlook)
//   live preview:    plain-English summary of generated set  ✓ (we add: clearer than Outlook)
//
// Capabilities we intentionally DO NOT have (anti-bloat per design memo):
//   yearly, "first Monday of month", multi-timezone, exception list editor.
//
// Shape of the rule object this panel reads/writes:
//   {
//     on:        bool,              // toggle for the whole feature
//     interval:  int >= 1,          // every N units
//     unit:      'day'|'week'|'month',
//     daysOfWeek: [0..6] subset,    // ignored unless unit=week; empty=use anchor DOW
//     endMode:   'count' | 'date',
//     endCount:  int >= 1,
//     endDate:   ISO string | null,
//     manualAdd: [ISO],             // dates added outside the rule
//     manualDrop: [ISO],            // rule-generated dates the user removed
//   }

import React from 'react';

const C = {
  forest: '#2A5741',
  sage: '#6B9E80',
  sageBg: '#EEF3EE',
  light: '#E8E4DC',
  cream: '#FAFAF7',
  ink: '#1A1A2E',
  inkMute: '#6B7280',
  white: '#FFFFFF',
};

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DEFAULT_RECURRING_RULE = {
  on: false,
  interval: 1,
  unit: 'week',
  daysOfWeek: [],
  endMode: 'count',
  endCount: 8,
  endDate: null,
  manualAdd: [],
  manualDrop: [],
};

// ─── generateSeriesDates ───────────────────────────────────────────
// Given an anchor ISO date and a rule, return the sorted list of
// ISO dates the series covers. Used by BookingModal + the calendar
// preview. Pure function, no React.
export function generateSeriesDates(anchorIso, rule) {
  if (!rule?.on || !anchorIso) return [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorIso)) return [];

  const dates = new Set();
  const safetyCap = 365; // hard limit on emitted dates regardless of rule
  const isoFor = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const [ay, am, ad] = anchorIso.split('-').map(Number);
  const anchor = new Date(ay, am - 1, ad);
  anchor.setHours(0, 0, 0, 0);

  // Resolve end boundary as a hard date. For count-mode we just walk
  // forward, capped by safetyCap; we slice to count at the end.
  let endBoundary = null;
  if (rule.endMode === 'date' && rule.endDate) {
    const [ey, em, ed] = rule.endDate.split('-').map(Number);
    endBoundary = new Date(ey, em - 1, ed);
    endBoundary.setHours(23, 59, 59, 999);
    // Edge case: end date before anchor → return just the anchor (we
    // still respect the explicit anchor pick).
    if (endBoundary < anchor) return [anchorIso];
  }

  const interval = Math.max(1, Math.min(99, rule.interval | 0 || 1));

  if (rule.unit === 'week') {
    // DOWs: explicit selection wins; empty defaults to anchor's DOW.
    const dows = (rule.daysOfWeek && rule.daysOfWeek.length > 0)
      ? [...new Set(rule.daysOfWeek)].sort((a, b) => a - b)
      : [anchor.getDay()];

    // Start at the Sunday of the anchor week so we can walk DOWs in
    // order within each interval block.
    const blockStart = new Date(anchor);
    blockStart.setDate(anchor.getDate() - anchor.getDay());

    let safety = 0;
    while (safety < safetyCap) {
      for (const dow of dows) {
        const candidate = new Date(blockStart);
        candidate.setDate(blockStart.getDate() + dow);
        candidate.setHours(0, 0, 0, 0);
        // Skip dates before the anchor (so picking Mid-week as anchor
        // doesn't accidentally schedule earlier in that same week).
        if (candidate < anchor) continue;
        if (endBoundary && candidate > endBoundary) {
          safety = safetyCap;
          break;
        }
        dates.add(isoFor(candidate));
      }
      blockStart.setDate(blockStart.getDate() + 7 * interval);
      safety++;
      // Count-mode early exit so we don't grind through 365 dates
      // when count is small.
      if (rule.endMode === 'count' && dates.size >= (rule.endCount | 0 || 1) + 20) break;
    }
  } else if (rule.unit === 'day') {
    let cursor = new Date(anchor);
    let safety = 0;
    while (safety < safetyCap) {
      if (endBoundary && cursor > endBoundary) break;
      dates.add(isoFor(cursor));
      cursor.setDate(cursor.getDate() + interval);
      safety++;
      if (rule.endMode === 'count' && dates.size >= (rule.endCount | 0 || 1)) break;
    }
  } else if (rule.unit === 'month') {
    let cursor = new Date(anchor);
    let safety = 0;
    while (safety < safetyCap) {
      if (endBoundary && cursor > endBoundary) break;
      dates.add(isoFor(cursor));
      cursor.setMonth(cursor.getMonth() + interval);
      safety++;
      if (rule.endMode === 'count' && dates.size >= (rule.endCount | 0 || 1)) break;
    }
  }

  // Manual overrides
  for (const iso of (rule.manualDrop || [])) dates.delete(iso);
  for (const iso of (rule.manualAdd || [])) dates.add(iso);

  // Sort ascending
  let sorted = [...dates].sort();

  // Trim to count
  if (rule.endMode === 'count') {
    const target = Math.max(1, Math.min(safetyCap, rule.endCount | 0 || 1));
    sorted = sorted.slice(0, target);
  }

  return sorted;
}

// ─── humanRuleSummary ──────────────────────────────────────────────
// Plain English description of the rule given the generated dates.
// Returns:
//   { line1, line2, sample, warning? }
// warning is set when the rule appears misconfigured (e.g. endDate
// before/equal to anchor produced only 1 session in date mode).
export function humanRuleSummary(rule, dates, anchorIso) {
  if (!rule?.on) return null;
  if (dates.length === 0) {
    return {
      line1: 'No sessions yet',
      line2: 'Pick a start date on the calendar below.',
      sample: '',
    };
  }
  const count = dates.length;
  const last = dates[dates.length - 1];
  const [ly, lm, ld] = last.split('-').map(Number);
  const lastDt = new Date(ly, lm - 1, ld);
  const lastFmt = lastDt.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const lastShort = lastDt.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const sessionWord = count === 1 ? 'session' : 'sessions';

  // Warning: date mode, single session, endDate <= anchor. Reads as
  // "you said weekly but only 1 session will be made because your
  // end date is on or before the start".
  let warning = null;
  if (rule.endMode === 'date' && rule.endDate && anchorIso && count === 1 && rule.endDate <= anchorIso) {
    warning = 'End date is on or before the start date. Only one session will be created. Pick an end date in the future to repeat.';
  }

  // Inline sample: first 5 dates as short labels, plus "and N more".
  const sampleDates = dates.slice(0, 5).map(iso => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const sample = dates.length <= 5
    ? sampleDates.join(', ')
    : `${sampleDates.join(', ')}, and ${dates.length - 5} more`;

  return {
    line1: `${count} ${sessionWord} through ${lastShort}`,
    line2: `Last: ${lastFmt}`,
    sample,
    warning,
  };
}

// ─── RecurringRulePanel component ──────────────────────────────────
export default function RecurringRulePanel({ rule, anchorIso, onChange }) {
  const setRule = (patch) => onChange({ ...rule, ...patch });
  const dates = React.useMemo(() => generateSeriesDates(anchorIso, rule), [anchorIso, rule]);
  const summary = humanRuleSummary(rule, dates, anchorIso);

  // Anchor's DOW (used as the auto-selected DOW when none picked yet)
  const anchorDow = anchorIso
    ? (() => {
      const [y, m, d] = anchorIso.split('-').map(Number);
      return new Date(y, m - 1, d).getDay();
    })()
    : null;

  // When toggle is OFF, render the collapsed compact bar
  if (!rule.on) {
    return (
      <button
        type="button"
        onClick={() => setRule({ on: true })}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px',
          background: C.cream,
          border: `1.5px solid ${C.light}`,
          borderRadius: 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: C.ink }}>
          <span style={{ fontSize: 15 }}>↻</span>
          Set up a recurring booking
        </span>
        <span style={{ fontSize: 11, color: C.inkMute, fontWeight: 500 }}>
          Tap to configure
        </span>
      </button>
    );
  }

  return (
    <div style={{
      background: C.cream,
      border: `1.5px solid ${C.sage}`,
      borderRadius: 12,
      padding: 16,
    }}>
      {/* Header with off toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>↻</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.forest, fontFamily: 'Georgia, serif' }}>
            Recurring booking
          </span>
        </div>
        <button
          type="button"
          onClick={() => setRule({ on: false })}
          aria-label="Turn off recurring"
          style={{
            background: 'none', border: 'none',
            color: C.inkMute, fontSize: 18, fontWeight: 400,
            cursor: 'pointer', padding: 4, lineHeight: 1,
            fontFamily: 'inherit',
          }}>
          ×
        </button>
      </div>

      {/* Row 1: interval + unit */}
      <div style={{ marginBottom: 16 }}>
        <Label>Repeats every</Label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <Stepper
            value={rule.interval}
            min={1}
            max={26}
            onChange={(n) => setRule({ interval: n })}
          />
          <ChipGroup
            value={rule.unit}
            options={[
              { value: 'day', label: rule.interval === 1 ? 'Day' : 'Days' },
              { value: 'week', label: rule.interval === 1 ? 'Week' : 'Weeks' },
              { value: 'month', label: rule.interval === 1 ? 'Month' : 'Months' },
            ]}
            onChange={(v) => setRule({ unit: v })}
          />
        </div>
      </div>

      {/* Row 2: days of week (only when unit=week) */}
      {rule.unit === 'week' && (
        <div style={{ marginBottom: 16 }}>
          <Label>
            On these days
            {rule.daysOfWeek.length === 0 && anchorDow != null && (
              <span style={{ marginLeft: 6, color: C.inkMute, fontWeight: 500, fontStyle: 'italic' }}>
                (using {DAY_NAMES[anchorDow]} from your selected date)
              </span>
            )}
          </Label>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {DAY_LABELS.map((lbl, idx) => {
              const isSelected = rule.daysOfWeek.includes(idx)
                || (rule.daysOfWeek.length === 0 && idx === anchorDow);
              const isAnchorImplicit = rule.daysOfWeek.length === 0 && idx === anchorDow;
              return (
                <button
                  key={idx}
                  type="button"
                  aria-label={DAY_NAMES[idx]}
                  aria-pressed={isSelected}
                  onClick={() => {
                    const current = rule.daysOfWeek.length === 0 && anchorDow != null
                      ? [anchorDow]
                      : [...rule.daysOfWeek];
                    const i = current.indexOf(idx);
                    if (i >= 0) {
                      // Don't allow zero-DOW selection; if removing last,
                      // fall back to "empty = anchor DOW" by clearing.
                      if (current.length === 1) {
                        setRule({ daysOfWeek: [] });
                        return;
                      }
                      current.splice(i, 1);
                    } else {
                      current.push(idx);
                    }
                    setRule({ daysOfWeek: current.sort((a, b) => a - b) });
                  }}
                  style={{
                    width: 36, height: 36,
                    borderRadius: '50%',
                    border: `1.5px solid ${isSelected ? C.sage : C.light}`,
                    background: isSelected ? C.sage : C.white,
                    color: isSelected ? C.white : C.ink,
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontStyle: isAnchorImplicit ? 'italic' : 'normal',
                    opacity: isAnchorImplicit ? 0.85 : 1,
                  }}>
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Row 3: end mode */}
      <div style={{ marginBottom: 14 }}>
        <Label>Ends</Label>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <EndModeRow
            selected={rule.endMode === 'count'}
            onSelect={() => setRule({ endMode: 'count' })}
          >
            <span style={{ fontSize: 13, color: C.ink }}>After</span>
            <Stepper
              value={rule.endCount}
              min={1}
              max={104}
              onChange={(n) => setRule({ endCount: n, endMode: 'count' })}
              compact
            />
            <span style={{ fontSize: 13, color: C.ink }}>
              {rule.endCount === 1 ? 'session' : 'sessions'}
            </span>
          </EndModeRow>
          <EndModeRow
            selected={rule.endMode === 'date'}
            onSelect={() => {
              // When switching to date mode, default the end date to
              // 12 weeks from anchor if none set.
              if (!rule.endDate && anchorIso) {
                const [y, m, d] = anchorIso.split('-').map(Number);
                const def = new Date(y, m - 1, d);
                def.setDate(def.getDate() + 84);
                const iso = `${def.getFullYear()}-${String(def.getMonth() + 1).padStart(2, '0')}-${String(def.getDate()).padStart(2, '0')}`;
                setRule({ endMode: 'date', endDate: iso });
              } else {
                setRule({ endMode: 'date' });
              }
            }}
          >
            <span style={{ fontSize: 13, color: C.ink }}>On</span>
            <input
              type="date"
              value={rule.endDate || ''}
              min={anchorIso || undefined}
              onChange={(e) => setRule({ endDate: e.target.value, endMode: 'date' })}
              style={{
                padding: '6px 8px', borderRadius: 6,
                border: `1.5px solid ${C.light}`,
                fontSize: 13, color: C.ink,
                fontFamily: 'inherit',
              }}
            />
          </EndModeRow>
        </div>
      </div>

      {/* Live preview / warning footer */}
      {summary && summary.warning && (
        <div style={{
          marginTop: 10, padding: '10px 12px',
          background: '#FEF3C7',
          border: '1px solid #F59E0B',
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 2 }}>
            ⚠ Check the end date
          </div>
          <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
            {summary.warning}
          </div>
        </div>
      )}
      {summary && !summary.warning && (
        <div style={{
          marginTop: 10, padding: '10px 12px',
          background: C.sageBg,
          border: `1px solid ${C.sage}`,
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.forest, marginBottom: 2 }}>
            ✨ {summary.line1}
          </div>
          <div style={{ fontSize: 11, color: C.forest, opacity: 0.85, marginBottom: summary.sample ? 6 : 0 }}>
            {summary.line2}
          </div>
          {summary.sample && (
            <div style={{
              fontSize: 11, color: C.forest,
              padding: '6px 8px',
              background: C.white,
              border: `1px solid ${C.sage}`,
              borderRadius: 6,
              lineHeight: 1.5,
              marginTop: 4,
            }}>
              <span style={{ fontWeight: 700, marginRight: 4 }}>Dates:</span>
              {summary.sample}
            </div>
          )}
        </div>
      )}

      {!anchorIso && (
        <div style={{
          marginTop: 10, padding: '10px 12px',
          background: C.cream,
          border: `1px dashed ${C.light}`,
          borderRadius: 8,
          fontSize: 12, color: C.inkMute,
          fontStyle: 'italic',
        }}>
          Pick a start date on the calendar below to preview the series.
        </div>
      )}
    </div>
  );
}

// ─── small subcomponents ───────────────────────────────────────────

function Label({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700,
      color: C.inkMute,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    }}>
      {children}
    </div>
  );
}

function Stepper({ value, min = 1, max = 99, onChange, compact = false }) {
  const dec = () => onChange(Math.max(min, (value | 0) - 1));
  const inc = () => onChange(Math.min(max, (value | 0) + 1));
  const btnStyle = {
    width: compact ? 28 : 32, height: compact ? 28 : 32,
    background: C.white,
    border: `1.5px solid ${C.light}`,
    borderRadius: 8,
    fontSize: 16, fontWeight: 600,
    color: C.ink, cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <button type="button" onClick={dec} aria-label="decrease" style={btnStyle}>−</button>
      <span style={{
        minWidth: compact ? 28 : 36,
        textAlign: 'center',
        fontSize: 14, fontWeight: 700,
        color: C.ink,
      }}>{value}</span>
      <button type="button" onClick={inc} aria-label="increase" style={btnStyle}>+</button>
    </div>
  );
}

function ChipGroup({ value, options, onChange }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, background: C.white, padding: 3, borderRadius: 10, border: `1.5px solid ${C.light}` }}>
      {options.map(opt => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 7,
              border: 'none',
              background: isActive ? C.forest : 'transparent',
              color: isActive ? C.white : C.ink,
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function EndModeRow({ selected, onSelect, children }) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px',
        background: selected ? C.sageBg : C.white,
        border: `1.5px solid ${selected ? C.sage : C.light}`,
        borderRadius: 8,
        cursor: 'pointer',
      }}>
      <span style={{
        width: 16, height: 16, borderRadius: '50%',
        border: `2px solid ${selected ? C.sage : C.light}`,
        background: C.white,
        position: 'relative',
        flexShrink: 0,
      }}>
        {selected && (
          <span style={{
            position: 'absolute', top: 2, left: 2,
            width: 8, height: 8, borderRadius: '50%',
            background: C.sage,
          }} />
        )}
      </span>
      {children}
    </div>
  );
}
