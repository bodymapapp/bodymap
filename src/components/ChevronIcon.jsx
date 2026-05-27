// src/components/ChevronIcon.jsx
//
// Site-wide standardized chevron + round chevron button for collapse
// and expand surfaces. Promoted from ScheduleDashboard's CockpitSection
// pattern (Phase 22, HK May 25 2026) after HK noted May 27 2026:
//
//   "See the chevron example in the snapshot. Will be easier for our
//    persona of 70 year old to use those. Standardize them across the
//    website and add to the design principles."
//
// Two exports:
//
// 1. <ChevronIcon open color /> renders the 14x14 SVG only. Use it
//    inline when you have your own button container and just need the
//    rotating glyph.
//
// 2. <ChevronButton open onClick /> renders the full 34x34 round
//    button. Forest filled when open with white chevron; sage cream
//    tinted when closed with forest chevron. Generous tap target,
//    soft shadow when active, smooth 180deg rotate animation. This is
//    the canonical pattern for collapse/expand controls anywhere on
//    the site.
//
// Why a circle button matters: our 70-year-old massage therapist
// persona has lower fine-motor precision and needs a tap target much
// larger than a tiny inline SVG. The round button reads unambiguously
// as a control. Color contrast between open and closed states adds an
// at-a-glance read of section state without requiring the user to
// process the chevron rotation.

import React from 'react';

export function ChevronIcon({ open = false, color = '#fff', size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      aria-hidden="true"
    >
      <polyline points="3 5 7 9 11 5" />
    </svg>
  );
}

export function ChevronButton({
  open = false,
  onClick,
  size = 34,
  // Optional override colors. Defaults to forest + sage cream tint.
  openBg = '#2A5741',
  openColor = '#fff',
  closedBg = '#EEF3EE',
  closedColor = '#2A5741',
  ariaLabel,
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={open}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: open ? openBg : closedBg,
        color: open ? openColor : closedColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.22s ease, box-shadow 0.22s ease',
        boxShadow: open ? '0 2px 6px rgba(42,87,65,0.20)' : 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <ChevronIcon open={open} color={open ? openColor : closedColor} />
    </div>
  );
}

/**
 * RoundIconButton: standardized circular button for any single-glyph
 * affordance: close (×), help (?), navigation (‹ ›), add (+), etc.
 *
 * HK May 27 2026 design principle 25 extension: every circular control
 * across the product uses this same sage-cream tint with forest
 * content. Sister to ChevronButton.
 *
 * Variants:
 *   - tone='neutral' (default): sage-cream bg, forest content
 *   - tone='filled': forest bg, white content (for primary actions)
 *   - tone='outline': white bg, forest content with forest border
 */
export function RoundIconButton({
  onClick,
  children,
  ariaLabel,
  size = 36,
  tone = 'neutral',
  fontSize = 18,
  disabled = false,
}) {
  let bg = '#EEF3EE';
  let color = '#2A5741';
  let border = 'none';
  if (tone === 'filled') {
    bg = '#2A5741';
    color = '#FFFFFF';
  } else if (tone === 'outline') {
    bg = '#FFFFFF';
    color = '#2A5741';
    border = '1.5px solid #2A5741';
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: bg,
        color: color,
        border: border,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        padding: 0,
        fontFamily: 'inherit',
        fontSize: fontSize,
        fontWeight: 500,
        lineHeight: 1,
        transition: 'background 0.18s ease, box-shadow 0.18s ease',
        boxShadow: tone === 'filled' ? '0 2px 6px rgba(42,87,65,0.18)' : 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {children}
    </button>
  );
}

export default ChevronButton;
