// src/pages/IntakeBrief.js
//
// Phase 3 of the three-dot document system redesign (HK May 11 2026).
//
// This is dot 1 of 3: the intake form output. It is what the
// therapist sees and prints to read what the client just filled in.
//
// Per HK direction the layout is two pages:
//   Page 1: visual front + back body diagrams, key request pills,
//           and a notes column the therapist can write into.
//   Page 2: every preference and intake answer in a clean table.
//
// Design principle: this is the rawest view of what the client
// said today. No intelligence, no patterns. The pre-session brief
// adds intelligence. The post-session report adds the SOAP. This
// page is just the intake.

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getStandingFlags, zoneLabel, ZONE_COORDS } from '../lib/sessionIntelligence';

const T = {
  cream: '#F9F5EE',
  creamAlt: '#F3EEE2',
  forest: '#1C2B22',
  sage: '#4A6B54',
  gold: '#C9A84C',
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

function BodySVG({ focusAreas = [], avoidAreas = [] }) {
  const fill = T.creamAlt;
  const stroke = '#C8BFB0';
  return (
    <svg width="180" height="345" viewBox="0 0 170 310" aria-hidden="true">
      <ellipse cx="85" cy="28" rx="20" ry="24" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <rect x="77" y="50" width="16" height="14" rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <path d="M57 64 Q47 70 44 90 L40 155 Q40 162 48 162 L122 162 Q130 162 130 155 L126 90 Q123 70 113 64 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <path d="M57 66 Q42 74 38 115 Q36 128 40 138 Q46 141 50 138 Q54 112 60 85 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <path d="M113 66 Q128 74 132 115 Q134 128 130 138 Q124 141 120 138 Q116 112 110 85 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <path d="M60 162 Q56 195 54 232 Q52 260 56 278 Q62 284 70 282 Q76 278 76 260 L78 162 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <path d="M110 162 Q114 195 116 232 Q118 260 114 278 Q108 284 100 282 Q94 278 94 260 L92 162 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
      {focusAreas.map((area, i) => {
        const c = ZONE_COORDS[area]; if (!c) return null;
        return (
          <g key={'f' + i}>
            <circle cx={c[0]} cy={c[1]} r="13" fill="rgba(74,107,84,0.22)" stroke={T.sage} strokeWidth="2" />
            <circle cx={c[0]} cy={c[1]} r="5" fill={T.sage} />
          </g>
        );
      })}
      {avoidAreas.map((area, i) => {
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

function PrefRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline',
      padding: '8px 0',
      borderBottom: `1px solid ${T.lineFaint}`,
      gap: 16,
    }}>
      <div style={{ flex: '0 0 130px', fontSize: 11, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px' }}>{label}</div>
      <div style={{ flex: 1, fontSize: 14, color: T.ink, lineHeight: 1.5, textTransform: typeof value === 'string' && value.length < 30 ? 'capitalize' : 'none' }}>{value}</div>
    </div>
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
  const intakeUrl = therapist?.custom_url ? `${window.location.origin}/${therapist.custom_url}` : null;

  const standing = getStandingFlags(session);
  const focusAreasFront = session.front_focus || [];
  const focusAreasBack = session.back_focus || [];
  const avoidAreasFront = session.front_avoid || [];
  const avoidAreasBack = session.back_avoid || [];
  const allFocus = [...focusAreasFront, ...focusAreasBack];
  const allAvoid = [...avoidAreasFront, ...avoidAreasBack];

  // Focus distribution (band percentages) if client adjusted them.
  const hasBands = session.front_pct !== null || session.top_pct !== null || session.middle_pct !== null || session.bottom_pct !== null;

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
          .bm-intake-wrap { background: white !important; }
          .bm-intake-card { box-shadow: none !important; border: 1px solid #DDD7C7 !important; }
          .bm-intake-page-break { page-break-before: always; }
        }
        * { box-sizing: border-box; }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{
        background: T.forest, padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span style={{ color: 'white', fontWeight: 600, fontSize: '14px', fontFamily: T.sans, letterSpacing: '0.2px' }}>
          Today's Intake
        </span>
        <button onClick={() => window.print()} style={{
          background: T.gold, color: T.forest, border: 'none',
          padding: '8px 18px', borderRadius: '8px',
          fontWeight: 700, fontSize: '13px', cursor: 'pointer',
          fontFamily: T.sans,
        }}>Save as PDF</button>
      </div>

      <div className="bm-intake-wrap" style={{ maxWidth: '820px', margin: '0 auto', padding: '24px 20px 48px' }}>

        {/* ============= PAGE 1: VISUAL ============= */}

        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '6px' }}>
            Document 1 of 3 · Today's Intake
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontFamily: T.serif, fontSize: '32px', fontWeight: 500, color: T.forest, margin: 0, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                {client?.name || 'Client'}
              </h1>
              <div style={{ fontSize: '13px', color: T.inkSoft, marginTop: '4px' }}>{sessionDate}</div>
              {client?.phone && <div style={{ fontSize: '12px', color: T.inkSoft }}>{client.phone}</div>}
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
          fontStyle: 'italic',
        }}>
          What {client?.name?.split(' ')[0] || 'this client'} filled in today. Page 1 visual, page 2 answers.
        </div>

        {/* Red flag strip if present */}
        {standing && (
          <div className="bm-intake-card" style={{
            background: T.redBg, border: `1.5px solid ${T.red}`,
            borderLeft: `4px solid ${T.red}`,
            borderRadius: '12px', padding: '14px 18px',
            marginBottom: '14px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: T.red, textTransform: 'uppercase', letterSpacing: '1.1px', marginBottom: '6px' }}>
              Review before session
            </div>
            {session.med_note && (
              <div style={{ fontSize: '14px', color: '#7F1D1D', fontWeight: 600, lineHeight: 1.5, marginBottom: 6 }}>{session.med_note}</div>
            )}
            {standing.conditions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 4 }}>
                {standing.conditions.map((c, i) => (
                  <span key={i} style={{ background: 'rgba(185,28,28,0.1)', color: '#7F1D1D', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{c}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hero: Bodies + key request + therapist note column */}
        <div className="bm-intake-card" style={{
          background: T.white, borderRadius: 14, padding: 22,
          border: `1px solid ${T.lineFaint}`,
          boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 14 }}>What they marked</div>

          <div style={{ display: 'flex', justifyContent: 'space-around', gap: 12, marginBottom: 18 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>Front</div>
              <BodySVG focusAreas={focusAreasFront} avoidAreas={avoidAreasFront} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>Back</div>
              <BodySVG focusAreas={focusAreasBack} avoidAreas={avoidAreasBack} />
            </div>
          </div>

          {/* Key request pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 14 }}>
            {session.pressure && (
              <span style={{ background: T.forest, color: 'white', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                Pressure {session.pressure}/5
              </span>
            )}
            {session.goal && (
              <span style={{ background: T.creamAlt, color: T.forest, padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
                Goal: {session.goal}
              </span>
            )}
          </div>

          {/* Focus / Avoid lists */}
          {(allFocus.length > 0 || allAvoid.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              {allFocus.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Focus</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {allFocus.map((a, i) => <span key={i} style={{ background: T.greenBg, color: T.forest, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{zoneLabel(a)}</span>)}
                  </div>
                </div>
              )}
              {allAvoid.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.red, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Avoid</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {allAvoid.map((a, i) => <span key={i} style={{ background: 'rgba(185,28,28,0.08)', color: '#7F1D1D', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{zoneLabel(a)}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Focus distribution bands if set */}
          {hasBands && (
            <div style={{ background: T.cream, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Focus distribution</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                {session.front_pct !== null && session.front_pct !== undefined && <span><strong>{session.front_pct}%</strong> <span style={{ color: T.inkSoft }}>front</span></span>}
                {session.top_pct !== null && session.top_pct !== undefined && <span><strong>{session.top_pct}%</strong> <span style={{ color: T.inkSoft }}>top</span></span>}
                {session.middle_pct !== null && session.middle_pct !== undefined && <span><strong>{session.middle_pct}%</strong> <span style={{ color: T.inkSoft }}>middle</span></span>}
                {session.bottom_pct !== null && session.bottom_pct !== undefined && <span><strong>{session.bottom_pct}%</strong> <span style={{ color: T.inkSoft }}>bottom</span></span>}
              </div>
            </div>
          )}

          {/* Therapist note space (blank lines for printing) */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px dashed ${T.lineFaint}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>Therapist notes (handwritten)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ borderBottom: `1px solid ${T.lineFaint}`, height: 0 }} />
              ))}
            </div>
          </div>
        </div>

        {/* ============= PAGE 2: Q&A ============= */}
        <div className="bm-intake-page-break" />

        {/* Page 2 header */}
        <div style={{ marginTop: 28, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 6 }}>
            Document 1 of 3 · Today's Intake · Answers
          </div>
          <h2 style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 500, color: T.forest, margin: 0, letterSpacing: '-0.3px' }}>
            What {client?.name?.split(' ')[0] || 'they'} filled in
          </h2>
        </div>

        {/* Preferences */}
        <div className="bm-intake-card" style={{
          background: T.white, borderRadius: 14, padding: '20px 22px',
          border: `1px solid ${T.lineFaint}`,
          boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 12 }}>Preferences</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <PrefRow label="Pressure" value={session.pressure ? `${session.pressure}/5` : null} />
            <PrefRow label="Goal" value={session.goal} />
            <PrefRow label="Music" value={session.music} />
            <PrefRow label="Lighting" value={session.lighting} />
            <PrefRow label="Conversation" value={session.conversation} />
            <PrefRow label="Table temp" value={session.table_temp} />
            <PrefRow label="Room temp" value={session.room_temp} />
            <PrefRow label="Draping" value={session.draping} />
            <PrefRow label="Oil" value={session.oil_pref && session.oil_pref !== 'none' ? session.oil_pref : null} />
          </div>
        </div>

        {/* Today's chief complaint / client notes */}
        {(session.client_notes || session.med_note) && (
          <div className="bm-intake-card" style={{
            background: T.white, borderRadius: 14, padding: '20px 22px',
            border: `1px solid ${T.lineFaint}`,
            boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 12 }}>What they wrote</div>
            {session.client_notes && (
              <div style={{ marginBottom: session.med_note ? 12 : 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Notes for the therapist</div>
                <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.6, fontStyle: 'italic' }}>"{session.client_notes}"</div>
              </div>
            )}
            {session.med_note && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.red, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Medical note</div>
                <div style={{ fontSize: 14, color: '#7F1D1D', lineHeight: 1.6, fontWeight: 500 }}>{session.med_note}</div>
              </div>
            )}
          </div>
        )}

        {/* Medical conditions checklist */}
        {Array.isArray(session.medical_conditions) && session.medical_conditions.length > 0 && (
          <div className="bm-intake-card" style={{
            background: T.white, borderRadius: 14, padding: '20px 22px',
            border: `1px solid ${T.lineFaint}`,
            boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 12 }}>Conditions they checked</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {session.medical_conditions.map((c, i) => (
                <span key={i} style={{ background: T.creamAlt, color: T.ink, padding: '5px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500 }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* Custom intake answers (whatever the therapist configured) */}
        {customKeys.length > 0 && (
          <div className="bm-intake-card" style={{
            background: T.white, borderRadius: 14, padding: '20px 22px',
            border: `1px solid ${T.lineFaint}`,
            boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 12 }}>Other answers</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {customKeys.map((k, i) => {
                const v = customAnswers[k];
                const display = typeof v === 'string' ? v : (Array.isArray(v) ? v.join(', ') : JSON.stringify(v));
                return <PrefRow key={i} label={k} value={display} />;
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${T.lineFaint}`, paddingTop: '12px', marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: T.inkSoft, flexWrap: 'wrap', gap: '8px' }}>
          <span>MyBodyMap · mybodymap.app · Confidential</span>
          <span style={{ textAlign: 'right' }}>{therapistName}{therapistPhone ? ' · ' + therapistPhone : ''}{intakeUrl ? ' · ' + intakeUrl : ''}</span>
        </div>
      </div>
    </div>
  );
}
