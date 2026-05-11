// src/pages/PostSessionSummary.js
//
// Client-facing summary of a completed session. The second output
// of dot 3 in the three-dot document system. The first output is
// the therapist's archival record at /brief/post/:sessionId. This
// is the warm, public-friendly version the client receives by
// email or QR code after the session.
//
// Design principle: minimal clinical language. Warm tone. The
// therapist's "note to client" is the headline. Aftercare is
// scannable. Rebooking is the single most prominent action at
// the bottom because retention is the whole point.

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { parseSoap, getAftercareItems, zoneLabel, ZONE_COORDS } from '../lib/sessionIntelligence';

const T = {
  cream: '#F9F5EE',
  creamAlt: '#F3EEE2',
  forest: '#1C2B22',
  sage: '#4A6B54',
  gold: '#C9A84C',
  rose: '#E8C5B5',
  ink: '#3D4F43',
  inkSoft: '#6B7F72',
  lineFaint: '#E8E0D0',
  white: '#FFFFFF',
  greenBg: '#EEF3EE',
  serif: "'Fraunces', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

function BodySVG({ focusAreas = [], size = 'normal' }) {
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
      {focusAreas.map((area, i) => {
        const c = ZONE_COORDS[area]; if (!c) return null;
        return (
          <g key={'f' + i}>
            <circle cx={c[0]} cy={c[1]} r="13" fill="rgba(74,107,84,0.22)" stroke={T.sage} strokeWidth="2" />
            <circle cx={c[0]} cy={c[1]} r="5" fill={T.sage} />
          </g>
        );
      })}
    </svg>
  );
}

export default function PostSessionSummary() {
  const { sessionId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
      if (!session) { setLoading(false); return; }
      const { data: client } = await supabase.from('clients').select('name,phone,email').eq('id', session.client_id).maybeSingle();
      const { data: therapist } = await supabase.from('therapists').select('full_name,business_name,custom_url,phone,booking_link_active').eq('id', session.therapist_id).maybeSingle();
      setData({ session, client, therapist });
      setLoading(false);
    }
    load();
  }, [sessionId]);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: T.serif, color: T.inkSoft, background: T.cream }}>Loading your summary...</div>;
  }
  if (!data || !data.session) {
    return <div style={{ padding: 40, fontFamily: T.serif, background: T.cream, minHeight: '100vh' }}>Summary not found.</div>;
  }

  const { session, client, therapist } = data;

  // Held until the therapist marks the session complete. The client
  // shouldn't see partial info if the SOAP and aftercare aren't done.
  if (!session.completed) {
    return (
      <div style={{ background: T.cream, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 460, background: T.white, borderRadius: 14, padding: 28, textAlign: 'center', border: `1px solid ${T.lineFaint}` }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🌿</div>
          <h1 style={{ fontFamily: T.serif, fontSize: 22, color: T.forest, margin: '0 0 10px', fontWeight: 500 }}>Your summary is on the way</h1>
          <p style={{ fontSize: 14, color: T.ink, lineHeight: 1.6, margin: 0 }}>
            Your therapist is still wrapping up their notes from today's session. Check back shortly or look for an email from {therapist?.business_name || therapist?.full_name || 'them'}.
          </p>
        </div>
      </div>
    );
  }

  const soap = parseSoap(session.therapist_notes || '');
  const firstName = client?.name ? client.name.split(' ')[0] : 'there';
  const sessionDate = new Date(session.created_at).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  // The five things that go into the client summary, in order:
  // 1. Note to client (the warm headline)
  // 2. What we worked on (body diagram + zones)
  // 3. Aftercare checklist
  // 4. Patterns we've noticed (friendly framing)
  // 5. Book your next session (CTA)

  const noteToClient = session.public_notes || soap.noteToClient || '';
  const focusAreas = [...(session.front_focus || []), ...(session.back_focus || [])];
  const aftercareItems = getAftercareItems(soap);
  const aftercareCustom = soap.aftercareCustom || '';

  const therapistName = therapist?.business_name || therapist?.full_name || 'Your therapist';
  const therapistFullName = therapist?.full_name || '';
  const therapistPhone = therapist?.phone || null;
  const bookingUrl = therapist?.custom_url ? `${window.location.origin}/${therapist.custom_url}` : null;

  return (
    <div style={{ background: T.cream, minHeight: '100vh', color: T.ink, fontFamily: T.sans }}>
      <style>{`
        * { box-sizing: border-box; }
        @media print {
          body { margin: 0; background: white; }
          @page { size: A4; margin: 12mm; }
          .no-print { display: none !important; }
          .bm-sum-card { box-shadow: none !important; }
        }
      `}</style>

      <div style={{ maxWidth: 620, margin: '0 auto', padding: '32px 20px 48px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: 8 }}>Your session summary</div>
          <h1 style={{ fontFamily: T.serif, fontSize: 36, fontWeight: 500, color: T.forest, margin: 0, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            Hi {firstName}.
          </h1>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 8 }}>{sessionDate} with {therapistFullName || therapistName}</div>
        </div>

        {/* 1. Therapist's note to client (headline) */}
        {noteToClient && (
          <div className="bm-sum-card" style={{
            background: T.white, borderRadius: 14, padding: '24px 24px 22px',
            border: `1px solid ${T.lineFaint}`,
            boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
            borderLeft: `4px solid ${T.gold}`,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 10 }}>
              A note from your therapist
            </div>
            <div style={{ fontSize: 16, color: T.ink, lineHeight: 1.7, fontFamily: T.serif, fontStyle: 'italic' }}>
              "{noteToClient}"
            </div>
            <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 14, textAlign: 'right' }}>
              {therapistFullName || therapistName}
            </div>
          </div>
        )}

        {/* 2. What we worked on */}
        {focusAreas.length > 0 && (
          <div className="bm-sum-card" style={{
            background: T.white, borderRadius: 14, padding: '20px 22px',
            border: `1px solid ${T.lineFaint}`,
            boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 14 }}>
              What we worked on
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Front</div>
                  <BodySVG focusAreas={session.front_focus || []} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Back</div>
                  <BodySVG focusAreas={session.back_focus || []} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.7, marginBottom: 12 }}>
                  We focused on:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {focusAreas.map((a, i) => (
                    <span key={i} style={{
                      background: T.greenBg, color: T.forest,
                      padding: '5px 12px', borderRadius: 20,
                      fontSize: 13, fontWeight: 600,
                    }}>{zoneLabel(a)}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Aftercare */}
        {(aftercareItems.length > 0 || aftercareCustom) && (
          <div className="bm-sum-card" style={{
            background: T.white, borderRadius: 14, padding: '20px 22px',
            border: `1px solid ${T.lineFaint}`,
            boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
            borderLeft: `4px solid ${T.sage}`,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 14 }}>
              How to take care of yourself today
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {aftercareItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 11, background: T.greenBg, color: T.sage, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>✓</span>
                  <span style={{ fontSize: 14, color: T.ink, lineHeight: 1.5 }}>{item.label}</span>
                </div>
              ))}
              {aftercareCustom && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: aftercareItems.length > 0 ? 4 : 0, paddingTop: aftercareItems.length > 0 ? 10 : 0, borderTop: aftercareItems.length > 0 ? `1px solid ${T.lineFaint}` : 'none' }}>
                  <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 11, background: T.creamAlt, color: T.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>★</span>
                  <span style={{ fontSize: 14, color: T.ink, lineHeight: 1.5, fontStyle: 'italic' }}>{aftercareCustom}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Rebooking CTA, primary action */}
        <div className="bm-sum-card" style={{
          background: T.forest, color: 'white',
          borderRadius: 14, padding: '24px 22px',
          marginBottom: 16,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '1.1px', marginBottom: 10 }}>
            See you next time?
          </div>
          <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 500, lineHeight: 1.3, marginBottom: 16 }}>
            The best results come from consistency.
          </div>
          {bookingUrl ? (
            <a href={bookingUrl} className="no-print" style={{
              display: 'inline-block',
              background: T.gold, color: T.forest,
              padding: '12px 28px', borderRadius: 10,
              fontSize: 14, fontWeight: 700,
              textDecoration: 'none',
              fontFamily: T.sans,
              letterSpacing: '0.3px',
            }}>Book your next session →</a>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              Reach out to {therapistName}{therapistPhone ? ` at ${therapistPhone}` : ''} to book.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: 16, fontSize: 11, color: T.inkSoft, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 4 }}>{therapistName}{therapistPhone ? ' · ' + therapistPhone : ''}</div>
          <div>Powered by MyBodyMap · mybodymap.app</div>
        </div>
      </div>
    </div>
  );
}
