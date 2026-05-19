// src/components/schedule/CollapsibleGroup.jsx
//
// Reusable collapsible wrapper following the Billing DeepDiveCard
// pattern. Single design principle: clear collapsibles for the 70yo
// persona.
//
// Visual structure (clear, scannable, big tap targets):
//   ┌──────────────────────────────────────┐
//   │ [icon] Title             [chevron]   │
//   │        teaser line                   │
//   └──────────────────────────────────────┘
//   when expanded: body content slides down
//
// Tokens:
//   - 36x36 icon tile, cream-deep when closed, sage-tint when open
//   - 14px bold dark title + 12px gray teaser
//   - 32x32 circular chevron pill, sage-tint when closed, forest when
//     open, white chevron rotates 180deg
//   - 16px card radius, soft shadow, border darkens to sage when open
//
// HK May 19 2026: introduced as the standard pattern for grouping
// rail cards on the Schedule page. Pattern lifted verbatim from
// BillingDashboardV2.DeepDiveCard so therapists get the same
// interaction language across Schedule and Billing.

import React, { useState } from 'react';

const T = {
  cream:      '#FAF6EE',
  creamDeep:  '#F5EFE0',
  creamEdge:  '#EDE6D6',
  forest:     '#2A5741',
  forestDeep: '#1F4131',
  sage:       '#6B9E80',
  sageSoft:   '#B7D1AB',
  sageTint:   '#F0F6EE',
  ink:        '#1F2937',
  gray500:    '#6B7280',
  gray400:    '#9CA3AF',
  shadowSoft: '0 1px 3px rgba(31, 65, 49, 0.06), 0 1px 2px rgba(31, 65, 49, 0.04)',
  shadowOpen: '0 4px 16px rgba(31, 65, 49, 0.08)',
  sans:       '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
};

function ChevronPill({ open }) {
  return (
    <div style={{
      width: 32,
      height: 32,
      borderRadius: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: open ? T.forest : T.sageTint,
      transition: 'background 0.2s ease',
      flexShrink: 0,
    }}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        style={{
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
        }}
      >
        <path
          d="M3 5 L7 9 L11 5"
          stroke={open ? '#FFFFFF' : T.forest}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

export default function CollapsibleGroup({
  icon,
  title,
  teaser,
  defaultOpen = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 16,
      overflow: 'hidden',
      border: `1px solid ${open ? T.sageSoft : T.creamEdge}`,
      boxShadow: open ? T.shadowOpen : T.shadowSoft,
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      fontFamily: T.sans,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '14px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
          fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          flexShrink: 0,
          background: open ? T.sageTint : T.creamDeep,
          color: T.forest,
          transition: 'background 0.2s ease',
        }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: T.ink,
            lineHeight: 1.2,
            marginBottom: 2,
          }}>{title}</div>
          {teaser && (
            <div style={{
              fontSize: 12,
              color: T.gray500,
              lineHeight: 1.4,
            }}>{teaser}</div>
          )}
        </div>
        <ChevronPill open={open} />
      </button>
      {open && (
        <div style={{
          padding: '14px 16px 16px',
          borderTop: `1px solid ${T.creamDeep}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}
