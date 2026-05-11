// src/pages/PostSessionSummary.js
//
// Client-facing recap, dot 3b of 3, one page.
//
// The warm public summary sent to the client. Held until the
// therapist marks the session complete, then becomes the document
// the client opens from their email or QR code.
//
// Layout:
//   1. Warm header: "Hi [first name]." with date
//   2. Note from therapist (the 5th SOAP field) as the headline quote
//   3. What we worked on, with body diagram showing worked zones
//   4. Aftercare checklist
//   5. Rebooking CTA card (dark forest, gold button)
//
// One page, friendly tone, minimal clinical language.

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import BodyDiagram from '../components/BodyDiagram';
import { parseSoap, getAftercareItems, zoneLabel } from '../lib/sessionIntelligence';

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
  lineFaint: '#E8E0D0',
  white: '#FFFFFF',
  serif: "'Fraunces', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

export default function PostSessionSummary() {
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
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: T.serif, color: T.inkSoft, background: T.cream }}>Loading your summary...</div>;
  }
  if (!data || !data.session) {
    return <div style={{ padding: 40, fontFamily: T.serif, background: T.cream, minHeight: '100vh' }}>Summary not found.</div>;
  }

  const { session, client, therapist } = data;

  if (!session.completed) {
    return (
      <div style={{ background: T.cream, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: T.sans }}>
        <div style={{ maxWidth: 460, background: T.white, borderRadius: 16, padding: 32, textAlign: 'center', border: `1px solid ${T.lineFaint}`, boxShadow: '0 4px 16px rgba(28,43,34,0.06)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🌿</div>
          <h1 style={{ fontFamily: T.serif, fontSize: 24, color: T.forest, margin: '0 0 12px', fontWeight: 500, letterSpacing: '-0.4px' }}>Your summary is on the way</h1>
          <p style={{ fontSize: 14, color: T.ink, lineHeight: 1.6, margin: 0 }}>
            Your therapist is finishing their notes from today's session. Check back shortly or look for an email from {therapist?.business_name || therapist?.full_name || 'them'}.
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

  const noteToClient = session.public_notes || soap.noteToClient || '';
  const focusAreasFront = session.front_focus || [];
  const focusAreasBack = session.back_focus || [];
  const allFocus = [...focusAreasFront, ...focusAreasBack];
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
        .bm-sum-worked-grid { display: grid; grid-template-columns: auto 1fr; gap: 18px; align-items: start; }
        @media (max-width: 560px) {
          .bm-sum-worked-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{ maxWidth: 620, margin: '0 auto', padding: '36px 20px 48px' }}>

        {/* Warm header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '1.6px', marginBottom: 10 }}>
            Your session summary
          </div>
          <h1 style={{
            fontFamily: T.serif, fontSize: 'clamp(36px, 7vw, 48px)',
            fontWeight: 500, color: T.forest, margin: 0,
            letterSpacing: '-0.7px', lineHeight: 1.05,
          }}>
            Hi {firstName}.
          </h1>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 8 }}>{sessionDate} with {therapistFullName || therapistName}</div>
        </div>

        {/* Therapist note (headline quote) */}
        {noteToClient && (
          <div className="bm-sum-card" style={{
            background: T.white, borderRadius: 16, padding: '26px 26px 22px',
            border: `1px solid ${T.lineFaint}`,
            boxShadow: '0 2px 8px rgba(28,43,34,0.05)',
            borderLeft: `4px solid ${T.gold}`,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
              A note from your therapist
            </div>
            <div style={{
              fontSize: 17, color: T.ink, lineHeight: 1.65,
              fontFamily: T.serif, fontStyle: 'italic',
              letterSpacing: '-0.1px',
            }}>
              "{noteToClient}"
            </div>
            <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 14, textAlign: 'right' }}>
              {therapistFullName || therapistName}
            </div>
          </div>
        )}

        {/* What we worked on */}
        {allFocus.length > 0 && (
          <div className="bm-sum-card" style={{
            background: T.white, borderRadius: 16, padding: '22px 24px',
            border: `1px solid ${T.lineFaint}`,
            boxShadow: '0 2px 8px rgba(28,43,34,0.05)',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>
              What we worked on
            </div>
            <div className="bm-sum-worked-grid">
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Front</div>
                  <BodyDiagram focusAreas={focusAreasFront} mode="worked" size="md" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Back</div>
                  <BodyDiagram focusAreas={focusAreasBack} mode="worked" size="md" />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.6, marginBottom: 14 }}>
                  Together we focused on:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {allFocus.map((a, i) => (
                    <span key={i} style={{
                      background: T.sageBg, color: T.forest,
                      padding: '6px 13px', borderRadius: 20,
                      fontSize: 13, fontWeight: 600,
                    }}>{zoneLabel(a)}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Aftercare */}
        {(aftercareItems.length > 0 || aftercareCustom) && (
          <div className="bm-sum-card" style={{
            background: T.white, borderRadius: 16, padding: '22px 24px',
            border: `1px solid ${T.lineFaint}`,
            boxShadow: '0 2px 8px rgba(28,43,34,0.05)',
            borderLeft: `4px solid ${T.sage}`,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>
              How to take care of yourself today
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {aftercareItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <span style={{
                    flexShrink: 0, width: 26, height: 26, borderRadius: 13,
                    background: T.sageBg, color: T.sage,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 800,
                  }}>✓</span>
                  <span style={{ fontSize: 15, color: T.ink, lineHeight: 1.5, paddingTop: 2 }}>{item.label}</span>
                </div>
              ))}
              {aftercareCustom && (
                <div style={{
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  marginTop: aftercareItems.length > 0 ? 4 : 0,
                  paddingTop: aftercareItems.length > 0 ? 12 : 0,
                  borderTop: aftercareItems.length > 0 ? `1px solid ${T.lineFaint}` : 'none',
                }}>
                  <span style={{
                    flexShrink: 0, width: 26, height: 26, borderRadius: 13,
                    background: T.goldBg, color: T.gold,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 800,
                  }}>★</span>
                  <span style={{ fontSize: 15, color: T.ink, lineHeight: 1.55, fontStyle: 'italic', paddingTop: 2 }}>
                    {aftercareCustom}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rebooking CTA */}
        <div className="bm-sum-card" style={{
          background: T.forest, color: 'white',
          borderRadius: 16, padding: '28px 24px',
          marginBottom: 16,
          textAlign: 'center',
          boxShadow: '0 4px 14px rgba(28,43,34,0.18)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: 12 }}>
            See you next time?
          </div>
          <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 500, lineHeight: 1.35, marginBottom: 18, letterSpacing: '-0.2px' }}>
            The best results come from consistency.
          </div>
          {bookingUrl ? (
            <a href={bookingUrl} className="no-print" style={{
              display: 'inline-block',
              background: T.gold, color: T.forest,
              padding: '14px 32px', borderRadius: 10,
              fontSize: 14.5, fontWeight: 700,
              textDecoration: 'none',
              letterSpacing: '0.3px',
            }}>Book your next session →</a>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              Reach out to {therapistName}{therapistPhone ? ` at ${therapistPhone}` : ''} to book.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: 18, fontSize: 11, color: T.inkSoft, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 4 }}>{therapistName}{therapistPhone ? ' · ' + therapistPhone : ''}</div>
          <div>Powered by MyBodyMap · mybodymap.app</div>
        </div>
      </div>
    </div>
  );
}
