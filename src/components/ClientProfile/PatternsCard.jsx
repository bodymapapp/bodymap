// src/components/ClientProfile/PatternsCard.jsx
//
// Body-map intelligence content for the Patterns section.
//
// Visual moat: two body silhouettes (front + back) side by side
// showing recurring zones as scaled colored heat dots. Sage for
// focus zones, rose for avoid zones. Dot size grows with how often
// the zone has come up across sessions.
//
// Below the silhouettes: compact zone breakdown listing the top
// front/back/avoid zones with counts. Together they reinforce
// each other: silhouette for the at-a-glance read, list for the
// detail.
//
// Card chrome + collapsible header is provided by ProfileSection
// in index.jsx; this component returns content only.

import React from 'react';
import BodyDiagram from '../BodyDiagram';
import EmptyState from './EmptyStates';
import { zoneLabel, zonesToBodyDiagram } from '../../lib/bodyZones';
import { zoneOpacity } from '../../lib/sessionIntelligence';

const C = {
  forest: '#1F3A2C',
  sage: '#4A6B54',
  sageBg: '#F0F7F2',
  inkSoft: '#6F7B6C',
  muted: '#98A395',
  rose: '#9A3B5E',
  roseBg: '#FCE5E0',
  paper: '#FFFFFF',
  cream: '#FBF8F1',
  lineFaint: '#E8E0D0',
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
      <EmptyState
        kind="patterns"
        headline="The body map starts here"
        body="As sessions are recorded, the recurring zones this client cares about will light up on a body silhouette right here."
      />
    );
  }

  // Build the heatmap input for BodyDiagram. Each zone's "opacity" is
  // its share of the client's total sessions (absolute), so the shade
  // means the same thing on every client rather than each client maxing
  // out their own busiest zone.
  const allFocusZones = [...topFrontZones, ...topBackZones];
  const allAvoidZones = topAvoidZones;

  // For the silhouette, we use simple zone IDs and translate them via
  // zonesToBodyDiagram. The diagram needs front/back split separately
  // since one silhouette renders front and another back; same zone
  // labels can light up either or both depending on the zone.
  const heatmapFocusFront = {};
  const heatmapFocusBack = {};
  for (const z of allFocusZones) {
    const { frontIds, backIds } = zonesToBodyDiagram([z.id]);
    const opacity = zoneOpacity(z.count, totalSessions);
    for (const id of frontIds) {
      heatmapFocusFront[id] = { opacity, count: z.count };
    }
    for (const id of backIds) {
      heatmapFocusBack[id] = { opacity, count: z.count };
    }
  }

  const heatmapAvoidFront = {};
  const heatmapAvoidBack = {};
  for (const z of allAvoidZones) {
    const { frontIds, backIds } = zonesToBodyDiagram([z.id]);
    const opacity = zoneOpacity(z.count, totalSessions);
    for (const id of frontIds) {
      heatmapAvoidFront[id] = { opacity, count: z.count };
    }
    for (const id of backIds) {
      heatmapAvoidBack[id] = { opacity, count: z.count };
    }
  }

  return (
    <div>
      {/* Silhouettes panel: front + back side by side.
          On mobile this fits inside the section card; the two SVGs
          are sized so even at the smallest viewport they sit
          neatly together with space for a center label. */}
      <div style={{
        background: C.cream,
        border: `1px solid ${C.lineFaint}`,
        borderRadius: 12,
        padding: '20px 12px 14px',
        marginBottom: 14,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'flex-start',
          gap: 8,
        }}>
          <BodyView
            label="Front"
            focus={heatmapFocusFront}
            avoid={heatmapAvoidFront}
          />
          <BodyView
            label="Back"
            focus={heatmapFocusBack}
            avoid={heatmapAvoidBack}
          />
        </div>
        <Legend />
      </div>

      {/* Compact zone breakdown for the detail */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {hasFront && (
          <ZoneList
            title="Focus, front"
            zones={topFrontZones}
            totalSessions={totalSessions}
            accent={C.sage}
            bgFill={C.sageBg}
          />
        )}
        {hasBack && (
          <ZoneList
            title="Focus, back"
            zones={topBackZones}
            totalSessions={totalSessions}
            accent={C.sage}
            bgFill={C.sageBg}
          />
        )}
        {hasAvoid && (
          <ZoneList
            title="Avoid"
            zones={topAvoidZones}
            totalSessions={totalSessions}
            accent={C.rose}
            bgFill={C.roseBg}
          />
        )}
      </div>
    </div>
  );
}

function BodyView({ label, focus, avoid }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <BodyDiagram
        mode="heatmap"
        heatmapFocus={focus}
        heatmapAvoid={avoid}
        size="md"
      />
      <div style={{
        marginTop: 4,
        fontSize: 10.5,
        fontWeight: 700,
        color: C.muted,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        fontFamily: F.sans,
      }}>
        {label}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div style={{
      marginTop: 10,
      paddingTop: 10,
      borderTop: `1px solid ${C.lineFaint}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
        <LegendItem gradient="linear-gradient(90deg, #E4EFE7, #16271D)" label="Focus" />
        <LegendItem gradient="linear-gradient(90deg, #F6DBE2, #6E1326)" label="Avoid" />
      </div>
      <span style={{
        fontSize: 10.5,
        color: C.muted,
        fontStyle: 'italic',
        fontFamily: F.sans,
        textAlign: 'center',
        lineHeight: 1.4,
      }}>
        Darker = bigger share of this client's sessions, same scale for every client. Bigger dot = more sessions.
      </span>
    </div>
  );
}

function LegendItem({ gradient, label }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11,
      color: C.inkSoft,
      fontFamily: F.sans,
      fontWeight: 600,
    }}>
      <span style={{
        width: 28,
        height: 10,
        borderRadius: 5,
        background: gradient,
      }}/>
      {label}
    </span>
  );
}

function ZoneList({ title, zones, totalSessions = 0, accent, bgFill }) {
  return (
    <div>
      <div style={{
        fontSize: 10.5, fontWeight: 700,
        color: C.muted,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        marginBottom: 8,
        fontFamily: F.sans,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {zones.map(z => {
          const pct = totalSessions > 0
            ? Math.min(100, Math.round((z.count / totalSessions) * 100))
            : 0;
          return (
            <div key={z.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: C.forest, fontFamily: F.sans, fontWeight: 500 }}>
                {zoneLabel(z.id)}
              </div>
              <div style={{ position: 'relative', height: 18, background: bgFill, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: accent, transition: 'width 0.3s ease' }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  paddingRight: 8,
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
