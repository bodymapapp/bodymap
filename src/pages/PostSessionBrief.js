// src/pages/PostSessionBrief.js
//
// The post-session therapist record, dot 3a of 3, one page.
//
// The therapist's archival document. SOAP first because it drives
// the next visit. Aftercare echo so the therapist remembers what
// they told the client. Pattern update + what changed surfaced as
// quick scan-able callouts. Today's request mini at the bottom so
// the document is complete on its own.
//
// Layout:
//   1. Header with visit number + completed status
//   2. SOAP card, S/O/A all compact, P highlighted
//   3. Side-by-side: Aftercare echo | Pattern update + What changed
//   4. Today's request mini at bottom (body diagrams + pills)
//   5. Visit context footer

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import BodyDiagram from '../components/BodyDiagram';
import {
  parseSoap,
  hasSoapContent,
  deriveCadence,
  deriveChanges,
  derivePatterns,
  getStandingFlags,
  getLastCompletedSession,
  zoneLabel,
  AFTERCARE_PRESETS,
} from '../lib/sessionIntelligence';

const T = {
  cream: '#F9F5EE',
  creamAlt: '#F3EEE2',
  forest: '#1C2B22',
  sage: '#4A6B54',
  sageBg: '#EEF3EE',
  gold: '#C9A84C',
  goldBg: '#FAF3DC',
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

function Pill({ children, color, bg, large }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: bg || T.creamAlt, color: color || T.ink,
      padding: large ? '5px 12px' : '4px 10px',
      borderRadius: 20,
      fontSize: large ? 12.5 : 11,
      fontWeight: 600,
      lineHeight: 1.2,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

const AFTERCARE_MAP = Object.fromEntries(AFTERCARE_PRESETS.map(p => [p.id, p.label]));

export default function PostSessionBrief() {
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
    return {
      soap: parseSoap(session.therapist_notes || ''),
      cadence: deriveCadence(history, session.id),
      changes: deriveChanges(session, lastSession),
      patterns: derivePatterns(history, session.id),
      standing: getStandingFlags(session),
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
  const focusAreasFront = session.front_focus || [];
  const focusAreasBack = session.back_focus || [];
  const avoidAreasFront = session.front_avoid || [];
  const avoidAreasBack = session.back_avoid || [];
  const allFocus = [...focusAreasFront, ...focusAreasBack];
  const allAvoid = [...avoidAreasFront, ...avoidAreasBack];
  const therapistName = therapist?.business_name || therapist?.full_name || 'Your Practice';
  const therapistFullName = therapist?.full_name || '';
  const therapistPhone = therapist?.phone || null;
  const summaryUrl = `${window.location.origin}/recap/${session.id}`;

  const soapHasContent = hasSoapContent(intel.soap);
  const aftercare = Array.isArray(intel.soap.aftercare) ? intel.soap.aftercare : [];
  const aftercareCustom = intel.soap.aftercareCustom || '';
  const visitLabel = intel.cadence.isFirstVisit ? 'First visit' : `Visit ${intel.cadence.visitNumber}`;

  return (
    <div style={{ background: T.cream, minHeight: '100vh', color: T.ink, fontFamily: T.sans }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          @page { size: A4; margin: 10mm; }
          .bm-post-wrap { background: white !important; }
          .bm-post-card { box-shadow: none !important; border: 1px solid #DDD7C7 !important; break-inside: avoid; }
        }
        * { box-sizing: border-box; }
        .bm-post-soap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .bm-post-split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .bm-post-mini { display: grid; grid-template-columns: 240px 1fr; gap: 16px; }
        @media (max-width: 760px) {
          .bm-post-soap-grid { grid-template-columns: 1fr; }
          .bm-post-split { grid-template-columns: 1fr; }
          .bm-post-mini { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{
        background: T.forest, padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 10, flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span style={{ color: 'white', fontWeight: 600, fontSize: 14, letterSpacing: '0.2px' }}>
          Post-Session Record
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.open(summaryUrl, '_blank')} style={{
            background: 'transparent', color: 'white',
            border: '1px solid rgba(255,255,255,0.35)',
            padding: '7px 14px', borderRadius: 8,
            fontWeight: 600, fontSize: 12, cursor: 'pointer',
          }}>View client recap</button>
          <button onClick={() => window.print()} style={{
            background: T.gold, color: T.forest, border: 'none',
            padding: '8px 18px', borderRadius: 8,
            fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '0.2px',
          }}>Save as PDF</button>
        </div>
      </div>

      <div className="bm-post-wrap" style={{ maxWidth: 920, margin: '0 auto', padding: '20px 20px 32px' }}>

        {/* Header */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: 6 }}>
                Document 3 of 3 · Post-Session · Therapist Record
              </div>
              <h1 style={{
                fontFamily: T.serif, fontSize: 'clamp(30px, 4vw, 40px)',
                fontWeight: 500, color: T.forest, margin: 0,
                letterSpacing: '-0.6px', lineHeight: 1.05,
              }}>
                {client?.name || 'Client'}
              </h1>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <Pill bg={T.forest} color="white" large>{visitLabel}</Pill>
                <span style={{ fontSize: 13, color: T.inkSoft }}>{sessionDate}</span>
                {!session.completed && (
                  <Pill bg="#FFFBEB" color="#92400E">Not yet completed</Pill>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: T.inkSoft, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: T.forest, fontSize: 13 }}>{therapistFullName || therapistName}</div>
              {therapistFullName && therapistName !== therapistFullName && <div>{therapistName}</div>}
              {therapistPhone && <div>{therapistPhone}</div>}
            </div>
          </div>
        </div>

        {/* SOAP card, top priority */}
        {soapHasContent ? (
          <div className="bm-post-card" style={{
            background: T.white, borderRadius: 14, padding: '16px 18px',
            border: `1px solid ${T.lineFaint}`,
            boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
            borderLeft: `4px solid ${T.forest}`,
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: T.forest, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>
              SOAP notes
            </div>

            {/* S/O/A in 2-col compact grid, P in its own highlighted card below */}
            <div className="bm-post-soap-grid" style={{ marginBottom: 10 }}>
              {[
                { key: 'S', label: 'Subjective' },
                { key: 'O', label: 'Objective' },
                { key: 'A', label: 'Assessment' },
              ].filter(s => intel.soap[s.key]).map(s => (
                <div key={s.key} style={{
                  background: T.cream, borderRadius: 10, padding: '10px 12px',
                  borderLeft: `3px solid ${T.lineFaint}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.forest, fontFamily: T.serif }}>{s.key}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px' }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{intel.soap[s.key]}</div>
                </div>
              ))}
            </div>

            {/* P, prominent highlighted card */}
            {intel.soap.P && (
              <div style={{
                background: T.sageBg, borderRadius: 10, padding: '12px 14px',
                borderLeft: `4px solid ${T.sage}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.forest, fontFamily: T.serif }}>P</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Plan · drives next visit</span>
                </div>
                <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontWeight: 500 }}>{intel.soap.P}</div>
              </div>
            )}

            {/* Note to client echo */}
            {intel.soap.noteToClient && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.lineFaint}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>
                  Note you sent the client
                </div>
                <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.55, fontStyle: 'italic', fontFamily: T.serif }}>
                  "{intel.soap.noteToClient}"
                </div>
              </div>
            )}

            {intel.soap.legacy && (
              <div style={{ marginTop: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#92400E' }}>
                <strong>Legacy note:</strong> {intel.soap.legacy}
              </div>
            )}
          </div>
        ) : (
          <div className="bm-post-card" style={{
            background: '#FFFBEB', border: '1.5px solid #FDE68A',
            borderRadius: 12, padding: '12px 16px', marginBottom: 12,
            fontSize: 13, color: '#92400E', lineHeight: 1.5,
          }}>
            <strong>No SOAP notes yet.</strong> Open this session in the dashboard, complete your S/O/A/P notes, and mark it complete. The client recap at <code style={{ background: 'white', padding: '1px 5px', borderRadius: 4 }}>/recap/...</code> is held until you do.
          </div>
        )}

        {/* Red flags */}
        {intel.standing && (
          <div className="bm-post-card" style={{
            background: T.redBg, border: `1.5px solid ${T.red}`,
            borderLeft: `4px solid ${T.red}`,
            borderRadius: 12, padding: '10px 14px',
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: T.red, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
              Medical flags on file
            </div>
            {session.med_note && (
              <div style={{ fontSize: 12.5, color: T.redInk, fontWeight: 600, lineHeight: 1.4, marginBottom: 4 }}>{session.med_note}</div>
            )}
            {intel.standing.conditions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {intel.standing.conditions.map((c, i) => (
                  <Pill key={i} color={T.redInk} bg="rgba(185,28,28,0.1)">{c}</Pill>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Split: Aftercare echo | Pattern update + What changed */}
        <div className="bm-post-split" style={{ marginBottom: 12 }}>

          {/* Aftercare echo */}
          {(aftercare.length > 0 || aftercareCustom) ? (
            <div className="bm-post-card" style={{
              background: T.white, borderRadius: 14, padding: '14px 16px',
              border: `1px solid ${T.lineFaint}`,
              boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
              borderLeft: `3px solid ${T.sage}`,
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 10 }}>
                Aftercare you sent · {aftercare.length + (aftercareCustom ? 1 : 0)} items
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {aftercare.map((id, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5, paddingLeft: 18, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, top: 4, color: T.sage, fontWeight: 800, fontSize: 13 }}>✓</span>
                    {AFTERCARE_MAP[id] || id}
                  </div>
                ))}
                {aftercareCustom && (
                  <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5, paddingLeft: 18, position: 'relative', fontStyle: 'italic', marginTop: aftercare.length > 0 ? 4 : 0, paddingTop: aftercare.length > 0 ? 6 : 0, borderTop: aftercare.length > 0 ? `1px solid ${T.lineFaint}` : 'none' }}>
                    <span style={{ position: 'absolute', left: 0, top: aftercare.length > 0 ? 10 : 4, color: T.gold, fontWeight: 800, fontSize: 13 }}>★</span>
                    {aftercareCustom}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bm-post-card" style={{
              background: T.cream, borderRadius: 14, padding: '14px 16px',
              border: `1px dashed ${T.lineFaint}`,
              fontSize: 12, color: T.inkSoft, lineHeight: 1.5, fontStyle: 'italic',
            }}>
              No aftercare sent. Add it on the SOAP tab.
            </div>
          )}

          {/* Pattern update + what changed combined */}
          <div className="bm-post-card" style={{
            background: T.white, borderRadius: 14, padding: '14px 16px',
            border: `1px solid ${T.lineFaint}`,
            boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
            borderLeft: `3px solid ${T.gold}`,
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 8 }}>
              What today added to the record
            </div>
            {intel.changes.length > 0 && (
              <div style={{ marginBottom: intel.patterns.length > 0 ? 10 : 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Changes today</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {intel.changes.slice(0, 3).map((c, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5, paddingLeft: 12, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, top: 6, width: 5, height: 5, borderRadius: 3, background: T.gold }} />
                      {c.text}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {intel.patterns.length > 0 && (
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Patterns now confirmed</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {intel.patterns.slice(0, 4).map((p, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5, paddingLeft: 12, position: 'relative' }}>
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
            {intel.changes.length === 0 && intel.patterns.length === 0 && (
              <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.5, fontStyle: 'italic' }}>
                Not enough history to surface changes or patterns yet.
              </div>
            )}
          </div>
        </div>

        {/* Today's request mini at bottom */}
        <div className="bm-post-card" style={{
          background: T.white, borderRadius: 14, padding: '14px 16px',
          border: `1px solid ${T.lineFaint}`,
          boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 10 }}>
            Today's request, from intake
          </div>
          <div className="bm-post-mini" style={{ alignItems: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Front</div>
                <BodyDiagram focusAreas={focusAreasFront} avoidAreas={avoidAreasFront} mode="mark" size="sm" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Back</div>
                <BodyDiagram focusAreas={focusAreasBack} avoidAreas={avoidAreasBack} mode="mark" size="sm" />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                {session.pressure && <Pill bg={T.forest} color="white">Pressure {session.pressure}/5</Pill>}
                {session.goal && <Pill bg={T.creamAlt} color={T.forest}>Goal: {session.goal}</Pill>}
              </div>
              {allFocus.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 3 }}>Focus</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {allFocus.map((a, i) => <Pill key={i} color={T.forest} bg={T.sageBg}>{zoneLabel(a)}</Pill>)}
                  </div>
                </div>
              )}
              {allAvoid.length > 0 && (
                <div style={{ marginBottom: session.client_notes ? 8 : 0 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: T.red, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 3 }}>Avoid</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {allAvoid.map((a, i) => <Pill key={i} color={T.redInk} bg="rgba(185,28,28,0.08)">{zoneLabel(a)}</Pill>)}
                  </div>
                </div>
              )}
              {session.client_notes && (
                <div style={{ fontSize: 11.5, color: T.ink, lineHeight: 1.5, fontStyle: 'italic', paddingTop: 6, borderTop: `1px solid ${T.lineFaint}` }}>
                  "{session.client_notes}"
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${T.lineFaint}`, paddingTop: 10, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: T.inkSoft, flexWrap: 'wrap', gap: 8 }}>
          <span>MyBodyMap · mybodymap.app · Confidential</span>
          <span style={{ textAlign: 'right' }}>{therapistName}{therapistPhone ? ' · ' + therapistPhone : ''}</span>
        </div>
      </div>
    </div>
  );
}
