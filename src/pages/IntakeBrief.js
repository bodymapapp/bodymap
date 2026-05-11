// src/pages/IntakeBrief.js
//
// Dot 1 of 3: Today's intake form output.
//
// Layout: bodyDisplay='today' (no pattern view, this is BEFORE
// the therapist works the client), sections 03 and 04 side-by-side.

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import DocumentLayout, { T, Pill } from '../components/DocumentLayout';
import { deriveCadence, getStandingFlags } from '../lib/sessionIntelligence';

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

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: T.serif, color: T.inkSoft, background: T.cream }}>Loading...</div>;
  if (!data) return <div style={{ padding: 40, fontFamily: T.serif, background: T.cream, minHeight: '100vh' }}>Session not found.</div>;

  const { session, client, therapist, history } = data;
  const cadence = deriveCadence(history, session.id);
  const standing = getStandingFlags(session);

  // Preferences for compact 2-col grid
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

  const customAnswers = session.custom_intake_answers || {};
  const customKeys = Object.keys(customAnswers).filter(k => {
    const v = customAnswers[k];
    return v !== null && v !== undefined && v !== '' && !(typeof v === 'string' && /^(no|none|n\/a)$/i.test(v.trim()));
  });

  const hasBands = session.front_pct != null || session.top_pct != null || session.middle_pct != null || session.bottom_pct != null;
  const bands = hasBands ? [
    { label: 'Front', pct: session.front_pct },
    { label: 'Top', pct: session.top_pct },
    { label: 'Mid', pct: session.middle_pct },
    { label: 'Bot', pct: session.bottom_pct },
  ].filter(b => b.pct != null) : [];

  // ── Section 03: Their answers (compact)
  const section03 = {
    title: 'Their answers',
    sub: `${prefs.length} preferences · ${customKeys.length} questions`,
    content: (
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 5 }}>Preferences</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
          {prefs.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '3px 8px', background: T.cream, borderRadius: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.5px', minWidth: 60 }}>{p.label}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: T.forest, textTransform: 'capitalize' }}>{p.val}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 5 }}>Custom answers</div>
        <div>
          {customKeys.slice(0, 6).map((k, i) => {
            const v = customAnswers[k];
            const display = typeof v === 'string' ? v : (Array.isArray(v) ? v.join(', ') : JSON.stringify(v));
            return (
              <div key={i} style={{ padding: '3px 0', borderBottom: i < Math.min(customKeys.length, 6) - 1 ? `1px solid ${T.lineFaint}` : 'none' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k}</div>
                <div style={{ fontSize: 11, color: T.ink, lineHeight: 1.35 }}>{display}</div>
              </div>
            );
          })}
        </div>
      </div>
    ),
  };

  // ── Section 04: Conditions, flags, distribution
  const conditions = Array.isArray(session.medical_conditions) ? session.medical_conditions : [];
  const section04 = {
    title: 'Conditions and flags',
    sub: standing ? `${conditions.length} checked${session.med_note ? ' · note below' : ''}` : 'Nothing flagged',
    accent: standing ? T.red : T.sage,
    content: (
      <div>
        {session.med_note && (
          <div style={{
            background: T.redBg, border: `1px solid ${T.red}40`,
            borderLeft: `3px solid ${T.red}`,
            borderRadius: 6, padding: '7px 10px',
            marginBottom: conditions.length > 0 || bands.length > 0 ? 8 : 0,
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.red, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 3 }}>Medical note</div>
            <div style={{ fontSize: 11.5, color: T.redInk, fontWeight: 500, lineHeight: 1.45 }}>{session.med_note}</div>
          </div>
        )}
        {conditions.length > 0 && (
          <div style={{ marginBottom: bands.length > 0 ? 8 : 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Conditions checked</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {conditions.map((c, i) => <Pill key={i} color={T.redInk} bg={T.redBg}>{c}</Pill>)}
            </div>
          </div>
        )}
        {bands.length > 0 && (
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 5 }}>Focus distribution</div>
            <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', border: `1px solid ${T.lineFaint}` }}>
              {bands.map((b, i) => (
                <div key={i} style={{
                  flex: b.pct,
                  background: i % 2 === 0 ? T.sage : T.gold,
                  position: 'relative',
                }} title={`${b.label}: ${b.pct}%`} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9.5, color: T.inkSoft }}>
              {bands.map((b, i) => (
                <span key={i}><strong style={{ color: T.forest }}>{b.pct}%</strong> {b.label}</span>
              ))}
            </div>
          </div>
        )}
        {!session.med_note && conditions.length === 0 && bands.length === 0 && (
          <div style={{ fontSize: 11.5, color: T.inkSoft, fontStyle: 'italic' }}>Nothing to review before the session.</div>
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
      bodyDisplay="today"
      section03={section03}
      section04={section04}
    />
  );
}
