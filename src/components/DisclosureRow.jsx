// src/components/DisclosureRow.jsx
//
// Compact disclosure row used in Settings to replace stacked
// expanded cards. One row per setting:
//   - Collapsed: ~52px tall, shows icon + title + value summary
//     on the right + chevron-down
//   - Expanded: pushes the editor inline below; chevron-up
//
// Multi-row groups should manage which row is open at a time so
// the page stays short. Pattern (in parent):
//   const [openRow, setOpenRow] = useState('hours');
//   <DisclosureRow open={openRow === 'hours'} onToggle={() => setOpenRow(openRow === 'hours' ? null : 'hours')} ... />
//
// Per HK May 10 2026 design principle: "I would rather have no
// scroll" + "modern ways of doing it." Disclosure rows are the
// iOS Settings pattern, well-understood by therapists.

import React from 'react';
import { ChevronButton } from './ChevronIcon';

const C = {
  forest: '#2A5741',
  darkText: '#3D4A42',
  gray: '#6B7280',
  border: '#DDD4C2',
  rowBg: '#FFFFFF',
  rowBgOpen: '#FFFFFF',
  divider: '#EAE5DA',
};

export default function DisclosureRow({
  icon,            // tabler-style emoji or React node, displayed on left
  title,           // e.g. "Working hours"
  summary,         // e.g. "Mon-Fri, 9:00 to 5:00" — shown when collapsed
  open = false,
  onToggle,
  children,        // editor body, rendered when open
  defaultOpen,     // starting state (when row should be open by default; rare)
  highlight,       // when true, draws the row in forest border to draw attention
  taxonomyId,      // optional, e.g. "2.1.6", shown as a small italic Georgia tag before the icon
}) {
  return (
    <div style={{
      background: C.rowBg,
      border: `1px solid ${highlight ? C.forest : C.border}`,
      borderRadius: 12,
      marginBottom: 8,
      overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      <button
        onClick={onToggle}
        type="button"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'system-ui',
          borderBottom: open ? `0.5px solid ${C.divider}` : 'none',
        }}
      >
        {taxonomyId && (
          <span style={{
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            fontSize: 10,
            fontWeight: 600,
            color: C.gray,
            letterSpacing: '0.4px',
            minWidth: 26,
            display: 'inline-block',
            textAlign: 'right',
            flexShrink: 0,
          }}>
            {taxonomyId}
          </span>
        )}
        {icon && (
          <span style={{
            fontSize: 16, color: C.forest, flexShrink: 0,
            width: 20, display: 'inline-flex', justifyContent: 'center',
          }}>
            {icon}
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 600,
            color: C.darkText,
            lineHeight: 1.3,
          }}>
            {title}
          </span>
          {summary && (
            <span style={{
              display: 'block',
              fontSize: 11,
              color: C.gray,
              marginTop: 2,
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {summary}
            </span>
          )}
        </span>
        <ChevronButton open={open} />
      </button>
      {open && (
        <div style={{ padding: '12px 14px' }}>
          {children}
        </div>
      )}
    </div>
  );
}
