// src/pages/PostSessionSummary.js
//
// Dot 3 of 3 (client recap). Same 4-section structure as the other
// documents so the system feels consistent, but content is
// client-friendly: warmer tone, no clinical jargon.
//
// Section 01: What we worked on (body diagrams, "worked" mode)
// Section 02: How you came in (today's request, soft framing)
// Section 03: A note from your therapist (italic headline quote)
// Section 04: How to take care of yourself + book next visit

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import BodyDiagram from '../components/BodyDiagram';
import { T, Pill, SectionMarker, Card } from '../components/DocumentLayout';
import { parseSoap, getAftercareItems, zoneLabel } from '../lib/sessionIntelligence';

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
        @media print {
          body { margin: 0; background: white; }
          @page { size: A4; margin: 12mm; }
          .no-print { display: none !important; }
          .bm-doc-card { box-shadow: none !important; }
        }
        * { box-sizing: border-box; }
        .bm-recap-top { display: grid; grid-template-columns: 320px 1fr; gap: 14px; }
        @media (max-width: 760px) {
          .bm-recap-top { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 18px 30px' }}>

        {/* Identity band */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: 5 }}>
            Document 3 of 3 · Your Recap
          </div>
          <h1 style={{
            fontFamily: T.serif, fontSize: 'clamp(28px, 3.8vw, 38px)',
            fontWeight: 500, color: T.forest, margin: 0,
            letterSpacing: '-0.6px', lineHeight: 1.05,
          }}>
            Hi {firstName}.
          </h1>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 6 }}>
            {sessionDate} with {therapistFullName || therapistName}
          </div>
        </div>

        {/* Section 01 + 02 top row */}
        <div className="bm-recap-top" style={{ marginBottom: 12 }}>

          {/* Section 01: What we worked on */}
          <Card accent={T.sage} className="bm-doc-card">
            <SectionMarker n="01" title="What we worked on" sub="Today" accent={T.gold} />
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: 4 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Front</div>
                <BodyDiagram focusAreas={focusAreasFront} mode="worked" size="md" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Back</div>
                <BodyDiagram focusAreas={focusAreasBack} mode="worked" size="md" />
              </div>
            </div>
            {allFocus.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.lineFaint}` }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 5 }}>
                  Areas worked
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {allFocus.map((a, i) => (
                    <Pill key={i} color={T.forest} bg={T.sageBg}>{zoneLabel(a)}</Pill>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Section 02: A note from your therapist */}
          <Card accent={T.gold} className="bm-doc-card">
            <SectionMarker n="02" title="A note from your therapist" sub={therapistFullName || therapistName} accent={T.gold} />
            {noteToClient ? (
              <div style={{
                fontSize: 15, color: T.ink, lineHeight: 1.65,
                fontFamily: T.serif, fontStyle: 'italic',
              }}>
                "{noteToClient}"
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: T.inkSoft, fontStyle: 'italic' }}>
                {therapistFullName || therapistName} did not leave a note this time.
              </div>
            )}
          </Card>
        </div>

        {/* Section 03: How to take care of yourself */}
        {(aftercareItems.length > 0 || aftercareCustom) && (
          <Card accent={T.sage} className="bm-doc-card" style={{ marginBottom: 12, padding: '14px 18px' }}>
            <SectionMarker n="03" title="How to take care of yourself today" sub={`${aftercareItems.length}${aftercareCustom ? ' + 1 custom' : ''} items`} accent={T.gold} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {aftercareItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: 11,
                    background: T.sageBg, color: T.sage,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800,
                  }}>✓</span>
                  <span style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5, paddingTop: 1 }}>{item.label}</span>
                </div>
              ))}
              {aftercareCustom && (
                <div style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  marginTop: aftercareItems.length > 0 ? 2 : 0,
                  paddingTop: aftercareItems.length > 0 ? 8 : 0,
                  borderTop: aftercareItems.length > 0 ? `1px solid ${T.lineFaint}` : 'none',
                }}>
                  <span style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: 11,
                    background: T.goldBg, color: T.gold,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 800,
                  }}>★</span>
                  <span style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.55, fontStyle: 'italic', paddingTop: 1 }}>
                    {aftercareCustom}
                  </span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Section 04: See you next time */}
        <Card accent={T.forest} className="bm-doc-card" style={{
          marginBottom: 12,
          padding: '16px 22px',
          background: T.forest,
          color: 'white',
          borderColor: T.forest,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
            <span style={{
              fontFamily: T.serif, fontSize: 22, fontWeight: 600,
              color: T.gold, lineHeight: 1, letterSpacing: '-0.5px',
            }}>04</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '1px', lineHeight: 1.1 }}>
                See you next time?
              </div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)', marginTop: 1, fontStyle: 'italic' }}>The best results come from consistency</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 500, lineHeight: 1.4, letterSpacing: '-0.2px', flex: 1, minWidth: 220 }}>
              Book your next session and keep what we built today moving forward.
            </div>
            {bookingUrl ? (
              <a href={bookingUrl} className="no-print" style={{
                display: 'inline-block', background: T.gold, color: T.forest,
                padding: '11px 22px', borderRadius: 10,
                fontSize: 13.5, fontWeight: 700,
                textDecoration: 'none', letterSpacing: '0.2px',
              }}>Book now →</a>
            ) : (
              <div style={{ fontSize: 12.5, opacity: 0.9 }}>
                Reach out to {therapistName}{therapistPhone ? ` at ${therapistPhone}` : ''}
              </div>
            )}
          </div>
        </Card>

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: 12, fontSize: 11, color: T.inkSoft, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 3 }}>{therapistName}{therapistPhone ? ' · ' + therapistPhone : ''}</div>
          <div>Powered by MyBodyMap · mybodymap.app</div>
        </div>
      </div>
    </div>
  );
}
