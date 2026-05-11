// src/pages/PreSessionBrief.js
//
// Dot 2 of 3: pre-session brief. Uses shared DocumentLayout.
//
// Section 01: On the body (cumulative heatmap, 5-visit aggregate)
// Section 02: Today's request (today's marks + pills)
// Section 03: Intelligence layer (patterns + what changed + last plan
//             + pressure trend sparkline)
// Section 04: Visit context (cadence stats + preferences strip)
//
// The heatmap on Section 01 shows numbers IN the dots so the
// reader instantly sees "R shoulder, 5 of 5 visits" rather than
// counting badges.

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import DocumentLayout, { T } from '../components/DocumentLayout';
import {
  deriveCadence,
  deriveChanges,
  derivePatterns,
  getLastPlan,
  aggregateHeatmap,
  getLastCompletedSession,
  getPriorSessions,
} from '../lib/sessionIntelligence';

// Small sparkline for pressure trend
function Sparkline({ values, color = T.sage, width = 110, height = 30 }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return [x, y];
  });
  const pathD = points.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill={i === points.length - 1 ? color : T.white} stroke={color} strokeWidth="1.5" />
      ))}
    </svg>
  );
}

function InsightRow({ children, accent = T.sage }) {
  return (
    <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5, paddingLeft: 12, position: 'relative' }}>
      <span style={{ position: 'absolute', left: 0, top: 7, width: 5, height: 5, borderRadius: 3, background: accent }} />
      {children}
    </div>
  );
}

export default function PreSessionBrief() {
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
    const prior = getPriorSessions(history, session.id);
    const pressureSeries = prior.slice(0, 6).reverse().map(s => s.pressure).filter(p => p != null);
    if (session.pressure) pressureSeries.push(session.pressure);
    return {
      cadence: deriveCadence(history, session.id),
      changes: deriveChanges(session, lastSession),
      patterns: derivePatterns(history, session.id),
      lastPlan: getLastPlan(history, session.id),
      heatmap: aggregateHeatmap(history, session.id, 6),
      pressureSeries,
    };
  }, [data]);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: T.serif, color: T.inkSoft, background: T.cream }}>Loading brief...</div>;
  }
  if (!data) {
    return <div style={{ padding: 40, fontFamily: T.serif, background: T.cream, minHeight: '100vh' }}>Session not found.</div>;
  }

  const { session, client, therapist } = data;

  // ── Section 03: Intelligence layer
  const section03 = {
    title: 'Intelligence',
    sub: 'What we know after every past visit',
    content: (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Left column: changes + last plan */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {intel.changes.length > 0 && (
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 5 }}>What's different today</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {intel.changes.slice(0, 4).map((c, i) => <InsightRow key={i} accent={T.gold}>{c.text}</InsightRow>)}
              </div>
            </div>
          )}

          {intel.lastPlan && intel.lastPlan.plan && (
            <div style={{
              background: T.goldBg, borderRadius: 8,
              padding: '8px 12px', borderLeft: `3px solid ${T.gold}`,
            }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#92660E', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>
                Plan from last visit · {intel.lastPlan.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div style={{ fontSize: 11.5, color: T.ink, lineHeight: 1.5, fontFamily: T.serif, fontStyle: 'italic' }}>
                "{intel.lastPlan.plan.length > 240 ? intel.lastPlan.plan.slice(0, 237) + '...' : intel.lastPlan.plan}"
              </div>
            </div>
          )}
        </div>

        {/* Right column: patterns + pressure trend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {intel.patterns.length > 0 && (
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 5 }}>Patterns we've learned</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {intel.patterns.slice(0, 4).map((p, i) => (
                  <InsightRow key={i} accent={p.severity === 'high' ? T.gold : T.sage}>{p.text}</InsightRow>
                ))}
              </div>
            </div>
          )}

          {intel.pressureSeries.length >= 2 && (
            <div style={{
              background: T.cream, borderRadius: 8,
              padding: '8px 12px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 2 }}>Pressure trend</div>
                <div style={{ fontSize: 12, color: T.ink, lineHeight: 1.3, fontWeight: 600 }}>
                  {intel.pressureSeries[0]}/5 → {intel.pressureSeries[intel.pressureSeries.length - 1]}/5
                  <span style={{ color: T.inkSoft, fontWeight: 400, marginLeft: 4, fontSize: 10.5 }}>across {intel.pressureSeries.length} visits</span>
                </div>
              </div>
              <Sparkline values={intel.pressureSeries} />
            </div>
          )}
        </div>
      </div>
    ),
  };

  // ── Section 04: Visit context + preferences strip
  const prefs = [
    session.pressure && { label: 'Pressure', val: `${session.pressure}/5` },
    session.goal && { label: 'Goal', val: session.goal },
    session.music && { label: 'Music', val: session.music },
    session.lighting && { label: 'Lighting', val: session.lighting },
    session.conversation && { label: 'Conversation', val: session.conversation },
    session.table_temp && { label: 'Table temp', val: session.table_temp },
    session.room_temp && { label: 'Room temp', val: session.room_temp },
    session.draping && { label: 'Draping', val: session.draping },
  ].filter(Boolean);

  const section04 = {
    title: 'Visit context',
    sub: `${intel.heatmap.count + 1} sessions on file`,
    content: (
      <div>
        {/* Stats row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {[
            { label: 'Last seen', value: intel.cadence.daysSinceLast !== null ? `${intel.cadence.daysSinceLast}d` : 'first' },
            { label: 'Avg cadence', value: intel.cadence.avgDays ? `${intel.cadence.avgDays}d` : 'n/a' },
            { label: 'Visit number', value: intel.cadence.isFirstVisit ? '1st' : `#${intel.cadence.visitNumber}` },
            { label: 'Status', value: intel.cadence.isOverdue ? 'Overdue' : intel.cadence.isFirstVisit ? 'New' : 'On track' },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, padding: '8px 10px',
              background: T.cream, borderRadius: 8,
              borderLeft: `2px solid ${T.sage}`,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.forest, fontFamily: T.serif, lineHeight: 1.1, marginTop: 1, letterSpacing: '-0.2px' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Preferences */}
        {prefs.length > 0 && (
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Today's preferences</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {prefs.map((p, i) => (
                <div key={i} style={{ background: T.cream, borderRadius: 6, padding: '5px 9px' }}>
                  <div style={{ fontSize: 8.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{p.label}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: T.forest, textTransform: 'capitalize' }}>{p.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    ),
  };

  return (
    <DocumentLayout
      docNumber={2}
      docName="Pre-Session Brief"
      docAccent={T.sage}
      client={client}
      session={session}
      therapist={therapist}
      visitNumber={intel.cadence.visitNumber}
      isFirstVisit={intel.cadence.isFirstVisit}
      isOverdue={intel.cadence.isOverdue}
      cumulativeHeatmap={intel.heatmap}
      showHeatmap={intel.heatmap.count > 0}
      section03={section03}
      section04={section04}
    />
  );
}
