// src/components/ClientProfile/PreferencesCard.jsx
//
// Therapist-facing default preferences from the most recent
// completed session. Card chrome provided by ProfileSection.

import React from 'react';
import EmptyState from './EmptyStates';
import { pressureLabel, preferenceLabel, goalLabel } from '../../lib/bodyZones';

const C = {
  forest: '#1F3A2C',
  sage: '#6B9E80',
  muted: '#98A395',
  inkSoft: '#6F7B6C',
  lineFaint: '#E8E0D0',
};

const F = {
  sans: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
};

export default function PreferencesCard({ preferences }) {
  if (!preferences) {
    return (
      <EmptyState
        kind="preferences"
        headline="Their preferences land here"
        body="Pressure, temperature, music, lighting, draping. Set automatically from the first completed session, so you know how to set up next time."
      />
    );
  }

  const rows = [
    { label: 'Pressure', render: () => <PressureDots level={preferences.pressure} /> },
    preferences.goal && { label: 'Goal', value: goalLabel(preferences.goal) },
    preferences.table_temp && { label: 'Table temp', value: preferenceLabel('table_temp', preferences.table_temp) },
    preferences.room_temp && { label: 'Room temp', value: preferenceLabel('room_temp', preferences.room_temp) },
    preferences.music && { label: 'Music', value: preferenceLabel('music', preferences.music) },
    preferences.lighting && { label: 'Lighting', value: preferenceLabel('lighting', preferences.lighting) },
    preferences.conversation && { label: 'Conversation', value: preferenceLabel('conversation', preferences.conversation) },
    preferences.draping && { label: 'Draping', value: preferenceLabel('draping', preferences.draping) },
    preferences.oil_pref && { label: 'Oil', value: preferenceLabel('oil_pref', preferences.oil_pref) },
  ].filter(Boolean);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '14px 22px',
    }}>
      {rows.map(r => (
        <Row key={r.label} label={r.label}>
          {r.render ? r.render() : <Value>{r.value}</Value>}
        </Row>
      ))}
    </div>
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
        marginBottom: 4,
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
    <div style={{ fontSize: 14, color: C.forest, fontFamily: F.sans, fontWeight: 500 }}>
      {children || <span style={{ color: C.muted, fontWeight: 400, fontStyle: 'italic' }}>Not set</span>}
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
            width: 10, height: 10, borderRadius: '50%',
            background: valid && i <= n ? C.sage : C.lineFaint,
          }}/>
        ))}
      </div>
      <span style={{ fontSize: 12, color: C.forest, fontWeight: 600, fontFamily: F.sans }}>
        {valid ? pressureLabel(n) : 'Not set'}
      </span>
    </div>
  );
}
