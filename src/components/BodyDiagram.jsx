// src/components/BodyDiagram.jsx
//
// Reusable body diagram for all three-dot document pages and any
// other surface that visualizes focus / avoid / heatmap data.
//
// Variants:
//   size: 'sm' | 'md' | 'lg' | 'xl'
//   mode: 'mark' (focus + avoid dots) | 'heatmap' | 'worked'
//         'worked' = solid green dots for zones the therapist actually
//         worked, used on the client recap.
//
// All inputs are zone-id arrays (e.g. ['f-r-shldr', 'b-lower-bk']).

import React, { useId } from 'react';
import { ZONE_COORDS } from '../lib/sessionIntelligence';

const SIZES = {
  sm: { w: 110, h: 210 },
  md: { w: 140, h: 270 },
  lg: { w: 170, h: 325 },
  xl: { w: 210, h: 400 },
};

const COLORS = {
  silhouetteFill: '#F3EEE2',
  silhouetteStroke: '#C8BFB0',
  sage: '#4A6B54',
  sageDeep: '#1C2B22',
  red: '#B91C1C',
  redDeep: '#7F1D1D',
};

// Heatmap bloom ramps. The center color of each zone's bloom is
// interpolated along these by the zone's absolute intensity (share of
// the client's sessions): a rare zone is a soft, light wash, a recurring
// zone is a deep, saturated bloom. The bloom feathers to fully
// transparent at the edge so overlapping zones blend into one organic
// region instead of separate coins. Size is the secondary cue.
const SAGE_BLOOM = ['#8FB39A', '#16271D']; // soft sage to deep forest
const ROSE_BLOOM = ['#CE8EA1', '#6E1326']; // soft rose to deep crimson

function hexToRgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

// Interpolate between two hex colors. t is clamped to 0..1.
function lerpHex(a, b, t) {
  const x = Math.max(0, Math.min(1, t));
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const ch = ca.map((v, i) => Math.round(v + (cb[i] - v) * x));
  return `rgb(${ch[0]}, ${ch[1]}, ${ch[2]})`;
}

export default function BodyDiagram({
  focusAreas = [],
  avoidAreas = [],
  heatmapFocus = {},
  heatmapAvoid = {},
  mode = 'mark',
  size = 'md',
}) {
  const { w, h } = SIZES[size] || SIZES.md;
  const f = COLORS.silhouetteFill;
  const s = COLORS.silhouetteStroke;
  // Unique seed so gradient ids never collide across diagram instances
  // (front + back, multiple cards on a page). Colons are stripped so the
  // id is safe inside url(#...) references.
  const uid = useId().replace(/:/g, '');

  return (
    <svg width={w} height={h} viewBox="0 0 170 310" aria-hidden="true">
      {/* Silhouette */}
      <ellipse cx="85" cy="28" rx="20" ry="24" fill={f} stroke={s} strokeWidth="1.5" />
      <rect x="77" y="50" width="16" height="14" rx="3" fill={f} stroke={s} strokeWidth="1.5" />
      <path d="M57 64 Q47 70 44 90 L40 155 Q40 162 48 162 L122 162 Q130 162 130 155 L126 90 Q123 70 113 64 Z" fill={f} stroke={s} strokeWidth="1.5" />
      <path d="M57 66 Q42 74 38 115 Q36 128 40 138 Q46 141 50 138 Q54 112 60 85 Z" fill={f} stroke={s} strokeWidth="1.5" />
      <path d="M113 66 Q128 74 132 115 Q134 128 130 138 Q124 141 120 138 Q116 112 110 85 Z" fill={f} stroke={s} strokeWidth="1.5" />
      <path d="M60 162 Q56 195 54 232 Q52 260 56 278 Q62 284 70 282 Q76 278 76 260 L78 162 Z" fill={f} stroke={s} strokeWidth="1.5" />
      <path d="M110 162 Q114 195 116 232 Q118 260 114 278 Q108 284 100 282 Q94 278 94 260 L92 162 Z" fill={f} stroke={s} strokeWidth="1.5" />

      {/* Heatmap mode: soft heat blooms. Center color and size scale
          with how often the zone recurs, and each bloom feathers to
          transparent so overlapping zones blend into organic regions
          rather than reading as separate coins. No numbers, no rings. */}
      {mode === 'heatmap' && (() => {
        const bloomOf = (area, opacity, ramp, kind) => {
          const c = ZONE_COORDS[area];
          const r = 13 + opacity * 13;        // recurring zones spread wider
          const core = lerpHex(ramp[0], ramp[1], opacity);
          const a = 0.45 + opacity * 0.5;     // hotter centre for recurring
          return { c, r, core, a, gid: `${kind}-${uid}-${area}` };
        };
        const focusBlooms = Object.entries(heatmapFocus)
          .filter(([area]) => ZONE_COORDS[area])
          .map(([area, { opacity }]) => bloomOf(area, opacity, SAGE_BLOOM, 'bf'));
        const avoidBlooms = Object.entries(heatmapAvoid)
          .filter(([area]) => ZONE_COORDS[area] && !heatmapFocus[area])
          .map(([area, { opacity }]) => bloomOf(area, opacity, ROSE_BLOOM, 'ba'));
        const all = [...focusBlooms, ...avoidBlooms];
        return (
          <g>
            <defs>
              {all.map(b => (
                <radialGradient key={b.gid} id={b.gid} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={b.core} stopOpacity={b.a.toFixed(2)} />
                  <stop offset="55%" stopColor={b.core} stopOpacity={(b.a * 0.45).toFixed(2)} />
                  <stop offset="100%" stopColor={b.core} stopOpacity="0" />
                </radialGradient>
              ))}
            </defs>
            {all.map(b => (
              <circle key={'c-' + b.gid} cx={b.c[0]} cy={b.c[1]} r={b.r} fill={`url(#${b.gid})`} />
            ))}
          </g>
        );
      })()}

      {/* Mark mode: focus = green outlined, avoid = red outlined */}
      {mode === 'mark' && focusAreas.map((area, i) => {
        const c = ZONE_COORDS[area]; if (!c) return null;
        return (
          <g key={'f' + i}>
            <circle cx={c[0]} cy={c[1]} r="13" fill="rgba(74,107,84,0.22)" stroke={COLORS.sage} strokeWidth="2" />
            <circle cx={c[0]} cy={c[1]} r="5" fill={COLORS.sage} />
          </g>
        );
      })}
      {mode === 'mark' && avoidAreas.map((area, i) => {
        const c = ZONE_COORDS[area]; if (!c) return null;
        return (
          <g key={'a' + i}>
            <circle cx={c[0]} cy={c[1]} r="13" fill="rgba(185,28,28,0.18)" stroke={COLORS.red} strokeWidth="2" />
            <circle cx={c[0]} cy={c[1]} r="5" fill={COLORS.red} />
          </g>
        );
      })}

      {/* Worked mode: solid sage dots, no outline ring */}
      {mode === 'worked' && focusAreas.map((area, i) => {
        const c = ZONE_COORDS[area]; if (!c) return null;
        return (
          <g key={'w' + i}>
            <circle cx={c[0]} cy={c[1]} r="9" fill={COLORS.sage} />
            <circle cx={c[0]} cy={c[1]} r="4" fill="white" />
          </g>
        );
      })}
    </svg>
  );
}
