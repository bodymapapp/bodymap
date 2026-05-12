// src/components/DocumentLayout.jsx
//
// Shared layout for all four three-dot documents. Enforces a
// consistent 4-section structure with visible 01/02/03/04 markers
// so the system feels uniform.
//
// V2 (May 11 2026, HK feedback) changes:
//   - Compressed padding to fit on one A4 page
//   - Sections 03 and 04 default to side-by-side (50/50) so the
//     document is shorter vertically
//   - Section 01 supports a 'split' mode: pattern (cumulative
//     heatmap) on the left, today's marks on the right, with mini
//     body diagrams. Used by post-session record and recap so the
//     therapist and client see the day-of marks in the context of
//     the full visit history.
//
// Layouts:
//
//   bodyDisplay='today' or 'pattern':
//     [ 01 body (320px) | 02 request (1fr) ]
//     [ 03 (50%)        | 04 (50%)         ]
//
//   bodyDisplay='split':
//     [ 01 body, full width, pattern + today side-by-side ]
//     [ 02 request (50%) | 03 doc-specific (50%)         ]
//     [ 04 doc-specific, full width                       ]

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
      padding: large ? '4px 11px' : '3px 9px',
      borderRadius: 20,
      fontSize: large ? 11.5 : 10.5,
      fontWeight: 600,
      lineHeight: 1.2,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

export function SectionMarker({ n, title, sub, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 8 }}>
      <span style={{
        fontFamily: T.serif,
        fontSize: 20,
        fontWeight: 600,
        color: accent || T.gold,
        lineHeight: 1,
        letterSpacing: '-0.4px',
      }}>{n}</span>
      <div>
        <div style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: T.forest,
          textTransform: 'uppercase',
          letterSpacing: '0.95px',
          lineHeight: 1.1,
        }}>{title}</div>
        {sub && <div style={{ fontSize: 10, color: T.inkSoft, marginTop: 1, fontStyle: 'italic' }}>{sub}</div>}
      </div>
    </div>
  );
}

export function Card({ children, style = {}, accent, className }) {
  return (
    <div className={className} style={{
      background: T.white,
      borderRadius: 12,
      padding: '12px 14px',
      border: `1px solid ${T.lineFaint}`,
      boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
      borderLeft: accent ? `3px solid ${accent}` : `1px solid ${T.lineFaint}`,
      ...style,
    }}>{children}</div>
  );
}

// Distribution bars: front/back and top/middle/bottom percentages
// as two stacked horizontal bars. Shows where on the body the
// client wants focus today. Renders in Section 01 of every doc
// so all four documents have a consistent body axes visual.
export function DistributionBars({ session }) {
  const hasFrontBack = session.front_pct != null;
  const topPct = session.top_pct || 0;
  const middlePct = session.middle_pct || 0;
  const bottomPct = session.bottom_pct || 0;
  const hasBands = topPct > 0 || middlePct > 0 || bottomPct > 0;

  if (!hasFrontBack && !hasBands) return null;

  const frontPct = session.front_pct;
  const backPct = hasFrontBack ? 100 - frontPct : 0;

  const SegmentLabel = ({ pct, color, position = 'left' }) => (
    <span style={{
      position: 'absolute', top: 0, [position]: 6,
      fontSize: 9, color: 'white', fontWeight: 700,
      lineHeight: '14px', letterSpacing: '0.2px',
      textShadow: '0 1px 0 rgba(0,0,0,0.15)',
    }}>{pct}%</span>
  );

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.lineFaint}` }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 5, textAlign: 'center' }}>
        Focus distribution
      </div>

      {/* Front/Back bar */}
      {hasFrontBack && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: hasBands ? 5 : 0 }}>
          <span style={{ fontSize: 8.5, color: T.inkSoft, fontWeight: 600, width: 32, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Front</span>
          <div style={{ flex: 1, height: 14, display: 'flex', borderRadius: 7, overflow: 'hidden', border: `1px solid ${T.lineFaint}`, position: 'relative' }}>
            {frontPct > 0 && (
              <div style={{ width: frontPct + '%', background: T.sage, position: 'relative' }}>
                {frontPct >= 15 && <SegmentLabel pct={frontPct} position="left" />}
              </div>
            )}
            {backPct > 0 && (
              <div style={{ width: backPct + '%', background: T.gold, position: 'relative' }}>
                {backPct >= 15 && <SegmentLabel pct={backPct} position="right" />}
              </div>
            )}
          </div>
          <span style={{ fontSize: 8.5, color: T.inkSoft, fontWeight: 600, width: 28, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Back</span>
        </div>
      )}

      {/* Top/Middle/Bottom bar */}
      {hasBands && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 8.5, color: T.inkSoft, fontWeight: 600, width: 32, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top</span>
          <div style={{ flex: 1, height: 14, display: 'flex', borderRadius: 7, overflow: 'hidden', border: `1px solid ${T.lineFaint}`, position: 'relative' }}>
            {topPct > 0 && (
              <div style={{ width: topPct + '%', background: T.sage, position: 'relative' }}>
                {topPct >= 15 && <SegmentLabel pct={topPct} position="left" />}
              </div>
            )}
            {middlePct > 0 && (
              <div style={{ width: middlePct + '%', background: T.gold, position: 'relative' }}>
                {middlePct >= 15 && <SegmentLabel pct={middlePct} position="left" />}
              </div>
            )}
            {bottomPct > 0 && (
              <div style={{ width: bottomPct + '%', background: T.forest, position: 'relative' }}>
                {bottomPct >= 15 && <SegmentLabel pct={bottomPct} position="right" />}
              </div>
            )}
          </div>
          <span style={{ fontSize: 8.5, color: T.inkSoft, fontWeight: 600, width: 28, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bot</span>
        </div>
      )}

      {/* Legend below bars */}
      {hasBands && (
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 4, fontSize: 9, color: T.inkSoft }}>
          {topPct > 0 && <span><span style={{ display: 'inline-block', width: 8, height: 8, background: T.sage, borderRadius: 2, marginRight: 3, verticalAlign: 'middle' }} />Top {topPct}%</span>}
          {middlePct > 0 && <span><span style={{ display: 'inline-block', width: 8, height: 8, background: T.gold, borderRadius: 2, marginRight: 3, verticalAlign: 'middle' }} />Middle {middlePct}%</span>}
          {bottomPct > 0 && <span><span style={{ display: 'inline-block', width: 8, height: 8, background: T.forest, borderRadius: 2, marginRight: 3, verticalAlign: 'middle' }} />Bottom {bottomPct}%</span>}
        </div>
      )}
    </div>
  );
}

// ────────────────── Body sub-renders ──────────────────

function SectionOneBody({ docAccent, session, cumulativeHeatmap, bodyDisplay }) {
  const focusAreasFront = session.front_focus || [];
  const focusAreasBack = session.back_focus || [];
  const avoidAreasFront = session.front_avoid || [];
  const avoidAreasBack = session.back_avoid || [];

  // Split mode: pattern on left, today on right
  if (bodyDisplay === 'split' && cumulativeHeatmap && cumulativeHeatmap.count > 0) {
    return (
      <Card className="bm-doc-card" accent={T.sage}>
        <SectionMarker
          n="01"
          title="On the body"
          sub={`Pattern across ${cumulativeHeatmap.count} prior visits, plus today`}
          accent={docAccent || T.gold}
        />
        <div className="bm-doc-body-split">
          {/* Pattern half */}
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6, textAlign: 'center' }}>
              Pattern · {cumulativeHeatmap.count} visits
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: 4 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 3 }}>Front</div>
                <BodyDiagram heatmapFocus={cumulativeHeatmap.frontFocus} heatmapAvoid={cumulativeHeatmap.frontAvoid} mode="heatmap" size="sm" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 3 }}>Back</div>
                <BodyDiagram heatmapFocus={cumulativeHeatmap.backFocus} heatmapAvoid={cumulativeHeatmap.backAvoid} mode="heatmap" size="sm" />
              </div>
            </div>
            <div style={{ fontSize: 9, color: T.inkSoft, textAlign: 'center', marginTop: 4, fontStyle: 'italic' }}>
              Number inside each dot = visits flagged
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: T.lineFaint }} />

          {/* Today half */}
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6, textAlign: 'center' }}>
              Today
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: 4 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 3 }}>Front</div>
                <BodyDiagram focusAreas={focusAreasFront} avoidAreas={avoidAreasFront} mode="mark" size="sm" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 3 }}>Back</div>
                <BodyDiagram focusAreas={focusAreasBack} avoidAreas={avoidAreasBack} mode="mark" size="sm" />
              </div>
            </div>
            <div style={{ fontSize: 9, color: T.inkSoft, textAlign: 'center', marginTop: 4, fontStyle: 'italic' }}>
              Green = focus · Red = avoid
            </div>
          </div>
        </div>
        <DistributionBars session={session} />
      </Card>
    );
  }

  // Default (today or pattern only)
  const useHeatmap = bodyDisplay === 'pattern' && cumulativeHeatmap && cumulativeHeatmap.count > 0;
  return (
    <Card className="bm-doc-card" accent={T.sage}>
      <SectionMarker
        n="01"
        title="On the body"
        sub={useHeatmap ? `Across ${cumulativeHeatmap.count} prior visits` : 'Today'}
        accent={docAccent || T.gold}
      />
      <div style={{ display: 'flex', justifyContent: 'space-around', gap: 4 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Front</div>
          {useHeatmap ? (
            <BodyDiagram heatmapFocus={cumulativeHeatmap.frontFocus} heatmapAvoid={cumulativeHeatmap.frontAvoid} mode="heatmap" size="md" />
          ) : (
            <BodyDiagram focusAreas={focusAreasFront} avoidAreas={avoidAreasFront} mode="mark" size="md" />
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Back</div>
          {useHeatmap ? (
            <BodyDiagram heatmapFocus={cumulativeHeatmap.backFocus} heatmapAvoid={cumulativeHeatmap.backAvoid} mode="heatmap" size="md" />
          ) : (
            <BodyDiagram focusAreas={focusAreasBack} avoidAreas={avoidAreasBack} mode="mark" size="md" />
          )}
        </div>
      </div>
      {useHeatmap && (
        <div style={{ marginTop: 6, fontSize: 9.5, color: T.inkSoft, textAlign: 'center', fontStyle: 'italic' }}>
          Number inside each dot = visits flagged
        </div>
      )}
      <DistributionBars session={session} />
    </Card>
  );
}

function SectionTwoRequest({ docAccent, session, compact = false }) {
  const focusAreasFront = session.front_focus || [];
  const focusAreasBack = session.back_focus || [];
  const avoidAreasFront = session.front_avoid || [];
  const avoidAreasBack = session.back_avoid || [];
  const allFocus = [...focusAreasFront, ...focusAreasBack];
  const allAvoid = [...avoidAreasFront, ...avoidAreasBack];

  return (
    <Card className="bm-doc-card" accent={T.gold}>
      <SectionMarker
        n="02"
        title="Today's request"
        sub={session.client_notes ? 'In their words below' : 'What they want today'}
        accent={docAccent || T.gold}
      />

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
        {session.pressure && <Pill bg={T.forest} color="white" large>Pressure {session.pressure}/5</Pill>}
        {session.goal && <Pill bg={T.creamAlt} color={T.forest} large>Goal: {session.goal}</Pill>}
      </div>

      {allFocus.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 3 }}>
            Focus · {allFocus.length} {allFocus.length === 1 ? 'area' : 'areas'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {allFocus.map((a, i) => <Pill key={i} color={T.forest} bg={T.sageBg}>{zoneLabel(a)}</Pill>)}
          </div>
        </div>
      )}

      {allAvoid.length > 0 && (
        <div style={{ marginBottom: session.client_notes ? 8 : 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.red, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 3 }}>
            Avoid · {allAvoid.length} {allAvoid.length === 1 ? 'area' : 'areas'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {allAvoid.map((a, i) => <Pill key={i} color={T.redInk} bg="rgba(185,28,28,0.08)">{zoneLabel(a)}</Pill>)}
          </div>
        </div>
      )}

      {session.client_notes && (
        <div style={{
          paddingTop: 7, borderTop: `1px solid ${T.lineFaint}`,
          fontSize: 11.5, color: T.ink, lineHeight: 1.45, fontStyle: 'italic',
          fontFamily: T.serif,
        }}>
          "{session.client_notes}"
        </div>
      )}

      {allFocus.length === 0 && allAvoid.length === 0 && !session.client_notes && (
        <div style={{ fontSize: 11.5, color: T.inkSoft, fontStyle: 'italic' }}>No specific request.</div>
      )}
    </Card>
  );
}

// ────────────────── Main layout ──────────────────

export default function DocumentLayout({
  docNumber,
  docTotalParts,
  docName,
  docAccent,

  client,
  session,
  therapist,
  visitNumber,
  isFirstVisit,
  isOverdue,

  cumulativeHeatmap = null,
  bodyDisplay = 'today',           // 'today' | 'pattern' | 'split'
  showSection02 = true,            // some docs (recap) skip the request section

  section03,
  section04,

  // When true, section 04 stretches full width below the 03/04 grid.
  // Use for prominent CTAs like the recap's rebook banner.
  section04FullWidth = false,

  toolbarExtras,
}) {
  const totalParts = docTotalParts || 4;
  const sessionDate = new Date(session.created_at).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const therapistName = therapist?.business_name || therapist?.full_name || 'Your Practice';
  const therapistFullName = therapist?.full_name || '';
  const therapistPhone = therapist?.phone || null;
  const intakeUrl = therapist?.custom_url ? `${window.location.origin}/${therapist.custom_url}` : null;

  const visitLabel = isFirstVisit ? 'First visit' : `Visit ${visitNumber}`;
  const completedPill = session.completed ? null : (
    <Pill bg="#FFFBEB" color="#92400E">Not yet complete</Pill>
  );

  const isSplit = bodyDisplay === 'split';

  return (
    <div style={{ background: T.cream, minHeight: '100vh', color: T.ink, fontFamily: T.sans }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          @page { size: A4; margin: 8mm; }
          .bm-doc-wrap { background: white !important; }
          .bm-doc-card { box-shadow: none !important; border: 1px solid #DDD7C7 !important; break-inside: avoid; }
        }
        * { box-sizing: border-box; }
        .bm-doc-top-row { display: grid; grid-template-columns: 320px 1fr; gap: 10px; }
        .bm-doc-bottom-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .bm-doc-body-split { display: grid; grid-template-columns: 1fr 1px 1fr; gap: 12px; align-items: start; }
        .bm-doc-split-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 760px) {
          .bm-doc-top-row { grid-template-columns: 1fr; }
          .bm-doc-bottom-row { grid-template-columns: 1fr; }
          .bm-doc-body-split { grid-template-columns: 1fr; gap: 14px; }
          .bm-doc-body-split > div:nth-child(2) { display: none; }
          .bm-doc-split-row { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Toolbar. Restructured per HK May 12 2026 feedback: page should
          feel like a viewable web page, not a static PDF. Made the actions
          explicit and clearly labeled. PDF is one of three send options,
          not the primary identity of the page. */}
      <div className="no-print" style={{
        background: T.forest, padding: '10px 18px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 10, flexWrap: 'wrap',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (window.opener && !window.opener.closed) { window.close(); return; }
              if (window.history.length > 1) { window.history.back(); return; }
              window.location.href = '/dashboard';
            }}
            style={{
              background: 'transparent', color: 'white',
              border: '1px solid rgba(255,255,255,0.35)',
              padding: '5px 11px', borderRadius: 7,
              fontWeight: 600, fontSize: 12, cursor: 'pointer',
              letterSpacing: '0.2px',
            }}
            aria-label="Close and return to session"
          >← Back to session</button>
          <span style={{ color: 'white', fontWeight: 600, fontSize: 13, letterSpacing: '0.3px' }}>
            {docName}
          </span>
          {typeof docNumber === 'number' && (
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 500, letterSpacing: '0.3px' }}>
              · {docNumber} of {totalParts}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {toolbarExtras}

          {/* Email link: opens user's email client pre-filled. Works
              everywhere (web + mobile). Subject and body adapt to whether
              this is a client-facing doc (recap) or therapist-internal. */}
          <button onClick={() => {
            const isClient = docNumber === 4;
            const recipient = isClient && client?.email ? client.email : '';
            const subject = isClient
              ? `Your session summary from ${therapistName}`
              : `${docName} for ${client?.name || 'client'}`;
            const body = isClient
              ? `Your post-session summary is here: ${window.location.href}\n\nThanks for trusting ${therapistName} with your care.`
              : `${docName} link: ${window.location.href}`;
            window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          }} style={{
            background: 'transparent', color: 'white',
            border: '1px solid rgba(255,255,255,0.35)',
            padding: '5px 11px', borderRadius: 7,
            fontWeight: 600, fontSize: 12, cursor: 'pointer', letterSpacing: '0.2px',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <polyline points="3 7 12 13 21 7" />
            </svg>
            Email link
          </button>

          {/* SMS link: only for the client-facing recap (doc 4) when we
              have the client's phone. Opens the user's SMS app on
              mobile pre-filled. */}
          {docNumber === 4 && client?.phone && (
            <button onClick={() => {
              const body = `Your post-session summary from ${therapistName}: ${window.location.href}`;
              // iOS uses & or ?, Android uses ?. Most modern handsets handle both.
              window.location.href = `sms:${client.phone}?&body=${encodeURIComponent(body)}`;
            }} style={{
              background: 'transparent', color: 'white',
              border: '1px solid rgba(255,255,255,0.35)',
              padding: '5px 11px', borderRadius: 7,
              fontWeight: 600, fontSize: 12, cursor: 'pointer', letterSpacing: '0.2px',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              Send via SMS
            </button>
          )}

          <button onClick={() => window.print()} style={{
            background: T.gold, color: T.forest, border: 'none',
            padding: '5px 13px', borderRadius: 7,
            fontWeight: 700, fontSize: 12, cursor: 'pointer', letterSpacing: '0.2px',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Save as PDF
          </button>
        </div>
      </div>

      <div className="bm-doc-wrap" style={{ maxWidth: 880, margin: '0 auto', padding: '14px 16px 24px' }}>

        {/* Identity band */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{
                fontSize: 10.5, fontWeight: 700,
                color: docAccent || T.gold,
                textTransform: 'uppercase', letterSpacing: '1.3px',
                marginBottom: 3,
              }}>
                Document {typeof docNumber === 'string' ? docNumber : docNumber} of {totalParts} · {docName}
              </div>
              <h1 style={{
                fontFamily: T.serif, fontSize: 'clamp(24px, 3.4vw, 32px)',
                fontWeight: 500, color: T.forest, margin: 0,
                letterSpacing: '-0.5px', lineHeight: 1.05,
              }}>
                {client?.name || 'Client'}
              </h1>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                <Pill bg={T.forest} color="white">{visitLabel}</Pill>
                <span style={{ fontSize: 12, color: T.inkSoft }}>{sessionDate}</span>
                {completedPill}
                {isOverdue && <Pill bg={T.redBg} color={T.red}>Overdue</Pill>}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: T.inkSoft, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: T.forest, fontSize: 12 }}>{therapistFullName || therapistName}</div>
              {therapistFullName && therapistName !== therapistFullName && <div>{therapistName}</div>}
              {therapistPhone && <div>{therapistPhone}</div>}
            </div>
          </div>
        </div>

        {/* SPLIT mode: Section 01 full width, then 02 in its own row */}
        {isSplit ? (
          <>
            <div style={{ marginBottom: 8 }}>
              <SectionOneBody docAccent={docAccent} session={session} cumulativeHeatmap={cumulativeHeatmap} bodyDisplay={bodyDisplay} />
            </div>
            {showSection02 && (
              <div className="bm-doc-split-row" style={{ marginBottom: 8 }}>
                <SectionTwoRequest docAccent={docAccent} session={session} />
                {section03 && (
                  <Card className="bm-doc-card" accent={section03.accent || docAccent} style={{ padding: '12px 14px' }}>
                    <SectionMarker n="03" title={section03.title} sub={section03.sub} accent={docAccent || T.gold} />
                    {section03.content}
                  </Card>
                )}
              </div>
            )}
            {section04 && (
              <div style={{ marginBottom: 8 }}>
                <Card className="bm-doc-card" accent={section04.accent || docAccent} style={{ padding: '12px 14px' }}>
                  <SectionMarker n="04" title={section04.title} sub={section04.sub} accent={docAccent || T.gold} />
                  {section04.content}
                </Card>
              </div>
            )}
          </>
        ) : (
          /* DEFAULT mode: 01 + 02 top row, 03 + 04 side-by-side */
          <>
            <div className="bm-doc-top-row" style={{ marginBottom: 8 }}>
              <SectionOneBody docAccent={docAccent} session={session} cumulativeHeatmap={cumulativeHeatmap} bodyDisplay={bodyDisplay} />
              {showSection02 && <SectionTwoRequest docAccent={docAccent} session={session} />}
            </div>
            {section04FullWidth ? (
              <>
                {section03 && (
                  <div style={{ marginBottom: 8 }}>
                    <Card className="bm-doc-card" accent={section03.accent || docAccent} style={{ padding: '12px 14px' }}>
                      <SectionMarker n="03" title={section03.title} sub={section03.sub} accent={docAccent || T.gold} />
                      {section03.content}
                    </Card>
                  </div>
                )}
                {section04 && (
                  <div style={{ marginBottom: 8 }}>
                    <Card className="bm-doc-card" accent={section04.accent || docAccent} style={{ padding: '12px 14px' }}>
                      <SectionMarker n="04" title={section04.title} sub={section04.sub} accent={docAccent || T.gold} />
                      {section04.content}
                    </Card>
                  </div>
                )}
              </>
            ) : (
              <div className="bm-doc-bottom-row" style={{ marginBottom: 8 }}>
                {section03 && (
                  <Card className="bm-doc-card" accent={section03.accent || docAccent} style={{ padding: '12px 14px' }}>
                    <SectionMarker n="03" title={section03.title} sub={section03.sub} accent={docAccent || T.gold} />
                    {section03.content}
                  </Card>
                )}
                {section04 && (
                  <Card className="bm-doc-card" accent={section04.accent || docAccent} style={{ padding: '12px 14px' }}>
                    <SectionMarker n="04" title={section04.title} sub={section04.sub} accent={docAccent || T.gold} />
                    {section04.content}
                  </Card>
                )}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${T.lineFaint}`, paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9.5, color: T.inkSoft, flexWrap: 'wrap', gap: 6 }}>
          <span>MyBodyMap · mybodymap.app · Confidential</span>
          <span style={{ textAlign: 'right' }}>{therapistName}{therapistPhone ? ' · ' + therapistPhone : ''}{intakeUrl ? ' · ' + intakeUrl : ''}</span>
        </div>
      </div>
    </div>
  );
}
