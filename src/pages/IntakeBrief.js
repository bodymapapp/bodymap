// src/pages/IntakeBrief.js
//
// The intake form output, dot 1 of 3, one page.
//
// The rawest view of what the client just filled in today. No
// intelligence layer, no patterns. The pre-session brief adds
// synthesis; this is the source material.
//
// Layout on a single A4 page:
//   1. Header: gold doc badge + client name + date
//   2. Red flag strip if med flag or conditions
//   3. Hero spread: body diagrams (left, 320px) + their request (right)
//   4. Side-by-side: preferences grid | their words + custom answers
//   5. Conditions checklist as pill row at bottom

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import BodyDiagram from '../components/BodyDiagram';
import { getStandingFlags, zoneLabel } from '../lib/sessionIntelligence';

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

export default function IntakeBrief() {
  const { sessionId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
      if (!session) { setLoading(false); return; }
      const { data: client } = await supabase.from('clients').select('name,phone,email').eq('id', session.client_id).maybeSingle();
      const { data: therapist } = await supabase.from('therapists').select('full_name,business_name,custom_url,phone').eq('id', session.therapist_id).maybeSingle();
      setData({ session, client, therapist });
      setLoading(false);
    }
    load();
  }, [sessionId]);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: T.serif, color: T.inkSoft, background: T.cream }}>Loading intake...</div>;
  }
  if (!data) {
    return <div style={{ padding: 40, fontFamily: T.serif, background: T.cream, minHeight: '100vh' }}>Session not found.</div>;
  }

  const { session, client, therapist } = data;
  const sessionDate = new Date(session.created_at).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const therapistName = therapist?.business_name || therapist?.full_name || 'Your Practice';
  const therapistFullName = therapist?.full_name || '';
  const therapistPhone = therapist?.phone || null;

  const standing = getStandingFlags(session);
  const focusAreasFront = session.front_focus || [];
  const focusAreasBack = session.back_focus || [];
  const avoidAreasFront = session.front_avoid || [];
  const avoidAreasBack = session.back_avoid || [];
  const allFocus = [...focusAreasFront, ...focusAreasBack];
  const allAvoid = [...avoidAreasFront, ...avoidAreasBack];

  // Preferences for grid
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

  // Custom intake answers
  const customAnswers = session.custom_intake_answers || {};
  const customKeys = Object.keys(customAnswers).filter(k => {
    const v = customAnswers[k];
    return v !== null && v !== undefined && v !== '' && !(typeof v === 'string' && /^(no|none|n\/a)$/i.test(v.trim()));
  });

  const hasBands = session.front_pct != null || session.top_pct != null || session.middle_pct != null || session.bottom_pct != null;

  return (
    <div style={{ background: T.cream, minHeight: '100vh', color: T.ink, fontFamily: T.sans }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          @page { size: A4; margin: 10mm; }
          .bm-intake-wrap { background: white !important; }
          .bm-intake-card { box-shadow: none !important; border: 1px solid #DDD7C7 !important; break-inside: avoid; }
        }
        * { box-sizing: border-box; }
        .bm-intake-hero { display: grid; grid-template-columns: 320px 1fr; gap: 16px; }
        .bm-intake-split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .bm-intake-prefs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
        @media (max-width: 760px) {
          .bm-intake-hero { grid-template-columns: 1fr; }
          .bm-intake-split { grid-template-columns: 1fr; }
          .bm-intake-prefs { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="no-print" style={{
        background: T.forest, padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span style={{ color: 'white', fontWeight: 600, fontSize: 14, letterSpacing: '0.2px' }}>
          Today's Intake
        </span>
        <button onClick={() => window.print()} style={{
          background: T.gold, color: T.forest, border: 'none',
          padding: '8px 18px', borderRadius: 8,
          fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '0.2px',
        }}>Save as PDF</button>
      </div>

      <div className="bm-intake-wrap" style={{ maxWidth: 920, margin: '0 auto', padding: '20px 20px 32px' }}>

        {/* Header */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: 6 }}>
                Document 1 of 3 · Today's Intake
              </div>
              <h1 style={{
                fontFamily: T.serif, fontSize: 'clamp(30px, 4vw, 40px)',
                fontWeight: 500, color: T.forest, margin: 0,
                letterSpacing: '-0.6px', lineHeight: 1.05,
              }}>
                {client?.name || 'Client'}
              </h1>
              <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 6 }}>
                {sessionDate}
                {client?.phone && <span style={{ marginLeft: 10 }}>· {client.phone}</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: T.inkSoft, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: T.forest, fontSize: 13 }}>{therapistFullName || therapistName}</div>
              {therapistFullName && therapistName !== therapistFullName && <div>{therapistName}</div>}
              {therapistPhone && <div>{therapistPhone}</div>}
            </div>
          </div>
        </div>

        {/* Red flag strip */}
        {standing && (
          <div className="bm-intake-card" style={{
            background: T.redBg, border: `1.5px solid ${T.red}`,
            borderLeft: `4px solid ${T.red}`,
            borderRadius: 12, padding: '10px 14px',
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: T.red, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
              Review before session
            </div>
            {session.med_note && (
              <div style={{ fontSize: 13, color: T.redInk, fontWeight: 600, lineHeight: 1.45, marginBottom: standing.conditions.length > 0 ? 4 : 0 }}>{session.med_note}</div>
            )}
            {standing.conditions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {standing.conditions.map((c, i) => (
                  <Pill key={i} color={T.redInk} bg="rgba(185,28,28,0.1)">{c}</Pill>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hero: body diagrams + today's request */}
        <div className="bm-intake-hero" style={{ marginBottom: 12 }}>

          <div className="bm-intake-card" style={{
            background: T.white, borderRadius: 14, padding: '14px 16px',
            border: `1px solid ${T.lineFaint}`,
            boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 10, textAlign: 'center' }}>
              What they marked
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: 6 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Front</div>
                <BodyDiagram focusAreas={focusAreasFront} avoidAreas={avoidAreasFront} mode="mark" size="md" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Back</div>
                <BodyDiagram focusAreas={focusAreasBack} avoidAreas={avoidAreasBack} mode="mark" size="md" />
              </div>
            </div>
            {hasBands && (
              <div style={{
                marginTop: 12, paddingTop: 10,
                borderTop: `1px solid ${T.lineFaint}`,
                display: 'flex', justifyContent: 'space-around',
                fontSize: 11, color: T.ink,
              }}>
                {session.front_pct != null && <span><strong>{session.front_pct}%</strong> <span style={{ color: T.inkSoft }}>front</span></span>}
                {session.top_pct != null && <span><strong>{session.top_pct}%</strong> <span style={{ color: T.inkSoft }}>top</span></span>}
                {session.middle_pct != null && <span><strong>{session.middle_pct}%</strong> <span style={{ color: T.inkSoft }}>middle</span></span>}
                {session.bottom_pct != null && <span><strong>{session.bottom_pct}%</strong> <span style={{ color: T.inkSoft }}>bottom</span></span>}
              </div>
            )}
          </div>

          {/* Today's request card */}
          <div className="bm-intake-card" style={{
            background: T.white, borderRadius: 14, padding: '14px 16px',
            border: `1px solid ${T.lineFaint}`,
            boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
            borderLeft: `3px solid ${T.sage}`,
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 10 }}>
              Today's request
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {session.pressure && <Pill bg={T.forest} color="white" large>Pressure {session.pressure}/5</Pill>}
              {session.goal && <Pill bg={T.creamAlt} color={T.forest} large>Goal: {session.goal}</Pill>}
            </div>
            {allFocus.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Focus</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {allFocus.map((a, i) => <Pill key={i} color={T.forest} bg={T.sageBg}>{zoneLabel(a)}</Pill>)}
                </div>
              </div>
            )}
            {allAvoid.length > 0 && (
              <div style={{ marginBottom: session.client_notes ? 10 : 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.red, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Avoid</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {allAvoid.map((a, i) => <Pill key={i} color={T.redInk} bg="rgba(185,28,28,0.08)">{zoneLabel(a)}</Pill>)}
                </div>
              </div>
            )}
            {session.client_notes && (
              <div style={{
                paddingTop: 10, borderTop: `1px solid ${T.lineFaint}`,
                fontSize: 12.5, color: T.ink, lineHeight: 1.55, fontStyle: 'italic',
              }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4, fontStyle: 'normal' }}>In their words</div>
                "{session.client_notes}"
              </div>
            )}
          </div>
        </div>

        {/* Split: Preferences | Custom answers */}
        <div className="bm-intake-split" style={{ marginBottom: 12 }}>

          {/* Preferences grid */}
          {prefs.length > 0 && (
            <div className="bm-intake-card" style={{
              background: T.white, borderRadius: 14, padding: '14px 16px',
              border: `1px solid ${T.lineFaint}`,
              boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 10 }}>
                Preferences
              </div>
              <div className="bm-intake-prefs">
                {prefs.map((p, i) => (
                  <div key={i} style={{ background: T.cream, borderRadius: 8, padding: '7px 10px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>{p.label}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.forest, textTransform: 'capitalize' }}>{p.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom intake answers */}
          {customKeys.length > 0 && (
            <div className="bm-intake-card" style={{
              background: T.white, borderRadius: 14, padding: '14px 16px',
              border: `1px solid ${T.lineFaint}`,
              boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 10 }}>
                Their answers
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {customKeys.slice(0, 8).map((k, i) => {
                  const v = customAnswers[k];
                  const display = typeof v === 'string' ? v : (Array.isArray(v) ? v.join(', ') : JSON.stringify(v));
                  return (
                    <div key={i} style={{
                      padding: '6px 0',
                      borderBottom: i < Math.min(customKeys.length, 8) - 1 ? `1px solid ${T.lineFaint}` : 'none',
                    }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>{k}</div>
                      <div style={{ fontSize: 12, color: T.ink, lineHeight: 1.45 }}>{display}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Conditions row at bottom */}
        {Array.isArray(session.medical_conditions) && session.medical_conditions.length > 0 && (
          <div className="bm-intake-card" style={{
            background: T.white, borderRadius: 14, padding: '12px 16px',
            border: `1px solid ${T.lineFaint}`,
            boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
            marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.9px', whiteSpace: 'nowrap' }}>
              Conditions checked
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {session.medical_conditions.map((c, i) => (
                <Pill key={i} color={T.ink} bg={T.creamAlt}>{c}</Pill>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${T.lineFaint}`, paddingTop: 10, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: T.inkSoft, flexWrap: 'wrap', gap: 8 }}>
          <span>MyBodyMap · mybodymap.app · Confidential</span>
          <span style={{ textAlign: 'right' }}>{therapistName}{therapistPhone ? ' · ' + therapistPhone : ''}</span>
        </div>
      </div>
    </div>
  );
}
