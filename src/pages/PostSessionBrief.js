// src/pages/PostSessionBrief.js
//
// Dot 3a: Post-session therapist record. Split body (pattern + today)
// in Section 01 per HK request, so the therapist sees today in
// context of all visits. SOAP gets the prominent Section 03 slot
// next to Today's request.

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { isSampleSessionId, getSampleSession, getSampleClient, getSampleSessions } from '../data/sampleClients';
import DocumentLayout, { T } from '../components/DocumentLayout';
import {
  parseSoap,
  hasSoapContent,
  deriveCadence,
  deriveChanges,
  derivePatterns,
  aggregateHeatmap,
  getLastCompletedSession,
  AFTERCARE_PRESETS,
} from '../lib/sessionIntelligence';

const AFTERCARE_MAP = Object.fromEntries(AFTERCARE_PRESETS.map(p => [p.id, p.label]));

function SoapCell({ letter, label, body, highlight = false }) {
  return (
    <div style={{
      background: highlight ? T.sageBg : T.cream,
      borderRadius: 6, padding: '6px 9px',
      borderLeft: `3px solid ${highlight ? T.sage : T.lineFaint}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 2 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.forest, fontFamily: T.serif, letterSpacing: '-0.2px' }}>{letter}</span>
        <span style={{ fontSize: 8.5, fontWeight: 700, color: highlight ? T.sage : T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 11, color: T.ink, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{body}</div>
    </div>
  );
}

export default function PostSessionBrief({ sessionIdProp, chrome = 'full' }) {
  const params = useParams();
  const sessionId = sessionIdProp || params.sessionId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (isSampleSessionId(sessionId)) {
        const session = getSampleSession(sessionId);
        if (!session) { setLoading(false); return; }
        const client = getSampleClient(session.client_id);
        const therapist = {
          full_name: 'Your name here',
          business_name: 'Your practice',
          custom_url: '',
          phone: '',
        };
        const history = getSampleSessions(session.client_id);
        setData({ session, client, therapist, history });
        setLoading(false);
        return;
      }
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
      heatmap: aggregateHeatmap(history, session.id, 6),
    };
  }, [data]);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: T.serif, color: T.inkSoft, background: T.cream }}>Loading...</div>;
  if (!data) return <div style={{ padding: 40, fontFamily: T.serif, background: T.cream, minHeight: '100vh' }}>Session not found.</div>;

  const { session, client, therapist } = data;
  const summaryUrl = `${window.location.origin}/recap/${session.id}`;
  const soapHasContent = hasSoapContent(intel.soap);
  const aftercare = Array.isArray(intel.soap.aftercare) ? intel.soap.aftercare : [];
  const aftercareCustom = intel.soap.aftercareCustom || '';

  // ── Section 03: SOAP (sits next to Section 02 in split mode)
  const section03 = {
    title: 'SOAP notes',
    sub: soapHasContent ? 'Clinical record' : 'Not yet filled in',
    accent: T.forest,
    content: soapHasContent ? (
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 6 }}>
          {intel.soap.S && <SoapCell letter="S" label="Subjective" body={intel.soap.S} />}
          {intel.soap.O && <SoapCell letter="O" label="Objective" body={intel.soap.O} />}
          {intel.soap.A && <SoapCell letter="A" label="Assessment" body={intel.soap.A} />}
          {intel.soap.P && <SoapCell letter="P" label="Plan · drives next visit" body={intel.soap.P} highlight />}
        </div>
        {intel.soap.noteToClient && (
          <div style={{ paddingTop: 6, borderTop: `1px solid ${T.lineFaint}` }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>Note sent to client</div>
            <div style={{ fontSize: 11, color: T.ink, lineHeight: 1.4, fontStyle: 'italic', fontFamily: T.serif }}>
              "{intel.soap.noteToClient}"
            </div>
          </div>
        )}
      </div>
    ) : (
      <div style={{
        background: '#FFFBEB', border: '1px solid #FDE68A',
        borderRadius: 6, padding: '8px 10px',
        fontSize: 11.5, color: '#92400E', lineHeight: 1.5,
      }}>
        Open this session in the dashboard, complete your S/O/A/P, and mark complete. The client recap is held until you do.
      </div>
    ),
  };

  // ── Section 04: Aftercare + Pattern update side by side (since 04 is full width in split)
  const section04 = {
    title: 'Aftercare and patterns',
    sub: `${aftercare.length} aftercare${intel.patterns.length > 0 ? ` · ${intel.patterns.length} pattern${intel.patterns.length === 1 ? '' : 's'}` : ''}`,
    content: (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Aftercare */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 5 }}>Aftercare sent</div>
          {(aftercare.length > 0 || aftercareCustom) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {aftercare.map((id, i) => (
                <div key={i} style={{ fontSize: 11, color: T.ink, lineHeight: 1.4, paddingLeft: 14, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, top: 2, color: T.sage, fontWeight: 800, fontSize: 11 }}>✓</span>
                  {AFTERCARE_MAP[id] || id}
                </div>
              ))}
              {aftercareCustom && (
                <div style={{
                  fontSize: 11, color: T.ink, lineHeight: 1.4,
                  paddingLeft: 14, position: 'relative', fontStyle: 'italic',
                  marginTop: aftercare.length > 0 ? 2 : 0,
                  paddingTop: aftercare.length > 0 ? 4 : 0,
                  borderTop: aftercare.length > 0 ? `1px solid ${T.lineFaint}` : 'none',
                }}>
                  <span style={{ position: 'absolute', left: 0, top: aftercare.length > 0 ? 7 : 2, color: T.gold, fontWeight: 800, fontSize: 11 }}>★</span>
                  {aftercareCustom}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: T.inkSoft, fontStyle: 'italic' }}>Nothing sent yet. Add on the SOAP tab.</div>
          )}
        </div>

        {/* Patterns + changes */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 5 }}>What today added</div>
          {intel.changes.length > 0 && (
            <div style={{ marginBottom: intel.patterns.length > 0 ? 6 : 0 }}>
              {intel.changes.slice(0, 2).map((c, i) => (
                <div key={i} style={{ fontSize: 11, color: T.ink, lineHeight: 1.4, paddingLeft: 10, position: 'relative', marginBottom: 2 }}>
                  <span style={{ position: 'absolute', left: 0, top: 5, width: 4, height: 4, borderRadius: 2, background: T.gold }} />
                  {c.text}
                </div>
              ))}
            </div>
          )}
          {intel.patterns.length > 0 && (
            <div>
              {intel.patterns.slice(0, 3).map((p, i) => (
                <div key={i} style={{ fontSize: 11, color: T.ink, lineHeight: 1.4, paddingLeft: 10, position: 'relative', marginBottom: 2 }}>
                  <span style={{
                    position: 'absolute', left: 0, top: 5, width: 4, height: 4, borderRadius: 2,
                    background: p.severity === 'high' ? T.gold : T.sage,
                  }} />
                  {p.text}
                </div>
              ))}
            </div>
          )}
          {intel.changes.length === 0 && intel.patterns.length === 0 && (
            <div style={{ fontSize: 11, color: T.inkSoft, fontStyle: 'italic' }}>Not enough history yet.</div>
          )}
        </div>
      </div>
    ),
  };

  return (
    <DocumentLayout
      docNumber={3}
      docName="Post-Session Record"
      docAccent={T.forest}
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
      chrome={chrome}
      toolbarExtras={
        <button onClick={() => window.open(summaryUrl, '_blank')} style={{
          background: 'transparent', color: 'white',
          border: '1px solid rgba(255,255,255,0.4)',
          padding: '5px 11px', borderRadius: 7,
          fontWeight: 600, fontSize: 11.5, cursor: 'pointer',
        }}>View recap →</button>
      }
    />
  );
}
