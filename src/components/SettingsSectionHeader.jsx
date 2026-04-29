// src/components/SettingsSectionHeader.jsx
//
// Italic-Fraunces categorical section header for the Settings page.
// Sits between groups of cards: "How I practice", "What I offer",
// "How I rest easier", "How I plug in".
//
// Includes a soft botanical sprig SVG to the left for editorial feel.

import React from "react";

const C = {
  forestInk: '#1F3A2C',
  sageMute: '#98A395',
  sage: '#6B9E80',
};

export default function SettingsSectionHeader({ title, sub, count, sprigType = 'leaf' }) {
  const SprigSVG = () => {
    if (sprigType === 'leaf') {
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke={C.sage} strokeWidth="1.2" strokeLinecap="round">
          <path d="M11 18 C 11 12, 11 6, 11 4" />
          <path d="M11 9 C 14 9, 16 7, 17 5" />
          <path d="M11 12 C 8 12, 6 10, 5 8" />
          <path d="M11 14 C 14 14, 16 13, 17 11" />
        </svg>
      );
    }
    if (sprigType === 'sun') {
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke={C.sage} strokeWidth="1.2" strokeLinecap="round">
          <circle cx="11" cy="11" r="3.5" />
          <path d="M11 4v2M11 16v2M4 11h2M16 11h2M6 6l1.5 1.5M14.5 14.5L16 16M6 16l1.5-1.5M14.5 7.5L16 6" />
        </svg>
      );
    }
    if (sprigType === 'moon') {
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke={C.sage} strokeWidth="1.2" strokeLinecap="round">
          <path d="M16 11.5A6 6 0 1 1 10.5 6 a 5 5 0 0 0 5.5 5.5z" />
        </svg>
      );
    }
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke={C.sage} strokeWidth="1.2" strokeLinecap="round">
        <circle cx="6" cy="11" r="2" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="16" cy="16" r="2" />
        <path d="M8 10l6-3M8 12l6 3" />
      </svg>
    );
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: 10,
      margin: '32px 4px 12px',
    }}>
      <div style={{ position: 'relative', top: 4, flexShrink: 0 }}>
        <SprigSVG />
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 19,
          color: C.forestInk,
          margin: 0,
          letterSpacing: '-0.005em',
        }}>
          {title}
          {typeof count === 'number' && (
            <span style={{
              fontFamily: 'system-ui, sans-serif',
              fontStyle: 'normal',
              fontSize: 11,
              color: C.sageMute,
              marginLeft: 8,
              letterSpacing: '0.04em',
            }}>{count}</span>
          )}
        </h3>
        {sub && (
          <p style={{ fontSize: 11.5, color: C.sageMute, margin: '2px 0 0', fontStyle: 'italic', lineHeight: 1.4 }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
