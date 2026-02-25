// src/components/SessionDetail.js
import React, { useState } from 'react';
import { db } from '../lib/supabase';

const C = {
  sage: '#6B9E80', forest: '#2A5741', beige: '#F0EAD9',
  lightBeige: '#F9FAFB', darkGray: '#1F2937', gray: '#6B7280',
  lightGray: '#E5E7EB', white: '#FFFFFF'
};

const AREA_LABELS = {
  'f-head': 'Head', 'f-neck': 'Neck', 'f-l-shoulder': 'L Shoulder', 'f-r-shoulder': 'R Shoulder',
  'f-chest': 'Chest', 'f-abdomen': 'Abdomen', 'f-l-arm': 'L Arm', 'f-r-arm': 'R Arm',
  'f-l-thigh': 'L Thigh', 'f-r-thigh': 'R Thigh', 'f-l-knee': 'L Knee', 'f-r-knee': 'R Knee',
  'f-l-foot': 'L Foot', 'f-r-foot': 'R Foot', 'f-hip': 'Hips',
  'b-head': 'Back of Head', 'b-neck': 'Back of Neck', 'b-upper-bk': 'Upper Back',
  'b-mid-bk': 'Mid Back', 'b-lower-bk': 'Lower Back', 'b-l-shoulder': 'L Shoulder Blade',
  'b-r-shoulder': 'R Shoulder Blade', 'b-glutes': 'Glutes', 'b-l-hamstr': 'L Hamstring',
  'b-r-hamstr': 'R Hamstring', 'b-l-calf': 'L Calf', 'b-r-calf': 'R Calf'
};

// SVG coordinates for each area code [x, y]
const AREA_COORDS = {
  'f-head': [85, 28], 'f-neck': [85, 52], 'f-l-shoulder': [58, 72], 'f-r-shoulder': [112, 72],
  'f-chest': [85, 95], 'f-abdomen': [85, 125], 'f-l-arm': [45, 110], 'f-r-arm': [125, 110],
  'f-l-thigh': [68, 185], 'f-r-thigh': [102, 185], 'f-l-knee': [68, 225], 'f-r-knee': [102, 225],
  'f-l-foot': [68, 290], 'f-r-foot': [102, 290], 'f-hip': [85, 155],
  'b-head': [85, 28], 'b-neck': [85, 52], 'b-upper-bk': [85, 85], 'b-mid-bk': [85, 110],
  'b-lower-bk': [85, 135], 'b-l-shoulder': [58, 72], 'b-r-shoulder': [112, 72],
  'b-glutes': [85, 160], 'b-l-hamstr': [68, 195], 'b-r-hamstr': [102, 195],
  'b-l-calf': [68, 245], 'b-r-calf': [102, 245]
};

function BodySVG({ focusAreas = [], avoidAreas = [] }) {
  return (
    <svg width="170" height="310" viewBox="0 0 170 310">
      <ellipse cx="85" cy="28" rx="20" ry="24" fill="#E8DDD0" stroke="#C4B8A8" strokeWidth="1.5"/>
      <rect x="77" y="50" width="16" height="14" rx="3" fill="#E8DDD0" stroke="#C4B8A8" strokeWidth="1.5"/>
      <path d="M57 64 Q47 70 44 90 L40 155 Q40 162 48 162 L122 162 Q130 162 130 155 L126 90 Q123 70 113 64 Z" fill="#E8DDD0" stroke="#C4B8A8" strokeWidth="1.5"/>
      <path d="M57 66 Q42 74 38 115 Q36 128 40 138 Q46 141 50 138 Q54 112 60 85 Z" fill="#E8DDD0" stroke="#C4B8A8" strokeWidth="1.5"/>
      <path d="M113 66 Q128 74 132 115 Q134 128 130 138 Q124 141 120 138 Q116 112 110 85 Z" fill="#E8DDD0" stroke="#C4B8A8" strokeWidth="1.5"/>
      <path d="M60 162 Q56 195 54 232 Q52 260 56 278 Q62 284 70 282 Q76 278 76 260 L78 162 Z" fill="#E8DDD0" stroke="#C4B8A8" strokeWidth="1.5"/>
      <path d="M110 162 Q114 195 116 232 Q118 260 114 278 Q108 284 100 282 Q94 278 94 260 L92 162 Z" fill="#E8DDD0" stroke="#C4B8A8" strokeWidth="1.5"/>
      
      {focusAreas.map((area, i) => {
        const c = AREA_COORDS[area];
        if (!c) return null;
        return <g key={"f"+i}>
          <circle cx={c[0]} cy={c[1]} r="11" fill="rgba(107,158,128,0.35)" stroke="#6B9E80" strokeWidth="2"/>
          <circle cx={c[0]} cy={c[1]} r="4" fill="#6B9E80"/>
        </g>;
      })}
      {avoidAreas.map((area, i) => {
        const c = AREA_COORDS[area];
        if (!c) return null;
        return <g key={"a"+i}>
          <circle cx={c[0]} cy={c[1]} r="11" fill="rgba(239,68,68,0.25)" stroke="#EF4444" strokeWidth="2"/>
          <circle cx={c[0]} cy={c[1]} r="4" fill="#EF4444"/>
        </g>;
      })}
    </svg>
  );
}

export default function SessionDetail({ session, client, onBack, onUpdate }) {
  const [notes, setNotes] = useState(session.therapist_notes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [completing, setCompleting] = useState(false);

  const frontFocus = session.front_focus || [];
  const frontAvoid = session.front_avoid || [];
  const backFocus = session.back_focus || [];
  const backAvoid = session.back_avoid || [];

  async function saveNotes() {
    setSaving(true);
    try {
      const updated = await db.updateSession(session.id, { therapist_notes: notes });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (onUpdate) onUpdate(updated);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function markComplete() {
    setCompleting(true);
    try {
      const updated = await db.updateSession(session.id, {
        completed: true,
        therapist_notes: notes,
        completed_at: new Date().toISOString()
      });
      if (onUpdate) onUpdate(updated);
      onBack();
    } catch (err) { console.error(err); }
    finally { setCompleting(false); }
  }

  const prefs = [
    { label: 'Pressure', value: session.pressure ? `Level ${session.pressure}/5` : null },
    { label: 'Goal', value: session.goal },
    { label: 'Table Temp', value: session.table_temp },
    { label: 'Room Temp', value: session.room_temp },
    { label: 'Music', value: session.music },
    { label: 'Lighting', value: session.lighting },
    { label: 'Conversation', value: session.conversation },
    { label: 'Draping', value: session.draping },
    { label: 'Oil Preference', value: session.oil_pref },
    { label: 'Medical Flag', value: session.med_flag && session.med_flag !== 'none' ? session.med_flag : null },
  ].filter(p => p.value && p.value !== 'none');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={onBack} style={{ background: C.white, border: `1px solid ${C.lightGray}`, color: C.gray, padding: '8px 16px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}>← Back</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: C.darkGray, margin: 0 }}>{client.name} — Session</h2>
          <p style={{ fontSize: '14px', color: C.gray, margin: '4px 0 0 0' }}>
            {new Date(session.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <span style={{ background: session.completed ? '#D1FAE5' : '#FEF3C7', color: session.completed ? '#065F46' : '#92400E', padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
          {session.completed ? '✓ Completed' : '⏳ Pending Review'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ background: C.white, borderRadius: '12px', padding: '24px', border: `1px solid ${C.lightGray}` }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>📋 Client Preferences</h3>
            {prefs.length === 0 ? (
              <p style={{ color: C.gray, fontSize: '14px' }}>No preferences recorded</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {prefs.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: C.lightBeige, borderRadius: '8px' }}>
                    <span style={{ fontSize: '13px', color: C.gray, fontWeight: '500' }}>{p.label}</span>
                    <span style={{ fontSize: '13px', color: C.darkGray, fontWeight: '600', textTransform: 'capitalize' }}>{p.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: C.white, borderRadius: '12px', padding: '24px', border: `1px solid ${C.lightGray}` }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>📝 Your Notes</h3>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add session notes..."
              style={{ width: '100%', minHeight: '100px', padding: '12px', border: `1px solid ${C.lightGray}`, borderRadius: '8px', fontSize: '14px', fontFamily: 'system-ui', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button onClick={saveNotes} disabled={saving} style={{ flex: 1, background: C.sage, color: C.white, border: 'none', padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Notes'}
              </button>
              {!session.completed && (
                <button onClick={markComplete} disabled={completing} style={{ flex: 1, background: C.forest, color: C.white, border: 'none', padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                  {completing ? 'Saving...' : '✓ Mark Complete'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ background: C.white, borderRadius: '12px', padding: '24px', border: `1px solid ${C.lightGray}` }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: C.darkGray, marginBottom: '8px' }}>🗺️ Body Map</h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', background: 'rgba(107,158,128,0.2)', color: C.forest, padding: '3px 10px', borderRadius: '20px' }}>🟢 Focus</span>
            <span style={{ fontSize: '12px', background: 'rgba(239,68,68,0.15)', color: '#991B1B', padding: '3px 10px', borderRadius: '20px' }}>🔴 Avoid</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: C.gray, marginBottom: '8px', textTransform: 'uppercase' }}>Front</p>
              <BodySVG focusAreas={frontFocus} avoidAreas={frontAvoid} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: C.gray, marginBottom: '8px', textTransform: 'uppercase' }}>Back</p>
              <BodySVG focusAreas={backFocus} avoidAreas={backAvoid} />
            </div>
          </div>

          {[...frontFocus, ...frontAvoid, ...backFocus, ...backAvoid].length > 0 && (
            <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {frontFocus.concat(backFocus).map((a, i) => (
                <span key={"f"+i} style={{ background: 'rgba(107,158,128,0.2)', color: C.forest, padding: '3px 10px', borderRadius: '20px', fontSize: '12px' }}>
                  🟢 {AREA_LABELS[a] || a}
                </span>
              ))}
              {frontAvoid.concat(backAvoid).map((a, i) => (
                <span key={"a"+i} style={{ background: 'rgba(239,68,68,0.12)', color: '#991B1B', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' }}>
                  🔴 {AREA_LABELS[a] || a}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
