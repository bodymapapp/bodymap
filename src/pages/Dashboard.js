// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, supabase } from '../lib/supabase';
import ClientList from '../components/ClientList';
import SessionList from '../components/SessionList';
import SessionDetail from '../components/SessionDetail';
import ScheduleDashboard from '../components/ScheduleDashboard';
import BillingDashboard from '../components/BillingDashboard';
import AIDashboard from '../components/AIDashboard';
import GiftCertificates from '../components/GiftCertificates';

const C = {
  sage: '#6B9E80', forest: '#2A5741', beige: '#F0EAD9',
  lightBeige: '#F9FAFB', darkGray: '#1F2937', gray: '#6B7280',
  lightGray: '#E5E7EB', white: '#FFFFFF'
};


function ServicesAndAvailability({ therapist }) {
  const C2 = { sage:'#6B9E80', forest:'#2A5741', beige:'#F0EAD9', darkGray:'#1A1A2E', gray:'#6B7280', lightGray:'#E8E4DC', white:'#FFFFFF' };
  const { updateProfile } = useAuth();
  const [depositEnabled, setDepositEnabled] = React.useState(therapist?.deposit_enabled || false);
  const [depositPercent, setDepositPercent] = React.useState(therapist?.deposit_percent || 20);
  const [depositSaving, setDepositSaving] = React.useState(false);
  const [services, setServices] = React.useState([]);
  const [availability, setAvailability] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(null);

  // Re-sync local state whenever therapist reloads (e.g. page refresh)
  React.useEffect(() => {
    setDepositEnabled(therapist?.deposit_enabled || false);
    setDepositPercent(therapist?.deposit_percent || 20);
  }, [therapist?.deposit_enabled, therapist?.deposit_percent]);

  const PRESETS = [
    { name:'Swedish Massage', duration:60, price:85 },
    { name:'Deep Tissue', duration:60, price:100 },
    { name:'Hot Stone', duration:90, price:130 },
    { name:'Sports Massage', duration:60, price:95 },
    { name:'Prenatal Massage', duration:60, price:90 },
    { name:'Relaxation Massage', duration:60, price:80 },
    { name:'Chair Massage', duration:30, price:45 },
    { name:'Custom...', duration:60, price:85 },
  ];

  const [draft, setDraft] = React.useState({ preset:'', name:'', duration:60, price:85 });
  const DAYS = [{id:1,label:'Mon'},{id:2,label:'Tue'},{id:3,label:'Wed'},{id:4,label:'Thu'},{id:5,label:'Fri'},{id:6,label:'Sat'},{id:0,label:'Sun'}];

  React.useEffect(() => { if (therapist?.id) load(); }, [therapist?.id]);

  async function load() {
    const [{ data: svcs }, { data: avail }] = await Promise.all([
      supabase.from('services').select('*').eq('therapist_id', therapist.id).order('duration'),
      supabase.from('availability').select('*').eq('therapist_id', therapist.id),
    ]);
    setServices(svcs || []);
    setAvailability(avail || []);
    setLoading(false);
  }

  function handlePreset(val) {
    if (val === 'Custom...') {
      setDraft(d => ({ ...d, preset: val, name: '' }));
    } else {
      const p = PRESETS.find(x => x.name === val);
      if (p) setDraft({ preset: val, name: p.name, duration: p.duration, price: p.price });
    }
  }

  async function addService() {
    if (!draft.name.trim()) return;
    setSaving('add');
    const { data } = await supabase.from('services').insert({ name: draft.name, duration: draft.duration, price: draft.price, therapist_id: therapist.id, active: true }).select().single();
    setServices(s => [...s, data]);
    setDraft({ preset:'', name:'', duration:60, price:85 });
    setSaving(false);
  }

  async function toggleService(svc) {
    await supabase.from('services').update({ active: !svc.active }).eq('id', svc.id);
    setServices(s => s.map(x => x.id === svc.id ? { ...x, active: !x.active } : x));
  }

  async function deleteService(id) {
    await supabase.from('services').delete().eq('id', id);
    setServices(s => s.filter(x => x.id !== id));
  }

  async function toggleDay(dow) {
    const existing = availability.find(a => a.day_of_week === dow);
    if (existing) {
      await supabase.from('availability').update({ active: !existing.active }).eq('id', existing.id);
      setAvailability(a => a.map(x => x.id === existing.id ? { ...x, active: !x.active } : x));
    } else {
      const { data } = await supabase.from('availability').insert({ therapist_id: therapist.id, day_of_week: dow, start_time: '09:00', end_time: '17:00', active: true }).select().single();
      setAvailability(a => [...a, data]);
    }
  }

  async function updateHours(id, field, val) {
    await supabase.from('availability').update({ [field]: val }).eq('id', id);
    setAvailability(a => a.map(x => x.id === id ? { ...x, [field]: val } : x));
  }

  // Time blocks helpers
  function getBlocks(avail) {
    if (avail.time_blocks && avail.time_blocks.length > 0) return avail.time_blocks;
    // Migrate from old start/end format
    return [{ start: avail.start_time?.slice(0,5) || '09:00', end: avail.end_time?.slice(0,5) || '17:00' }];
  }

  async function saveBlocks(id, blocks) {
    const sorted = [...blocks].sort((a,b) => a.start.localeCompare(b.start));
    await supabase.from('availability').update({
      time_blocks: sorted,
      start_time: sorted[0]?.start || '09:00',
      end_time: sorted[sorted.length-1]?.end || '17:00',
    }).eq('id', id);
    setAvailability(a => a.map(x => x.id === id ? { ...x, time_blocks: sorted, start_time: sorted[0]?.start || '09:00', end_time: sorted[sorted.length-1]?.end || '17:00' } : x));
  }

  function addBlock(avail) {
    const blocks = getBlocks(avail);
    const last = blocks[blocks.length - 1];
    // Suggest 1hr after last block ends
    const [h, m] = (last?.end || '17:00').split(':').map(Number);
    const newStart = `${String(h+1).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    const newEnd = `${String(h+2).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    saveBlocks(avail.id, [...blocks, { start: newStart, end: newEnd }]);
  }

  function removeBlock(avail, idx) {
    const blocks = getBlocks(avail).filter((_, i) => i !== idx);
    if (blocks.length === 0) return; // keep at least one
    saveBlocks(avail.id, blocks);
  }

  function updateBlock(avail, idx, field, val) {
    const blocks = getBlocks(avail).map((b, i) => i === idx ? { ...b, [field]: val } : b);
    saveBlocks(avail.id, blocks);
  }

  if (loading) return null;

  const isCustom = draft.preset === 'Custom...';
  const canAdd = draft.name.trim().length > 0;

  return (
    <div style={{ marginBottom:20 }}>
      {/* Services */}
      <div style={{ background:C2.white, border:`1.5px solid ${C2.lightGray}`, borderRadius:14, padding:20, marginBottom:16 }}>
        <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:C2.gray, margin:'0 0 4px' }}>💆 Services</p>
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 16px' }}>Clients choose from these when booking online.</p>

        {/* Existing services */}
        {services.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
            {services.map(svc => (
              <div key={svc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:svc.active?'#F9FAFB':'#FAFAFA', borderRadius:10, border:`1px solid ${svc.active?C2.lightGray:'#F0F0F0'}` }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:C2.darkGray }}>{svc.name}</span>
                  <span style={{ fontSize:12, color:C2.gray, marginLeft:8 }}>{svc.duration} min · ${svc.price}</span>
                </div>
                <button onClick={() => toggleService(svc)} style={{ background:svc.active?'#DCFCE7':'#F3F4F6', color:svc.active?'#16A34A':C2.gray, border:'none', borderRadius:20, padding:'3px 10px', fontSize:'11px', fontWeight:600, cursor:'pointer', flexShrink:0 }}>
                  {svc.active ? 'On' : 'Off'}
                </button>
                <button onClick={() => deleteService(svc.id)} style={{ background:'none', border:'none', color:'#EF4444', cursor:'pointer', fontSize:15, padding:'2px 4px', flexShrink:0, lineHeight:1 }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Add service - always visible inline */}
        <div style={{ background:'#F9FAFB', borderRadius:10, padding:14, border:`1.5px dashed ${C2.lightGray}` }}>
          <p style={{ fontSize:'11px', fontWeight:700, color:C2.gray, margin:'0 0 10px', textTransform:'uppercase', letterSpacing:'0.06em' }}>+ Add a service</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
            <select value={draft.preset} onChange={e => handlePreset(e.target.value)}
              style={{ flex:'1 1 180px', padding:'10px 12px', border:`1.5px solid ${C2.lightGray}`, borderRadius:10, fontSize:16, fontFamily:'system-ui', background:'#fff', color: draft.preset ? C2.darkGray : C2.gray, outline:'none', cursor:'pointer' }}>
              <option value="" disabled>Select a service type</option>
              {PRESETS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <div style={{ display:'flex', alignItems:'center', background:'#fff', border:`1.5px solid ${C2.lightGray}`, borderRadius:10, padding:'0 10px', height:42, flexShrink:0 }}>
              <input type="number" value={draft.duration} onChange={e => setDraft(d => ({...d, duration:parseInt(e.target.value)||60}))} min="15" max="240"
                style={{ width:38, border:'none', fontSize:16, fontWeight:700, color:C2.forest, background:'transparent', outline:'none', textAlign:'center' }} />
              <span style={{ fontSize:12, color:C2.gray }}>min</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', background:'#fff', border:`1.5px solid ${C2.lightGray}`, borderRadius:10, padding:'0 10px', height:42, flexShrink:0 }}>
              <span style={{ fontSize:13, color:C2.gray, marginRight:2 }}>$</span>
              <input type="number" value={draft.price} onChange={e => setDraft(d => ({...d, price:parseInt(e.target.value)||0}))} min="0"
                style={{ width:52, border:'none', fontSize:16, fontWeight:700, color:C2.forest, background:'transparent', outline:'none', textAlign:'center' }} />
            </div>
          </div>
          {isCustom && (
            <input value={draft.name} onChange={e => setDraft(d => ({...d, name:e.target.value}))} placeholder="Enter service name"
              style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${C2.lightGray}`, borderRadius:10, fontSize:13, fontFamily:'system-ui', boxSizing:'border-box', marginTop:8, outline:'none' }} />
          )}
          {draft.preset && (
            <button onClick={addService} disabled={!canAdd || saving === 'add'}
              style={{ marginTop:10, background:canAdd?C2.forest:'#D1D5DB', color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:canAdd?'pointer':'default', transition:'background 0.15s' }}>
              {saving === 'add' ? 'Saving...' : `Add ${draft.name || 'Service'}`}
            </button>
          )}
        </div>
      </div>


      {/* Deposit Settings */}
      <div style={{ background:C2.white, border:`1.5px solid ${C2.lightGray}`, borderRadius:14, padding:20, marginBottom:16 }}>
        <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:C2.gray, margin:'0 0 4px' }}>💳 New Client Deposit</p>
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 16px' }}>Require first-time clients to pay a deposit when booking. Repeat clients are never charged.</p>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <button onClick={async () => {
            const newVal = !depositEnabled;
            setDepositEnabled(newVal); // optimistic
            setDepositSaving(true);
            const result = await updateProfile({ deposit_enabled: newVal });
            setDepositSaving(false);
            if (!result.success) setDepositEnabled(!newVal); // revert if failed
          }} style={{ width:40, height:22, borderRadius:11, background:depositEnabled?C2.forest:'#D1D5DB', border:'none', cursor:'pointer', position:'relative', flexShrink:0, transition:'background 0.2s', opacity:depositSaving?0.6:1 }}>
            <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:depositEnabled?21:3, transition:'left 0.2s' }}/>
          </button>
          <span style={{ fontSize:13, fontWeight:600, color:C2.darkGray }}>
            {depositSaving ? 'Saving…' : depositEnabled ? 'Deposit enabled' : 'Deposit disabled'}
          </span>
        </div>
        {depositEnabled && (
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', background:'#F9FAFB', border:`1.5px solid ${C2.lightGray}`, borderRadius:10, padding:'8px 14px', gap:6 }}>
              <input type="number" min="5" max="100"
                defaultValue={depositPercent}
                onBlur={async e => {
                  const v = Math.min(100, Math.max(5, parseInt(e.target.value)||20));
                  setDepositPercent(v);
                  e.target.value = v;
                  await updateProfile({ deposit_percent: v });
                }}
                style={{ width:50, border:'none', background:'transparent', fontSize:16, fontWeight:700, color:C2.forest, outline:'none', textAlign:'center' }}
              />
              <span style={{ fontSize:14, color:C2.gray }}>%</span>
            </div>
            <div style={{ fontSize:12, color:C2.gray, lineHeight:1.5 }}>
              Recommended: 20-50%. For a $85 session, 20% = $17 deposit.
            </div>
          </div>
        )}
      </div>

      {/* Working Hours - Time Blocks */}
      <div style={{ background:C2.white, border:`1.5px solid ${C2.lightGray}`, borderRadius:14, padding:20 }}>
        <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:C2.gray, margin:'0 0 4px' }}>🕐 Working Hours</p>
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 14px' }}>Toggle days on/off. Add blocks for each working period — e.g. 9–12 and 1–5 for a lunch break.</p>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {DAYS.map(({ id: dow, label }) => {
            const avail = availability.find(a => a.day_of_week === dow);
            const isOn = avail?.active;
            const blocks = avail ? getBlocks(avail) : [];
            return (
              <div key={dow} style={{ background:isOn?'#F9FAFB':'transparent', borderRadius:12, border:`1px solid ${isOn?C2.lightGray:'transparent'}`, padding:'10px 14px', transition:'all 0.15s' }}>
                {/* Day toggle row */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: isOn ? 10 : 0 }}>
                  <button onClick={() => toggleDay(dow)}
                    style={{ width:38, height:20, borderRadius:10, background:isOn?C2.forest:'#D1D5DB', border:'none', cursor:'pointer', position:'relative', flexShrink:0, transition:'background 0.2s' }}>
                    <div style={{ width:14, height:14, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:isOn?21:3, transition:'left 0.2s' }} />
                  </button>
                  <span style={{ fontSize:13, fontWeight:700, color:isOn?C2.darkGray:'#C4C4C4', minWidth:30 }}>{label}</span>
                  {!isOn && <span style={{ fontSize:12, color:'#D1D5DB' }}>Off</span>}
                  {isOn && (
                    <span style={{ fontSize:11, color:C2.gray, marginLeft:'auto' }}>
                      {blocks.map(b => `${b.start}–${b.end}`).join('  ·  ')}
                    </span>
                  )}
                </div>
                {/* Time blocks */}
                {isOn && avail && (
                  <div style={{ paddingLeft:48, display:'flex', flexDirection:'column', gap:6 }}>
                    {blocks.map((block, idx) => (
                      <div key={idx} style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <input type="time" value={block.start}
                          onChange={e => updateBlock(avail, idx, 'start', e.target.value)}
                          style={{ padding:'6px 8px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:14, outline:'none', background:'#fff', flexShrink:0 }} />
                        <span style={{ fontSize:13, color:C2.gray }}>–</span>
                        <input type="time" value={block.end}
                          onChange={e => updateBlock(avail, idx, 'end', e.target.value)}
                          style={{ padding:'6px 8px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:14, outline:'none', background:'#fff', flexShrink:0 }} />
                        {blocks.length > 1 && (
                          <button onClick={() => removeBlock(avail, idx)}
                            style={{ background:'transparent', border:'none', color:'#EF4444', cursor:'pointer', fontSize:16, padding:'0 4px', lineHeight:1, flexShrink:0 }}>×</button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => addBlock(avail)}
                      style={{ alignSelf:'flex-start', background:'transparent', border:`1.5px dashed ${C2.lightGray}`, borderRadius:8, padding:'5px 12px', fontSize:12, fontWeight:600, color:C2.sage, cursor:'pointer', marginTop:2 }}>
                      + Add block
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ therapist, lapsedDays, setLapsedDays }) {
  const { updateProfile } = useAuth();
  const [lapsedSaved, setLapsedSaved] = React.useState(false);
  const [fullName, setFullName] = React.useState(therapist?.full_name || '');
  const [businessName, setBusinessName] = React.useState(therapist?.business_name || '');
  const [phone, setPhone] = React.useState(therapist?.phone || '');
  const [phoneError, setPhoneError] = React.useState('');
  const [nameError, setNameError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [photoUrl, setPhotoUrl] = React.useState(therapist?.photo_url || '');

  const [photoUploading, setPhotoUploading] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [calKey, setCalKey] = React.useState(therapist?.cal_api_key || '');
  const [calSaved, setCalSaved] = React.useState(false);
  const [showCalKey, setShowCalKey] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const intakeUrl = `${window.location.origin}/${therapist?.custom_url}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(intakeUrl)}`;

  const C2 = {
    sage: '#6B9E80', forest: '#2A5741', beige: '#F0EAD9',
    darkGray: '#1A1A2E', gray: '#6B7280', lightGray: '#E8E4DC',
    white: '#FFFFFF', gold: '#C9A84C'
  };

  const copyLink = () => {
    navigator.clipboard.writeText(intakeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ width: '100%' }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: '700', color: C2.darkGray, margin: '0 0 28px 0' }}>
        Account Settings
      </h2>

      {/* Profile Completion Bar */}
      {(() => {
        const fields = [
          { label: 'Full Name', done: !!(therapist?.full_name) },
          { label: 'Business Name', done: !!(therapist?.business_name) },
          { label: 'Intake URL', done: !!(therapist?.custom_url) },
          { label: 'Phone Number', done: !!(therapist?.phone) },
          { label: 'Email', done: !!(therapist?.email) },
          { label: 'Profile Photo', done: !!(therapist?.photo_url) },
        ];
        const done = fields.filter(f => f.done).length;
        const pct = Math.round((done / fields.length) * 100);
        if (pct === 100) return null;
        return (
          <div style={{ background: '#fff', border: '1.5px solid #E8E4DC', borderRadius: '14px', padding: '20px 24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#1A1A2E' }}>Profile Completion</span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#2A5741' }}>{pct}%</span>
            </div>
            <div style={{ background: '#E8E4DC', borderRadius: '99px', height: '8px', marginBottom: '14px' }}>
              <div style={{ width: pct + '%', background: 'linear-gradient(90deg, #6B9E80, #2A5741)', borderRadius: '99px', height: '8px', transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {fields.map(f => (
                <span key={f.label} style={{ fontSize: '12px', fontWeight: '600', padding: '4px 10px', borderRadius: '99px', background: f.done ? '#F0FDF4' : '#FEF9F0', color: f.done ? '#2A5741' : '#92400E', border: f.done ? '1px solid #BBF7D0' : '1px solid #FDE68A' }}>
                  {f.done ? '✓' : '+'} {f.label}
                </span>
              ))}
            </div>
            {!therapist?.phone && (
              <p style={{ fontSize: '12px', color: '#6B7280', margin: '10px 0 0 0' }}>
                💡 Add your phone number below - shown on client session briefs
              </p>
            )}
          </div>
        );
      })()}


      {/* Intake Link */}
      <div style={{ background: `linear-gradient(135deg, ${C2.forest}08, ${C2.sage}15)`, border: `1.5px solid ${C2.sage}40`, borderRadius: '14px', padding: '24px', marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.sage, margin: '0 0 8px 0' }}>
          🔗 Your Client Intake Link
        </p>
        <p style={{ fontSize: '13px', color: C2.gray, margin: '0 0 14px 0' }}>
          Share this with clients - they tap it, fill their body map, you get it instantly.
        </p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, background: C2.white, border: `1.5px solid ${C2.lightGray}`, borderRadius: '8px', padding: '10px 14px', fontSize: '13px', fontFamily: 'monospace', color: C2.darkGray, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {intakeUrl}
          </div>
          <button onClick={copyLink} style={{ background: copied ? C2.forest : C2.sage, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.2s' }}>
            {copied ? '✓ Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* QR Code */}
      <div className="bm-qr-section" style={{ background: C2.white, border: `1.5px solid ${C2.lightGray}`, borderRadius: '14px', padding: '24px', marginBottom: '20px', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        <img src={qrUrl} alt="QR Code" style={{ width: 130, height: 130, borderRadius: '8px', border: `1px solid ${C2.lightGray}` }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.gray, margin: '0 0 6px 0' }}>
            📱 QR Code
          </p>
          <p style={{ fontSize: '14px', fontWeight: '600', color: C2.darkGray, margin: '0 0 8px 0' }}>Print & place at your table</p>
          <p style={{ fontSize: '13px', color: C2.gray, margin: '0 0 16px 0', lineHeight: 1.5 }}>
            Clients scan before the session. No link needed. Works on any phone.
          </p>
          <a href={qrUrl} download="bodymap-qr.png" style={{ display: 'inline-block', background: C2.beige, border: `1.5px solid ${C2.lightGray}`, color: C2.darkGray, padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
            ⬇️ Download QR Code
          </a>
        </div>
      </div>

      {/* Profile Edit */}
      <div style={{ background: C2.white, border: `1.5px solid ${C2.lightGray}`, borderRadius: '14px', padding: '24px', marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.gray, margin: '0 0 16px 0' }}>
          ✏️ Profile
        </p>
        {/* Photo Upload */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', paddingBottom: '20px', borderBottom: `1px solid ${C2.lightGray}` }}>
          <div style={{ position: 'relative' }}>
            {photoUrl || therapist?.photo_url ? (
              <img src={photoUrl || therapist?.photo_url} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${C2.sage}` }} />
            ) : (
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: C2.beige, border: `2px dashed ${C2.sage}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>🌿</div>
            )}
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: '700', color: C2.darkGray, margin: '0 0 4px 0' }}>Profile Photo / Business Logo</p>
            <p style={{ fontSize: '11px', color: C2.gray, margin: '0 0 10px 0' }}>Used on client briefs. Square image works best.</p>
            <label style={{ display: 'inline-block', background: C2.beige, border: `1.5px solid ${C2.lightGray}`, color: C2.darkGray, padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: photoUploading ? 'not-allowed' : 'pointer' }}>
              {photoUploading ? '⏳ Uploading...' : '📷 Upload Photo'}
              <input type="file" accept="image/*" style={{ display: 'none' }} disabled={photoUploading}
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }
                  setPhotoUploading(true);
                  try {
                    const { supabase } = await import('../lib/supabase');
                    const ext = file.name.split('.').pop();
                    const { data: { user } } = await supabase.auth.getUser();
                    const path = `${user.id}/profile.${ext}`;
                    const { error: upErr } = await supabase.storage.from('bodymap-assets').upload(path, file, { upsert: true });
                    if (upErr) throw upErr;
                    const { data: { publicUrl } } = supabase.storage.from('bodymap-assets').getPublicUrl(path);
                    await supabase.from('therapists').update({ photo_url: publicUrl }).eq('id', therapist.id);
                    setPhotoUrl(publicUrl);
                  } catch(err) { console.error(err); alert('Upload failed. Please try again.'); }
                  finally { setPhotoUploading(false); }
                }} />
            </label>
            {(photoUrl || therapist?.photo_url) && (
              <button onClick={async () => {
                const { supabase } = await import('../lib/supabase');
                await supabase.from('therapists').update({ photo_url: null }).eq('id', therapist.id);
                setPhotoUrl('');
              }} style={{ marginLeft: '8px', background: 'none', border: 'none', fontSize: '11px', color: '#EF4444', cursor: 'pointer', fontWeight: '600' }}>Remove</button>
            )}
          </div>
        </div>

        <div className="bm-profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: C2.gray, display: 'block', marginBottom: '6px' }}>Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${nameError?'#EF4444':C2.lightGray}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'system-ui', background: C2.beige }} />
          {nameError && <p style={{color:'#EF4444',fontSize:'11px',margin:'4px 0 0'}}>{nameError}</p>}
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: C2.gray, display: 'block', marginBottom: '6px' }}>Business Name</label>
            <input value={businessName} onChange={e => setBusinessName(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C2.lightGray}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'system-ui', background: C2.beige }} />
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', color: C2.gray, display: 'block', marginBottom: '6px' }}>Phone Number (shown on client briefs)</label>
          <input value={phone} onChange={e => { const d=e.target.value.replace(/\D/g,'').slice(0,10); const f=d.length<=3?d:d.length<=6?`(${d.slice(0,3)}) ${d.slice(3)}`:`(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`; setPhone(f); setPhoneError(''); }} placeholder="(512) 555-1234" type="tel"
            style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${phoneError?'#EF4444':C2.lightGray}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'system-ui', background: C2.beige }} />
          {phoneError && <p style={{color:'#EF4444',fontSize:'11px',margin:'4px 0 0'}}>{phoneError}</p>}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={async () => {
              let valid = true;
              if (!fullName.trim() || fullName.trim().length < 2) { setNameError('Name must be at least 2 characters'); valid = false; } else setNameError('');
              if (phone && phone.replace(/\D/g,'').length > 0 && phone.replace(/\D/g,'').length !== 10) { setPhoneError('Enter a valid 10-digit phone number'); valid = false; } else setPhoneError('');
              if (!valid) return;
              setSaving(true);
              try {
                const { supabase } = await import('../lib/supabase');
                await supabase.from('therapists').update({ full_name: fullName, business_name: businessName, phone: phone }).eq('id', therapist.id);
                setSaved(true); setTimeout(() => setSaved(false), 2500);
              } catch(e) { console.error(e); }
              finally { setSaving(false); }
            }}
            style={{ background: C2.sage, color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
          <div>
            {nameError && <p style={{color:'#EF4444',fontSize:'11px',margin:'0 0 2px'}}>{nameError}</p>}
            <p style={{ fontSize: '12px', color: C2.gray, margin: 0 }}>Email: {therapist?.email}</p>
          </div>
        </div>
      </div>


      {/* Lapsed Threshold */}
      <div style={{ background:C2.white, border:`1.5px solid ${C2.lightGray}`, borderRadius:14, padding:20, marginBottom:20 }}>
        <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:C2.gray, margin:'0 0 12px 0' }}>🍂 Lapsed Threshold</p>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <input type="number" min="1" max="365" value={lapsedDays}
            onChange={e => { const v=parseInt(e.target.value); if(!isNaN(v)) setLapsedDays(v); }}
            onBlur={e => { const v=parseInt(e.target.value); const c=Math.max(1,Math.min(365,isNaN(v)?60:v)); setLapsedDays(c); localStorage.setItem('bm_lapsed_days',c); setLapsedSaved(true); setTimeout(()=>setLapsedSaved(false),2000); }}
            style={{ width:'70px', padding:'8px 12px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:'17px', fontWeight:'700', color:C2.forest, background:C2.beige, textAlign:'center' }} />
          <p style={{ fontSize:'13px', color:C2.darkGray, margin:0 }}>days since last session before a client is flagged as lapsed</p>
          {lapsedSaved && <p style={{ fontSize:'12px', color:C2.forest, fontWeight:'600', margin:0 }}>✓ Saved</p>}
        </div>
      </div>

      {/* Integrations Row - Cal.com + Stripe side by side */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }} className="bm-integrations">
        {/* Cal.com */}
        <div style={{ background:C2.white, border:`1.5px solid ${C2.lightGray}`, borderRadius:14, padding:20 }}>
          <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:C2.gray, margin:'0 0 6px 0' }}>📅 Calendar</p>
          <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 14px 0', lineHeight:1.5 }}>Sync your bookings so clients appear in your Schedule tab automatically.</p>
          {(therapist?.cal_connected || therapist?.cal_api_key) ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'10px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span>✅</span>
                <div>
                  <div style={{ fontSize:'12px', fontWeight:'700', color:'#2A5741' }}>Calendar Connected</div>
                  <div style={{ fontSize:'11px', color:'#6B7280' }}>Syncing automatically</div>
                </div>
              </div>
              <button onClick={async () => {
                await supabase.from('therapists').update({ cal_connected:false, cal_access_token:null, cal_refresh_token:null }).eq('id', therapist.id);
                window.location.reload();
              }} style={{ background:'transparent', border:'1px solid #DC2626', color:'#DC2626', borderRadius:6, padding:'4px 10px', fontSize:'11px', fontWeight:'600', cursor:'pointer' }}>
                Disconnect
              </button>
            </div>
          ) : (
            <div style={{ background:C2.beige, borderRadius:10, padding:12 }}>
              <p style={{ fontSize:'11px', color:C2.gray, margin:'0 0 8px 0', lineHeight:1.5 }}>
                Using Cal.com? Find your API key at <strong>cal.com → Settings → Developer → API Keys</strong>
              </p>
              <div style={{ display:'flex', gap:6 }}>
                <input type="password" value={calKey} onChange={e => setCalKey(e.target.value)} placeholder="cal_live_..."
                  style={{ flex:1, padding:'8px 10px', border:'1.5px solid #E8E4DC', borderRadius:8, fontSize:'12px', fontFamily:'monospace', background:'#fff' }} />
                <button onClick={async () => {
                  const { supabase: sb } = await import('../lib/supabase');
                  await sb.from('therapists').update({ cal_api_key: calKey }).eq('id', therapist.id);
                  setCalSaved(true); setTimeout(() => setCalSaved(false), 2000);
                }} style={{ background:C2.sage, color:'#fff', border:'none', padding:'8px 14px', borderRadius:8, fontSize:'12px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap' }}>
                  {calSaved ? '✓' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stripe */}
        <div style={{ background:C2.white, border:`1.5px solid ${C2.lightGray}`, borderRadius:14, padding:20 }}>
          <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:C2.gray, margin:'0 0 6px 0' }}>💳 Payments</p>
          <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 14px 0', lineHeight:1.5 }}>Accept payments from clients and track real revenue in your Billing tab.</p>
          {therapist?.stripe_account_connected ? (
            <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'10px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span>✅</span>
                  <div>
                    <div style={{ fontSize:'12px', fontWeight:'700', color:'#2A5741' }}>Payments Connected</div>
                    <div style={{ fontSize:'11px', color:'#6B7280' }}>Real revenue tracked in Billing</div>
                  </div>
                </div>
                <button onClick={async () => {
                  if (!window.confirm('Disconnect Stripe? Deposit collection will stop until you reconnect.')) return;
                  await updateProfile({ stripe_account_id: null, stripe_account_connected: false });
                }} style={{ background:'transparent', border:'1px solid #EF4444', color:'#EF4444', borderRadius:8, padding:'5px 12px', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <button onClick={async () => {
              const { data: { session } } = await supabase.auth.getSession();
              const res = await fetch('https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/stripe-connect', {
                method:'POST',
                headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${session?.access_token}` },
                body: JSON.stringify({ action:'get_oauth_url', therapist_id: therapist.id }),
              });
              const data = await res.json();
              if (data.url) window.open(data.url, '_blank');
              else alert('Error: ' + JSON.stringify(data));
            }} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#635BFF', color:'#fff', border:'none', borderRadius:10, padding:'12px 16px', fontSize:'13px', fontWeight:'600', cursor:'pointer', width:'100%' }}>
              💳 Connect Payments
            </button>
          )}
        </div>
      </div>

      {/* Booking Link */}
      <div style={{ background:`linear-gradient(135deg,${C2.forest}08,${C2.sage}15)`, border:`1.5px solid ${C2.sage}40`, borderRadius:14, padding:20, marginBottom:20 }}>
        <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:C2.sage, margin:'0 0 6px' }}>📅 Your Booking Link</p>
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 12px', lineHeight:1.5 }}>Share this link so clients can book directly with you - no back-and-forth needed.</p>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ flex:1, background:C2.white, border:`1.5px solid ${C2.lightGray}`, borderRadius:8, padding:'9px 12px', fontSize:'12px', fontFamily:'monospace', color:C2.darkGray, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {window.location.origin}/book/{therapist?.custom_url}
          </div>
          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/book/${therapist?.custom_url}`); }} style={{ background:C2.sage, color:'#fff', border:'none', padding:'9px 16px', borderRadius:8, fontSize:'12px', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
            Copy
          </button>
          <a href={`/book/${therapist?.custom_url}`} target="_blank" rel="noreferrer" style={{ background:C2.forest, color:'#fff', border:'none', padding:'9px 14px', borderRadius:8, fontSize:'12px', fontWeight:600, textDecoration:'none', whiteSpace:'nowrap' }}>
            Preview →
          </a>
        </div>
      </div>

      {/* Services + Availability */}
      <ServicesAndAvailability therapist={therapist} />

      {/* Plan */}
      <div style={{ background: C2.white, border: `1.5px solid ${C2.lightGray}`, borderRadius: '14px', padding: '24px' }}>
        <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.gray, margin: '0 0 12px 0' }}>
          💳 Plan
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '18px', fontWeight: '700', color: C2.darkGray, margin: '0 0 4px 0' }}>
              {(!therapist?.plan || therapist?.plan === 'free') ? 'Bronze - Free' : therapist?.plan === 'silver' ? 'Silver - $19/mo' : 'Gold - $49/mo'}
            </p>
            <p style={{ fontSize: '13px', color: C2.gray, margin: '0 0 4px 0' }}>
              {therapist?.plan === 'free' ? 'All tools included free. Upgrade to unlock unlimited.' : therapist?.plan === 'silver' ? 'Unlimited clients + full session history.' : 'All features including AI insights.'}
            </p>
            {therapist?.plan !== 'free' && (
              <p style={{ fontSize: '12px', color: C2.gray, margin: 0, opacity: 0.7 }}>Cancel anytime. Access continues until end of billing period.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ view }) {
  const { therapist, signOut } = useAuth();
  const navigate = useNavigate();
  const { clientId, sessionId } = useParams();
  const [stats, setStats] = useState({ clients: 0, sessions: 0 });
  const [client, setClient] = useState(null);
  const [session, setSession] = useState(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendPhone, setSendPhone] = useState('');
  const [sendCopied, setSendCopied] = useState(false);
  const [showBookmarkNudge, setShowBookmarkNudge] = useState(false);
  const [lapsedDays, setLapsedDays] = React.useState(() => parseInt(localStorage.getItem('bm_lapsed_days') || '60'));


  useEffect(() => {
    if (therapist?.id) loadStats();
    if (localStorage.getItem('showSendOnLoad') === 'true') {
      localStorage.removeItem('showSendOnLoad');
      setTimeout(() => setShowSendModal(true), 800);
    }
    if (localStorage.getItem('showBookmarkNudge') === 'true') {
      localStorage.removeItem('showBookmarkNudge');
      setShowBookmarkNudge(true);
    }
  }, [therapist?.id]);

  useEffect(() => {
    if (clientId) loadClient();
  }, [clientId]);

  useEffect(() => {
    if (sessionId) loadSession();
  }, [sessionId]);

  async function loadStats() {
    try {
      const clients = await db.getTherapistClients(therapist.id);
      const { data: sessions } = await supabase.from('sessions').select('id').eq('therapist_id', therapist.id);
      setStats({ clients: clients?.length || 0, sessions: sessions?.length || 0 });
    } catch (err) { console.error(err); }
  }

  async function loadClient() {
    try {
      const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
      if (!error) setClient(data);
    } catch (err) { console.error(err); }
  }

  async function loadSession() {
    try {
      const { data, error } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
      if (!error) setSession(data);
    } catch (err) { console.error(err); }
  }

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div style={{ minHeight: '100vh', background: C.beige, fontFamily: 'system-ui, sans-serif', overflowX: 'hidden', paddingTop: '0' }}>
      {new URLSearchParams(window.location.search).get('upgraded') === 'true' && (
        <div style={{ background: '#ECFDF5', borderBottom: '2px solid #059669', padding: '16px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '17px', fontWeight: '700', color: '#065F46', margin: '0 0 2px 0' }}>🎉 Congratulations! You're now on Silver.</p>
          <p style={{ fontSize: '13px', color: '#047857', margin: 0 }}>Unlimited clients and sessions are now unlocked. Let's get to work!</p>
        </div>
      )}
      <header style={{ background: C.white, borderBottom: `1px solid ${C.lightGray}`, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <span style={{ fontSize: '32px' }}>🌿</span>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: C.forest, margin: 0 }}>BodyMap</h1>
            <p style={{ fontSize: '14px', color: C.gray, margin: 0 }}>{therapist?.business_name || 'Dashboard'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '14px', fontWeight: '600', color: C.darkGray, margin: 0 }}>{therapist?.full_name}</p>
            <p style={{ fontSize: '12px', color: C.gray, margin: 0 }}>
              {(!therapist?.plan || therapist?.plan === 'free') ? 'Bronze - Free' : therapist?.plan === 'silver' ? 'Silver Plan ✓' : 'Gold Plan ✓'}
            </p>
          </div>
          {(!therapist?.plan || therapist?.plan === 'free') && (
            <a href="https://buy.stripe.com/5kQbJ23kC0eAfVe9vGeQM03" target="_blank" rel="noopener noreferrer"
              style={{ background: '#C9A84C', color: '#fff', padding: '7px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Upgrade to Silver →
            </a>
          )}
          <button onClick={handleLogout} style={{ background: C.white, border: `1px solid ${C.lightGray}`, color: C.gray, padding: '8px 16px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </header>

      {showBookmarkNudge && (
        <div style={{ background: '#2A5741', color: 'white', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📲</span>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Add BodyMap to your home screen for instant 3-second access - bookmark this page or use Share → Add to Home Screen</p>
          </div>
          <button onClick={() => setShowBookmarkNudge(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>Got it ✓</button>
        </div>
      )}
      <div className="bm-dash-pad" style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ background: C.white, borderRadius: '12px', padding: '8px', marginBottom: '24px', display: 'flex', gap: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ flex: 1, background: (view === 'clients' || view === 'sessions' || view === 'session-detail') ? C.sage : 'transparent', color: (view === 'clients' || view === 'sessions' || view === 'session-detail') ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
          >
            📋 Clients
          </button>
          <button
            onClick={() => navigate('/dashboard/schedule')}
            style={{ flex: 1, background: view === 'schedule' ? C.sage : 'transparent', color: view === 'schedule' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
          >
            📅 Schedule
          </button>
          <button
            onClick={() => navigate('/dashboard/billing')}
            style={{ flex: 1, background: view === 'billing' ? C.sage : 'transparent', color: view === 'billing' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
          >
            💰 Billing
          </button>
          <button
            onClick={() => navigate('/dashboard/ai')}
            style={{ flex: 1, background: view === 'ai' ? C.sage : 'transparent', color: view === 'ai' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
          >
            🤖 AI
          </button>
          <button
            onClick={() => navigate('/dashboard/gifts')}
            style={{ flex: 1, background: view === 'gifts' ? C.sage : 'transparent', color: view === 'gifts' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
          >
            🎁 Gifts
          </button>
          <button
            onClick={() => navigate('/dashboard/settings')}
            style={{ flex: 1, background: view === 'settings' ? C.sage : 'transparent', color: view === 'settings' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
          >
            ⚙️ Settings
          </button>
        </div>

        <div style={{ background: C.white, borderRadius: '12px', padding: '32px', minHeight: '400px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          {view === 'clients' && (
            <ClientList
              therapistId={therapist?.id}
              onSelectClient={(c) => navigate(`/dashboard/clients/${c.id}`)}
              lapsedDays={lapsedDays}
              customUrl={therapist?.custom_url || ''}
            />
          )}
          {view === 'sessions' && client && (
            <SessionList
              client={client}
              therapistId={therapist?.id}
              onBack={() => navigate('/dashboard')}
              onSelectSession={(s) => navigate(`/dashboard/clients/${clientId}/sessions/${s.id}`)}
            />
          )}
          {view === 'sessions' && !client && (
            <div style={{ textAlign: 'center', padding: '40px', color: C.gray }}>Loading client...</div>
          )}
          {view === 'session-detail' && session && client && (
            <SessionDetail
              session={session}
              client={client}
              onBack={() => navigate(`/dashboard/clients/${clientId}`)}
              onUpdate={(updated) => setSession(updated)}
            />
          )}
          {view === 'session-detail' && (!session || !client) && (
            <div style={{ textAlign: 'center', padding: '40px', color: C.gray }}>Loading session...</div>
          )}
          {view === 'schedule' && (
            <ScheduleDashboard therapist={therapist} />
          )}
          {view === 'billing' && (
            <BillingDashboard therapist={therapist} />
          )}
          {view === 'ai' && (
            <AIDashboard therapist={therapist} />
          )}
          {view === 'settings' && (
            <SettingsPanel therapist={therapist} lapsedDays={lapsedDays} setLapsedDays={setLapsedDays} />
          )}
          {view === 'gifts' && therapist && (
            <GiftCertificates therapist={therapist} />
          )}
        </div>

        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '24px' }}>
          <div style={{ background: C.white, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '14px', color: C.gray, margin: '0 0 8px 0' }}>Total Clients</p>
            <p style={{ fontSize: '32px', fontWeight: '700', color: C.forest, margin: 0 }}>{stats.clients}</p>
          </div>
          <div style={{ background: C.white, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '14px', color: C.gray, margin: '0 0 8px 0' }}>Total Sessions</p>
            <p style={{ fontSize: '32px', fontWeight: '700', color: C.sage, margin: 0 }}>{stats.sessions}</p>
          </div>
          <div style={{ background: C.white, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '14px', color: C.gray, margin: '0 0 8px 0' }}>Plan</p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: C.darkGray, margin: 0 }}>
              {(!therapist?.plan || therapist?.plan === 'free') ? 'Bronze (Free)' : therapist?.plan === 'silver' ? 'Silver ($19/mo)' : 'Gold ($49/mo)'}
            </p>
          </div>
        </div>
      </div>
      {(view === 'clients' || view === 'sessions' || view === 'session-detail') && (
        <button onClick={() => { setShowSendModal(true); setSendPhone(''); setSendCopied(false); }} style={{ position: 'fixed', bottom: '32px', right: '32px', background: '#2A5741', color: 'white', border: 'none', borderRadius: '50px', padding: '16px 28px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 8px 24px rgba(42,87,65,0.4)', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 1000 }}>
          📤 Send Intake
        </button>
      )}
      {showSendModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '24px' }} onClick={() => setShowSendModal(false)}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: '700', color: '#1A1A2E', margin: '0 0 4px 0' }}>📤 Send Intake Form</h2>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Client fills it on their phone in 60 seconds</p>
              </div>
              <button onClick={() => setShowSendModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF', padding: '4px' }}>✕</button>
            </div>
            <div style={{ background: '#F5F0E8', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px 0' }}>Your intake link</p>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#2A5741', margin: 0, wordBreak: 'break-all' }}>{window.location.origin}/{therapist?.custom_url}</p>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#1A1A2E', display: 'block', marginBottom: '8px' }}>Client phone number (optional)</label>
              <input type="tel" value={sendPhone} onChange={e => { const d=e.target.value.replace(/\D/g,'').slice(0,10); const f=d.length<=3?d:d.length<=6?`(${d.slice(0,3)}) ${d.slice(3)}`:`(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`; setSendPhone(f); }} placeholder="(512) 555-1234" autoFocus style={{ width: '100%', padding: '12px 16px', border: '2px solid #E8E4DC', borderRadius: '10px', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a href={sendPhone.replace(/\D/g,'').length >= 10 ? 'sms:' + sendPhone.replace(/\D/g,'') + '?body=' + encodeURIComponent('Hi! Please fill out my quick intake form before your session: ' + window.location.origin + '/' + (therapist?.custom_url || '')) : undefined} onClick={e => { if(sendPhone.replace(/\D/g,'').length < 10) e.preventDefault(); else setTimeout(() => setShowSendModal(false), 500); }} style={{ display: 'block', textAlign: 'center', background: sendPhone.replace(/\D/g,'').length >= 10 ? '#2A5741' : '#C8BFB0', color: 'white', padding: '14px', borderRadius: '50px', fontWeight: '700', fontSize: '15px', textDecoration: 'none', cursor: sendPhone.replace(/\D/g,'').length >= 10 ? 'pointer' : 'not-allowed' }}>
                💬 Open in Messages →
              </a>
              <button onClick={() => { navigator.clipboard.writeText(window.location.origin + '/' + (therapist?.custom_url || '')); setSendCopied(true); setTimeout(() => setSendCopied(false), 2000); }} style={{ background: sendCopied ? '#E8F5EE' : '#F5F0E8', border: '1.5px solid ' + (sendCopied ? '#6B9E80' : '#E8E4DC'), color: sendCopied ? '#2A5741' : '#6B7280', padding: '12px', borderRadius: '50px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                {sendCopied ? '✓ Copied!' : '📋 Copy Link Only'}
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', marginTop: '16px', marginBottom: 0 }}>🔒 Only shared with you</p>
          </div>
        </div>
      )}
    </div>
  );
}
