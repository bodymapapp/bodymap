// src/components/DocumentLayout.jsx
//
// Shared layout shell for all four three-dot documents (Intake,
// Pre-Session, Post-Session Therapist, Post-Session Recap). Enforces
// a consistent 4-section structure so the documents feel like a
// system, not four different designs.
//
// Every document looks like this, top to bottom:
//
//   [ Toolbar: sticky doc-type label + Save as PDF ]
//   [ Identity band: doc badge + client name + visit pill + date ]
//   [ Sections grid:
//       Section 01 - On the body (left), Section 02 - Today's request (right)
//       Section 03 - Doc-specific primary content (full width)
//       Section 04 - Doc-specific secondary content (full width or split)
//   ]
//   [ Footer signature: brand + therapist + confidentiality ]
//
// The numbered "01 / 02 / 03 / 04" gold markers on each section make
// the structure visible at a glance. Same on every document.
//
// Sections 01 and 02 receive ready-made content (body diagrams +
// request pills) from this shell. Sections 03 and 04 take children
// nodes from the calling document for doc-specific content.

import React from 'react';
import BodyDiagram from './BodyDiagram';
import { zoneLabel } from '../lib/sessionIntelligence';

export const T = {
  cream: '#F9F5EE',
  creamAlt: '#F3EEE2',
  forest: '#1C2B22',
  sage: '#4A6B54',
  sageBg: '#EEF3EE',
  gold: '#C9A84C',
  goldBg: '#FAF3DC',
  rose: '#E8C5B5',
  ink: '#3D4F43',
  inkSoft: '#6B7F72',
  red: '#B91C1C',
  redBg: '#FDF2F2',
  redInk: '#7F1D1D',
  lineFaint: '#E8E0D0',
  white: '#FFFFFF',
  serif: "'Fraunces', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

// ────────────────── Atoms ──────────────────

export function Pill({ children, color, bg, large }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: bg || T.creamAlt, color: color || T.ink,
      padding: large ? '5px 12px' : '3px 9px',
      borderRadius: 20,
      fontSize: large ? 12 : 10.5,
      fontWeight: 600,
      lineHeight: 1.2,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

// The numbered section marker. Big gold number + small label.
// Used at the start of every section so structure is visible.
export function SectionMarker({ n, title, sub, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
      <span style={{
        fontFamily: T.serif,
        fontSize: 22,
        fontWeight: 600,
        color: accent || T.gold,
        lineHeight: 1,
        letterSpacing: '-0.5px',
      }}>{n}</span>
      <div>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: T.forest,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          lineHeight: 1.1,
        }}>{title}</div>
        {sub && <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 1, fontStyle: 'italic' }}>{sub}</div>}
      </div>
    </div>
  );
}

export function Card({ children, style = {}, accent }) {
  return (
    <div style={{
      background: T.white,
      borderRadius: 12,
      padding: '14px 16px',
      border: `1px solid ${T.lineFaint}`,
      boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
      borderLeft: accent ? `3px solid ${accent}` : `1px solid ${T.lineFaint}`,
      ...style,
    }}>{children}</div>
  );
}

// ────────────────── Layout ──────────────────

export default function DocumentLayout({
  // Required identity props
  docNumber,        // 1, 2, 3 or '3a'/'3b' for sub-docs
  docTotalParts,    // for the badge "of N", default 3
  docName,          // "Today's Intake", "Pre-Session Brief", etc.
  docAccent,        // Brand color for this doc (gold, sage, forest)

  // Client + session info
  client,
  session,
  therapist,
  visitNumber,
  isFirstVisit,
  isOverdue,

  // Section 01 + 02 are content-fixed by the shell
  cumulativeHeatmap = null,   // {frontFocus, frontAvoid, backFocus, backAvoid, count} | null
  showHeatmap = false,        // turn on for pre-session brief

  // Sections 03 and 04 vary per doc
  section03,        // { title, sub, content }
  section04,        // { title, sub, content }

  // Optional extra controls in the toolbar
  toolbarExtras,
}) {
  const totalParts = docTotalParts || 3;
  const sessionDate = new Date(session.created_at).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const therapistName = therapist?.business_name || therapist?.full_name || 'Your Practice';
  const therapistFullName = therapist?.full_name || '';
  const therapistPhone = therapist?.phone || null;
  const intakeUrl = therapist?.custom_url ? `${window.location.origin}/${therapist.custom_url}` : null;

  const focusAreasFront = session.front_focus || [];
  const focusAreasBack = session.back_focus || [];
  const avoidAreasFront = session.front_avoid || [];
  const avoidAreasBack = session.back_avoid || [];
  const allFocus = [...focusAreasFront, ...focusAreasBack];
  const allAvoid = [...avoidAreasFront, ...avoidAreasBack];

  const visitLabel = isFirstVisit ? 'First visit' : `Visit ${visitNumber}`;
  const completedPill = session.completed ? null : (
    <Pill bg="#FFFBEB" color="#92400E">Not yet complete</Pill>
  );

  return (
    <div style={{ background: T.cream, minHeight: '100vh', color: T.ink, fontFamily: T.sans }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          @page { size: A4; margin: 10mm; }
          .bm-doc-wrap { background: white !important; }
          .bm-doc-card { box-shadow: none !important; border: 1px solid #DDD7C7 !important; break-inside: avoid; }
        }
        * { box-sizing: border-box; }
        .bm-doc-top-row { display: grid; grid-template-columns: 320px 1fr; gap: 14px; }
        @media (max-width: 760px) {
          .bm-doc-top-row { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{
        background: T.forest, padding: '12px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 10, flexWrap: 'wrap',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span style={{ color: 'white', fontWeight: 600, fontSize: 13.5, letterSpacing: '0.3px' }}>
          {docName}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {toolbarExtras}
          <button onClick={() => window.print()} style={{
            background: T.gold, color: T.forest, border: 'none',
            padding: '7px 16px', borderRadius: 8,
            fontWeight: 700, fontSize: 12.5, cursor: 'pointer', letterSpacing: '0.2px',
          }}>Save as PDF</button>
        </div>
      </div>

      <div className="bm-doc-wrap" style={{ maxWidth: 880, margin: '0 auto', padding: '18px 18px 30px' }}>

        {/* ──────── Identity band ──────── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{
                fontSize: 11, fontWeight: 700,
                color: docAccent || T.gold,
                textTransform: 'uppercase', letterSpacing: '1.4px',
                marginBottom: 5,
              }}>
                Document {typeof docNumber === 'string' ? docNumber : docNumber} of {totalParts} · {docName}
              </div>
              <h1 style={{
                fontFamily: T.serif, fontSize: 'clamp(28px, 3.8vw, 38px)',
                fontWeight: 500, color: T.forest, margin: 0,
                letterSpacing: '-0.6px', lineHeight: 1.05,
              }}>
                {client?.name || 'Client'}
              </h1>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                <Pill bg={T.forest} color="white">{visitLabel}</Pill>
                <span style={{ fontSize: 12.5, color: T.inkSoft }}>{sessionDate}</span>
                {completedPill}
                {isOverdue && <Pill bg={T.redBg} color={T.red}>Overdue</Pill>}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11.5, color: T.inkSoft, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: T.forest, fontSize: 12.5 }}>{therapistFullName || therapistName}</div>
              {therapistFullName && therapistName !== therapistFullName && <div>{therapistName}</div>}
              {therapistPhone && <div>{therapistPhone}</div>}
            </div>
          </div>
        </div>

        {/* ──────── Section 01: On the body  +  Section 02: Today's request ──────── */}
        <div className="bm-doc-top-row" style={{ marginBottom: 12 }}>

          {/* Section 01: On the body */}
          <Card className="bm-doc-card" accent={T.sage}>
            <SectionMarker n="01" title="On the body" sub={cumulativeHeatmap && showHeatmap ? `${cumulativeHeatmap.count + 1} sessions` : 'Today'} accent={docAccent || T.gold} />
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: 4 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Front</div>
                {showHeatmap && cumulativeHeatmap ? (
                  <BodyDiagram
                    heatmapFocus={cumulativeHeatmap.frontFocus}
                    heatmapAvoid={cumulativeHeatmap.frontAvoid}
                    mode="heatmap"
                    size="md"
                  />
                ) : (
                  <BodyDiagram focusAreas={focusAreasFront} avoidAreas={avoidAreasFront} mode="mark" size="md" />
                )}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Back</div>
                {showHeatmap && cumulativeHeatmap ? (
                  <BodyDiagram
                    heatmapFocus={cumulativeHeatmap.backFocus}
                    heatmapAvoid={cumulativeHeatmap.backAvoid}
                    mode="heatmap"
                    size="md"
                  />
                ) : (
                  <BodyDiagram focusAreas={focusAreasBack} avoidAreas={avoidAreasBack} mode="mark" size="md" />
                )}
              </div>
            </div>
            {/* Heatmap legend if showing heatmap */}
            {showHeatmap && cumulativeHeatmap && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.lineFaint}`, fontSize: 10, color: T.inkSoft, textAlign: 'center', lineHeight: 1.4 }}>
                Number inside each dot is how many visits flagged that area
              </div>
            )}
          </Card>

          {/* Section 02: Today's request */}
          <Card className="bm-doc-card" accent={T.gold}>
            <SectionMarker n="02" title="Today's request" sub={session.client_notes ? 'In their words below' : 'What they want today'} accent={docAccent || T.gold} />

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {session.pressure && <Pill bg={T.forest} color="white" large>Pressure {session.pressure}/5</Pill>}
              {session.goal && <Pill bg={T.creamAlt} color={T.forest} large>Goal: {session.goal}</Pill>}
            </div>

            {allFocus.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>
                  Focus · {allFocus.length} {allFocus.length === 1 ? 'area' : 'areas'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {allFocus.map((a, i) => <Pill key={i} color={T.forest} bg={T.sageBg}>{zoneLabel(a)}</Pill>)}
                </div>
              </div>
            )}

            {allAvoid.length > 0 && (
              <div style={{ marginBottom: session.client_notes ? 10 : 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.red, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>
                  Avoid · {allAvoid.length} {allAvoid.length === 1 ? 'area' : 'areas'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {allAvoid.map((a, i) => <Pill key={i} color={T.redInk} bg="rgba(185,28,28,0.08)">{zoneLabel(a)}</Pill>)}
                </div>
              </div>
            )}

            {session.client_notes && (
              <div style={{
                paddingTop: 10, borderTop: `1px solid ${T.lineFaint}`,
                fontSize: 12, color: T.ink, lineHeight: 1.5, fontStyle: 'italic',
                fontFamily: T.serif,
              }}>
                "{session.client_notes}"
              </div>
            )}

            {allFocus.length === 0 && allAvoid.length === 0 && !session.client_notes && (
              <div style={{ fontSize: 12, color: T.inkSoft, fontStyle: 'italic' }}>No specific request.</div>
            )}
          </Card>
        </div>

        {/* ──────── Section 03: Doc-specific primary ──────── */}
        {section03 && (
          <Card className="bm-doc-card" accent={section03.accent || docAccent} style={{ marginBottom: 12, padding: '14px 18px' }}>
            <SectionMarker n="03" title={section03.title} sub={section03.sub} accent={docAccent || T.gold} />
            {section03.content}
          </Card>
        )}

        {/* ──────── Section 04: Doc-specific secondary ──────── */}
        {section04 && (
          <Card className="bm-doc-card" accent={section04.accent || docAccent} style={{ marginBottom: 12, padding: '14px 18px' }}>
            <SectionMarker n="04" title={section04.title} sub={section04.sub} accent={docAccent || T.gold} />
            {section04.content}
          </Card>
        )}

        {/* ──────── Footer signature ──────── */}
        <div style={{ borderTop: `1px solid ${T.lineFaint}`, paddingTop: 10, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: T.inkSoft, flexWrap: 'wrap', gap: 8 }}>
          <span>MyBodyMap · mybodymap.app · Confidential</span>
          <span style={{ textAlign: 'right' }}>{therapistName}{therapistPhone ? ' · ' + therapistPhone : ''}{intakeUrl ? ' · ' + intakeUrl : ''}</span>
        </div>
      </div>
    </div>
  );
}
