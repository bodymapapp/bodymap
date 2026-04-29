// src/components/SettingsSectionHeader.jsx
//
// Italic-Fraunces categorical section header for the Settings page.
// Now tappable: parent passes isOpen + onToggle and the header collapses
// the entire section group below it. Chevron rotates 90deg when open.

import React from "react";

const C = {
  forestInk: '#1F3A2C',
  sageMute: '#98A395',
  sage: '#6B9E80',
  forest: '#2A5741',
};

export default function SettingsSectionHeader({ title, sub, count, sprigType = 'leaf', isOpen = true, onToggle }) {
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

  const isClickable = typeof onToggle === 'function';

  const handleClick = () => {
    if (isClickable) onToggle();
  };

  return (
    <div
      onClick={handleClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        margin: '32px 4px 12px',
        cursor: isClickable ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div style={{ flexShrink: 0, position: 'relative', top: 1 }}>
        <SprigSVG />
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 20,
          color: C.forestInk,
          margin: 0,
          letterSpacing: '-0.005em',
          lineHeight: 1.2,
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
        {sub && isOpen && (
          <p style={{ fontSize: 12, color: C.sageMute, margin: '3px 0 0', fontStyle: 'italic', lineHeight: 1.4 }}>
            {sub}
          </p>
        )}
      </div>
      {isClickable && (
        <svg
          width="13"
          height="13"
          viewBox="0 0 12 12"
          fill="none"
          stroke={isOpen ? C.forest : '#B5BEB1'}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s, stroke 0.15s',
          }}
        >
          <path d="M4 2l4 4-4 4" />
        </svg>
      )}
    </div>
  );
}
