// src/components/ClientProfile/PatternsCard.jsx
//
// Body-map intelligence content for the Patterns section. Card
// chrome + collapsible header is provided by ProfileSection in
// index.jsx; this component returns content only.

import React from 'react';
import { zoneLabel } from '../../lib/bodyZones';

const C = {
  forest: '#1F3A2C',
  sage: '#6B9E80',
  sageBg: '#F0F7F2',
  inkSoft: '#6F7B6C',
  muted: '#98A395',
  rose: '#9A3B5E',
  roseBg: '#FCE5E0',
  paper: '#FFFFFF',
};

const F = {
  sans: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
};

export default function PatternsCard({ patterns, totalSessions }) {
  if (!patterns) return null;
  const { topFrontZones = [], topBackZones = [], topAvoidZones = [] } = patterns;
  const hasFront = topFrontZones.length > 0;
  const hasBack = topBackZones.length > 0;
  const hasAvoid = topAvoidZones.length > 0;
  const empty = !hasFront && !hasBack && !hasAvoid;

  if (empty) {
    return (
      <Empty>
        No patterns yet. Send an intake form so the body map starts
        collecting data across sessions.
      </Empty>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {hasFront && <ZoneGroup title="Focus, front" zones={topFrontZones} totalSessions={totalSessions} accent={C.sage} bgFill={C.sageBg} />}
      {hasBack && <ZoneGroup title="Focus, back" zones={topBackZones} totalSessions={totalSessions} accent={C.sage} bgFill={C.sageBg} />}
      {hasAvoid && <ZoneGroup title="Avoid" zones={topAvoidZones} totalSessions={totalSessions} accent={C.rose} bgFill={C.roseBg} />}
    </div>
  );
}

function ZoneGroup({ title, zones, totalSessions = 0, accent, bgFill }) {
  return (
    <div>
      <div style={{
        fontSize: 10.5, fontWeight: 700,
        color: C.muted,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        marginBottom: 10,
        fontFamily: F.sans,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {zones.map(z => {
          const pct = totalSessions > 0
            ? Math.min(100, Math.round((z.count / totalSessions) * 100))
            : 0;
          return (
            <div key={z.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 13.5, color: C.forest, fontFamily: F.sans, fontWeight: 500 }}>
                {zoneLabel(z.id)}
              </div>
              <div style={{ position: 'relative', height: 20, background: bgFill, borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: accent, transition: 'width 0.3s ease' }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  paddingRight: 9,
                  fontSize: 11, fontWeight: 700,
                  color: pct > 50 ? C.paper : C.forest,
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: F.sans,
                }}>
                  {z.count}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Empty({ children }) {
  return (
    <div style={{
      fontSize: 13,
      color: C.muted,
      fontFamily: F.sans,
      fontStyle: 'italic',
      lineHeight: 1.5,
    }}>
      {children}
    </div>
  );
}
