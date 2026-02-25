// src/components/SessionDetail.js
import React, { useState } from 'react';
import { db } from '../lib/supabase';

const C = {
  sage: '#6B9E80', forest: '#2A5741', beige: '#F0EAD9',
  lightBeige: '#F9FAFB', darkGray: '#1F2937', gray: '#6B7280',
  lightGray: '#E5E7EB', white: '#FFFFFF', red: '#EF4444'
};

const BODY_REGIONS = {
  head: { label: 'Head', x: 85, y: 12, front: true },
  neck: { label: 'Neck', x: 85, y: 22, front: true },
  left_shoulder: { label: 'L Shoulder', x: 65, y: 28, front: true },
  right_shoulder: { label: 'R Shoulder', x: 105, y: 28, front: true },
  chest: { label: 'Chest', x: 85, y: 38, front: true },
  left_arm: { label: 'L Arm', x: 55, y: 45, front: true },
  right_arm: { label: 'R Arm', x: 115, y: 45, front: true },
  abdomen: { label: 'Abdomen', x: 85, y: 52, front: true },
  lower_back: { label: 'Lower Back', x: 85, y: 60, back: true },
  upper_back: { label: 'Upper Back', x: 85, y: 35, back: true },
  left_hip: { label: 'L Hip', x: 70, y: 62, front: true },
  right_hip: { label: 'R Hip', x: 100, y: 62, front: true },
  left_thigh: { label: 'L Thigh', x: 70, y: 72, front: true },
  right_thigh: { label: 'R Thigh', x: 100, y: 72, front: true },
  left_knee: { label: 'L Knee', x: 70, y: 82, front: true },
  right_knee: { label: 'R Knee', x: 100, y: 82, front: true },
  left_foot: { label: 'L Foot', x: 70, y: 95, front: true },
  right_foot: { label: 'R Foot', x: 100, y: 95, front: true },
};

function BodyMapViz({ painAreas = [] }) {
  const markedAreas = painAreas || [];
  
  return (
    <div style={{ display: 'flex', gap: '32px', justifyContent: 'center', flexWrap: 'wrap' }}>
      {['front', 'back'].map(side => (
        <div key={side} style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '13px', fontWeight: '600', color: C.gray, marginBottom: '8px', textTransform: 'uppercase' }}>
            {side === 'front' ? 'Front' : 'Back'}
          </p>
          <div style={{ position: 'relative', width: '170px', height: '320px' }}>
            {/* Body silhouette */}
            <svg width="170" height="320" viewBox="0 0 170 320">
              {/* Head */}
              <ellipse cx="85" cy="30" rx="22" ry="26" fill="#E8DDD0" stroke="#C4B8A8" strokeWidth="1.5"/>
              {/* Neck */}
              <rect x="76" y="54" width="18" height="16" rx="4" fill="#E8DDD0" stroke="#C4B8A8" strokeWidth="1.5"/>
              {/* Body */}
              <path d="M55 70 Q45 75 42 95 L38 160 Q38 168 46 168 L124 168 Q132 168 132 160 L128 95 Q125 75 115 70 Z" fill="#E8DDD0" stroke="#C4B8A8" strokeWidth="1.5"/>
              {/* Left arm */}
              <path d="M55 72 Q40 80 36 120 Q34 135 38 145 Q44 148 48 145 Q52 120 58 90 Z" fill="#E8DDD0" stroke="#C4B8A8" strokeWidth="1.5"/>
              {/* Right arm */}
              <path d="M115 72 Q130 80 134 120 Q136 135 132 145 Q126 148 122 145 Q118 120 112 90 Z" fill="#E8DDD0" stroke="#C4B8A8" strokeWidth="1.5"/>
              {/* Left leg */}
              <path d="M62 168 Q58 200 56 240 Q54 270 58 290 Q64 296 72 294 Q78 290 78 270 L80 168 Z" fill="#E8DDD0" stroke="#C4B8A8" strokeWidth="1.5"/>
              {/* Right leg */}
              <path d="M108 168 Q112 200 114 240 Q116 270 112 290 Q106 296 98 294 Q92 290 92 270 L90 168 Z" fill="#E8DDD0" stroke="#C4B8A8" strokeWidth="1.5"/>
              
              {/* Pain markers */}
              {markedAreas.map((area, i) => {
                const region = BODY_REGIONS[area];
                if (!region) return null;
                if (side === 'front' && !region.front && !region.back) return null;
                if (side === 'back' && !region.back) return null;
                if (side === 'front' && region.back) return null;
                return (
                  <g key={i}>
                    <circle cx={region.x} cy={region.y * 3.1} r="10" fill="rgba(239,68,68,0.3)" stroke="#EF4444" strokeWidth="2"/>
                    <circle cx={region.x} cy={region.y * 3.1} r="4" fill="#EF4444"/>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      ))}
      
      {markedAreas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px', color: C.gray, fontSize: '14px' }}>
          No pain areas marked for this session
        </div>
      )}
      
      {markedAreas.length > 0 && (
        <div style={{ width: '100%', marginTop: '8px' }}>
          <p style={{ fontSize: '13px', color: C.gray, marginBottom: '8px' }}>Marked areas:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {markedAreas.map((area, i) => (
              <span key={i} style={{ background: '#FEE2E2', color: '#991B1B', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
                🔴 {BODY_REGIONS[area]?.label || area}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SessionDetail({ session, client, onBack, onUpdate }) {
  const [notes, setNotes] = useState(session.therapist_notes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [completing, setCompleting] = useState(false);

  const sessionData = session.intake_data || {};

  async function saveNotes() {
    setSaving(true);
    try {
      const updated = await db.updateSession(session.id, { therapist_notes: notes });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (onUpdate) onUpdate(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function markComplete() {
    setCompleting(true);
    try {
      const updated = await db.updateSession(session.id, {
        status: 'completed',
        therapist_notes: notes,
        completed_at: new Date().toISOString()
      });
      if (onUpdate) onUpdate(updated);
      onBack();
    } catch (err) {
      console.error(err);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={onBack} style={{ background: C.white, border: `1px solid ${C.lightGray}`, color: C.gray, padding: '8px 16px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: C.darkGray, margin: 0 }}>
            {client.name} — Session
          </h2>
          <p style={{ fontSize: '14px', color: C.gray, margin: '4px 0 0 0' }}>
            {new Date(session.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <span style={{
          background: session.status === 'completed' ? '#D1FAE5' : '#FEF3C7',
          color: session.status === 'completed' ? '#065F46' : '#92400E',
          padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '600'
        }}>
          {session.status === 'completed' ? '✓ Completed' : '⏳ Pending Review'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Client preferences */}
          <div style={{ background: C.white, borderRadius: '12px', padding: '24px', border: `1px solid ${C.lightGray}` }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>📋 Client Preferences</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Pressure', value: sessionData.pressure },
                { label: 'Focus Area', value: sessionData.focus },
                { label: 'Session Type', value: sessionData.sessionType },
                { label: 'Oil/Fragrance', value: sessionData.oil },
                { label: 'Medical Notes', value: sessionData.medicalNotes || sessionData.medical },
              ].filter(item => item.value).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: C.lightBeige, borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px', color: C.gray, fontWeight: '500' }}>{item.label}</span>
                  <span style={{ fontSize: '13px', color: C.darkGray, fontWeight: '600' }}>{item.value}</span>
                </div>
              ))}
              {sessionData.additionalNotes && (
                <div style={{ padding: '10px', background: C.lightBeige, borderRadius: '8px' }}>
                  <p style={{ fontSize: '13px', color: C.gray, fontWeight: '500', margin: '0 0 4px 0' }}>Additional Notes</p>
                  <p style={{ fontSize: '13px', color: C.darkGray, margin: 0 }}>{sessionData.additionalNotes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Therapist notes */}
          <div style={{ background: C.white, borderRadius: '12px', padding: '24px', border: `1px solid ${C.lightGray}` }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>📝 Your Notes</h3>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add your session notes here..."
              style={{ width: '100%', minHeight: '120px', padding: '12px', border: `1px solid ${C.lightGray}`, borderRadius: '8px', fontSize: '14px', fontFamily: 'system-ui', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button
                onClick={saveNotes}
                disabled={saving}
                style={{ flex: 1, background: C.sage, color: C.white, border: 'none', padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
              >
                {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Notes'}
              </button>
              {session.status !== 'completed' && (
                <button
                  onClick={markComplete}
                  disabled={completing}
                  style={{ flex: 1, background: C.forest, color: C.white, border: 'none', padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  {completing ? 'Completing...' : '✓ Mark Complete'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right column - Body Map */}
        <div style={{ background: C.white, borderRadius: '12px', padding: '24px', border: `1px solid ${C.lightGray}` }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: C.darkGray, marginBottom: '20px' }}>🗺️ Body Map</h3>
          <BodyMapViz painAreas={session.pain_areas || sessionData.painAreas || []} />
        </div>
      </div>
    </div>
  );
}
