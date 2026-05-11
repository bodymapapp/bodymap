// src/pages/PreSessionBrief.js
//
// The pre-session brief, dot 2 of 3, one-page editorial layout.
//
// Read by the therapist 5 minutes before the session walks in.
// Answers four questions fast: what does the client want today,
// what should I be careful about, what did I plan to do last time,
// what patterns matter.
//
// Layout (top to bottom):
//   1. Header band: client name (huge serif), visit pill, date
//   2. Stats strip: 4 KPI cards (visit, last seen, avg cadence, status)
//   3. Red flag strip (only if any flags present)
//   4. Editorial spread: body diagrams (left) | insights column (right)
//      Insights column = pressure trend sparkline + what changed +
//      last plan + patterns as quoted callouts
//   5. Preferences strip
//
// One page, vertical. Designed to fit on a single A4 print and feel
// like a clinical magazine spread, not a generic dashboard.

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import BodyDiagram from '../components/BodyDiagram';
import {
  deriveCadence,
  deriveChanges,
  derivePatterns,
  getLastPlan,
  getStandingFlags,
  aggregateHeatmap,
  getLastCompletedSession,
  getPriorSessions,
  zoneLabel,
} from '../lib/sessionIntelligence';

const T = {
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

function Stat({ label, value, sub, accent }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      padding: '14px 16px',
      background: T.white,
      borderRadius: 12,
      border: `1px solid ${T.lineFaint}`,
      borderTop: accent ? `3px solid ${accent}` : `1px solid ${T.lineFaint}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: T.forest, fontFamily: T.serif, lineHeight: 1, letterSpacing: '-0.3px' }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 4, lineHeight: 1.3 }}>{sub}</div>}
    </div>
  );
}

function Pill({ children, color, bg, large }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: bg || T.creamAlt, color: color || T.ink,
      padding: large ? '6px 14px' : '4px 10px',
      borderRadius: 20,
      fontSize: large ? 13 : 11.5,
      fontWeight: 600,
      lineHeight: 1.2,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

// Inline sparkline for pressure trend.
// Takes an array of values [2, 3, 3, 4, 4] and a width/height.
function Sparkline({ values, color = T.sage, width = 120, height = 32 }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return [x, y];
  });
  const pathD = points.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill={i === points.length - 1 ? color : T.white} stroke={color} strokeWidth="1.5" />
      ))}
    </svg>
  );
}

// ────────────────── Main ──────────────────

export default function PreSessionBrief() {
  const { sessionId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
      if (!session) { setLoading(false); return; }
      const { data: client } = await supabase.from('clients').select('name,phone,email').eq('id', session.client_id).maybeSingle();
      const { data: therapist } = await supabase.from('therapists').select('full_name,business_name,custom_url,phone').eq('id', session.therapist_id).maybeSingle();
      const { data: history } = await supabase.from('sessions').select('*').eq('client_id', session.client_id).order('created_at', { ascending: false }).limit(20);
      setData({ session, client, therapist, history: history || [] });
      setLoading(false);
    }
    load();
  }, [sessionId]);

  const intel = useMemo(() => {
    if (!data) return null;
    const { session, history } = data;
    const lastSession = getLastCompletedSession(history, session.id);
    const prior = getPriorSessions(history, session.id);
    const pressureSeries = prior.slice(0, 6).reverse().map(s => s.pressure).filter(p => p != null);
    if (session.pressure) pressureSeries.push(session.pressure);
    return {
      cadence: deriveCadence(history, session.id),
      changes: deriveChanges(session, lastSession),
      patterns: derivePatterns(history, session.id),
      lastPlan: getLastPlan(history, session.id),
      standing: getStandingFlags(session),
      heatmap: aggregateHeatmap(history, session.id, 6),
      pressureSeries,
    };
  }, [data]);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: T.serif, color: T.inkSoft, background: T.cream }}>Loading brief...</div>;
  }
  if (!data) {
    return <div style={{ padding: 40, fontFamily: T.serif, background: T.cream, minHeight: '100vh' }}>Session not found.</div>;
  }

  const { session, client, therapist } = data;
  const firstName = client?.name?.split(' ')[0] || 'Client';
  const sessionDate = new Date(session.created_at).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const focusAreasFront = session.front_focus || [];
  const focusAreasBack = session.back_focus || [];
  const avoidAreasFront = session.front_avoid || [];
  const avoidAreasBack = session.back_avoid || [];
  const allFocus = [...focusAreasFront, ...focusAreasBack];
  const allAvoid = [...avoidAreasFront, ...avoidAreasBack];
  const therapistName = therapist?.business_name || therapist?.full_name || 'Your Practice';
  const therapistFullName = therapist?.full_name || '';
  const therapistPhone = therapist?.phone || null;

  // Status pill for the visit count
  const visitLabel = intel.cadence.isFirstVisit
    ? 'First visit'
    : `Visit ${intel.cadence.visitNumber}`;

  // Preferences for the bottom strip
  const prefs = [
    session.pressure && { label: 'Pressure', val: `${session.pressure}/5` },
    session.goal && { label: 'Goal', val: session.goal },
    session.music && { label: 'Music', val: session.music },
    session.lighting && { label: 'Lighting', val: session.lighting },
    session.conversation && { label: 'Conversation', val: session.conversation },
    session.table_temp && { label: 'Table temp', val: session.table_temp },
    session.room_temp && { label: 'Room temp', val: session.room_temp },
    session.draping && { label: 'Draping', val: session.draping },
  ].filter(Boolean);

  return (
    <div style={{ background: T.cream, minHeight: '100vh', color: T.ink, fontFamily: T.sans }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          @page { size: A4; margin: 10mm; }
          .bm-pre-wrap { background: white !important; }
          .bm-pre-card { box-shadow: none !important; border: 1px solid #DDD7C7 !important; }
        }
        * { box-sizing: border-box; }
        .bm-pre-stats { display: flex; gap: 10px; }
        .bm-pre-hero { display: grid; grid-template-columns: 360px 1fr; gap: 18px; }
        .bm-pre-prefs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        @media (max-width: 760px) {
          .bm-pre-stats { flex-direction: column; }
          .bm-pre-hero { grid-template-columns: 1fr; }
          .bm-pre-prefs { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{
        background: T.forest, padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span style={{ color: 'white', fontWeight: 600, fontSize: 14, letterSpacing: '0.2px' }}>
          Pre-Session Brief
        </span>
        <button onClick={() => window.print()} style={{
          background: T.gold, color: T.forest, border: 'none',
          padding: '8px 18px', borderRadius: 8,
          fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '0.2px',
        }}>Save as PDF</button>
      </div>

      <div className="bm-pre-wrap" style={{ maxWidth: 920, margin: '0 auto', padding: '24px 20px 36px' }}>

        {/* Editorial header */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: 6 }}>
                Document 2 of 3 · Pre-Session Brief
              </div>
              <h1 style={{
                fontFamily: T.serif, fontSize: 'clamp(34px, 4.5vw, 44px)',
                fontWeight: 500, color: T.forest, margin: 0,
                letterSpacing: '-0.7px', lineHeight: 1.05,
              }}>
                {client?.name || 'Client'}
              </h1>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <Pill bg={T.forest} color="white" large>{visitLabel}</Pill>
                <span style={{ fontSize: 13, color: T.inkSoft }}>{sessionDate}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: T.inkSoft, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: T.forest, fontSize: 13 }}>{therapistFullName || therapistName}</div>
              {therapistFullName && therapistName !== therapistFullName && <div>{therapistName}</div>}
              {therapistPhone && <div>{therapistPhone}</div>}
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="bm-pre-stats" style={{ marginBottom: 14 }}>
          <Stat
            label="Last seen"
            value={intel.cadence.daysSinceLast !== null ? `${intel.cadence.daysSinceLast}d` : 'first'}
            sub={intel.cadence.lastVisitDate ? intel.cadence.lastVisitDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'New client'}
            accent={T.sage}
          />
          <Stat
            label="Avg cadence"
            value={intel.cadence.avgDays ? `${intel.cadence.avgDays}d` : 'n/a'}
            sub={intel.cadence.avgDays ? 'between visits' : 'after 3+ visits'}
            accent={T.sage}
          />
          <Stat
            label="History"
            value={`${intel.heatmap.count + 1}`}
            sub="sessions on file"
            accent={T.gold}
          />
          <Stat
            label="Status"
            value={intel.cadence.isOverdue ? 'Overdue' : intel.cadence.isFirstVisit ? 'New' : 'On track'}
            sub={intel.cadence.isOverdue ? 'past usual cadence' : intel.cadence.isFirstVisit ? 'first session' : 'maintaining cadence'}
            accent={intel.cadence.isOverdue ? T.red : T.sage}
          />
        </div>

        {/* Red flag strip */}
        {intel.standing && (
          <div style={{
            background: T.redBg, border: `1.5px solid ${T.red}`,
            borderLeft: `4px solid ${T.red}`,
            borderRadius: 12, padding: '12px 16px',
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: T.red, textTransform: 'uppercase', letterSpacing: '1.1px', marginBottom: 6 }}>
              Review before session
            </div>
            {session.med_note && (
              <div style={{ fontSize: 13.5, color: T.redInk, fontWeight: 600, lineHeight: 1.5, marginBottom: 6 }}>{session.med_note}</div>
            )}
            {intel.standing.conditions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {intel.standing.conditions.map((c, i) => (
                  <Pill key={i} color={T.redInk} bg="rgba(185,28,28,0.1)">{c}</Pill>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hero spread: body diagrams left, insights right */}
        <div className="bm-pre-hero" style={{ marginBottom: 14 }}>

          {/* Body diagrams card */}
          <div className="bm-pre-card" style={{
            background: T.white, borderRadius: 14, padding: '18px 18px 14px',
            border: `1px solid ${T.lineFaint}`,
            boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
            borderLeft: `3px solid ${T.sage}`,
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: T.forest, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 10 }}>Today's request</div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-around', marginBottom: 14 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Front</div>
                <BodyDiagram focusAreas={focusAreasFront} avoidAreas={avoidAreasFront} mode="mark" size="md" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Back</div>
                <BodyDiagram focusAreas={focusAreasBack} avoidAreas={avoidAreasBack} mode="mark" size="md" />
              </div>
            </div>

            {/* Pressure + goal pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 }}>
              {session.pressure && <Pill bg={T.forest} color="white" large>Pressure {session.pressure}/5</Pill>}
              {session.goal && <Pill bg={T.creamAlt} color={T.forest} large>Goal: {session.goal}</Pill>}
            </div>

            {/* Focus and avoid chips */}
            {(allFocus.length > 0 || allAvoid.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.lineFaint}` }}>
                {allFocus.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Focus</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {allFocus.map((a, i) => <Pill key={i} color={T.forest} bg={T.sageBg}>{zoneLabel(a)}</Pill>)}
                    </div>
                  </div>
                )}
                {allAvoid.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: T.red, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Avoid</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {allAvoid.map((a, i) => <Pill key={i} color={T.redInk} bg="rgba(185,28,28,0.08)">{zoneLabel(a)}</Pill>)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {session.client_notes && (
              <div style={{
                marginTop: 12, paddingTop: 12,
                borderTop: `1px solid ${T.lineFaint}`,
                fontSize: 12, color: T.ink, lineHeight: 1.55, fontStyle: 'italic',
              }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4, fontStyle: 'normal' }}>{firstName}'s words</div>
                "{session.client_notes}"
              </div>
            )}
          </div>

          {/* Insights column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Pressure trend (compact card with sparkline) */}
            {intel.pressureSeries.length >= 2 && (
              <div className="bm-pre-card" style={{
                background: T.white, borderRadius: 14, padding: '14px 16px',
                border: `1px solid ${T.lineFaint}`,
                boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 4 }}>Pressure over time</div>
                  <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.4, fontWeight: 600 }}>
                    {intel.pressureSeries[0]}/5 → {intel.pressureSeries[intel.pressureSeries.length - 1]}/5
                    <span style={{ color: T.inkSoft, fontWeight: 400, marginLeft: 4 }}>across {intel.pressureSeries.length} visits</span>
                  </div>
                </div>
                <Sparkline values={intel.pressureSeries} color={T.sage} width={130} height={36} />
              </div>
            )}

            {/* What changed */}
            {intel.changes.length > 0 && (
              <div className="bm-pre-card" style={{
                background: T.white, borderRadius: 14, padding: '14px 16px',
                border: `1px solid ${T.lineFaint}`,
                boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
                borderLeft: `3px solid ${T.gold}`,
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 8 }}>What's different today</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {intel.changes.slice(0, 4).map((c, i) => (
                    <div key={i} style={{ fontSize: 13, color: T.ink, lineHeight: 1.45, paddingLeft: 12, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, top: 6, width: 5, height: 5, borderRadius: 3, background: T.gold }} />
                      {c.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last session's plan */}
            {intel.lastPlan && intel.lastPlan.plan && (
              <div className="bm-pre-card" style={{
                background: T.goldBg, borderRadius: 14, padding: '14px 16px',
                border: `1px solid ${T.gold}40`,
                borderLeft: `3px solid ${T.gold}`,
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#92660E', textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 6 }}>
                  Plan from last visit · {intel.lastPlan.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.55, fontFamily: T.serif, fontStyle: 'italic' }}>
                  "{intel.lastPlan.plan.length > 280 ? intel.lastPlan.plan.slice(0, 277) + '...' : intel.lastPlan.plan}"
                </div>
              </div>
            )}

            {/* Patterns as callouts */}
            {intel.patterns.length > 0 && (
              <div className="bm-pre-card" style={{
                background: T.white, borderRadius: 14, padding: '14px 16px',
                border: `1px solid ${T.lineFaint}`,
                boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
                borderLeft: `3px solid ${T.sage}`,
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 8 }}>Patterns we've learned</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {intel.patterns.slice(0, 5).map((p, i) => (
                    <div key={i} style={{ fontSize: 13, color: T.ink, lineHeight: 1.45, paddingLeft: 12, position: 'relative' }}>
                      <span style={{
                        position: 'absolute', left: 0, top: 6, width: 5, height: 5, borderRadius: 3,
                        background: p.severity === 'high' ? T.gold : T.sage,
                      }} />
                      {p.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cumulative heatmap, inline small */}
            {intel.heatmap.count > 0 && (
              <div className="bm-pre-card" style={{
                background: T.white, borderRadius: 14, padding: '14px 16px',
                border: `1px solid ${T.lineFaint}`,
                boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 8 }}>Cumulative map · {intel.heatmap.count} past visits</div>
                <div style={{ display: 'flex', justifyContent: 'space-around', gap: 6 }}>
                  <BodyDiagram heatmapFocus={intel.heatmap.frontFocus} heatmapAvoid={intel.heatmap.frontAvoid} mode="heatmap" size="sm" />
                  <BodyDiagram heatmapFocus={intel.heatmap.backFocus} heatmapAvoid={intel.heatmap.backAvoid} mode="heatmap" size="sm" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preferences strip (full width, dense) */}
        {prefs.length > 0 && (
          <div className="bm-pre-card" style={{
            background: T.white, borderRadius: 14, padding: '14px 16px',
            border: `1px solid ${T.lineFaint}`,
            boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 10 }}>
              Today's preferences
            </div>
            <div className="bm-pre-prefs">
              {prefs.map((p, i) => (
                <div key={i} style={{
                  background: T.cream, borderRadius: 8,
                  padding: '7px 11px',
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>{p.label}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: T.forest, textTransform: 'capitalize' }}>{p.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${T.lineFaint}`, paddingTop: 10, marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: T.inkSoft, flexWrap: 'wrap', gap: 8 }}>
          <span>MyBodyMap · mybodymap.app</span>
          <span style={{ textAlign: 'right' }}>{therapistName}{therapistPhone ? ' · ' + therapistPhone : ''} · Confidential</span>
        </div>
      </div>
    </div>
  );
}
