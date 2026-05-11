// src/pages/IntakeBrief.js
//
// Dot 1 of 3: today's intake form output. Uses the shared
// DocumentLayout for consistent 4-section structure.
//
// Section 01: On the body (today's marks)
// Section 02: Today's request
// Section 03: Their answers (preferences grid + custom intake)
// Section 04: Conditions and medical flags

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import DocumentLayout, { T, Pill } from '../components/DocumentLayout';
import { deriveCadence, getStandingFlags } from '../lib/sessionIntelligence';

function PrefRow({ label, val }) {
  return (
    <div style={{ background: T.cream, borderRadius: 8, padding: '6px 10px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.forest, textTransform: 'capitalize' }}>{val}</div>
    </div>
  );
}

function AnswerRow({ q, a, last }) {
  return (
    <div style={{ padding: '5px 0', borderBottom: last ? 'none' : `1px solid ${T.lineFaint}` }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 1 }}>{q}</div>
      <div style={{ fontSize: 12, color: T.ink, lineHeight: 1.4 }}>{a}</div>
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
      const { data: history } = await supabase.from('sessions').select('id,created_at,completed').eq('client_id', session.client_id).order('created_at', { ascending: false }).limit(20);
      setData({ session, client, therapist, history: history || [] });
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

  const { session, client, therapist, history } = data;
  const cadence = deriveCadence(history, session.id);
  const standing = getStandingFlags(session);

  // Preferences grid
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

  // ── Section 03: Their answers (preferences + custom answers, side-by-side)
  const section03 = {
    title: 'Their answers',
    sub: `${prefs.length} preferences and ${customKeys.length} questions`,
    content: (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Preferences</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {prefs.map((p, i) => <PrefRow key={i} label={p.label} val={p.val} />)}
          </div>
          {hasBands && (
            <div style={{
              marginTop: 8, paddingTop: 8,
              borderTop: `1px dashed ${T.lineFaint}`,
              display: 'flex', justifyContent: 'space-between',
              fontSize: 11, color: T.ink,
            }}>
              {session.front_pct != null && <span><strong>{session.front_pct}%</strong> <span style={{ color: T.inkSoft }}>front</span></span>}
              {session.top_pct != null && <span><strong>{session.top_pct}%</strong> <span style={{ color: T.inkSoft }}>top</span></span>}
              {session.middle_pct != null && <span><strong>{session.middle_pct}%</strong> <span style={{ color: T.inkSoft }}>mid</span></span>}
              {session.bottom_pct != null && <span><strong>{session.bottom_pct}%</strong> <span style={{ color: T.inkSoft }}>bot</span></span>}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Custom answers</div>
          <div>
            {customKeys.slice(0, 7).map((k, i) => {
              const v = customAnswers[k];
              const display = typeof v === 'string' ? v : (Array.isArray(v) ? v.join(', ') : JSON.stringify(v));
              return <AnswerRow key={i} q={k} a={display} last={i === Math.min(customKeys.length, 7) - 1} />;
            })}
          </div>
        </div>
      </div>
    ),
  };

  // ── Section 04: Conditions + flags (medical info)
  const conditions = Array.isArray(session.medical_conditions) ? session.medical_conditions : [];
  const section04 = {
    title: 'Conditions and flags',
    sub: standing ? `${conditions.length} conditions checked${session.med_note ? ' plus a note' : ''}` : 'None flagged',
    accent: standing ? T.red : T.sage,
    content: (
      <div>
        {session.med_note && (
          <div style={{
            background: T.redBg, border: `1px solid ${T.red}40`,
            borderLeft: `3px solid ${T.red}`,
            borderRadius: 8, padding: '10px 12px',
            marginBottom: conditions.length > 0 ? 10 : 0,
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: T.red, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Medical note</div>
            <div style={{ fontSize: 13, color: T.redInk, fontWeight: 500, lineHeight: 1.5 }}>{session.med_note}</div>
          </div>
        )}
        {conditions.length > 0 && (
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Conditions they checked</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {conditions.map((c, i) => (
                <Pill key={i} color={T.redInk} bg={T.redBg}>{c}</Pill>
              ))}
            </div>
          </div>
        )}
        {!session.med_note && conditions.length === 0 && (
          <div style={{ fontSize: 12, color: T.inkSoft, fontStyle: 'italic' }}>
            No conditions flagged. Nothing to review before the session.
          </div>
        )}
      </div>
    ),
  };

  return (
    <DocumentLayout
      docNumber={1}
      docName="Today's Intake"
      docAccent={T.gold}
      client={client}
      session={session}
      therapist={therapist}
      visitNumber={cadence.visitNumber}
      isFirstVisit={cadence.isFirstVisit}
      isOverdue={cadence.isOverdue}
      section03={section03}
      section04={section04}
    />
  );
}
