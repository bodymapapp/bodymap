// src/pages/PostSessionSummary.js
//
// Dot 3b: Client recap. Mirrors 3a structure (split body, 4 sections)
// per HK so the document system feels consistent. Content is
// client-friendly: warm tone, no clinical jargon, prominent rebook
// CTA in Section 04.

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import DocumentLayout, { T, Pill } from '../components/DocumentLayout';
import {
  parseSoap,
  getAftercareItems,
  deriveCadence,
  aggregateHeatmap,
} from '../lib/sessionIntelligence';

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
      const { data: history } = await supabase.from('sessions').select('id,created_at,completed,pressure,front_focus,front_avoid,back_focus,back_avoid').eq('client_id', session.client_id).order('created_at', { ascending: false }).limit(20);
      setData({ session, client, therapist, history: history || [] });
      setLoading(false);
    }
    load();
  }, [sessionId]);

  const intel = useMemo(() => {
    if (!data) return null;
    const { session, history } = data;
    return {
      cadence: deriveCadence(history, session.id),
      heatmap: aggregateHeatmap(history, session.id, 6),
    };
  }, [data]);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: T.serif, color: T.inkSoft, background: T.cream }}>Loading your summary...</div>;
  if (!data || !data.session) return <div style={{ padding: 40, fontFamily: T.serif, background: T.cream, minHeight: '100vh' }}>Summary not found.</div>;

  const { session, client, therapist } = data;

  // Held until session marked complete
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
  const noteToClient = session.public_notes || soap.noteToClient || '';
  const aftercareItems = getAftercareItems(soap);
  const aftercareCustom = soap.aftercareCustom || '';

  const therapistName = therapist?.business_name || therapist?.full_name || 'Your therapist';
  const therapistFullName = therapist?.full_name || '';
  const therapistPhone = therapist?.phone || null;
  const bookingUrl = therapist?.custom_url ? `${window.location.origin}/${therapist.custom_url}` : null;

  // ── Section 03: Note from your therapist + aftercare
  const section03 = {
    title: 'From your therapist',
    sub: 'Note and aftercare',
    content: (
      <div>
        {noteToClient && (
          <div style={{
            background: T.goldBg, borderRadius: 7,
            padding: '8px 12px', borderLeft: `3px solid ${T.gold}`,
            marginBottom: aftercareItems.length > 0 || aftercareCustom ? 8 : 0,
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#92660E', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 3 }}>
              A note for you
            </div>
            <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.55, fontStyle: 'italic', fontFamily: T.serif }}>
              "{noteToClient}"
            </div>
            <div style={{ fontSize: 10, color: T.inkSoft, marginTop: 5, textAlign: 'right', fontStyle: 'italic' }}>
              {therapistFullName || therapistName}
            </div>
          </div>
        )}
        {(aftercareItems.length > 0 || aftercareCustom) && (
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 5 }}>
              Take care of yourself today
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {aftercareItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{
                    flexShrink: 0, width: 18, height: 18, borderRadius: 9,
                    background: T.sageBg, color: T.sage,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800,
                  }}>✓</span>
                  <span style={{ fontSize: 12, color: T.ink, lineHeight: 1.45, paddingTop: 1 }}>{item.label}</span>
                </div>
              ))}
              {aftercareCustom && (
                <div style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                  marginTop: aftercareItems.length > 0 ? 2 : 0,
                  paddingTop: aftercareItems.length > 0 ? 5 : 0,
                  borderTop: aftercareItems.length > 0 ? `1px solid ${T.lineFaint}` : 'none',
                }}>
                  <span style={{
                    flexShrink: 0, width: 18, height: 18, borderRadius: 9,
                    background: T.goldBg, color: T.gold,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800,
                  }}>★</span>
                  <span style={{ fontSize: 12, color: T.ink, lineHeight: 1.45, fontStyle: 'italic', paddingTop: 1 }}>
                    {aftercareCustom}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        {!noteToClient && aftercareItems.length === 0 && !aftercareCustom && (
          <div style={{ fontSize: 11.5, color: T.inkSoft, fontStyle: 'italic' }}>
            Your therapist did not leave a note this time.
          </div>
        )}
      </div>
    ),
  };

  // ── Section 04: Book next session, full width prominent CTA card
  const section04 = {
    title: 'See you next time',
    sub: 'The best results come from consistency',
    accent: T.forest,
    content: (
      <div style={{
        background: T.forest, color: 'white',
        borderRadius: 10, padding: '14px 18px',
        margin: '-2px 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 500, lineHeight: 1.35, letterSpacing: '-0.2px' }}>
            Book your next session and keep what we built today moving forward.
          </div>
          {intel.cadence.avgDays && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontStyle: 'italic' }}>
              Your usual rhythm: about every {intel.cadence.avgDays} days
            </div>
          )}
        </div>
        {bookingUrl ? (
          <a href={bookingUrl} className="no-print" style={{
            display: 'inline-block', background: T.gold, color: T.forest,
            padding: '10px 22px', borderRadius: 9,
            fontSize: 13, fontWeight: 700,
            textDecoration: 'none', letterSpacing: '0.2px',
            whiteSpace: 'nowrap',
          }}>Book now →</a>
        ) : (
          <div style={{ fontSize: 12.5, opacity: 0.9 }}>
            Reach out to {therapistName}{therapistPhone ? ` at ${therapistPhone}` : ''}
          </div>
        )}
      </div>
    ),
  };

  return (
    <DocumentLayout
      docNumber="3b"
      docName="Your Recap"
      docAccent={T.gold}
      client={client}
      session={session}
      therapist={therapist}
      visitNumber={intel.cadence.visitNumber}
      isFirstVisit={intel.cadence.isFirstVisit}
      isOverdue={intel.cadence.isOverdue}
      cumulativeHeatmap={intel.heatmap}
      bodyDisplay="split"
      section03={section03}
      section04={section04}
    />
  );
}
