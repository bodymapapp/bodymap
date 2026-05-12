// src/pages/PreSessionBrief.js
//
// Dot 2 of 3: Pre-session brief. Split body so the therapist sees
// the cumulative pattern (heatmap with numbers in dots) alongside
// today's specific request.

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

function Sparkline({ values, color = T.sage, width = 100, height = 26 }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 6) - 3;
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
    <div style={{ fontSize: 11.5, color: T.ink, lineHeight: 1.45, paddingLeft: 11, position: 'relative' }}>
      <span style={{ position: 'absolute', left: 0, top: 6, width: 5, height: 5, borderRadius: 3, background: accent }} />
      {children}
    </div>
  );
}

export default function PreSessionBrief({ sessionIdProp, chrome = 'full' }) {
  const params = useParams();
  const sessionId = sessionIdProp || params.sessionId;
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

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: T.serif, color: T.inkSoft, background: T.cream }}>Loading...</div>;
  if (!data) return <div style={{ padding: 40, fontFamily: T.serif, background: T.cream, minHeight: '100vh' }}>Session not found.</div>;

  const { session, client, therapist } = data;

  // ── Section 03: Intelligence
  const section03 = {
    title: 'Intelligence',
    sub: 'Patterns, change, and last plan',
    content: (
      <div>
        {intel.changes.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>What's different today</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {intel.changes.slice(0, 3).map((c, i) => <InsightRow key={i} accent={T.gold}>{c.text}</InsightRow>)}
            </div>
          </div>
        )}
        {intel.patterns.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Patterns we've learned</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {intel.patterns.slice(0, 3).map((p, i) => <InsightRow key={i} accent={p.severity === 'high' ? T.gold : T.sage}>{p.text}</InsightRow>)}
            </div>
          </div>
        )}
        {intel.lastPlan && intel.lastPlan.plan && (
          <div style={{
            background: T.goldBg, borderRadius: 7,
            padding: '7px 10px', borderLeft: `3px solid ${T.gold}`,
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#92660E', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 3 }}>
              Plan from last visit · {intel.lastPlan.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <div style={{ fontSize: 11, color: T.ink, lineHeight: 1.45, fontFamily: T.serif, fontStyle: 'italic' }}>
              "{intel.lastPlan.plan.length > 200 ? intel.lastPlan.plan.slice(0, 197) + '...' : intel.lastPlan.plan}"
            </div>
          </div>
        )}
        {intel.changes.length === 0 && intel.patterns.length === 0 && !intel.lastPlan && (
          <div style={{ fontSize: 11, color: T.inkSoft, fontStyle: 'italic' }}>
            Not enough history yet to surface intelligence.
          </div>
        )}
      </div>
    ),
  };

  // ── Section 04: Visit context (stats + preferences strip + pressure trend)
  const prefs = [
    session.pressure && { label: 'Pressure', val: `${session.pressure}/5` },
    session.goal && { label: 'Goal', val: session.goal },
    session.music && { label: 'Music', val: session.music },
    session.lighting && { label: 'Lighting', val: session.lighting },
    session.conversation && { label: 'Conv', val: session.conversation },
    session.table_temp && { label: 'Table', val: session.table_temp },
  ].filter(Boolean);

  const section04 = {
    title: 'Visit context',
    sub: `${intel.heatmap.count + 1} sessions on file`,
    content: (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5, marginBottom: 8 }}>
          {[
            { label: 'Last seen', value: intel.cadence.daysSinceLast !== null ? `${intel.cadence.daysSinceLast}d` : 'new' },
            { label: 'Cadence', value: intel.cadence.avgDays ? `${intel.cadence.avgDays}d` : 'n/a' },
            { label: 'Visit', value: intel.cadence.isFirstVisit ? '1st' : `#${intel.cadence.visitNumber}` },
            { label: 'Status', value: intel.cadence.isOverdue ? 'Late' : intel.cadence.isFirstVisit ? 'New' : 'Ok' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '6px 8px', background: T.cream, borderRadius: 7, borderLeft: `2px solid ${T.sage}` }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.forest, fontFamily: T.serif, lineHeight: 1.1, marginTop: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>
        {intel.pressureSeries.length >= 2 && (
          <div style={{
            background: T.cream, borderRadius: 7,
            padding: '6px 10px', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Pressure trend</div>
              <div style={{ fontSize: 11.5, color: T.ink, lineHeight: 1.3, fontWeight: 600 }}>
                {intel.pressureSeries[0]}/5 → {intel.pressureSeries[intel.pressureSeries.length - 1]}/5
                <span style={{ color: T.inkSoft, fontWeight: 400, marginLeft: 3, fontSize: 10 }}>({intel.pressureSeries.length} visits)</span>
              </div>
            </div>
            <Sparkline values={intel.pressureSeries} />
          </div>
        )}
        {prefs.length > 0 && (
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Preferences</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {prefs.map((p, i) => (
                <div key={i} style={{ background: T.cream, borderRadius: 5, padding: '4px 8px' }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{p.label}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: T.forest, textTransform: 'capitalize' }}>{p.val}</div>
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
      bodyDisplay="split"
      section03={section03}
      section04={section04}
      section04FullWidth
      chrome={chrome}
    />
  );
}
