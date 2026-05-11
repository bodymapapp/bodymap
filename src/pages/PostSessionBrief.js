// src/pages/PostSessionBrief.js
//
// Dot 3 of 3 (therapist record). Uses shared DocumentLayout.
//
// Section 01: On the body (today's marks, what got worked)
// Section 02: Today's request
// Section 03: SOAP (S/O/A as compact grid, P highlighted, note to client)
// Section 04: Aftercare sent + Pattern update

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import DocumentLayout, { T } from '../components/DocumentLayout';
import {
  parseSoap,
  hasSoapContent,
  deriveCadence,
  deriveChanges,
  derivePatterns,
  getLastCompletedSession,
  AFTERCARE_PRESETS,
} from '../lib/sessionIntelligence';

const AFTERCARE_MAP = Object.fromEntries(AFTERCARE_PRESETS.map(p => [p.id, p.label]));

function SoapCell({ letter, label, body, accent = T.lineFaint, highlight = false }) {
  return (
    <div style={{
      background: highlight ? T.sageBg : T.cream,
      borderRadius: 8, padding: '8px 10px',
      borderLeft: `3px solid ${highlight ? T.sage : accent}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.forest, fontFamily: T.serif, letterSpacing: '-0.2px' }}>{letter}</span>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: highlight ? T.sage : T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 12, color: T.ink, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{body}</div>
    </div>
  );
}

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
    };
  }, [data]);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: T.serif, color: T.inkSoft, background: T.cream }}>Loading record...</div>;
  }
  if (!data) {
    return <div style={{ padding: 40, fontFamily: T.serif, background: T.cream, minHeight: '100vh' }}>Session not found.</div>;
  }

  const { session, client, therapist } = data;
  const summaryUrl = `${window.location.origin}/recap/${session.id}`;
  const soapHasContent = hasSoapContent(intel.soap);
  const aftercare = Array.isArray(intel.soap.aftercare) ? intel.soap.aftercare : [];
  const aftercareCustom = intel.soap.aftercareCustom || '';

  // ── Section 03: SOAP
  const section03 = {
    title: 'SOAP notes',
    sub: soapHasContent ? 'Clinical record · drives the next visit' : 'Not yet filled in',
    accent: T.forest,
    content: soapHasContent ? (
      <div>
        {/* S/O/A in 3-col grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          {intel.soap.S && <SoapCell letter="S" label="Subjective" body={intel.soap.S} />}
          {intel.soap.O && <SoapCell letter="O" label="Objective" body={intel.soap.O} />}
          {intel.soap.A && <SoapCell letter="A" label="Assessment" body={intel.soap.A} />}
        </div>

        {/* P highlighted, full width */}
        {intel.soap.P && <SoapCell letter="P" label="Plan · drives next visit" body={intel.soap.P} highlight />}

        {/* Note to client echo */}
        {intel.soap.noteToClient && (
          <div style={{
            marginTop: 10, paddingTop: 8,
            borderTop: `1px solid ${T.lineFaint}`,
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>
              Note you sent the client
            </div>
            <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5, fontStyle: 'italic', fontFamily: T.serif }}>
              "{intel.soap.noteToClient}"
            </div>
          </div>
        )}
      </div>
    ) : (
      <div style={{
        background: '#FFFBEB', border: '1px solid #FDE68A',
        borderRadius: 8, padding: '10px 12px',
        fontSize: 12.5, color: '#92400E', lineHeight: 1.5,
      }}>
        Open this session in the dashboard, complete your S/O/A/P, and mark it complete. The client recap is held until you do.
      </div>
    ),
  };

  // ── Section 04: Aftercare sent + Pattern update (side-by-side)
  const section04 = {
    title: 'Aftercare and patterns',
    sub: `${aftercare.length} aftercare items${intel.patterns.length > 0 ? ` · ${intel.patterns.length} pattern${intel.patterns.length === 1 ? '' : 's'} confirmed` : ''}`,
    content: (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Aftercare echo */}
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>
            Aftercare you sent
          </div>
          {(aftercare.length > 0 || aftercareCustom) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {aftercare.map((id, i) => (
                <div key={i} style={{ fontSize: 12, color: T.ink, lineHeight: 1.45, paddingLeft: 16, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, top: 3, color: T.sage, fontWeight: 800, fontSize: 12 }}>✓</span>
                  {AFTERCARE_MAP[id] || id}
                </div>
              ))}
              {aftercareCustom && (
                <div style={{
                  fontSize: 12, color: T.ink, lineHeight: 1.45,
                  paddingLeft: 16, position: 'relative', fontStyle: 'italic',
                  marginTop: aftercare.length > 0 ? 4 : 0,
                  paddingTop: aftercare.length > 0 ? 6 : 0,
                  borderTop: aftercare.length > 0 ? `1px solid ${T.lineFaint}` : 'none',
                }}>
                  <span style={{ position: 'absolute', left: 0, top: aftercare.length > 0 ? 9 : 3, color: T.gold, fontWeight: 800, fontSize: 12 }}>★</span>
                  {aftercareCustom}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: T.inkSoft, fontStyle: 'italic' }}>Nothing sent yet. Add on the SOAP tab.</div>
          )}
        </div>

        {/* Pattern update + changes */}
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>
            What today added to the record
          </div>
          {intel.changes.length > 0 && (
            <div style={{ marginBottom: intel.patterns.length > 0 ? 8 : 0 }}>
              {intel.changes.slice(0, 2).map((c, i) => (
                <div key={i} style={{ fontSize: 12, color: T.ink, lineHeight: 1.45, paddingLeft: 12, position: 'relative', marginBottom: 3 }}>
                  <span style={{ position: 'absolute', left: 0, top: 6, width: 4, height: 4, borderRadius: 2, background: T.gold }} />
                  {c.text}
                </div>
              ))}
            </div>
          )}
          {intel.patterns.length > 0 && (
            <div>
              {intel.patterns.slice(0, 3).map((p, i) => (
                <div key={i} style={{ fontSize: 12, color: T.ink, lineHeight: 1.45, paddingLeft: 12, position: 'relative', marginBottom: 3 }}>
                  <span style={{
                    position: 'absolute', left: 0, top: 6, width: 4, height: 4, borderRadius: 2,
                    background: p.severity === 'high' ? T.gold : T.sage,
                  }} />
                  {p.text}
                </div>
              ))}
            </div>
          )}
          {intel.changes.length === 0 && intel.patterns.length === 0 && (
            <div style={{ fontSize: 12, color: T.inkSoft, fontStyle: 'italic' }}>
              Not enough history to surface patterns yet.
            </div>
          )}
        </div>
      </div>
    ),
  };

  return (
    <DocumentLayout
      docNumber="3a"
      docName="Post-Session Record"
      docAccent={T.forest}
      client={client}
      session={session}
      therapist={therapist}
      visitNumber={intel.cadence.visitNumber}
      isFirstVisit={intel.cadence.isFirstVisit}
      isOverdue={intel.cadence.isOverdue}
      section03={section03}
      section04={section04}
      toolbarExtras={
        <button
          onClick={() => window.open(summaryUrl, '_blank')}
          style={{
            background: 'transparent', color: 'white',
            border: '1px solid rgba(255,255,255,0.4)',
            padding: '6px 13px', borderRadius: 8,
            fontWeight: 600, fontSize: 12, cursor: 'pointer',
          }}>View client recap →</button>
      }
    />
  );
}
