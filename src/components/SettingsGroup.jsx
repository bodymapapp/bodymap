// src/components/SettingsGroup.jsx
//
// Apple Settings style grouped list panel. Wraps a sequence of
// CollapsibleSection rows (or any list rows) inside a single rounded
// surface with hairline dividers between adjacent rows.
//
// Visual rules (lifted from iOS Settings):
//   - Single rounded container (radius 14)
//   - White surface on cream-tinted page
//   - Hairline divider between rows, indented to align with row content
//     (starts under the icon column, not at the edge)
//   - No per-row border
//   - No per-row margin between siblings
//
// This component just provides the container chrome. The rows
// inside are responsible for their own padding and content. The
// CollapsibleSection component reads its `grouped` prop and drops
// its own border/radius/marginBottom when inside a group.

import React from "react";

const C = {
  border: 'rgba(31,58,44,0.07)',
};

export default function SettingsGroup({ children }) {
  // Filter out null/false/undefined children (e.g. matchesSearch hidden ones)
  const items = React.Children.toArray(children).filter(c => c && c !== false);
  if (items.length === 0) return null;

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      overflow: 'hidden',
      border: `0.5px solid ${C.border}`,
      marginBottom: 18,
      boxShadow: '0 1px 2px rgba(31,58,44,0.025)',
    }}>
      {items.map((child, i) => (
        <div key={child.key || i} style={i > 0 ? {
          borderTop: `0.5px solid ${C.border}`,
        } : null}>
          {child}
        </div>
      ))}
    </div>
  );
}
