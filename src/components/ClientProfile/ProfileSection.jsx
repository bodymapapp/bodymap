// src/components/ClientProfile/ProfileSection.jsx
//
// Collapsible section card for the therapist client profile.
// Design direction this iteration:
//   - Stop copying Settings page literally (italic Georgia everywhere
//     looked generic and dated).
//   - Header: small caps sans-serif label + bigger sans title.
//   - 4px colored vertical accent bar on the left, color set per
//     section (sage for SOAP, gold for Patterns, etc).
//   - Body uses the SAME white background as the header so empty
//     states sit cleanly inside the card boundary (the previous
//     version had a cream body background that leaked visually).
//   - Subtle hover lifts the whole card when interactive.
//   - Chevron animates rotation; whole header is the hit target.

import React from 'react';

const C = {
  forestInk: '#1F3A2C',
  forest: '#2A5741',
  sage: '#4A6B54',
  sageBright: '#6B9E80',
  gold: '#C9A84C',
  goldBright: '#E5B948',
  rose: '#C2526E',
  border: 'rgba(31,58,44,0.08)',
  borderHover: 'rgba(31,58,44,0.15)',
  shadow: '0 1px 2px rgba(31,58,44,0.04), 0 0 0 1px transparent',
  shadowHover: '0 4px 12px rgba(31,58,44,0.07), 0 0 0 1px rgba(31,58,44,0.04)',
  paper: '#FFFFFF',
  muted: '#7E8F84',
  ink: '#3D4F43',
};

const F = {
  sans: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
};

// Each section has its own accent color so they look related but
// not identical. Subtle differentiation: a 4px left bar in the
// section's color. Helps the eye distinguish sections at a glance.
const ACCENTS = {
  about:       { bar: C.muted,      label: 'CLIENT INFO'  },
  soap:        { bar: C.sage,       label: 'SOAP NOTES'   },
  patterns:    { bar: C.gold,       label: 'BODY PATTERNS' },
  preferences: { bar: C.sageBright, label: 'SETTINGS'      },
  medical:     { bar: C.rose,       label: 'MEDICAL'       },
  timeline:    { bar: C.forest,     label: 'ACTIVITY'      },
};

export default function ProfileSection({
  accent = 'soap',
  title,
  trailingLabel,
  count,
  isOpen,
  onToggle,
  children,
  order = 0,
}) {
  const [hover, setHover] = React.useState(false);
  const interactive = typeof onToggle === 'function';
  const a = ACCENTS[accent] || ACCENTS.soap;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: C.paper,
        border: `1px solid ${hover && interactive ? C.borderHover : C.border}`,
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
        boxShadow: hover && interactive ? C.shadowHover : C.shadow,
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        position: 'relative',
        animation: `bm-cp-rise 0.45s ${order * 70}ms cubic-bezier(0.2, 0.6, 0.2, 1) both`,
      }}
    >
      <style>{`
        @keyframes bm-cp-rise {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* 4px vertical accent bar on the left */}
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: 4,
        background: a.bar,
      }} />

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
          gap: 14,
          padding: '16px 18px 16px 22px',
          cursor: interactive ? 'pointer' : 'default',
          userSelect: 'none',
          minHeight: 64,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: a.bar,
            letterSpacing: '0.14em',
            fontFamily: F.sans,
            marginBottom: 3,
          }}>
            {a.label}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            flexWrap: 'wrap',
          }}>
            <h3 style={{
              fontFamily: F.sans,
              fontWeight: 700,
              fontSize: 17,
              color: C.forestInk,
              margin: 0,
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}>
              {title}
            </h3>
            {typeof count === 'number' && count > 0 && (
              <span style={{
                fontFamily: F.sans,
                fontSize: 12,
                color: C.muted,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {count}
              </span>
            )}
            {trailingLabel && (
              <span style={{
                fontFamily: F.sans,
                fontSize: 12,
                color: C.muted,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {trailingLabel}
              </span>
            )}
          </div>
        </div>

        {interactive && (
          <button
            aria-label={isOpen ? 'Collapse section' : 'Expand section'}
            style={{
              flexShrink: 0,
              background: 'transparent',
              border: 'none',
              padding: 6,
              cursor: 'pointer',
              borderRadius: 6,
              color: C.muted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              <path d="M4 2l4 4-4 4" />
            </svg>
          </button>
        )}
      </div>

      {isOpen && (
        <div style={{
          padding: '4px 20px 20px 22px',
          background: C.paper,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}
