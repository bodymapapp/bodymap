// src/components/CollapsibleSection.jsx
//
// The expand-on-tap row that turns Settings from a 22-card scroll into a
// summary list. Closed state shows: status dot + label + live summary +
// chevron. Open state additionally renders children below.
//
// Designed mobile-first (380px) but holds at desktop (max-width container
// imposed by parent). Tap target is the entire summary row (min-height 56px
// for accessibility on the 70-year-old persona).

import React from "react";

const C = {
  cream: '#FAF4E8',
  creamSoft: '#FAF7EE',
  forest: '#2A5741',
  forestInk: '#1F3A2C',
  sage: '#6B9E80',
  sageMute: '#98A395',
  gold: '#C9A84C',
  goldText: '#8B6F25',
  border: 'rgba(31,58,44,0.08)',
  borderHover: 'rgba(31,58,44,0.14)',
  ink: '#1F3A2C',
  inkSoft: '#6B7C68',
};

function StatusDot({ status }) {
  if (status === 'done') {
    return (
      <div style={{ width: 16, height: 16, borderRadius: '50%', background: C.forest, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#F0EAD9" strokeWidth="2.5" strokeLinecap="round"><path d="M3 6l2 2 4-4"/></svg>
      </div>
    );
  }
  if (status === 'attn') {
    return (
      <div style={{ width: 16, height: 16, borderRadius: '50%', background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke={C.forest} strokeWidth="2.4" strokeLinecap="round"><path d="M6 3v3M6 8.5h.01"/></svg>
      </div>
    );
  }
  return <div style={{ width: 16, height: 16, borderRadius: '50%', border: `1.4px solid #C8CDC4`, flexShrink: 0 }} />;
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
  children,
}) {
  if (hidden) return null;

  const handleClick = () => onToggle && onToggle(id);

  return (
    <div
      data-section-id={id}
      style={{
        background: '#fff',
        borderRadius: 14,
        marginBottom: 8,
        overflow: 'hidden',
        border: `0.5px solid ${C.border}`,
        transition: 'border-color 0.15s',
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
          padding: '14px 16px',
          cursor: 'pointer',
          userSelect: 'none',
          minHeight: 56,
          background: isOpen ? C.creamSoft : '#fff',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = C.creamSoft; }}
        onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = '#fff'; }}
      >
        {icon && (
          <div style={{ width: 24, height: 24, color: C.sage, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14.5,
            fontWeight: 500,
            color: C.forestInk,
            margin: 0,
            lineHeight: 1.25,
          }}>
            {label}
          </div>
          {summary && (
            <div style={{
              fontSize: 12,
              color: C.inkSoft,
              margin: '2px 0 0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.3,
            }}>
              {summary}
            </div>
          )}
        </div>
        <StatusDot status={status} />
        <svg
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="none"
          stroke={isOpen ? C.forest : '#B5BEB1'}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.18s',
          }}
        >
          <path d="M4 2l4 4-4 4" />
        </svg>
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
