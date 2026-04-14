// BMLogo.jsx — BodyMap paired-leaf SVG mark
// Props:
//   size: number (height in px, default 32)
//   variant: 'dark' | 'light' | 'white' (default 'dark')
//   showWordmark: boolean (default true)
//   showTagline: boolean (default false)

import React from 'react';

export default function BMLogo({ size = 32, variant = 'dark', showWordmark = true, showTagline = false }) {
  const h = size;
  const w = Math.round(h * 0.65);

  const colors = {
    dark: {
      stem:  '#2A5741',
      l1:    '#2A5741',
      l2:    '#3D6E54',
      l3:    '#4A7A5C',
      l4:    '#6B9E80',
      bud:   '#8BB89A',
      text:  '#1A3A28',
      tag:   '#6B9E80',
    },
    light: {
      stem:  '#4A7A5C',
      l1:    '#4A7A5C',
      l2:    '#6B9E80',
      l3:    '#8BB89A',
      l4:    '#9FC4AF',
      bud:   '#B5D4C5',
      text:  '#ffffff',
      tag:   'rgba(255,255,255,0.7)',
    },
    white: {
      stem:  '#ffffff',
      l1:    '#ffffff',
      l2:    'rgba(255,255,255,0.75)',
      l3:    'rgba(255,255,255,0.55)',
      l4:    'rgba(255,255,255,0.40)',
      bud:   'rgba(255,255,255,0.28)',
      text:  '#ffffff',
      tag:   'rgba(255,255,255,0.65)',
    },
  };

  const c = colors[variant] || colors.dark;
  const s = h / 88; // scale factor relative to base 88px artboard

  const markW = Math.round(28 * s);
  const gap   = showWordmark ? 8 : 0;
  const fontSize = Math.round(h * 0.5);
  const tagSize  = Math.round(h * 0.22);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: gap, lineHeight: 1 }}>
      {/* SVG Mark */}
      <svg
        width={markW}
        height={h}
        viewBox="0 0 28 88"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Stem */}
        <path d="M14 84 Q14 56 14 8" stroke={c.stem} strokeWidth="3.2" strokeLinecap="round"/>
        {/* Lower left leaf */}
        <path d="M14 72 Q-2 56 2 36 Q17 44 14 68" fill={c.l1}/>
        {/* Lower right leaf */}
        <path d="M14 72 Q30 56 26 36 Q11 44 14 68" fill={c.l2}/>
        {/* Upper left leaf */}
        <path d="M14 46 Q-2 30 2 10 Q17 18 14 42" fill={c.l3}/>
        {/* Upper right leaf */}
        <path d="M14 46 Q30 30 26 10 Q11 18 14 42" fill={c.l4}/>
        {/* Top bud */}
        <ellipse cx="14" cy="8" rx="6" ry="7.5" fill={c.bud}/>
      </svg>

      {/* Wordmark + tagline */}
      {showWordmark && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
          <span style={{
            fontFamily: 'Georgia, serif',
            fontSize: fontSize,
            fontWeight: 700,
            color: c.text,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}>
            BodyMap
          </span>
          {showTagline && (
            <span style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: tagSize,
              fontWeight: 700,
              color: c.tag,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}>
              Client Intelligence
            </span>
          )}
        </div>
      )}
    </div>
  );
}
