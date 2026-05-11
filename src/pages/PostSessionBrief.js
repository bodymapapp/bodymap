// src/pages/PostSessionBrief.js
//
// Phase 2 of the three-dot document system redesign (HK May 11 2026).
//
// This is dot 3 of 3: the post-session therapist record. It is the
// therapist's archival document for what happened in the session.
// SOAP is on top because it is the most important part. Everything
// else below is supporting context.
//
// A separate client-facing summary exists at /summary/:sessionId
// (PostSessionSummary.js) for what the client sees.
//
// Design principle: SOAP first, decision-relevant context below,
// historical material collapsed by default. Every section suppresses
// when empty.

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  parseSoap,
  hasSoapContent,
  deriveCadence,
  deriveChanges,
  derivePatterns,
  getStandingFlags,
  aggregateHeatmap,
  getLastCompletedSession,
  zoneLabel,
  ZONE_COORDS,
} from '../lib/sessionIntelligence';

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
  const fill = T.creamAlt;
  const stroke = '#C8BFB0';
  return (
    <svg width={width} height={height} viewBox="0 0 170 310" aria-hidden="true">
      <ellipse cx="85" cy="28" rx="20" ry="24" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <rect x="77" y="50" width="16" height="14" rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <path d="M57 64 Q47 70 44 90 L40 155 Q40 162 48 162 L122 162 Q130 162 130 155 L126 90 Q123 70 113 64 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <path d="M57 66 Q42 74 38 115 Q36 128 40 138 Q46 141 50 138 Q54 112 60 85 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <path d="M113 66 Q128 74 132 115 Q134 128 130 138 Q124 141 120 138 Q116 112 110 85 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <path d="M60 162 Q56 195 54 232 Q52 260 56 278 Q62 284 70 282 Q76 278 76 260 L78 162 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <path d="M110 162 Q114 195 116 232 Q118 260 114 278 Q108 284 100 282 Q94 278 94 260 L92 162 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
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
      background: T.white, borderRadius: '14px',
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

// ---------- Main page ----------

export default function PostSessionBrief() {
  const { sessionId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
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

  const intel = useMemo(() => {
    if (!data) return null;
    const { session, history } = data;
    const lastSession = getLastCompletedSession(history, session.id);
    return {
      soap: parseSoap(session.therapist_notes || ''),
      cadence: deriveCadence(history, session.id),
      changes: deriveChanges(session, lastSession),
      patterns: derivePatterns(history, session.id),
      standing: getStandingFlags(session),
      heatmap: aggregateHeatmap(history, session.id, 5),
    };
  }, [data]);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: T.serif, color: T.inkSoft, background: T.cream }}>Loading record...</div>;
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
  const therapistPhone = therapist?.phone || null;
  const intakeUrl = therapist?.custom_url ? `${window.location.origin}/${therapist.custom_url}` : null;

  const soapHasContent = hasSoapContent(intel.soap);
  const summaryUrl = `${window.location.origin}/recap/${session.id}`;

  return (
    <div style={{ background: T.cream, minHeight: '100vh', color: T.ink, fontFamily: T.sans }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          @page { size: A4; margin: 12mm; }
          .bm-post-wrap { background: white !important; }
          .bm-post-card { box-shadow: none !important; border: 1px solid #DDD7C7 !important; break-inside: avoid; }
        }
        * { box-sizing: border-box; }
        .bm-post-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .bm-post-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        @media (max-width: 720px) {
          .bm-post-grid-2 { grid-template-columns: 1fr; }
          .bm-post-grid-4 { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{
        background: T.forest, padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, flexWrap: 'wrap',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span style={{ color: 'white', fontWeight: 600, fontSize: '14px', fontFamily: T.sans, letterSpacing: '0.2px' }}>
          Post-Session Record
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.open(summaryUrl, '_blank')} style={{
            background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)',
            padding: '7px 14px', borderRadius: '8px',
            fontWeight: 600, fontSize: '12px', cursor: 'pointer',
            fontFamily: T.sans,
          }}>View client summary</button>
          <button onClick={() => window.print()} style={{
            background: T.gold, color: T.forest, border: 'none',
            padding: '8px 18px', borderRadius: '8px',
            fontWeight: 700, fontSize: '13px', cursor: 'pointer',
            fontFamily: T.sans,
          }}>Save as PDF</button>
        </div>
      </div>

      <div className="bm-post-wrap" style={{ maxWidth: '820px', margin: '0 auto', padding: '24px 20px 48px' }}>

        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '6px' }}>
            Document 3 of 3 · Post-Session · Therapist Record
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontFamily: T.serif, fontSize: '32px', fontWeight: 500, color: T.forest, margin: 0, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                {client?.name || 'Client'}
              </h1>
              <div style={{ fontSize: '13px', color: T.inkSoft, marginTop: '4px' }}>
                {sessionDate}
                {!session.completed && (
                  <span style={{ marginLeft: 10, background: '#FFFBEB', color: '#92400E', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                    Not yet marked complete
                  </span>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '12px', color: T.inkSoft, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: T.forest, fontSize: '13px' }}>{therapistFullName || therapistName}</div>
              {therapistFullName && therapistName !== therapistFullName && <div>{therapistName}</div>}
              {therapistPhone && <div>{therapistPhone}</div>}
            </div>
          </div>
        </div>

        <div style={{
          background: T.creamAlt, borderRadius: '10px',
          padding: '10px 14px', marginBottom: '18px',
          fontSize: '12px', color: T.ink, lineHeight: 1.5,
          fontFamily: T.sans, fontStyle: 'italic',
        }}>
          Your archival record of this session. SOAP notes are on top because they drive the next visit. Everything else below is supporting context.
        </div>

        {/* SOAP - prominent at top */}
        {soapHasContent ? (
          <Card className="bm-post-card" style={{ marginBottom: '14px', padding: '20px' }} accent={T.forest}>
            <SectionLabel accent={T.forest}>SOAP notes</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { key: 'S', label: 'Subjective', desc: 'What the client reported' },
                { key: 'O', label: 'Objective', desc: 'What you observed' },
                { key: 'A', label: 'Assessment', desc: 'Your interpretation' },
                { key: 'P', label: 'Plan', desc: 'Next steps', highlight: true },
              ].filter(s => intel.soap[s.key]).map(s => (
                <div key={s.key} style={{
                  background: s.highlight ? T.greenBg : T.cream,
                  borderRadius: '10px', padding: '12px 14px',
                  borderLeft: s.highlight ? `4px solid ${T.sage}` : `3px solid ${T.lineFaint}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: T.forest, fontFamily: T.serif, letterSpacing: '0.5px' }}>{s.key}</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: s.highlight ? T.sage : T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px' }}>{s.label}</span>
                    <span style={{ fontSize: '10px', color: T.inkSoft }}>· {s.desc}</span>
                  </div>
                  <div style={{ fontSize: '14px', color: T.ink, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{intel.soap[s.key]}</div>
                </div>
              ))}
              {intel.soap.legacy && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400E' }}>
                  <strong>Previous note (legacy):</strong> {intel.soap.legacy}
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card className="bm-post-card" style={{ marginBottom: '14px', background: '#FFFBEB', borderColor: '#FDE68A' }}>
            <div style={{ fontSize: '13px', color: '#92400E', lineHeight: 1.5 }}>
              <strong>No SOAP notes yet.</strong> Open this session in the dashboard and add your notes before marking complete. The client summary at <code style={{ background: 'white', padding: '1px 6px', borderRadius: 4 }}>/recap/{session.id.slice(0, 8)}…</code> is held until you finish.
            </div>
          </Card>
        )}

        {/* Aftercare therapist recorded */}
        {(intel.soap.aftercare?.length > 0 || intel.soap.aftercareCustom) && (
          <Card className="bm-post-card" style={{ marginBottom: '14px' }} accent={T.sage}>
            <SectionLabel accent={T.sage}>Aftercare you sent the client</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(intel.soap.aftercare || []).map((id, i) => {
                const labelMap = {
                  'hydrate': 'Drink plenty of water today',
                  'rest': 'Take it easy for the rest of the day',
                  'no-strenuous': 'Avoid strenuous exercise for 24 hours',
                  'epsom-bath': 'A warm Epsom salt bath can help',
                  'gentle-stretch': 'Do some gentle stretching tonight',
                  'ice': 'Apply ice if you feel any soreness',
                  'heat': 'Apply heat to help muscles relax',
                  'no-alcohol': 'Avoid alcohol for 24 hours',
                };
                return (
                  <div key={i} style={{ fontSize: 13, color: T.ink, lineHeight: 1.5, paddingLeft: 18, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, top: 5, color: T.sage, fontWeight: 700 }}>✓</span>
                    {labelMap[id] || id}
                  </div>
                );
              })}
              {intel.soap.aftercareCustom && (
                <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.5, paddingLeft: 18, position: 'relative', fontStyle: 'italic', marginTop: 4 }}>
                  <span style={{ position: 'absolute', left: 0, top: 5, color: T.gold, fontWeight: 700 }}>+</span>
                  {intel.soap.aftercareCustom}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Red flags from intake (carried forward, still relevant for record) */}
        {intel.standing && (
          <div className="bm-post-card" style={{
            background: T.redBg, border: `1.5px solid ${T.red}`,
            borderLeft: `4px solid ${T.red}`,
            borderRadius: '12px', padding: '14px 18px',
            marginBottom: '14px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: T.red, textTransform: 'uppercase', letterSpacing: '1.1px', marginBottom: '8px' }}>
              Medical flags noted at intake
            </div>
            {session.med_note && (
              <div style={{ fontSize: '14px', color: '#7F1D1D', fontWeight: 600, marginBottom: '6px', lineHeight: 1.5 }}>{session.med_note}</div>
            )}
            {intel.standing.conditions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {intel.standing.conditions.map((c, i) => (
                  <Pill key={i} color="#7F1D1D" bg="rgba(185,28,28,0.1)">{c}</Pill>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pattern update */}
        {intel.patterns.length > 0 && (
          <Card className="bm-post-card" style={{ marginBottom: '14px' }} accent={T.sage}>
            <SectionLabel accent={T.sage}>Pattern update</SectionLabel>
            <div style={{ fontSize: '11px', color: T.inkSoft, marginTop: '-6px', marginBottom: '10px' }}>What the data shows after today's visit</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {intel.patterns.map((p, i) => (
                <div key={i} style={{ fontSize: '14px', color: T.ink, lineHeight: 1.5, paddingLeft: '14px', position: 'relative' }}>
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

        {/* What changed today */}
        {intel.changes.length > 0 && (
          <Card className="bm-post-card" style={{ marginBottom: '14px' }} accent={T.gold}>
            <SectionLabel accent={T.gold}>What changed today vs last visit</SectionLabel>
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

        {/* Today's request, collapsible */}
        <Card className="bm-post-card" style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showRequest ? '14px' : 0 }}>
            <div>
              <SectionLabel>Today's request, from intake</SectionLabel>
              <div style={{ fontSize: '11px', color: T.inkSoft, marginTop: '-6px' }}>What the client asked for before the session</div>
            </div>
            <button onClick={() => setShowRequest(v => !v)} className="no-print" style={{
              background: 'transparent', border: `1px solid ${T.lineFaint}`,
              padding: '6px 14px', borderRadius: '8px',
              fontSize: '12px', fontWeight: 600, color: T.forest, cursor: 'pointer',
              fontFamily: T.sans,
            }}>{showRequest ? 'Hide' : 'Show'}</button>
          </div>
          {showRequest && (
            <div className="bm-post-grid-2" style={{ alignItems: 'start' }}>
              <div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 10 }}>
                  {session.pressure && <Pill bg={T.forest} color="white">Pressure {session.pressure}/5</Pill>}
                  {session.goal && <Pill bg={T.creamAlt} color={T.forest}>Goal: {session.goal}</Pill>}
                </div>
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
              <div style={{ display: 'flex', justifyContent: 'space-around', gap: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '8px' }}>Front</div>
                  <BodySVG focusAreas={session.front_focus || []} avoidAreas={session.front_avoid || []} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '8px' }}>Back</div>
                  <BodySVG focusAreas={session.back_focus || []} avoidAreas={session.back_avoid || []} />
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Cumulative body heatmap, collapsible */}
        {intel.heatmap.count > 0 && (
          <Card className="bm-post-card" style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showHeatmap ? '14px' : 0 }}>
              <div>
                <SectionLabel>Cumulative body map</SectionLabel>
                <div style={{ fontSize: '11px', color: T.inkSoft, marginTop: '-6px' }}>Across {intel.heatmap.count} past visits</div>
              </div>
              <button onClick={() => setShowHeatmap(v => !v)} className="no-print" style={{
                background: 'transparent', border: `1px solid ${T.lineFaint}`,
                padding: '6px 14px', borderRadius: '8px',
                fontSize: '12px', fontWeight: 600, color: T.forest, cursor: 'pointer',
                fontFamily: T.sans,
              }}>{showHeatmap ? 'Hide' : 'Show'}</button>
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

        {/* Visit context footer */}
        <div style={{ fontSize: 12, color: T.inkSoft, padding: '12px 4px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <span>Visit #{intel.cadence.visitNumber}</span>
          {intel.cadence.lastVisitDate && <span>Previous: {intel.cadence.lastVisitDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
          {intel.cadence.avgDays && <span>Avg cadence: {intel.cadence.avgDays}d</span>}
        </div>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${T.lineFaint}`, paddingTop: '12px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: T.inkSoft, flexWrap: 'wrap', gap: '8px' }}>
          <span>MyBodyMap · mybodymap.app · Therapist record · Confidential</span>
          <span style={{ textAlign: 'right' }}>{therapistName}{therapistPhone ? ' · ' + therapistPhone : ''}{intakeUrl ? ' · ' + intakeUrl : ''}</span>
        </div>
      </div>
    </div>
  );
}
