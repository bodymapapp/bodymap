// src/pages/PreSessionBrief.js
//
// Phase 1 of the three-dot document system redesign (HK May 11 2026).
//
// This is dot 2 of 3: the pre-session report. It is read by the
// therapist about five minutes before the session starts. It must
// answer four questions fast:
//
//   1. What does this client want today?
//   2. What should I be careful about?
//   3. What did I plan to do last time that I should follow up on?
//   4. What patterns have I noticed across visits that change my approach?
//
// Design principle: every section is suppressed entirely when it
// has no content. A clean visit with nothing notable shows a short
// brief. A loaded visit shows a longer one. The therapist's eye is
// drawn only to information that matters.

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  deriveCadence,
  deriveChanges,
  derivePatterns,
  getLastPlan,
  getStandingFlags,
  aggregateHeatmap,
  getLastCompletedSession,
  zoneLabel,
  ZONE_COORDS,
} from '../lib/sessionIntelligence';

// ---------- Design tokens ----------
//
// All hex values mirror :root vars in index.css. Repeated here so
// the print stylesheet can override them without affecting the rest
// of the app. On screen we use the warm cream palette. On print we
// switch to clinical white for legibility on paper.

const T = {
  cream: '#F9F5EE',
  creamAlt: '#F3EEE2',
  forest: '#1C2B22',
  sage: '#4A6B54',
  gold: '#C9A84C',
  rose: '#E8C5B5',
  ink: '#3D4F43',
  inkSoft: '#6B7F72',
  red: '#B91C1C',
  redBg: '#FDF2F2',
  green: '#4A6B54',
  greenBg: '#EEF3EE',
  lineFaint: '#E8E0D0',
  white: '#FFFFFF',
  serif: "'Fraunces', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

// ---------- Body diagram ----------

function BodySVG({ focusAreas = [], avoidAreas = [], heatmapFocus = {}, heatmapAvoid = {}, showHeatmap = false, size = 'normal' }) {
  const width = size === 'large' ? 160 : 130;
  const height = size === 'large' ? 305 : 250;
  const silhouetteFill = T.creamAlt;
  const silhouetteStroke = '#C8BFB0';

  return (
    <svg width={width} height={height} viewBox="0 0 170 310" aria-hidden="true">
      <ellipse cx="85" cy="28" rx="20" ry="24" fill={silhouetteFill} stroke={silhouetteStroke} strokeWidth="1.5" />
      <rect x="77" y="50" width="16" height="14" rx="3" fill={silhouetteFill} stroke={silhouetteStroke} strokeWidth="1.5" />
      <path d="M57 64 Q47 70 44 90 L40 155 Q40 162 48 162 L122 162 Q130 162 130 155 L126 90 Q123 70 113 64 Z" fill={silhouetteFill} stroke={silhouetteStroke} strokeWidth="1.5" />
      <path d="M57 66 Q42 74 38 115 Q36 128 40 138 Q46 141 50 138 Q54 112 60 85 Z" fill={silhouetteFill} stroke={silhouetteStroke} strokeWidth="1.5" />
      <path d="M113 66 Q128 74 132 115 Q134 128 130 138 Q124 141 120 138 Q116 112 110 85 Z" fill={silhouetteFill} stroke={silhouetteStroke} strokeWidth="1.5" />
      <path d="M60 162 Q56 195 54 232 Q52 260 56 278 Q62 284 70 282 Q76 278 76 260 L78 162 Z" fill={silhouetteFill} stroke={silhouetteStroke} strokeWidth="1.5" />
      <path d="M110 162 Q114 195 116 232 Q118 260 114 278 Q108 284 100 282 Q94 278 94 260 L92 162 Z" fill={silhouetteFill} stroke={silhouetteStroke} strokeWidth="1.5" />
      {showHeatmap && Object.entries(heatmapFocus).map(([area, { opacity, count }]) => {
        const c = ZONE_COORDS[area]; if (!c) return null;
        const r = 8 + opacity * 10;
        return (
          <g key={'hf-' + area}>
            <circle cx={c[0]} cy={c[1]} r={r + 8} fill={`rgba(74,107,84,${(opacity * 0.18).toFixed(2)})`} />
            <circle cx={c[0]} cy={c[1]} r={r} fill={`rgba(74,107,84,${(opacity * 0.5).toFixed(2)})`} stroke={T.sage} strokeWidth={opacity > 0.6 ? '2.5' : '1.5'} />
            <circle cx={c[0]} cy={c[1]} r="5" fill={T.forest} />
            <circle cx={c[0] + r - 1} cy={c[1] - r + 1} r="7.5" fill={T.forest} stroke="white" strokeWidth="1.5" />
            <text x={c[0] + r - 1} y={c[1] - r + 5} textAnchor="middle" fill="white" fontSize="8.5" fontWeight="700" fontFamily={T.sans}>{count}</text>
          </g>
        );
      })}
      {showHeatmap && Object.entries(heatmapAvoid).map(([area, { opacity, count }]) => {
        if (heatmapFocus[area]) return null;
        const c = ZONE_COORDS[area]; if (!c) return null;
        const r = 8 + opacity * 10;
        return (
          <g key={'ha-' + area}>
            <circle cx={c[0]} cy={c[1]} r={r + 8} fill={`rgba(185,28,28,${(opacity * 0.14).toFixed(2)})`} />
            <circle cx={c[0]} cy={c[1]} r={r} fill={`rgba(185,28,28,${(opacity * 0.36).toFixed(2)})`} stroke={T.red} strokeWidth={opacity > 0.6 ? '2.5' : '1.5'} />
            <circle cx={c[0]} cy={c[1]} r="5" fill="#7F1D1D" />
            <circle cx={c[0] + r - 1} cy={c[1] - r + 1} r="7.5" fill="#7F1D1D" stroke="white" strokeWidth="1.5" />
            <text x={c[0] + r - 1} y={c[1] - r + 5} textAnchor="middle" fill="white" fontSize="8.5" fontWeight="700" fontFamily={T.sans}>{count}</text>
          </g>
        );
      })}
      {!showHeatmap && focusAreas.map((area, i) => {
        const c = ZONE_COORDS[area]; if (!c) return null;
        return (
          <g key={'f' + i}>
            <circle cx={c[0]} cy={c[1]} r="13" fill="rgba(74,107,84,0.22)" stroke={T.sage} strokeWidth="2" />
            <circle cx={c[0]} cy={c[1]} r="5" fill={T.sage} />
          </g>
        );
      })}
      {!showHeatmap && avoidAreas.map((area, i) => {
        const c = ZONE_COORDS[area]; if (!c) return null;
        return (
          <g key={'a' + i}>
            <circle cx={c[0]} cy={c[1]} r="13" fill="rgba(185,28,28,0.18)" stroke={T.red} strokeWidth="2" />
            <circle cx={c[0]} cy={c[1]} r="5" fill={T.red} />
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Small UI atoms ----------

function SectionLabel({ children, accent }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: 700, color: accent || T.inkSoft,
      textTransform: 'uppercase', letterSpacing: '0.9px',
      marginBottom: '10px', fontFamily: T.sans,
    }}>{children}</div>
  );
}

function Card({ children, accent, style = {}, className }) {
  return (
    <div className={className} style={{
      background: T.white,
      borderRadius: '14px',
      padding: '18px 18px 16px',
      border: `1px solid ${T.lineFaint}`,
      boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
      borderLeft: accent ? `3px solid ${accent}` : `1px solid ${T.lineFaint}`,
      ...style,
    }}>{children}</div>
  );
}

function Pill({ children, color, bg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      background: bg || T.creamAlt, color: color || T.ink,
      padding: '5px 11px', borderRadius: '20px',
      fontSize: '12px', fontWeight: 600, fontFamily: T.sans,
      lineHeight: 1.2, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 600, color: T.forest, fontFamily: T.serif, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: T.inkSoft, marginTop: '3px' }}>{sub}</div>}
    </div>
  );
}

// ---------- Main page ----------

export default function PreSessionBrief() {
  const { sessionId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);

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

  // Derived intelligence. All memo'd so they only recompute when
  // the underlying data changes.
  const intel = useMemo(() => {
    if (!data) return null;
    const { session, history } = data;
    const lastSession = getLastCompletedSession(history, session.id);
    return {
      cadence: deriveCadence(history, session.id),
      changes: deriveChanges(session, lastSession),
      patterns: derivePatterns(history, session.id),
      lastPlan: getLastPlan(history, session.id),
      standing: getStandingFlags(session),
      heatmap: aggregateHeatmap(history, session.id, 5),
    };
  }, [data]);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: T.serif, color: T.inkSoft, background: T.cream }}>Loading brief...</div>;
  }
  if (!data) {
    return <div style={{ padding: 40, fontFamily: T.serif, background: T.cream, minHeight: '100vh' }}>Session not found.</div>;
  }

  const { session, client, therapist } = data;
  const sessionDate = new Date(session.created_at).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const focusAreas = [...(session.front_focus || []), ...(session.back_focus || [])];
  const avoidAreas = [...(session.front_avoid || []), ...(session.back_avoid || [])];
  const therapistName = therapist?.business_name || therapist?.full_name || 'Your Practice';
  const therapistFullName = therapist?.full_name || '';
  const intakeUrl = therapist?.custom_url ? `${window.location.origin}/${therapist.custom_url}` : null;
  const therapistPhone = therapist?.phone || null;

  // Today's preferences as a flat list. Order chosen for therapist
  // workflow: pressure and goal first (drive technique choice), then
  // ambient settings, then logistics.
  const prefs = [
    session.pressure && { label: 'Pressure', val: `${session.pressure}/5` },
    session.goal && { label: 'Goal', val: session.goal },
    session.music && { label: 'Music', val: session.music },
    session.lighting && { label: 'Lighting', val: session.lighting },
    session.conversation && { label: 'Conversation', val: session.conversation },
    session.table_temp && { label: 'Table temp', val: session.table_temp },
    session.room_temp && { label: 'Room temp', val: session.room_temp },
    session.draping && { label: 'Draping', val: session.draping },
    session.oil_pref && session.oil_pref !== 'none' && { label: 'Oil', val: session.oil_pref },
  ].filter(Boolean);

  // Today's chief complaint and free-text client notes from intake.
  // These are not patterns; they are what the client just said.
  const chiefComplaint = session.med_note || '';
  const clientNotes = session.client_notes || '';

  const customAnswers = session.custom_intake_answers || {};
  const customKeys = Object.keys(customAnswers).filter(k => {
    const v = customAnswers[k];
    return v !== null && v !== undefined && v !== '' && !(typeof v === 'string' && /^(no|none|n\/a)$/i.test(v.trim()));
  });

  return (
    <div style={{ background: T.cream, minHeight: '100vh', color: T.ink, fontFamily: T.sans }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          @page { size: A4; margin: 12mm; }
          .bm-pre-wrap { background: white !important; }
          .bm-pre-card { box-shadow: none !important; border: 1px solid #DDD7C7 !important; break-inside: avoid; }
        }
        * { box-sizing: border-box; }
        .bm-pre-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .bm-pre-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .bm-pre-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        @media (max-width: 720px) {
          .bm-pre-grid-2 { grid-template-columns: 1fr; }
          .bm-pre-grid-3 { grid-template-columns: 1fr 1fr; }
          .bm-pre-grid-4 { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      {/* Toolbar (no-print) */}
      <div className="no-print" style={{
        background: T.forest, padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span style={{ color: 'white', fontWeight: 600, fontSize: '14px', fontFamily: T.sans, letterSpacing: '0.2px' }}>
          Pre-Session Brief
        </span>
        <button onClick={() => window.print()} style={{
          background: T.gold, color: T.forest, border: 'none',
          padding: '8px 18px', borderRadius: '8px',
          fontWeight: 700, fontSize: '13px', cursor: 'pointer',
          fontFamily: T.sans, letterSpacing: '0.2px',
        }}>Save as PDF</button>
      </div>

      <div className="bm-pre-wrap" style={{ maxWidth: '820px', margin: '0 auto', padding: '24px 20px 48px' }}>

        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '6px' }}>
            Document 2 of 3 · Pre-Session
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontFamily: T.serif, fontSize: '32px', fontWeight: 500, color: T.forest, margin: 0, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                {client?.name || 'Client'}
              </h1>
              <div style={{ fontSize: '13px', color: T.inkSoft, marginTop: '4px' }}>{sessionDate}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '12px', color: T.inkSoft, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: T.forest, fontSize: '13px' }}>{therapistFullName || therapistName}</div>
              {therapistFullName && therapistName !== therapistFullName && <div>{therapistName}</div>}
              {therapistPhone && <div>{therapistPhone}</div>}
            </div>
          </div>
        </div>

        {/* What this document is. One-line subtitle for the persona. */}
        <div style={{
          background: T.creamAlt, borderRadius: '10px',
          padding: '10px 14px', marginBottom: '18px',
          fontSize: '12px', color: T.ink, lineHeight: 1.5,
          fontFamily: T.sans, fontStyle: 'italic',
        }}>
          What {client?.name?.split(' ')[0] || 'this client'} asked for today, plus patterns and notes from past visits. Read this 5 minutes before the session.
        </div>

        {/* Visit context stats */}
        <Card style={{ marginBottom: '14px' }} className="bm-pre-card">
          <div className="bm-pre-grid-4" style={{ alignItems: 'center' }}>
            <Stat
              label="Visit"
              value={intel.cadence.isFirstVisit ? 'First' : `#${intel.cadence.visitNumber}`}
              sub={intel.cadence.isFirstVisit ? 'New client' : null}
            />
            <Stat
              label="Last seen"
              value={intel.cadence.daysSinceLast !== null ? `${intel.cadence.daysSinceLast}d ago` : 'n/a'}
              sub={intel.cadence.lastVisitDate ? intel.cadence.lastVisitDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null}
            />
            <Stat
              label="Avg cadence"
              value={intel.cadence.avgDays ? `${intel.cadence.avgDays}d` : 'n/a'}
              sub={intel.cadence.avgDays ? 'between visits' : 'need 3+ visits'}
            />
            <Stat
              label="Status"
              value={intel.cadence.isOverdue ? 'Overdue' : intel.cadence.isFirstVisit ? 'New' : 'On schedule'}
              sub={intel.cadence.isOverdue ? 'Past usual cadence' : null}
            />
          </div>
        </Card>

        {/* Red flags strip */}
        {intel.standing && (
          <div className="bm-pre-card" style={{
            background: T.redBg, border: `1.5px solid ${T.red}`,
            borderLeft: `4px solid ${T.red}`,
            borderRadius: '12px', padding: '14px 18px',
            marginBottom: '14px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: T.red, textTransform: 'uppercase', letterSpacing: '1.1px', marginBottom: '8px' }}>
              Review before session
            </div>
            {chiefComplaint && (
              <div style={{ fontSize: '14px', color: '#7F1D1D', fontWeight: 600, marginBottom: '6px', lineHeight: 1.5 }}>{chiefComplaint}</div>
            )}
            {intel.standing.conditions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {intel.standing.conditions.map((c, i) => (
                  <Pill key={i} color="#7F1D1D" bg="rgba(185,28,28,0.1)">{c}</Pill>
                ))}
              </div>
            )}
            {intel.standing.customFlags.length > 0 && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {intel.standing.customFlags.map((cf, i) => (
                  <div key={i} style={{ fontSize: '13px', color: '#7F1D1D' }}>
                    <span style={{ fontWeight: 700 }}>{cf.key}:</span> <span>{typeof cf.value === 'string' ? cf.value : JSON.stringify(cf.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hero: Today's request */}
        <Card className="bm-pre-card" style={{ marginBottom: '14px' }} accent={T.sage}>
          <SectionLabel accent={T.forest}>Today's request</SectionLabel>
          <div className="bm-pre-grid-2" style={{ alignItems: 'start', gap: '20px' }}>
            <div>
              {/* Pressure and goal as the prominent decision drivers */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {session.pressure && <Pill bg={T.forest} color="white">Pressure {session.pressure}/5</Pill>}
                {session.goal && <Pill bg={T.creamAlt} color={T.forest}>Goal: {session.goal}</Pill>}
              </div>
              {clientNotes && (
                <div style={{
                  background: T.cream, borderRadius: '8px',
                  padding: '12px 14px', marginBottom: '12px',
                  borderLeft: `3px solid ${T.gold}`,
                }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '4px' }}>In their own words</div>
                  <div style={{ fontSize: '13px', color: T.ink, lineHeight: 1.55, fontStyle: 'italic' }}>"{clientNotes}"</div>
                </div>
              )}
              {focusAreas.length === 0 && avoidAreas.length === 0 && !clientNotes && (
                <div style={{ fontSize: '13px', color: T.inkSoft, fontStyle: 'italic' }}>No specific focus or avoid zones marked.</div>
              )}
              {focusAreas.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '6px' }}>Focus</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {focusAreas.map((a, i) => <Pill key={i} color={T.forest} bg={T.greenBg}>{zoneLabel(a)}</Pill>)}
                  </div>
                </div>
              )}
              {avoidAreas.length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: T.red, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '6px' }}>Avoid</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {avoidAreas.map((a, i) => <Pill key={i} color="#7F1D1D" bg="rgba(185,28,28,0.08)">{zoneLabel(a)}</Pill>)}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '8px' }}>Front</div>
                <BodySVG focusAreas={session.front_focus || []} avoidAreas={session.front_avoid || []} size="large" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '8px' }}>Back</div>
                <BodySVG focusAreas={session.back_focus || []} avoidAreas={session.back_avoid || []} size="large" />
              </div>
            </div>
          </div>
        </Card>

        {/* What changed */}
        {intel.changes.length > 0 && (
          <Card className="bm-pre-card" style={{ marginBottom: '14px' }} accent={T.gold}>
            <SectionLabel accent={T.gold}>What changed since last visit</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {intel.changes.map((c, i) => (
                <div key={i} style={{ fontSize: '14px', color: T.ink, lineHeight: 1.5, paddingLeft: '14px', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, top: '7px', width: '6px', height: '6px', borderRadius: '50%', background: T.gold }} />
                  {c.text}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Last session's plan */}
        {intel.lastPlan && (intel.lastPlan.plan || intel.lastPlan.assessment) && (
          <Card className="bm-pre-card" style={{ marginBottom: '14px' }} accent={T.forest}>
            <SectionLabel accent={T.forest}>Your plan from last visit</SectionLabel>
            <div style={{ fontSize: '11px', color: T.inkSoft, marginBottom: '10px' }}>
              {intel.lastPlan.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            {intel.lastPlan.plan && (
              <div style={{ marginBottom: intel.lastPlan.assessment ? '12px' : 0 }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '5px' }}>Plan</div>
                <div style={{ fontSize: '14px', color: T.ink, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{intel.lastPlan.plan}</div>
              </div>
            )}
            {intel.lastPlan.assessment && (
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '5px' }}>Assessment</div>
                <div style={{ fontSize: '14px', color: T.ink, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{intel.lastPlan.assessment}</div>
              </div>
            )}
          </Card>
        )}

        {/* Patterns */}
        {intel.patterns.length > 0 && (
          <Card className="bm-pre-card" style={{ marginBottom: '14px' }} accent={T.sage}>
            <SectionLabel accent={T.sage}>Patterns across visits</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {intel.patterns.map((p, i) => (
                <div key={i} style={{
                  fontSize: '14px', color: T.ink, lineHeight: 1.5,
                  paddingLeft: '14px', position: 'relative',
                }}>
                  <span style={{
                    position: 'absolute', left: 0, top: '7px',
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: p.severity === 'high' ? T.gold : p.severity === 'medium' ? T.sage : T.inkSoft,
                  }} />
                  {p.text}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Cumulative heatmap, toggle */}
        {intel.heatmap.count > 0 && (
          <Card className="bm-pre-card" style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showHeatmap ? '14px' : 0 }}>
              <div>
                <SectionLabel>Cumulative body map</SectionLabel>
                <div style={{ fontSize: '11px', color: T.inkSoft, marginTop: '-6px' }}>Where you've worked them across {intel.heatmap.count} past visits</div>
              </div>
              <button
                onClick={() => setShowHeatmap(v => !v)}
                className="no-print"
                style={{
                  background: 'transparent', border: `1px solid ${T.lineFaint}`,
                  padding: '6px 14px', borderRadius: '8px',
                  fontSize: '12px', fontWeight: 600, color: T.forest, cursor: 'pointer',
                  fontFamily: T.sans,
                }}
              >{showHeatmap ? 'Hide' : 'Show'}</button>
            </div>
            {showHeatmap && (
              <div style={{ display: 'flex', justifyContent: 'space-around', gap: '8px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '8px' }}>Front</div>
                  <BodySVG heatmapFocus={intel.heatmap.frontFocus} heatmapAvoid={intel.heatmap.frontAvoid} showHeatmap={true} size="large" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '8px' }}>Back</div>
                  <BodySVG heatmapFocus={intel.heatmap.backFocus} heatmapAvoid={intel.heatmap.backAvoid} showHeatmap={true} size="large" />
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Today's full preferences */}
        {prefs.length > 0 && (
          <Card className="bm-pre-card" style={{ marginBottom: '14px' }}>
            <SectionLabel>Today's preferences</SectionLabel>
            <div className="bm-pre-grid-4">
              {prefs.map((p, i) => (
                <div key={i} style={{
                  background: T.cream, borderRadius: '8px',
                  padding: '8px 12px',
                }}>
                  <div style={{ fontSize: '9.5px', color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '3px', fontWeight: 600 }}>{p.label}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: T.forest, textTransform: 'capitalize' }}>{p.val}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Standing health / custom intake answers */}
        {customKeys.length > 0 && (
          <Card className="bm-pre-card" style={{ marginBottom: '14px' }}>
            <SectionLabel>Intake answers</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {customKeys.map((k, i) => {
                const v = customAnswers[k];
                const display = typeof v === 'string' ? v : (Array.isArray(v) ? v.join(', ') : JSON.stringify(v));
                return (
                  <div key={i}>
                    <div style={{ fontSize: '10px', color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '3px', fontWeight: 600 }}>{k}</div>
                    <div style={{ fontSize: '13px', color: T.ink, lineHeight: 1.5 }}>{display}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${T.lineFaint}`, paddingTop: '12px', marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: T.inkSoft, flexWrap: 'wrap', gap: '8px' }}>
          <span>MyBodyMap · mybodymap.app</span>
          <span style={{ textAlign: 'right' }}>{therapistName}{therapistPhone ? ' · ' + therapistPhone : ''}{intakeUrl ? ' · ' + intakeUrl : ''} · Confidential</span>
        </div>
      </div>
    </div>
  );
}
