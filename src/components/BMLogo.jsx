// BMLogo.jsx — MyBodyMap paired-leaf SVG mark
import React from 'react';

export default function BMLogo({ size = 32, variant = 'dark', showWordmark = true, showTagline = false }) {

  const colors = {
    dark:  { stem:'#2A5741', l1:'#2A5741', l2:'#3D6E54', l3:'#4A7A5C', l4:'#6B9E80', bud:'#8BB89A', text:'#1A3A28', tag:'#6B9E80' },
    light: { stem:'#4A7A5C', l1:'#4A7A5C', l2:'#6B9E80', l3:'#8BB89A', l4:'#9FC4AF', bud:'#B5D4C5', text:'#ffffff', tag:'rgba(255,255,255,0.7)' },
    white: { stem:'#ffffff', l1:'#ffffff', l2:'rgba(255,255,255,0.75)', l3:'rgba(255,255,255,0.55)', l4:'rgba(255,255,255,0.38)', bud:'rgba(255,255,255,0.22)', text:'#ffffff', tag:'rgba(255,255,255,0.65)' },
  };

  const c = colors[variant] || colors.dark;
  const markH = size;
  const markW = Math.round(size * (60 / 72));
  const gap = showWordmark ? 10 : 0;
  // Slightly smaller font since "MyBodyMap" (9 chars) is longer than the original "BodyMap" (7 chars)
  const fontSize = Math.round(size * 0.48);
  const tagSize  = Math.round(size * 0.24);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap, lineHeight: 1 }}>
      <svg width={markW} height={markH} viewBox="0 0 60 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M30 68 Q30 44 30 6" stroke={c.stem} strokeWidth="4.5" strokeLinecap="round"/>
        <path d="M30 60 Q6 46 10 26 Q32 34 30 56" fill={c.l1}/>
        <path d="M30 60 Q54 46 50 26 Q28 34 30 56" fill={c.l2}/>
        <path d="M30 38 Q6 24 10 4 Q32 12 30 34" fill={c.l3}/>
        <path d="M30 38 Q54 24 50 4 Q28 12 30 34" fill={c.l4}/>
        <ellipse cx="30" cy="6" rx="8" ry="9" fill={c.bud}/>
      </svg>
      {showWordmark && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize, fontWeight: 700, color: c.text, lineHeight: 1, whiteSpace: 'nowrap' }}>MyBodyMap</span>
          {showTagline && (
            <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: tagSize, fontWeight: 700, color: c.tag, letterSpacing: '0.13em', textTransform: 'uppercase', lineHeight: 1, whiteSpace: 'nowrap' }}>For massage therapists</span>
          )}
        </div>
      )}
    </div>
  );
}
