// src/components/ClientProfile/MedicalCard.jsx
//
// Surfaces medical conditions and contraindications across all of
// this client's sessions. Aggregated by getClientProfile from the
// medical_conditions array and med_flag column on sessions.
//
// Each item rendered as a chip with a subtle red/rose tone to signal
// 'pay attention.' Severity escalation (red vs amber) is queued for
// section 7 when we wire med_flag's specific values to known
// contraindication categories.

import React from 'react';
import { C, F, S } from './tokens';

export default function MedicalCard({ medicalFlags = [] }) {
  const has = medicalFlags.length > 0;
  return (
    <Card>
      <SectionHeader
        icon="⚕️"
        label="Medical flags"
        subtitle={has ? 'Things to keep in mind' : 'Ask about anything new at next visit'}
      />
      {has ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {medicalFlags.map((f, i) => (
            <Chip key={i} flag={f} />
          ))}
        </div>
      ) : (
        <EmptyState>No flags on file.</EmptyState>
      )}
    </Card>
  );
}

function Chip({ flag }) {
  // Two visual tones. Conditions surface in the intake form
  // (e.g., 'pregnancy', 'recent surgery') and use rose. Therapist-
  // entered med_flag values use amber to differentiate the source.
  const tone = flag.type === 'flag'
    ? { bg: '#FEF3C7', border: '#FCD34D', text: C.amber }
    : { bg: C.roseBg, border: '#F8B4B4', text: C.rose };

  return (
    <span
      title={flag.note || undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '5px 10px',
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: 16,
        fontSize: 12.5,
        fontWeight: 600,
        color: tone.text,
        fontFamily: F.sans,
        cursor: flag.note ? 'help' : 'default',
      }}
    >
      {flag.text}
      {flag.note && (
        <span style={{ fontSize: 10, opacity: 0.65 }}>ⓘ</span>
      )}
    </span>
  );
}

function Card({ children }) {
  return (
    <div style={{
      background: C.paper,
      border: `1px solid ${C.lineFaint}`,
      borderRadius: 14,
      padding: S.xl,
      marginBottom: S.lg,
      boxShadow: '0 1px 2px rgba(28,43,34,0.03)',
    }}>
      {children}
    </div>
  );
}

function SectionHeader({ icon, label, subtitle }) {
  return (
    <div style={{ marginBottom: S.lg }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 3,
      }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <h2 style={{
          margin: 0,
          fontFamily: F.serif,
          fontSize: 17, fontWeight: 700,
          color: C.forest,
          lineHeight: 1.2,
        }}>
          {label}
        </h2>
      </div>
      {subtitle && (
        <div style={{
          fontSize: 12,
          color: C.muted,
          fontFamily: F.sans,
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div style={{
      fontSize: 13,
      color: C.muted,
      fontFamily: F.sans,
      lineHeight: 1.5,
      padding: '6px 0',
    }}>
      {children}
    </div>
  );
}
