// src/components/ClientProfile/PreferencesCard.jsx
//
// Displays the therapist-facing default preferences for this client.
// Sourced from the most recent completed session (set in
// getClientProfile). Each preference is a labeled row: pressure has
// a dot-meter, the rest are text values.
//
// If no completed sessions yet, the card renders a friendly empty
// state pointing at the intake form, so a brand-new client doesn't
// feel like data is missing.
//
// Inline edit is queued for section 7; for now this is read-only.

import React from 'react';
import { C, F, S } from './tokens';
import { pressureLabel, preferenceLabel, goalLabel } from '../../lib/bodyZones';

export default function PreferencesCard({ preferences }) {
  if (!preferences) {
    return (
      <Card>
        <SectionHeader icon="🎚" label="Preferences" subtitle="Pressure, temp, music, draping" />
        <EmptyState>
          Set after the first completed session. Send an intake form so the
          client tells you their starting preferences.
        </EmptyState>
      </Card>
    );
  }

  const rows = [
    {
      label: 'Pressure',
      render: () => <PressureDots level={preferences.pressure} />,
    },
    preferences.goal && {
      label: 'Goal',
      value: goalLabel(preferences.goal),
    },
    preferences.table_temp && {
      label: 'Table temp',
      value: preferenceLabel('table_temp', preferences.table_temp),
    },
    preferences.room_temp && {
      label: 'Room temp',
      value: preferenceLabel('room_temp', preferences.room_temp),
    },
    preferences.music && {
      label: 'Music',
      value: preferenceLabel('music', preferences.music),
    },
    preferences.lighting && {
      label: 'Lighting',
      value: preferenceLabel('lighting', preferences.lighting),
    },
    preferences.conversation && {
      label: 'Conversation',
      value: preferenceLabel('conversation', preferences.conversation),
    },
    preferences.draping && {
      label: 'Draping',
      value: preferenceLabel('draping', preferences.draping),
    },
    preferences.oil_pref && {
      label: 'Oil',
      value: preferenceLabel('oil_pref', preferences.oil_pref),
    },
  ].filter(Boolean);

  return (
    <Card>
      <SectionHeader icon="🎚" label="Preferences" subtitle="Defaults from last completed session" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 18px' }}>
        {rows.map(r => (
          <Row key={r.label} label={r.label}>
            {r.render ? r.render() : <Value>{r.value}</Value>}
          </Row>
        ))}
      </div>
    </Card>
  );
}

function Row({ label, children }) {
  return (
    <div>
      <div style={{
        fontSize: 10.5, fontWeight: 700,
        color: C.muted,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        marginBottom: 3,
        fontFamily: F.sans,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Value({ children }) {
  return (
    <div style={{
      fontSize: 14,
      color: C.forest,
      fontFamily: F.sans,
      fontWeight: 500,
    }}>
      {children || <span style={{ color: C.muted, fontWeight: 400 }}>Not set</span>}
    </div>
  );
}

function PressureDots({ level }) {
  const n = parseInt(level, 10);
  const valid = !isNaN(n) && n >= 1 && n <= 5;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            width: 10, height: 10,
            borderRadius: '50%',
            background: valid && i <= n ? C.sage : C.lineFaint,
          }}/>
        ))}
      </div>
      <span style={{
        fontSize: 12,
        color: C.forest,
        fontWeight: 600,
        fontFamily: F.sans,
      }}>
        {valid ? pressureLabel(n) : 'Not set'}
      </span>
    </div>
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
