// src/components/FocusDistribution.jsx
//
// Compact focus distribution display, designed to sit alongside or
// below a body SVG without stealing the show. The body is the
// centerpiece; this strip is at most 20% of the view height.
//
// Renders 5 percentages:
//   - Top, Middle, Bottom (three horizontal sliders, vertically
//     stacked so they line up with the head/torso/legs of the
//     body image)
//   - Front, Back (a single split bar with one drag handle, shown
//     below the three sliders)
//
// Each slider can be:
//   - read-only (display mode, used on summary or therapist read)
//   - editable (intake form mode)
//
// Auto-derive from zones: when the parent passes `autoDeriveFrom`
// (a list of focus zone ids), the percentages auto-recompute as
// the client taps zones, UNLESS they have manually moved a slider
// (we lock to manual after first drag). This is signaled via the
// `manuallyAdjusted` flag in state.
//
// Lindsey #4 follow-up, May 10 2026. Per HK constraint:
// 'centerpiece should be the body... should be lighter and take
// very small space... no more than 20% of the view... focus is
// still to highlight focus and avoid areas.'

import React, { useState, useEffect, useRef } from 'react';
import {
  DEFAULT_DISTRIBUTION,
  computeDistributionFromZones,
  rebalanceTriple,
} from '../lib/focusDistribution';

const C = {
  inkDim: '#6B7280',
  inkFaint: '#9CA3AF',
  forest: '#2A5741',
  sage: '#A9C99A',
  pinkish: '#E8C9B8',
  line: '#E5E7EB',
  bg: '#FAFAF6',
};

export default function FocusDistribution({
  value,
  onChange,
  autoDeriveFrom,
  editable = true,
  compact = true,
}) {
  // Local state mirrors the parent's value but tracks an extra flag:
  // whether the user has manually moved any slider. Once they have,
  // we stop auto-deriving from zones (manual wins).
  const [manuallyAdjusted, setManuallyAdjusted] = useState(false);
  const lastAutoRef = useRef(null);

  const dist = value || { ...DEFAULT_DISTRIBUTION };

  // Auto-derive from zones when zones change and user has not manually
  // overridden. Skips initial render so we do not blow away a value
  // the parent set explicitly. Compares string of zones to avoid
  // infinite loops from new-array references.
  useEffect(() => {
    if (!autoDeriveFrom || manuallyAdjusted) return;
    const zoneStr = JSON.stringify(autoDeriveFrom);
    if (zoneStr === lastAutoRef.current) return;
    lastAutoRef.current = zoneStr;
    const auto = computeDistributionFromZones(autoDeriveFrom);
    if (onChange) onChange(auto);
  }, [autoDeriveFrom, manuallyAdjusted, onChange]);

  function handleFrontChange(e) {
    if (!editable) return;
    setManuallyAdjusted(true);
    const v = parseInt(e.target.value, 10) || 0;
    if (onChange) onChange({ ...dist, front_pct: v });
  }

  function handleBandChange(key, v) {
    if (!editable) return;
    setManuallyAdjusted(true);
    const rebal = rebalanceTriple(
      { top_pct: dist.top_pct, middle_pct: dist.middle_pct, bottom_pct: dist.bottom_pct },
      key,
      v
    );
    if (onChange) onChange({ ...dist, ...rebal });
  }

  const sliderStyle = {
    width: '100%',
    height: 18,
    margin: 0,
    padding: 0,
    accentColor: C.forest,
  };
  const rowStyle = {
    display: 'grid',
    gridTemplateColumns: '50px 1fr 32px',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontFamily: 'system-ui',
    color: C.inkDim,
  };
  const labelStyle = { textAlign: 'right', paddingRight: 4 };
  const valueStyle = { textAlign: 'right', fontWeight: 600, color: '#3D4A42' };

  return (
    <div style={{
      background: C.bg,
      border: `1px solid ${C.line}`,
      borderRadius: 10,
      padding: compact ? '8px 10px' : '12px 14px',
      fontFamily: 'system-ui',
    }}>
      {/* Title is tiny so the body remains the focus. */}
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: C.inkFaint,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 6,
      }}>
        How to balance the time
      </div>

      {/* Three band sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={rowStyle}>
          <span style={labelStyle}>Top</span>
          <input
            type="range" min="0" max="100" step="5"
            value={dist.top_pct ?? DEFAULT_DISTRIBUTION.top_pct}
            onChange={e => handleBandChange('top_pct', parseInt(e.target.value, 10))}
            disabled={!editable}
            style={sliderStyle}
            aria-label="Top percentage"
          />
          <span style={valueStyle}>{dist.top_pct ?? DEFAULT_DISTRIBUTION.top_pct}%</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Middle</span>
          <input
            type="range" min="0" max="100" step="5"
            value={dist.middle_pct ?? DEFAULT_DISTRIBUTION.middle_pct}
            onChange={e => handleBandChange('middle_pct', parseInt(e.target.value, 10))}
            disabled={!editable}
            style={sliderStyle}
            aria-label="Middle percentage"
          />
          <span style={valueStyle}>{dist.middle_pct ?? DEFAULT_DISTRIBUTION.middle_pct}%</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Bottom</span>
          <input
            type="range" min="0" max="100" step="5"
            value={dist.bottom_pct ?? DEFAULT_DISTRIBUTION.bottom_pct}
            onChange={e => handleBandChange('bottom_pct', parseInt(e.target.value, 10))}
            disabled={!editable}
            style={sliderStyle}
            aria-label="Bottom percentage"
          />
          <span style={valueStyle}>{dist.bottom_pct ?? DEFAULT_DISTRIBUTION.bottom_pct}%</span>
        </div>
      </div>

      {/* Front / back split bar */}
      <div style={{
        marginTop: 8,
        paddingTop: 8,
        borderTop: `1px dashed ${C.line}`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: C.inkDim,
        }}>
          <span style={{ width: 28, textAlign: 'right' }}>Front</span>
          <input
            type="range" min="0" max="100" step="5"
            value={dist.front_pct ?? DEFAULT_DISTRIBUTION.front_pct}
            onChange={handleFrontChange}
            disabled={!editable}
            style={{ ...sliderStyle, flex: 1 }}
            aria-label="Front percentage"
          />
          <span style={{ width: 28, textAlign: 'left' }}>Back</span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: C.inkFaint,
          padding: '0 34px',
          marginTop: 2,
        }}>
          <span style={{ fontWeight: 600, color: '#3D4A42' }}>{dist.front_pct ?? DEFAULT_DISTRIBUTION.front_pct}%</span>
          <span style={{ fontWeight: 600, color: '#3D4A42' }}>{100 - (dist.front_pct ?? DEFAULT_DISTRIBUTION.front_pct)}%</span>
        </div>
      </div>

      {editable && autoDeriveFrom && !manuallyAdjusted && (
        <div style={{
          fontSize: 9,
          color: C.inkFaint,
          fontStyle: 'italic',
          marginTop: 6,
          textAlign: 'center',
        }}>
          Auto-updating from your selections. Move a slider to lock.
        </div>
      )}
    </div>
  );
}
