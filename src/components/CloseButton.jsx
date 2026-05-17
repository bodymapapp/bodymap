// src/components/CloseButton.jsx
//
// Standard close affordance for modals, sheets, and drawers
// across the platform.
//
// Per HK design principle May 16 2026: "A 70 year old should be
// able to figure it out." A bare × glyph fails this test for two
// reasons:
//   1. Older users don't reliably read × as "close." Some try to
//      type into it. Some assume it's a delete icon.
//   2. The bare × is usually the smallest tap target on a screen,
//      which is a real usability failure for thumbs.
//
// This component renders a labeled pill button that is unambiguous,
// hits the 44x44 tap-target minimum, and inherits the design system
// tokens.
//
// USAGE
//   <CloseButton onClick={onClose} />
//   <CloseButton onClick={onClose} label="Done" />
//   <CloseButton onClick={onClose} label="Cancel" disabled={saving} />
//
// PROPS
//   onClick       Handler. Required.
//   label         Button text. Defaults to "Close". Use "Cancel"
//                 inside forms where data could be lost. Use "Done"
//                 after a successful action.
//   disabled      Lock the button while a parent operation is in
//                 flight (e.g. saving=true).
//   ariaLabel     Override aria-label. Defaults to the label.

import React from 'react';

const C = {
  ink: '#1F2937',
  inkSoft: '#6B7280',
  inkFade: '#9CA3AF',
  border: '#E8E4DC',
  hover: '#F3F4F6',
  hoverBorder: '#D1D5DB',
};

export default function CloseButton({
  onClick,
  label = 'Close',
  disabled = false,
  ariaLabel,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || label}
      style={{
        // Visual: rounded pill, neutral. Reads as "secondary action."
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 80,
        minHeight: 44,                 // accessibility tap target
        padding: '8px 18px',
        background: '#FFFFFF',
        border: `1.5px solid ${C.border}`,
        borderRadius: 999,
        color: disabled ? C.inkFade : C.inkSoft,
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: '0.01em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = C.hover;
        e.currentTarget.style.borderColor = C.hoverBorder;
        e.currentTarget.style.color = C.ink;
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = '#FFFFFF';
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.color = C.inkSoft;
      }}
    >
      {label}
    </button>
  );
}
