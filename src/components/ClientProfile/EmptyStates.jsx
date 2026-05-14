// src/components/ClientProfile/EmptyStates.jsx
//
// Shared empty-state component for the client profile sections.
// Each call gets a small line-drawing SVG illustration, a clear
// short headline, a friendly explanation, and optionally an action
// button. Avoids the "No X yet" pattern which reads as a failure;
// frames empty states as "you'll see this here once Y happens."

import React from 'react';

const C = {
  forest: '#1F3A2C',
  sage: '#4A6B54',
  sageBright: '#6B9E80',
  muted: '#8A9C90',
  inkSoft: '#5F6F62',
  paper: '#FFFFFF',
  cream: '#FBF8F1',
  lineFaint: '#E8E0D0',
};

const F = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
};

// Each illustration is a small (~64px) line drawing. Stroke-only,
// sage color. Reads as a quiet visual flourish, not a stock icon.

const Illustrations = {
  patterns: () => (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      {/* Stylized body silhouette, hollow */}
      <ellipse cx="32" cy="12" rx="6" ry="7" stroke={C.sage} strokeWidth="1.4" />
      <path d="M22 22 Q18 28 18 38 L18 52 Q18 56 22 56 L42 56 Q46 56 46 52 L46 38 Q46 28 42 22 Z" stroke={C.sage} strokeWidth="1.4" />
      {/* A scattered handful of dots, lightly placed */}
      <circle cx="26" cy="32" r="2" fill={C.sageBright} opacity="0.4" />
      <circle cx="38" cy="32" r="2" fill={C.sageBright} opacity="0.4" />
      <circle cx="32" cy="44" r="2.5" fill={C.sageBright} opacity="0.6" />
    </svg>
  ),
  preferences: () => (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      {/* Three sliders, ascending */}
      <line x1="14" y1="20" x2="50" y2="20" stroke={C.sage} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="22" cy="20" r="4" fill={C.paper} stroke={C.sage} strokeWidth="1.4" />
      <line x1="14" y1="32" x2="50" y2="32" stroke={C.sage} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="32" cy="32" r="4" fill={C.paper} stroke={C.sage} strokeWidth="1.4" />
      <line x1="14" y1="44" x2="50" y2="44" stroke={C.sage} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="42" cy="44" r="4" fill={C.paper} stroke={C.sage} strokeWidth="1.4" />
    </svg>
  ),
  medical: () => (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      {/* Soft plus / health cross in a circle */}
      <circle cx="32" cy="32" r="22" stroke={C.sage} strokeWidth="1.4" />
      <line x1="32" y1="20" x2="32" y2="44" stroke={C.sage} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="20" y1="32" x2="44" y2="32" stroke={C.sage} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  timeline: () => (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      {/* Vertical timeline with two empty bubbles */}
      <line x1="20" y1="16" x2="20" y2="48" stroke={C.sage} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="20" cy="22" r="4" fill={C.paper} stroke={C.sage} strokeWidth="1.4" />
      <circle cx="20" cy="42" r="4" fill={C.paper} stroke={C.sage} strokeWidth="1.4" />
      <line x1="30" y1="22" x2="48" y2="22" stroke={C.sage} strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
      <line x1="30" y1="42" x2="44" y2="42" stroke={C.sage} strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
    </svg>
  ),
  soap: () => (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      {/* Open notebook */}
      <path d="M18 14 L42 14 L46 18 L46 52 L18 52 Z" stroke={C.sage} strokeWidth="1.4" fill={C.paper} />
      <path d="M42 14 L42 18 L46 18" stroke={C.sage} strokeWidth="1.4" fill="none" />
      <line x1="24" y1="28" x2="40" y2="28" stroke={C.sage} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <line x1="24" y1="34" x2="40" y2="34" stroke={C.sage} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <line x1="24" y1="40" x2="36" y2="40" stroke={C.sage} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  ),
};

/**
 * EmptyState component.
 *
 * Props:
 *   kind:        which illustration to show (patterns | preferences |
 *                medical | timeline | soap)
 *   headline:    main message, short and clear
 *   body:        secondary line explaining when this fills up
 *   actionLabel: optional CTA button label
 *   onAction:    optional CTA click handler
 */
export default function EmptyState({ kind = 'patterns', headline, body, actionLabel, onAction }) {
  const Illustration = Illustrations[kind] || Illustrations.patterns;
  return (
    <div style={{
      textAlign: 'center',
      padding: '8px 16px 12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
        <Illustration />
      </div>
      <div style={{
        fontFamily: F.serif,
        fontSize: 16,
        fontWeight: 700,
        color: C.forest,
        marginBottom: 4,
        letterSpacing: '-0.005em',
      }}>
        {headline}
      </div>
      <div style={{
        fontSize: 12.5,
        color: C.muted,
        fontFamily: F.sans,
        lineHeight: 1.5,
        maxWidth: 320,
        margin: '0 auto',
      }}>
        {body}
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            marginTop: 14,
            background: C.forest,
            border: 'none',
            color: C.paper,
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: F.sans,
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
