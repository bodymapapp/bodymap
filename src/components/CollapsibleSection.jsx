// src/components/CollapsibleSection.jsx
//
// Apple Settings style expandable row. Closed: status indicator,
// icon, label + summary line, time badge inline, chevron.
// Open: same row chrome plus body content below.
//
// Visual hierarchy (calmest -> loudest, from screenshot critique):
//   - Taxonomy "1.1" tiny mono number, top-left of icon column,
//     dim sage gray. Doesn't compete with the label.
//   - Icon: 22px sage stroke, left of label
//   - Label: 15px regular, forest ink, primary
//   - Summary: 12.5px gray, secondary, with optional time badge
//     INLINE before the summary text (chip is now small and pale)
//   - Status dot: only shown for "todo" or "attn", hidden when "done"
//     (cleaner, less green-checkmark fatigue)
//   - Chevron: 10px, very light, only stroke
//
// `grouped` prop (default true): drops per-row border, radius, and
// marginBottom so rows can sit inside a SettingsGroup container with
// hairline dividers.

import React from "react";

const C = {
  cream: '#FAF4E8',
  creamSoft: '#FAF7EE',
  pageBeige: '#FBF8F1',
  forest: '#2A5741',
  forestInk: '#1F3A2C',
  sage: '#7A9C84',
  sageMute: '#9CB0A0',
  gold: '#C9A84C',
  goldText: '#B0902F',
  goldChip: '#FBF4DC',
  goldChipBorder: 'rgba(201,168,76,0.22)',
  border: 'rgba(31,58,44,0.07)',
  borderHover: 'rgba(31,58,44,0.12)',
  ink: '#1F3A2C',
  inkSoft: '#6F7B6C',
  numTaxonomy: '#A8B3A4',
};

function StatusIndicator({ status }) {
  // Don't show anything for "done" — completed setup is uneventful by
  // default. This calms the right edge of every row.
  if (status === 'done') return null;
  if (status === 'attn') {
    return (
      <div style={{
        width: 14, height: 14, borderRadius: '50%',
        background: C.gold, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
          <path d="M6 3v3M6 8.5h.01"/>
        </svg>
      </div>
    );
  }
  // todo: hollow ring, calm
  return (
    <div style={{
      width: 13, height: 13, borderRadius: '50%',
      border: `1.4px solid #C8CDC4`, flexShrink: 0,
    }} />
  );
}

function TimeChip({ children }) {
  return (
    <span style={{
      fontSize: 10.5,
      color: C.goldText,
      background: C.goldChip,
      border: `1px solid ${C.goldChipBorder}`,
      padding: '2px 7px',
      borderRadius: 9,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      letterSpacing: '0.01em',
      verticalAlign: 'middle',
      marginRight: 6,
    }}>{children}</span>
  );
}

export default function CollapsibleSection({
  id,
  label,
  summary,
  status = 'todo',
  icon,
  isOpen,
  onToggle,
  hidden = false,
  taxonomy,   // e.g. "1.1"
  timeBadge,  // e.g. "~30s"
  grouped = true,
  children,
}) {
  if (hidden) return null;

  const handleClick = () => onToggle && onToggle(id);

  const rowChrome = grouped ? {} : {
    background: '#fff',
    borderRadius: 14,
    marginBottom: 8,
    overflow: 'hidden',
    border: `0.5px solid ${C.border}`,
  };

  return (
    <div
      id={id}
      data-section-id={id}
      data-taxonomy={taxonomy || ''}
      data-search-text={`${label || ''} ${summary || ''}`.toLowerCase()}
      style={{
        ...rowChrome,
        transition: 'background 0.12s',
        background: isOpen ? C.creamSoft : (grouped ? 'transparent' : '#fff'),
      }}
    >
      <div
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          cursor: 'pointer',
          userSelect: 'none',
          minHeight: 54,
        }}
      >
        {/* Taxonomy + icon column. Stacks them vertically: the taxonomy
            number sits above the icon as a tiny mono cap, not inline
            with the label so it doesn't compete. Center-aligned vertically
            against the label column (via the parent row's alignItems:center).
            Do NOT stretch this column to row height or the small stack
            ends up centered in dead space and visually floats away from
            the label. */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 28,
          flexShrink: 0,
          gap: 2,
        }}>
          {taxonomy && (
            <span style={{
              fontSize: 9.5,
              color: C.numTaxonomy,
              fontWeight: 600,
              letterSpacing: '0.02em',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}>{taxonomy}</span>
          )}
          {icon && (
            <div style={{
              width: 22, height: 22, color: C.sage,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {icon}
            </div>
          )}
        </div>

        {/* Label + summary column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15,
            fontWeight: 500,
            color: C.forestInk,
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.005em',
          }}>
            {label}
          </div>
          {(summary || timeBadge) && (
            <div style={{
              fontSize: 12.5,
              color: C.inkSoft,
              margin: '3px 0 0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.35,
            }}>
              {timeBadge && <TimeChip>{timeBadge}</TimeChip>}
              {summary}
            </div>
          )}
        </div>

        {/* Right rail: status indicator + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <StatusIndicator status={status} />
          <svg
            width="10" height="10" viewBox="0 0 12 12"
            fill="none"
            stroke={isOpen ? C.forest : '#B5BEB1'}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.18s',
            }}
          >
            <path d="M4 2l4 4-4 4"/>
          </svg>
        </div>
      </div>

      {isOpen && (
        <div style={{
          background: C.creamSoft,
          padding: '4px 14px 14px',
          borderTop: `0.5px solid ${C.border}`,
          animation: 'bm-collapse-in 0.18s ease-out',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}
