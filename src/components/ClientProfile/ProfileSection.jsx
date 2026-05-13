// src/components/ClientProfile/ProfileSection.jsx
//
// Collapsible section wrapper for the therapist client profile,
// matching the Settings design language (italic Georgia serif
// title, sage sprig SVG, chevron toggle, white card with hairline
// borders, cream-soft background when open).
//
// Each major section on the profile (Sessions and SOAP, Patterns,
// Preferences, Medical, Timeline) renders inside one of these.
// Header is always visible and clickable; body shows when isOpen.
//
// Props:
//   title       string, the section name
//   subtitle    optional string under the title (italic muted)
//   count       optional number badge after the title
//   sprig       'leaf' | 'sun' | 'moon' | 'dots' | 'note'
//   isOpen      boolean
//   onToggle    function
//   trailing    optional ReactNode rendered on the right (before chevron)
//   children    body content

import React from 'react';

const C = {
  forestInk: '#1F3A2C',
  forest: '#2A5741',
  sage: '#6B9E80',
  sageMute: '#98A395',
  sageMutePale: '#B5BEB1',
  border: 'rgba(31,58,44,0.07)',
  borderOpen: 'rgba(31,58,44,0.10)',
  creamSoft: '#FAF7EE',
};

function Sprig({ type }) {
  const stroke = C.sage;
  const props = {
    width: 22, height: 22, viewBox: '0 0 22 22',
    fill: 'none', stroke, strokeWidth: 1.2,
    strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  if (type === 'leaf') {
    return (
      <svg {...props}>
        <path d="M11 18 C 11 12, 11 6, 11 4" />
        <path d="M11 9 C 14 9, 16 7, 17 5" />
        <path d="M11 12 C 8 12, 6 10, 5 8" />
        <path d="M11 14 C 14 14, 16 13, 17 11" />
      </svg>
    );
  }
  if (type === 'sun') {
    return (
      <svg {...props}>
        <circle cx="11" cy="11" r="3.5" />
        <path d="M11 4v2M11 16v2M4 11h2M16 11h2M6 6l1.5 1.5M14.5 14.5L16 16M6 16l1.5-1.5M14.5 7.5L16 6" />
      </svg>
    );
  }
  if (type === 'moon') {
    return (
      <svg {...props}>
        <path d="M16 11.5A6 6 0 1 1 10.5 6 a 5 5 0 0 0 5.5 5.5z" />
      </svg>
    );
  }
  if (type === 'note') {
    // Folded page with a leaf detail, for SOAP / notes sections
    return (
      <svg {...props}>
        <path d="M6 4h7l4 4v10H6z" />
        <path d="M13 4v4h4" />
        <path d="M9 13h5M9 16h3" />
      </svg>
    );
  }
  // dots (default) — connected pattern, used for the Patterns section
  return (
    <svg {...props}>
      <circle cx="6" cy="11" r="2" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="16" cy="16" r="2" />
      <path d="M8 10l6-3M8 12l6 3" />
    </svg>
  );
}

export default function ProfileSection({
  title,
  subtitle,
  count,
  sprig = 'leaf',
  isOpen,
  onToggle,
  trailing,
  children,
}) {
  const interactive = typeof onToggle === 'function';

  return (
    <div style={{
      background: '#fff',
      border: `0.5px solid ${isOpen ? C.borderOpen : C.border}`,
      borderRadius: 14,
      marginBottom: 14,
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(31,58,44,0.025)',
      transition: 'border-color 0.15s ease',
    }}>
      <div
        onClick={interactive ? onToggle : undefined}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={(e) => {
          if (interactive && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onToggle();
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          cursor: interactive ? 'pointer' : 'default',
          userSelect: 'none',
          minHeight: 56,
        }}
      >
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <Sprig type={sprig} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 20,
            color: C.forestInk,
            margin: 0,
            letterSpacing: '-0.005em',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {title}
            {typeof count === 'number' && (
              <span style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontStyle: 'normal',
                fontSize: 11,
                color: C.sageMute,
                marginLeft: 8,
                letterSpacing: '0.04em',
                verticalAlign: 'middle',
                fontWeight: 600,
              }}>{count}</span>
            )}
          </h3>
          {subtitle && (
            <p style={{
              fontSize: 12,
              color: C.sageMute,
              margin: '3px 0 0',
              fontStyle: 'italic',
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {subtitle}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {trailing}
          {interactive && (
            <svg
              width="13"
              height="13"
              viewBox="0 0 12 12"
              fill="none"
              stroke={isOpen ? C.forest : C.sageMutePale}
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s, stroke 0.15s',
              }}
            >
              <path d="M4 2l4 4-4 4" />
            </svg>
          )}
        </div>
      </div>

      {isOpen && (
        <div style={{
          background: C.creamSoft,
          borderTop: `0.5px solid ${C.border}`,
          padding: '16px 18px 18px',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}
