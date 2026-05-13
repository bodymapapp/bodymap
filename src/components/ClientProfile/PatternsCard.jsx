// src/components/ClientProfile/PatternsCard.jsx
//
// The moat. Shows the therapist this client's recurring body-map
// zones aggregated across every session. Each zone shows count + bar
// of how often it has come up across the client's total sessions.
//
// Three groups:
//   FOCUS (front)  zones the therapist worked on the front body
//   FOCUS (back)   zones worked on the back body
//   AVOID          zones the client asked to skip (sensitive,
//                  injury, post-surgery, etc)
//
// Empty state: friendly nudge to fill out intake before the first
// session.

import React from 'react';
import { C, F, S } from './tokens';
import { zoneLabel } from '../../lib/bodyZones';

export default function PatternsCard({ patterns, totalSessions }) {
  if (!patterns) return null;
  const { topFrontZones = [], topBackZones = [], topAvoidZones = [] } = patterns;
  const hasFront = topFrontZones.length > 0;
  const hasBack = topBackZones.length > 0;
  const hasAvoid = topAvoidZones.length > 0;
  const empty = !hasFront && !hasBack && !hasAvoid;

  return (
    <Card>
      <SectionHeader icon="🧭" label="Patterns" subtitle="Recurring body zones across sessions" />
      {empty ? (
        <EmptyState>
          No patterns yet. Send an intake form so the body map starts collecting data.
        </EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: S.lg }}>
          {hasFront && (
            <ZoneGroup
              title="Focus, front"
              zones={topFrontZones}
              totalSessions={totalSessions}
              accent={C.sage}
              bgFill={C.sageBg}
            />
          )}
          {hasBack && (
            <ZoneGroup
              title="Focus, back"
              zones={topBackZones}
              totalSessions={totalSessions}
              accent={C.sage}
              bgFill={C.sageBg}
            />
          )}
          {hasAvoid && (
            <ZoneGroup
              title="Avoid"
              zones={topAvoidZones}
              totalSessions={totalSessions}
              accent={C.rose}
              bgFill={C.roseBg}
            />
          )}
        </div>
      )}
    </Card>
  );
}

function ZoneGroup({ title, zones, totalSessions = 0, accent, bgFill }) {
  return (
    <div>
      <div style={{
        fontSize: 10.5, fontWeight: 700,
        color: C.inkSoft,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {zones.map(z => {
          const pct = totalSessions > 0
            ? Math.min(100, Math.round((z.count / totalSessions) * 100))
            : 0;
          return (
            <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: S.md }}>
              <div style={{
                flex: 1,
                fontSize: 13.5,
                color: C.forest,
                fontFamily: F.sans,
                fontWeight: 500,
              }}>
                {zoneLabel(z.id)}
              </div>
              <div style={{
                position: 'relative',
                flex: 2,
                minWidth: 80,
                height: 18,
                background: bgFill,
                borderRadius: 4,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: accent,
                  transition: 'width 0.3s ease',
                }} />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: 8,
                  fontSize: 11,
                  fontWeight: 700,
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
