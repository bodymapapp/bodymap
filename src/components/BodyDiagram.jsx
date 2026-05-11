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

import React from 'react';
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

      {/* Heatmap mode: zone IS the number circle, bigger and bolder */}
      {mode === 'heatmap' && Object.entries(heatmapFocus).map(([area, { opacity, count }]) => {
        const c = ZONE_COORDS[area]; if (!c) return null;
        // Zone size scales with count. Min radius 11, max 20.
        const r = 11 + opacity * 9;
        const fontSize = r >= 17 ? 14 : r >= 14 ? 12 : 11;
        return (
          <g key={'hf-' + area}>
            {/* Outer halo for emphasis on high-count zones */}
            <circle cx={c[0]} cy={c[1]} r={r + 5} fill={`rgba(74,107,84,${(opacity * 0.15).toFixed(2)})`} />
            {/* Main zone circle, color saturation scales with count */}
            <circle cx={c[0]} cy={c[1]} r={r} fill={COLORS.sage} stroke={COLORS.sageDeep} strokeWidth={opacity > 0.7 ? '2.5' : '1.5'} />
            {/* Number IN the circle */}
            <text x={c[0]} y={c[1] + fontSize / 3} textAnchor="middle" fill="white" fontSize={fontSize} fontWeight="800" fontFamily="Inter, sans-serif">{count}</text>
          </g>
        );
      })}
      {mode === 'heatmap' && Object.entries(heatmapAvoid).map(([area, { opacity, count }]) => {
        if (heatmapFocus[area]) return null;
        const c = ZONE_COORDS[area]; if (!c) return null;
        const r = 11 + opacity * 9;
        const fontSize = r >= 17 ? 14 : r >= 14 ? 12 : 11;
        return (
          <g key={'ha-' + area}>
            <circle cx={c[0]} cy={c[1]} r={r + 5} fill={`rgba(185,28,28,${(opacity * 0.12).toFixed(2)})`} />
            <circle cx={c[0]} cy={c[1]} r={r} fill={COLORS.red} stroke={COLORS.redDeep} strokeWidth={opacity > 0.7 ? '2.5' : '1.5'} />
            <text x={c[0]} y={c[1] + fontSize / 3} textAnchor="middle" fill="white" fontSize={fontSize} fontWeight="800" fontFamily="Inter, sans-serif">{count}</text>
          </g>
        );
      })}

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
