// src/components/ClientProfile/MedicalCard.jsx
//
// Medical flags + conditions. Card chrome provided by ProfileSection.

import React from 'react';

const C = {
  rose: '#9A3B5E',
  roseBg: '#FCE5E0',
  roseBorder: '#F8B4B4',
  amber: '#92400E',
  amberBg: '#FEF3C7',
  amberBorder: '#FCD34D',
  muted: '#98A395',
};

const F = {
  sans: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
};

export default function MedicalCard({ medicalFlags = [] }) {
  if (medicalFlags.length === 0) {
    return (
      <Empty>
        No flags on file. Ask about anything new at the next visit.
      </Empty>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {medicalFlags.map((f, i) => (
        <Chip key={i} flag={f} />
      ))}
    </div>
  );
}

function Chip({ flag }) {
  const tone = flag.type === 'flag'
    ? { bg: C.amberBg, border: C.amberBorder, text: C.amber }
    : { bg: C.roseBg, border: C.roseBorder, text: C.rose };

  return (
    <span
      title={flag.note || undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 12px',
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: 18,
        fontSize: 13,
        fontWeight: 600,
        color: tone.text,
        fontFamily: F.sans,
        cursor: flag.note ? 'help' : 'default',
      }}
    >
      {flag.text}
      {flag.note && <span style={{ fontSize: 10, opacity: 0.65 }}>ⓘ</span>}
    </span>
  );
}

function Empty({ children }) {
  return (
    <div style={{ fontSize: 13, color: C.muted, fontFamily: F.sans, fontStyle: 'italic', lineHeight: 1.5 }}>
      {children}
    </div>
  );
}
