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
import PackagesCard from '../components/PackagesCard';
import MembershipsCard from '../components/MembershipsCard';
import EventsCard from '../components/EventsCard';
import SettingsHero from '../components/SettingsHero';
import SettingsSectionHeader from '../components/SettingsSectionHeader';
import CollapsibleSection from '../components/CollapsibleSection';
import OnboardingChecklist from '../components/OnboardingChecklist';
import Outreach from '../components/Outreach';
import ImportClients from '../components/ImportClients';
import BMLogo from '../components/BMLogo';
import MobileBottomNav from '../components/MobileBottomNav';
import PWAInstallBanner from '../components/PWAInstallBanner';
import { ActivationNudge, LapsedClientAlert, BookingLinkNudge } from '../components/MarketingNudges';
import { useMobile } from '../hooks/useMobile';
import usePushNotifications from '../hooks/usePushNotifications';
import WaiverCard from '../components/WaiverCard';
import NotificationPrefsCard from '../components/NotificationPrefsCard';
import QRCodesCard from '../components/QRCodesCard';

// Mobile page-end indicator
function PageEnd() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'28px 0 12px', opacity:0.25 }}>
      <div style={{ flex:1, height:1, background:'#9CA3AF' }} />
      <div style={{ width:4, height:4, borderRadius:'50%', background:'#9CA3AF' }} />
      <div style={{ flex:1, height:1, background:'#9CA3AF' }} />
    </div>
  );
}

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
  const [bufferEnabled, setBufferEnabled] = React.useState(therapist?.buffer_enabled || false);
  const [bufferMinutes, setBufferMinutes] = React.useState(therapist?.buffer_minutes || 15);
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
    { name:'Couples Massage', duration:90, price:180, is_couples:true },
    { name:'Custom...', duration:60, price:85 },
  ];

  const [draft, setDraft] = React.useState({ preset:'', name:'', duration:60, price:85, is_couples:false });
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
      if (p) setDraft({ preset: val, name: p.name, duration: p.duration, price: p.price, is_couples: p.is_couples || false });
    }
  }

  async function addService() {
    if (!draft.name.trim()) return;
    setSaving('add');
    const { data } = await supabase.from('services').insert({ name: draft.name, duration: draft.duration, price: draft.price, therapist_id: therapist.id, active: true, is_couples: draft.is_couples || false }).select().single();
    setServices(s => [...s, data]);
    setDraft({ preset:'', name:'', duration:60, price:85 });
    setSaving(false);
    // Activation: first service added
    if (therapist?.id) {
      try {
        const { trackActivation } = await import('../lib/activation');
        trackActivation(therapist.id, 'added_service');
      } catch {}
    }
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
    // Activation: set availability for at least one day
    if (therapist?.id) {
      try {
        const { trackActivation } = await import('../lib/activation');
        trackActivation(therapist.id, 'set_availability');
      } catch {}
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
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 8px' }}>Require first-time clients to pay a deposit when booking. Repeat clients are never charged.</p>
        <p style={{ fontSize:'11px', color:C2.gray, background:C2.beige, borderRadius:8, padding:'8px 10px', margin:'0 0 16px', lineHeight:1.5 }}>
          💡 Prefer Square or cash? Keep deposits off, clients pay you directly at the session. MyBodyMap handles scheduling, intake, and reminders regardless.
        </p>
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

      {/* Buffer Time Between Sessions */}
      <div style={{ background:C2.white, border:`1.5px solid ${C2.lightGray}`, borderRadius:14, padding:20 }}>
        <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:C2.gray, margin:'0 0 4px' }}>⏱️ Buffer Time</p>
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 14px', lineHeight:1.5 }}>
          Add time after each session for room turnover, notes, or a break. Clients won't see available slots during this window.
        </p>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
          <button onClick={async () => {
            const newVal = !bufferEnabled;
            setBufferEnabled(newVal);
            await supabase.from('therapists').update({ buffer_enabled: newVal }).eq('id', therapist.id);
          }} style={{ width:40, height:22, borderRadius:11, background:bufferEnabled?C2.forest:'#D1D5DB', border:'none', cursor:'pointer', position:'relative', flexShrink:0, transition:'background 0.2s' }}>
            <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:bufferEnabled?21:3, transition:'left 0.2s' }} />
          </button>
          <span style={{ fontSize:13, fontWeight:600, color:C2.darkGray }}>
            {bufferEnabled ? `Buffer ON, ${bufferMinutes} min after each session` : 'Buffer OFF'}
          </span>
        </div>
        {bufferEnabled && (
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:13, color:C2.gray }}>Block</span>
            <div style={{ display:'flex', alignItems:'center', background:'#F9FAFB', border:`1.5px solid ${C2.lightGray}`, borderRadius:10, padding:'6px 12px', gap:4 }}>
              <input type="number" min="5" max="60" step="5" value={bufferMinutes}
                onChange={e => setBufferMinutes(parseInt(e.target.value)||15)}
                onBlur={async e => {
                  const v = Math.min(60, Math.max(5, parseInt(e.target.value)||15));
                  setBufferMinutes(v);
                  await supabase.from('therapists').update({ buffer_minutes: v }).eq('id', therapist.id);
                }}
                style={{ width:46, border:'none', background:'transparent', fontSize:16, fontWeight:700, color:C2.forest, outline:'none', textAlign:'center' }} />
              <span style={{ fontSize:13, color:C2.gray }}>min</span>
            </div>
            <span style={{ fontSize:13, color:C2.gray }}>after each session</span>
          </div>
        )}
      </div>

      {/* Working Hours - Time Blocks */}
      <div style={{ background:C2.white, border:`1.5px solid ${C2.lightGray}`, borderRadius:14, padding:20 }}>
        <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:C2.gray, margin:'0 0 4px' }}>🕐 Working Hours</p>
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 14px' }}>Toggle days on/off. Add blocks for each working period, e.g. 9–12 and 1–5 for a lunch break.</p>
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

// ─────────────────────────────────────────────────────────────────────────
// ServiceAddonsCard
//
// Settings card where a therapist defines optional extras a client can
// pick at booking — Hot Stones, Aromatherapy, Extended Time, etc.
// Each add-on has a name, price, and optional extra minutes that get
// added to the appointment slot when chosen. Lives in the service_addons
// Supabase table.
//
// Triggered by Leslie Luna's FB question (April 2026): "Is there an
// option for add-ons?" Same shape Vagaro and MassageBook offer.
// ─────────────────────────────────────────────────────────────────────────
function ServiceAddonsCard({ therapist }) {
  const C2 = { sage:'#6B9E80', forest:'#2A5741', beige:'#F0EAD9', gray:'#6B7280', lightGray:'#E8E4DC', white:'#FFFFFF' };
  const [addons, setAddons] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [draft, setDraft] = React.useState({ name:'', price:15, extra_minutes:0 });
  const [saving, setSaving] = React.useState(false);

  const PRESETS = [
    { name:'Hot Stones', price:15, extra_minutes:0 },
    { name:'Aromatherapy', price:10, extra_minutes:0 },
    { name:'CBD Oil', price:15, extra_minutes:0 },
    { name:'Cupping Therapy', price:25, extra_minutes:15 },
    { name:'Extended Time +30 min', price:45, extra_minutes:30 },
    { name:'Hot Towels', price:8, extra_minutes:0 },
    { name:'Custom...', price:15, extra_minutes:0 },
  ];

  React.useEffect(() => {
    if (!therapist?.id) return;
    supabase.from('service_addons').select('*').eq('therapist_id', therapist.id).order('display_order').order('created_at')
      .then(({ data }) => { setAddons(data || []); setLoading(false); });
  }, [therapist?.id]);

  function handlePreset(name) {
    if (name === 'Custom...') { setDraft(d => ({ ...d, name:'' })); return; }
    const p = PRESETS.find(x => x.name === name);
    if (p) setDraft({ name:p.name, price:p.price, extra_minutes:p.extra_minutes });
  }

  async function addAddon() {
    if (!draft.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('service_addons').insert({
      therapist_id: therapist.id,
      name: draft.name.trim(),
      price: Number(draft.price) || 0,
      extra_minutes: Number(draft.extra_minutes) || 0,
      active: true,
    }).select().single();
    setSaving(false);
    if (error) {
      alert('Could not save the add-on. The schema may not be applied yet — run the SQL migration in Supabase.');
      return;
    }
    setAddons(a => [...a, data]);
    setDraft({ name:'', price:15, extra_minutes:0 });
  }

  async function toggleAddon(addon) {
    await supabase.from('service_addons').update({ active: !addon.active }).eq('id', addon.id);
    setAddons(a => a.map(x => x.id === addon.id ? { ...x, active: !x.active } : x));
  }

  async function deleteAddon(id) {
    if (!window.confirm('Remove this add-on? Existing bookings that include it are unaffected.')) return;
    await supabase.from('service_addons').delete().eq('id', id);
    setAddons(a => a.filter(x => x.id !== id));
  }

  return (
    <div style={{ background:C2.white, border:`1.5px solid ${C2.lightGray}`, borderRadius:14, padding:24, marginBottom:20 }}>
      <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:C2.gray, margin:'0 0 6px 0' }}>✨ Service Add-ons</p>
      <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 16px 0', lineHeight:1.5 }}>Optional extras a client can add to any service when booking. Hot Stones, Aromatherapy, Extended Time. Each can change price and optionally extend the appointment.</p>

      {loading ? (
        <p style={{ fontSize:13, color:C2.gray }}>Loading…</p>
      ) : (
        <>
          {addons.length > 0 && (
            <div style={{ marginBottom:16 }}>
              {addons.map(a => (
                <div key={a.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:a.active ? '#FAFAF6' : '#F3F4F6', border:`1px solid ${C2.lightGray}`, borderRadius:10, marginBottom:6, opacity:a.active?1:0.55 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:14, color:C2.forest }}>{a.name}</div>
                    <div style={{ fontSize:12, color:C2.gray }}>+${Number(a.price).toFixed(0)}{a.extra_minutes > 0 ? ` · +${a.extra_minutes} min` : ''}</div>
                  </div>
                  <button onClick={() => toggleAddon(a)} style={{ background:a.active?'#fff':C2.sage, color:a.active?C2.gray:'#fff', border:`1px solid ${C2.lightGray}`, borderRadius:8, padding:'5px 10px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                    {a.active ? 'Hide' : 'Show'}
                  </button>
                  <button onClick={() => deleteAddon(a.id)} style={{ background:'transparent', color:C2.gray, border:'none', fontSize:18, cursor:'pointer', padding:'2px 6px' }} aria-label="Delete">×</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ background:C2.beige, padding:14, borderRadius:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C2.forest, marginBottom:10 }}>Add a new one</div>
            <select onChange={e => handlePreset(e.target.value)} value={PRESETS.find(p => p.name === draft.name)?.name || ''}
              style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:13, marginBottom:8, background:'#fff' }}>
              <option value="">Pick a preset or write your own…</option>
              {PRESETS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <input type="text" value={draft.name} onChange={e => setDraft(d => ({ ...d, name:e.target.value }))}
              placeholder="Add-on name (e.g. Hot Stones)"
              style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:13, marginBottom:8, boxSizing:'border-box' }} />
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C2.gray, fontWeight:600, display:'block', marginBottom:3 }}>Price</label>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ color:C2.gray, fontSize:13 }}>$</span>
                  <input type="number" value={draft.price} onChange={e => setDraft(d => ({ ...d, price:e.target.value }))}
                    min="0" step="1"
                    style={{ flex:1, padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:13, boxSizing:'border-box' }} />
                </div>
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C2.gray, fontWeight:600, display:'block', marginBottom:3 }}>Extra minutes</label>
                <input type="number" value={draft.extra_minutes} onChange={e => setDraft(d => ({ ...d, extra_minutes:e.target.value }))}
                  min="0" step="5"
                  style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:13, boxSizing:'border-box' }} />
              </div>
            </div>
            <button onClick={addAddon} disabled={saving || !draft.name.trim()}
              style={{ width:'100%', background:saving?C2.sage:C2.forest, color:'#fff', border:'none', borderRadius:8, padding:'10px', fontSize:13, fontWeight:700, cursor:draft.name.trim() ? 'pointer' : 'not-allowed', opacity:draft.name.trim()?1:0.5 }}>
              {saving ? 'Saving…' : '+ Add this add-on'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function BookingEmbedPanel({ customUrl }) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  if (!customUrl) return null;
  const bookingUrl = `${window.location.origin}/book/${customUrl}`;
  const embedCode = `<iframe
  src="${bookingUrl}"
  width="100%"
  height="780"
  frameborder="0"
  style="border:0;max-width:560px;display:block;margin:0 auto;"
  title="Book a session"
  loading="lazy"
></iframe>`;
  const onCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#2A5741',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '4px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
        <span style={{ fontSize: 10, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
        Embed on your website
      </button>
      {open && (
        <div style={{ marginTop: 10, background: '#fff', border: '1.5px solid #E8E4DC', borderRadius: 10, padding: 14 }}>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 10px', lineHeight: 1.5 }}>
            Paste this snippet into your website's HTML where you want the booking form to appear. Works on Wix, Squarespace, WordPress, or any site that accepts HTML embeds.
          </p>
          <textarea
            readOnly
            value={embedCode}
            onClick={e => e.target.select()}
            style={{
              width: '100%',
              minHeight: 120,
              padding: 10,
              border: '1.5px solid #E8E4DC',
              borderRadius: 8,
              fontSize: 11,
              fontFamily: 'monospace',
              color: '#1F2937',
              background: '#FAFAF7',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button
              onClick={onCopy}
              style={{
                background: copied ? '#16A34A' : '#2A5741',
                color: '#fff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}>
              {copied ? '✓ Copied' : 'Copy embed code'}
            </button>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                background: '#fff',
                border: '1.5px solid #E8E4DC',
                color: '#6B7280',
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
              }}>
              Test the booking form →
            </a>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>
            <strong style={{ color: '#6B7280' }}>Tip:</strong> On Wix, use <em>Embed HTML</em>. On Squarespace, use <em>Code Block</em>. On WordPress, use the <em>Custom HTML</em> block.
          </div>
        </div>
      )}
    </div>
  );
}

function PushNotificationsCard({ therapist, C2 }) {
  const { supported, permission, subscribed, loading, error, subscribe, unsubscribe, sendTest } = usePushNotifications(therapist?.id);
  const [testStatus, setTestStatus] = React.useState(null);
  const [testSending, setTestSending] = React.useState(false);

  const doTest = async () => {
    setTestSending(true);
    setTestStatus(null);
    const result = await sendTest();
    setTestSending(false);

    // Build a clear diagnostic based on what came back
    if (result.ok && result.data?.sent > 0) {
      setTestStatus({ ok: true, msg: `Test sent to ${result.data.sent} device${result.data.sent > 1 ? 's' : ''}. Check your notifications.` });
    } else if (result.ok && result.data?.sent === 0 && result.data?.reason === 'no subscriptions') {
      setTestStatus({ ok: false, msg: 'No devices subscribed yet. Turn on notifications above first, then try again.' });
    } else if (result.status === 404) {
      setTestStatus({ ok: false, msg: 'send-push edge function not deployed. From your terminal: npx supabase functions deploy send-push --project-ref rmnqfrljoknmellbnpiy' });
    } else if (result.data?.error && /VAPID/i.test(result.data.error)) {
      setTestStatus({ ok: false, msg: 'VAPID secrets missing in Supabase. Add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT under Project Settings -> Edge Functions -> Secrets.' });
    } else if (result.data?.error) {
      setTestStatus({ ok: false, msg: `Edge function error: ${result.data.error}` });
    } else if (result.data?.errors?.length > 0) {
      const e = result.data.errors[0];
      setTestStatus({ ok: false, msg: `Push service rejected (${e.statusCode || '?'}) from ${e.endpoint_host || 'endpoint'}: ${e.message || e.body || 'unknown'}` });
    } else if (result.reason) {
      setTestStatus({ ok: false, msg: result.reason });
    } else {
      setTestStatus({ ok: false, msg: `HTTP ${result.status || '?'}: ${JSON.stringify(result.data).slice(0, 200)}` });
    }
    setTimeout(() => setTestStatus(null), 12000);
  };

  return (
    <div style={{ background: C2.white, border: `1.5px solid ${C2.lightGray}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
      <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.gray, margin: '0 0 6px 0' }}>
        🔔 Push Notifications
      </p>
      <p style={{ fontSize: '12px', color: C2.gray, margin: '0 0 16px 0', lineHeight: 1.5 }}>
        Get a tap on your phone when something matters, a new booking, a client reply, a gift card redemption. Works on your iPhone after you install MyBodyMap to your home screen.
      </p>

      {!supported && (
        <div style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#9A3412', lineHeight: 1.5 }}>
          <strong>Not supported in this browser.</strong><br/>
          On iPhone, open mybodymap.app in Safari, tap Share → Add to Home Screen, then open from the home screen. Notifications will work from there.
        </div>
      )}

      {supported && permission === 'denied' && (
        <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#991B1B', lineHeight: 1.5 }}>
          <strong>Notifications blocked.</strong> Open your device Settings → Notifications → MyBodyMap, and allow notifications.
        </div>
      )}

      {supported && permission !== 'denied' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={subscribed ? unsubscribe : subscribe}
                disabled={loading}
                style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: subscribed ? C2.forest : '#D1D5DB',
                  border: 'none', cursor: loading ? 'wait' : 'pointer',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  opacity: loading ? 0.6 : 1,
                }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3,
                  left: subscribed ? 21 : 3,
                  transition: 'left 0.2s',
                }} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 600, color: subscribed ? C2.forest : C2.gray }}>
                {loading ? 'Working…' : subscribed ? 'Notifications ON' : 'Notifications OFF'}
              </span>
            </div>
          </div>

          {subscribed && (
            <button
              onClick={doTest}
              disabled={testSending}
              style={{
                background: testSending ? C2.sage : C2.beige,
                color: C2.forest,
                border: `1.5px solid ${C2.lightGray}`,
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 12, fontWeight: 700,
                cursor: testSending ? 'wait' : 'pointer',
                marginBottom: testStatus ? 10 : 0,
              }}>
              {testSending ? 'Sending…' : 'Send me a test notification'}
            </button>
          )}

          {testStatus && (
            <div style={{
              background: testStatus.ok ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${testStatus.ok ? '#86EFAC' : '#FECACA'}`,
              color: testStatus.ok ? '#166534' : '#991B1B',
              borderRadius: 8, padding: '8px 12px', fontSize: 12, lineHeight: 1.5,
            }}>
              {testStatus.ok ? '✓ ' : '⚠ '}{testStatus.msg}
            </div>
          )}

          {error && !testStatus && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginTop: 10 }}>
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReferralCard({ therapist, C2 }) {
  const [copied, setCopied] = React.useState(false);
  const [count, setCount] = React.useState(null);
  const referralUrl = therapist?.custom_url
    ? `${window.location.origin}/signup?ref=${therapist.custom_url}`
    : '';

  React.useEffect(() => {
    if (!therapist?.id) return;
    supabase.from('referrals').select('id', { count: 'exact', head: true })
      .eq('referrer_therapist_id', therapist.id)
      .then(({ count }) => setCount(count || 0))
      .catch(() => {});
  }, [therapist?.id]);

  function copy() {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!referralUrl) return null;

  return (
    <div style={{ background: 'linear-gradient(135deg, #F0FDF4, #FFFBEB)', border: '1.5px solid #86EFAC', borderRadius: 14, padding: 24, marginBottom: 20 }}>
      <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.forest, margin: '0 0 6px 0' }}>🌿 Refer a therapist</p>
      <p style={{ fontSize: 14, color: C2.darkGray, lineHeight: 1.6, margin: '0 0 14px 0', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
        Know another therapist who'd love MyBodyMap? Share your link. They get Silver free for a limited time. You get a shoutout and swag.
      </p>
      <div style={{ background: '#fff', border: `1.5px solid ${C2.lightGray}`, borderRadius: 10, padding: '10px 12px', marginBottom: 10, fontSize: 13, color: C2.forest, fontWeight: 700, wordBreak: 'break-all' }}>
        {referralUrl}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={copy} style={{ background: copied ? '#E8F5EE' : C2.forest, color: copied ? C2.forest : '#fff', border: copied ? '1.5px solid #86EFAC' : 'none', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {copied ? '✓ Copied!' : '📋 Copy link'}
        </button>
        {count !== null && count > 0 && (
          <span style={{ fontSize: 12, color: C2.gray }}>{count} {count === 1 ? 'therapist' : 'therapists'} signed up through you</span>
        )}
      </div>
    </div>
  );
}

function SettingsPanel({ therapist, lapsedDays, setLapsedDays }) {
  const { updateProfile } = useAuth();

  // Which row in Settings is currently expanded. null = all collapsed.
  // Mobile-first: collapsed by default to kill the endless vertical scroll.
  const [openRow, setOpenRow] = React.useState(null);
  const toggleRow = React.useCallback((id) => {
    setOpenRow(prev => prev === id ? null : id);
  }, []);

  // Which major SECTION groups are open. Default all open so the page
  // looks identical to before unless user collapses. Tap header to fold.
  const [openSections, setOpenSections] = React.useState({
    practice: true,
    offer: true,
    restEasier: true,
    plugIn: true,
    membership: true,
  });
  const toggleSection = React.useCallback((key) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const [lapsedSaved, setLapsedSaved] = React.useState(false);
  const [fullName, setFullName] = React.useState(therapist?.full_name || '');
  const [businessName, setBusinessName] = React.useState(therapist?.business_name || '');
  const [phone, setPhone] = React.useState(therapist?.phone || '');
  const [phoneError, setPhoneError] = React.useState('');
  const [nameError, setNameError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [photoUrl, setPhotoUrl] = React.useState(therapist?.photo_url || '');
  const [pulseEnabled, setPulseEnabled] = React.useState(therapist?.practice_pulse_enabled !== false);
  const [pulseEmail, setPulseEmail] = React.useState(therapist?.practice_pulse_email || '');
  const [pulseEmailSaved, setPulseEmailSaved] = React.useState(false);
  const [pulseSending, setPulseSending] = React.useState(false);
  const [pulseSent, setPulseSent] = React.useState(false);

  // AI features master switch. Defaults TRUE so existing therapists are
  // unchanged. Flipping to false hides MyBodyMap AI chat tab, pre-session
  // brief buttons, and Practice Pulse from the dashboard. Data is preserved
  // -- flipping back to true restores all surfaces.
  const [aiEnabled, setAiEnabled] = React.useState(therapist?.ai_enabled !== false);

  async function togglePulse() {
    const newVal = !pulseEnabled;
    setPulseEnabled(newVal);
    await supabase.from('therapists').update({ practice_pulse_enabled: newVal }).eq('id', therapist.id);
  }

  async function toggleAi() {
    const newVal = !aiEnabled;
    setAiEnabled(newVal);
    await supabase.from('therapists').update({ ai_enabled: newVal }).eq('id', therapist.id);
    // Hard reload so all dashboard surfaces re-fetch the therapist row and
    // re-render with AI tabs/buttons hidden or shown. Cheaper than threading
    // a context update through every component that reads therapist.ai_enabled.
    setTimeout(() => window.location.reload(), 400);
  }

  async function savePulseEmail() {
    await supabase.from('therapists').update({ practice_pulse_email: pulseEmail || null }).eq('id', therapist.id);
    setPulseEmailSaved(true);
    setTimeout(() => setPulseEmailSaved(false), 2000);
  }

  async function sendTestPulse() {
    setPulseSending(true);
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
    await fetch(`${supabaseUrl}/functions/v1/practice-pulse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
      body: JSON.stringify({ therapist_id: therapist.id }),
    });
    setPulseSending(false);
    setPulseSent(true);
    setTimeout(() => setPulseSent(false), 3000);
  }
  const [photoUploading, setPhotoUploading] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [newBookingUrl, setNewBookingUrl] = React.useState(null);
  const [calKey, setCalKey] = React.useState(therapist?.cal_api_key || '');

  // Blocked days
  const [blockedDays, setBlockedDays] = React.useState([]);
  const [blockDate, setBlockDate] = React.useState('');
  const [blockNote, setBlockNote] = React.useState('');
  const [blockSaving, setBlockSaving] = React.useState(false);

  React.useEffect(() => {
    if (!therapist?.id) return;
    supabase.from('blocked_days').select('*').eq('therapist_id', therapist.id)
      .gte('date', new Date().toISOString().slice(0,10))
      .order('date').then(({ data }) => setBlockedDays(data || []));
  }, [therapist?.id]);

  async function addBlockedDay() {
    if (!blockDate) return;
    setBlockSaving(true);
    const { data } = await supabase.from('blocked_days').insert({
      therapist_id: therapist.id, date: blockDate, note: blockNote.trim() || null
    }).select().single();
    if (data) setBlockedDays(prev => [...prev, data].sort((a,b) => a.date.localeCompare(b.date)));
    setBlockDate(''); setBlockNote(''); setBlockSaving(false);
  }

  async function removeBlockedDay(id) {
    await supabase.from('blocked_days').delete().eq('id', id);
    setBlockedDays(prev => prev.filter(d => d.id !== id));
  }
  const [calSaved, setCalSaved] = React.useState(false);
  const [twilioSid, setTwilioSid] = React.useState(therapist?.twilio_account_sid || '');
  const [twilioToken, setTwilioToken] = React.useState('');
  const [twilioPhone, setTwilioPhone] = React.useState(therapist?.twilio_phone_number || '');
  const [twilioSaved, setTwilioSaved] = React.useState(false);
  const [showCalKey, setShowCalKey] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const [pwCurrent, setPwCurrent] = React.useState('');
  const [pwNew, setPwNew] = React.useState('');
  const [pwConfirm, setPwConfirm] = React.useState('');
  const [pwSaving, setPwSaving] = React.useState(false);
  const [pwMsg, setPwMsg] = React.useState(null); // { type: 'ok'|'err', text }

  async function changePassword() {
    setPwMsg(null);
    if (!pwNew || pwNew.length < 8) { setPwMsg({ type:'err', text:'New password must be at least 8 characters.' }); return; }
    if (pwNew !== pwConfirm) { setPwMsg({ type:'err', text:'New passwords do not match.' }); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    setPwSaving(false);
    if (error) { setPwMsg({ type:'err', text: error.message }); }
    else { setPwMsg({ type:'ok', text:'Password updated.' }); setPwCurrent(''); setPwNew(''); setPwConfirm(''); }
    setTimeout(() => setPwMsg(null), 4000);
  }

  const intakeUrl = `${window.location.origin}/${therapist?.custom_url}`;
  const bookingUrl = `${window.location.origin}/book/${therapist?.custom_url}`;

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
    if (therapist?.id) {
      import('../lib/activation').then(({ trackActivation }) => {
        trackActivation(therapist.id, 'shared_booking_link');
      }).catch(() => {});
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <SettingsHero therapist={therapist} />

      <SettingsSectionHeader
        title="How I practice"
        sub="The bones of your practice — who you are, when you work, what you offer."
        sprigType="leaf"
        isOpen={openSections.practice}
        onToggle={() => toggleSection('practice')}
      />

      {openSections.practice && (<>
      {/* Import Clients — critical first feature for new therapists migrating
          from Vagaro / MassageBook / Square. Sits at the top of How I practice
          because it's the most important first action: you can't practice
          well without your client list. */}
      <CollapsibleSection
        id="import"
        label="Import existing clients"
        summary="Bring your list from CSV — Vagaro, MassageBook, Square"
        status="todo"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v10"/><path d="M8 8l4-4 4 4"/><rect x="4" y="14" width="16" height="6" rx="1"/></svg>}
        isOpen={openRow === 'import'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><ImportClients therapist={therapist} onComplete={() => {}} /></div></CollapsibleSection>

      {/* Intake Link */}
      <CollapsibleSection
        id="intake"
        label="Client intake link"
        summary={intakeUrl}
        status="done"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M9 15a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M15 9a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/></svg>}
        isOpen={openRow === 'intake'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
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
      </div></CollapsibleSection>

      {/* QR Codes: Intake, Booking, Custom */}
      <CollapsibleSection
        id="qrcodes"
        label="QR codes"
        summary="3 codes ready to print or share"
        status="done"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"/></svg>}
        isOpen={openRow === 'qrcodes'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><QRCodesCard intakeUrl={intakeUrl} bookingUrl={bookingUrl} businessName={therapist?.business_name || therapist?.full_name} C2={C2} /></div></CollapsibleSection>

      {/* Profile Edit */}
      <CollapsibleSection
        id="profile"
        label="Your info"
        summary={`${therapist?.full_name || 'Add your name'}${therapist?.phone ? ' · ' + therapist.phone : ''}`}
        status={therapist?.full_name && therapist?.phone ? 'done' : 'todo'}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="12" cy="9" r="3.5"/><path d="M5 19c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>}
        isOpen={openRow === 'profile'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
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

                // If business name changed, regenerate the booking-link slug
                // (custom_url) to match. Falls back to full_name if business
                // name is empty. Slugify: lowercase, strip non-alphanumeric,
                // truncate to 30. If the resulting slug is taken by another
                // therapist, append -2, -3, etc. until unique.
                const updates = { full_name: fullName, business_name: businessName, phone: phone };
                let newSlug = null;
                const businessOrName = (businessName || fullName).trim();
                if (businessOrName) {
                  const baseSlug = businessOrName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30);
                  // Only regenerate if the user's CURRENT slug looks auto-generated
                  // from their old name (i.e. doesn't match the new base AND
                  // isn't a custom hand-picked slug they care about).
                  if (baseSlug && baseSlug !== therapist?.custom_url) {
                    let candidate = baseSlug;
                    let attempt = 1;
                    while (attempt < 20) {
                      const { data: clash } = await supabase.from('therapists')
                        .select('id').eq('custom_url', candidate).neq('id', therapist.id).maybeSingle();
                      if (!clash) break;
                      attempt += 1;
                      candidate = baseSlug + '-' + attempt;
                    }
                    newSlug = candidate;
                    updates.custom_url = newSlug;
                  }
                }

                await supabase.from('therapists').update(updates).eq('id', therapist.id);
                if (newSlug) {
                  setNewBookingUrl(`${window.location.origin}/book/${newSlug}`);
                }
                setSaved(true); setTimeout(() => { setSaved(false); setNewBookingUrl(null); }, 6000);
                // Refresh page state so the rest of the dashboard sees the new slug
                if (newSlug) {
                  setTimeout(() => window.location.reload(), 1500);
                }
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
        {newBookingUrl && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#16A34A', margin: '0 0 4px' }}>Booking link updated</p>
            <p style={{ fontSize: 13, color: C2.darkGray, margin: 0, fontFamily: 'monospace', wordBreak: 'break-all' }}>{newBookingUrl}</p>
            <p style={{ fontSize: 11, color: C2.gray, margin: '6px 0 0', lineHeight: 1.4 }}>
              Old links you've shared will stop working. Update your social profiles, business cards, and email signatures with this new link. Reloading dashboard…
            </p>
          </div>
        )}
      </div></CollapsibleSection>


      {/* Lapsed Threshold */}
      <CollapsibleSection
        id="lapsed"
        label="Lapsed client threshold"
        summary={`${lapsedDays} days · clients flagged after this`}
        status="done"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M12 4v8l5 3"/><circle cx="12" cy="12" r="9"/></svg>}
        isOpen={openRow === 'lapsed'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <input type="number" min="1" max="365" value={lapsedDays}
            onChange={e => { const v=parseInt(e.target.value); if(!isNaN(v)) setLapsedDays(v); }}
            onBlur={e => { const v=parseInt(e.target.value); const c=Math.max(1,Math.min(365,isNaN(v)?60:v)); setLapsedDays(c); localStorage.setItem('bm_lapsed_days',c); setLapsedSaved(true); setTimeout(()=>setLapsedSaved(false),2000); }}
            style={{ width:'70px', padding:'8px 12px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:'17px', fontWeight:'700', color:C2.forest, background:C2.beige, textAlign:'center' }} />
          <p style={{ fontSize:'13px', color:C2.darkGray, margin:0 }}>days since last session before a client is flagged as lapsed</p>
          {lapsedSaved && <p style={{ fontSize:'12px', color:C2.forest, fontWeight:'600', margin:0 }}>✓ Saved</p>}
        </div>
      </div></CollapsibleSection>

      {/* Cal.com sync */}
      <CollapsibleSection
        id="cal"
        label="Cal.com sync"
        summary={(therapist?.cal_connected || therapist?.cal_api_key) ? "Connected · syncing automatically" : "Optional · two-way calendar"}
        status={(therapist?.cal_connected || therapist?.cal_api_key) ? "done" : "todo"}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M4 10h16M8 4v4M16 4v4"/></svg>}
        isOpen={openRow === 'cal'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
          <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 14px 0', lineHeight:1.5 }}>Already using Cal.com for scheduling? Connect it here to sync bookings automatically. If you're using MyBodyMap's built-in booking, you don't need this.</p>
          {(therapist?.cal_connected || therapist?.cal_api_key) ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'10px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span>✅</span>
                <div>
                  <div style={{ fontSize:'12px', fontWeight:'700', color:'#2A5741' }}>Cal.com Connected</div>
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
                <strong>Cal.com users only:</strong> Find your API key at cal.com → Settings → Developer → API Keys
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
      </div></CollapsibleSection>

        {/* Payments (Stripe / Square) */}
        <CollapsibleSection
          id="payments"
          label="Payments"
          summary={therapist?.stripe_account_connected ? "Stripe connected · cards on file" : "Connect Stripe or Square"}
          status={therapist?.stripe_account_connected ? "done" : "attn"}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 11h18M7 15h3"/></svg>}
          isOpen={openRow === 'payments'}
          onToggle={toggleRow}
        ><div style={{ padding: '4px 4px' }}>
          <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 14px 0', lineHeight:1.5 }}>Connect Stripe or Square to save cards on file and charge clients directly from the Clients tab.</p>

          {/* Stripe */}
          {therapist?.stripe_account_connected ? (
            <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'10px 14px', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span>✅</span>
                  <div>
                    <div style={{ fontSize:'12px', fontWeight:'700', color:'#2A5741' }}>Stripe Connected</div>
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
            }} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#635BFF', color:'#fff', border:'none', borderRadius:10, padding:'12px 16px', fontSize:'13px', fontWeight:'600', cursor:'pointer', width:'100%', marginBottom:10 }}>
              💳 Connect Stripe
            </button>
          )}

          {/* Square */}
          {therapist?.square_connected ? (
            <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'10px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span>✅</span>
                  <div>
                    <div style={{ fontSize:'12px', fontWeight:'700', color:'#2A5741' }}>Square Connected</div>
                    <div style={{ fontSize:'11px', color:'#6B7280' }}>Card on file ready for your clients</div>
                  </div>
                </div>
                <button onClick={async () => {
                  if (!window.confirm('Disconnect Square?')) return;
                  await updateProfile({ square_access_token: null, square_merchant_id: null, square_location_id: null, square_connected: false });
                }} style={{ background:'transparent', border:'1px solid #EF4444', color:'#EF4444', borderRadius:8, padding:'5px 12px', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <button onClick={async () => {
              const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
              const res = await fetch('https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/square-oauth', {
                method:'POST',
                headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${anonKey}`, 'apikey': anonKey },
                body: JSON.stringify({ therapist_id: therapist.id }),
              });
              const data = await res.json();
              if (data.url) {
                const popup = window.open(data.url, 'square-oauth', 'width=600,height=700');
                window.addEventListener('message', async (e) => {
                  if (e.data?.type === 'square-oauth-success') {
                    popup?.close();
                    const { data: t } = await supabase.from('therapists').select('*').eq('id', therapist.id).single();
                    if (t) await updateProfile(t);
                    window.location.reload();
                  }
                }, { once: true });
              } else alert('Error: ' + JSON.stringify(data));
            }} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#000', color:'#fff', border:'none', borderRadius:10, padding:'12px 16px', fontSize:'13px', fontWeight:'600', cursor:'pointer', width:'100%' }}>
              ⬛ Connect Square
            </button>
          )}
        </div></CollapsibleSection>

      {/* Booking Link */}
      <CollapsibleSection
        id="booking"
        label="Booking page"
        summary={therapist?.custom_url ? `mybodymap.app/book/${therapist.custom_url}` : "Set your URL above"}
        status={therapist?.custom_url ? "done" : "todo"}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M9 15a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M15 9a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/></svg>}
        isOpen={openRow === 'booking'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 12px', lineHeight:1.5 }}>Share this link so clients can book directly with you - no back-and-forth needed.</p>
        <div className="bm-settings-btn-row" style={{ display:'flex', gap:8, alignItems:'center' }}>
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

        {/* Embed on your website */}
        <BookingEmbedPanel customUrl={therapist?.custom_url} />
      </div></CollapsibleSection>

      {/* Services + Availability */}
      <CollapsibleSection
        id="services"
        label="Services & hours"
        summary="Your menu, weekly hours, deposits, buffer"
        status="done"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M5 9c2 4 5 4 7 4s5 0 7-4"/><path d="M5 13c2 4 5 4 7 4s5 0 7-4"/><path d="M12 4v3"/></svg>}
        isOpen={openRow === 'services'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><ServicesAndAvailability therapist={therapist} /></div></CollapsibleSection>

      {/* SMS / Twilio */}
      <CollapsibleSection
        id="twilio"
        label="Custom SMS sender (Twilio)"
        summary={therapist?.twilio_phone_number ? `Connected · ${therapist.twilio_phone_number}` : "Optional · advanced"}
        status={therapist?.twilio_phone_number ? "done" : "todo"}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M5 5h14v11H10l-3 3v-3H5z"/></svg>}
        isOpen={openRow === 'twilio'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 6px 0', lineHeight:1.5 }}>Send text messages to lapsed or due clients from a dedicated practice number. Your clients see a local number, not your personal phone.</p>
        <div style={{ background:C2.beige, borderRadius:8, padding:'10px 12px', marginBottom:14, fontSize:12, color:C2.gray, lineHeight:1.6 }}>
          <strong>Setup takes about 10 minutes:</strong><br/>
          1. Go to <a href="https://twilio.com" target="_blank" rel="noreferrer" style={{ color:C2.forest }}>twilio.com</a> → create a free account ($15 trial credit included)<br/>
          2. Get a phone number, pick your local area code<br/>
          3. Go to Console → Account Info → copy your Account SID, Auth Token, and phone number<br/>
          4. Paste them below and save
        </div>
        {therapist?.twilio_phone_number ? (
          <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'#2A5741' }}>✅ SMS Connected</div>
              <div style={{ fontSize:11, color:C2.gray }}>Sending from {therapist.twilio_phone_number}</div>
            </div>
            <button onClick={async () => {
              await supabase.from('therapists').update({ twilio_account_sid:null, twilio_auth_token:null, twilio_phone_number:null }).eq('id', therapist.id);
              window.location.reload();
            }} style={{ background:'transparent', border:'1px solid #DC2626', color:'#DC2626', borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
              Disconnect
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <input type="text" value={twilioSid} onChange={e => setTwilioSid(e.target.value)} placeholder="Account SID (ACxxxxxxxxxxxxxxx)"
              style={{ padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:12, fontFamily:'monospace', outline:'none' }} />
            <input type="password" value={twilioToken} onChange={e => setTwilioToken(e.target.value)} placeholder="Auth Token"
              style={{ padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:12, fontFamily:'monospace', outline:'none' }} />
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <input type="text" value={twilioPhone} onChange={e => setTwilioPhone(e.target.value)} placeholder="+15551234567"
                style={{ flex:1, minWidth:120, padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:12, fontFamily:'monospace', outline:'none' }} />
              <button onClick={async () => {
                if (!twilioSid || !twilioToken || !twilioPhone) return;
                await supabase.from('therapists').update({ twilio_account_sid: twilioSid, twilio_auth_token: twilioToken, twilio_phone_number: twilioPhone }).eq('id', therapist.id);
                setTwilioSaved(true); setTimeout(() => { setTwilioSaved(false); window.location.reload(); }, 1500);
              }} style={{ background:C2.sage, color:'#fff', border:'none', padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                {twilioSaved ? '✓ Saved!' : 'Save & Connect'}
              </button>
            </div>
          </div>
        )}
      </div></CollapsibleSection>

      {/* AI Features master switch */}
      <CollapsibleSection
        id="ai"
        label="AI features"
        summary={aiEnabled ? 'On · chat, briefs, patterns' : 'Off · all AI hidden'}
        status={aiEnabled ? 'done' : 'todo'}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M12 5c4 4 5 7 5 10a5 5 0 0 1-10 0c0-3 1-6 5-10z"/></svg>}
        isOpen={openRow === 'ai'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 16px 0', lineHeight:1.5 }}>MyBodyMap AI chat, pre-session briefs, and the Practice Pulse digest. Turn off if you prefer a fully manual workflow. Your data is unchanged either way.</p>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={toggleAi}
              style={{ width:40, height:22, borderRadius:11, background:aiEnabled?C2.forest:'#D1D5DB', border:'none', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
              <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:aiEnabled?21:3, transition:'left 0.2s' }} />
            </button>
            <span style={{ fontSize:13, fontWeight:600, color:aiEnabled?C2.forest:C2.gray }}>{aiEnabled ? 'AI features ON' : 'AI features OFF'}</span>
          </div>
        </div>
        {!aiEnabled && (
          <p style={{ fontSize:11, color:C2.gray, margin:'12px 0 0', fontStyle:'italic' }}>The MyBodyMap AI tab and pre-session brief buttons are hidden. Booking, intake, SOAP notes, billing, reminders, and schedule all stay on.</p>
        )}
      </div></CollapsibleSection>
      </>)}

      <SettingsSectionHeader
        title="What I offer"
        sub="Your menu — extras, bundles, and ways for clients to come back."
        sprigType="dots"
        isOpen={openSections.offer}
        onToggle={() => toggleSection('offer')}
      />

      {openSections.offer && (<>
      {/* Service Add-ons */}
      <CollapsibleSection
        id="addons"
        label="Add-ons"
        summary="Hot stones, aromatherapy, hot towels…"
        status="todo"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="9" cy="9" r="3"/><circle cx="15" cy="15" r="3"/><path d="M9 12v3M15 12V9"/></svg>}
        isOpen={openRow === 'addons'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><ServiceAddonsCard therapist={therapist} /></div></CollapsibleSection>

      {/* Packages — multi-session bundles */}
      <CollapsibleSection
        id="packages"
        label="Packages"
        summary="Multi-session bundles"
        status="todo"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="4" y="8" width="16" height="12" rx="1"/><path d="M4 12h16M12 8v12"/></svg>}
        isOpen={openRow === 'packages'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><PackagesCard therapist={therapist} /></div></CollapsibleSection>

      {/* Memberships — recurring monthly tiers */}
      <CollapsibleSection
        id="memberships"
        label="Memberships"
        summary="Recurring monthly plans"
        status="todo"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 6v6l4 2"/></svg>}
        isOpen={openRow === 'memberships'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><MembershipsCard therapist={therapist} /></div></CollapsibleSection>

      {/* Classes & Events — group sessions */}
      <CollapsibleSection
        id="events"
        label="Classes & events"
        summary="Workshops, group sessions"
        status="todo"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="9" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M4 19c0-2.5 2.2-4.5 5-4.5"/></svg>}
        isOpen={openRow === 'events'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><EventsCard therapist={therapist} /></div></CollapsibleSection>
      </>)}

      <SettingsSectionHeader
        title="How I rest easier"
        sub="Quiet help — automations, reminders, and AI working in the background."
        sprigType="moon"
        isOpen={openSections.restEasier}
        onToggle={() => toggleSection('restEasier')}
      />

      {openSections.restEasier && (<>

      {/* Practice Pulse — only shown when AI is enabled, since the digest is AI-generated */}
      {aiEnabled && (
      <CollapsibleSection
        id="pulse"
        label="Practice Pulse"
        summary={pulseEnabled ? "Daily 6 PM digest · email" : "Off"}
        status={pulseEnabled ? "done" : "todo"}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M12 5c4 4 5 7 5 10a5 5 0 0 1-10 0c0-3 1-6 5-10z"/></svg>}
        isOpen={openRow === 'pulse'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 16px 0', lineHeight:1.5 }}>A short daily email sent to you each evening, sessions today, who's coming tomorrow, who's overdue, and who just went quiet. Opens in 10 seconds.</p>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={togglePulse}
              style={{ width:40, height:22, borderRadius:11, background:pulseEnabled?C2.forest:'#D1D5DB', border:'none', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
              <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:pulseEnabled?21:3, transition:'left 0.2s' }} />
            </button>
            <span style={{ fontSize:13, fontWeight:600, color:pulseEnabled?C2.forest:C2.gray }}>{pulseEnabled ? 'Daily Pulse ON, sent at 6pm' : 'Daily Pulse OFF'}</span>
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:700, color:C2.gray, display:'block', marginBottom:6 }}>Also send to (optional)</label>
          <div style={{ display:'flex', gap:8 }}>
            <input type="email" value={pulseEmail} onChange={e => setPulseEmail(e.target.value)}
              placeholder="e.g. bodymap01@gmail.com"
              style={{ flex:1, padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:14, outline:'none', background:'#fff' }} />
            <button onClick={savePulseEmail}
              style={{ background:C2.sage, color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              {pulseEmailSaved ? '✓ Saved' : 'Save'}
            </button>
          </div>
          <p style={{ fontSize:11, color:C2.gray, margin:'6px 0 0' }}>The Pulse always goes to your account email. Add a second address here if you check another inbox more often.</p>
        </div>
        <button onClick={sendTestPulse} disabled={pulseSending}
          style={{ background:pulseSending?C2.sage:C2.beige, color:C2.forest, border:`1.5px solid ${C2.lightGray}`, borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
          {pulseSending ? 'Sending…' : pulseSent ? '✓ Sent! Check your email' : 'Send me a test Pulse now'}
        </button>
      </div></CollapsibleSection>
      )}

      {/* Push Notifications */}
      <CollapsibleSection
        id="push"
        label="Push notifications"
        summary="On-device alerts for new bookings"
        status="todo"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M6 9a6 6 0 0 1 12 0v6l2 2H4l2-2V9z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>}
        isOpen={openRow === 'push'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><PushNotificationsCard therapist={therapist} C2={C2} /></div></CollapsibleSection>

      {/* Referral */}
      <CollapsibleSection
        id="referral"
        label="Referrals"
        summary={therapist?.referral_code ? `Code ${therapist.referral_code}` : "Earn from word-of-mouth"}
        status={therapist?.referral_code ? "done" : "todo"}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8 8l3 8M16 8l-3 8"/></svg>}
        isOpen={openRow === 'referral'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><ReferralCard therapist={therapist} C2={C2} /></div></CollapsibleSection>

      {/* Waiver */}
      <CollapsibleSection
        id="waiver"
        label="Waiver text"
        summary={therapist?.waiver_text ? "Custom waiver" : "Standard release · edit to customize"}
        status="done"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v4h4M9 12h7M9 16h5"/></svg>}
        isOpen={openRow === 'waiver'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><WaiverCard therapist={therapist} C2={C2} /></div></CollapsibleSection>

      {/* Notifications */}
      <CollapsibleSection
        id="notifs"
        label="Notification preferences"
        summary="Email alerts for events"
        status="done"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M5 5h14v10H7l-2 4z"/></svg>}
        isOpen={openRow === 'notifs'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><NotificationPrefsCard therapist={therapist} C2={C2} /></div></CollapsibleSection>

      {/* Block Days Off */}
      <CollapsibleSection
        id="timeoff"
        label="Time off"
        summary={blockedDays.length === 0 ? "None scheduled" : `${blockedDays.length} day${blockedDays.length === 1 ? '' : 's'} blocked`}
        status={blockedDays.length > 0 ? "done" : "todo"}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M4 10h16M9 4v4M15 4v4"/></svg>}
        isOpen={openRow === 'timeoff'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 16px 0', lineHeight:1.5 }}>Block entire days for vacations, personal days, or events. Clients cannot book on these dates.</p>
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          <input type="date" value={blockDate} onChange={e => setBlockDate(e.target.value)}
            min={new Date().toISOString().slice(0,10)}
            style={{ padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:13, outline:'none', flex:'1', minWidth:140 }} />
          <input type="text" value={blockNote} onChange={e => setBlockNote(e.target.value)}
            placeholder="Reason (optional)"
            style={{ padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:13, outline:'none', flex:'2', minWidth:160 }} />
          <button onClick={addBlockedDay} disabled={!blockDate || blockSaving}
            style={{ background:blockDate ? C2.forest : '#D1D5DB', color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, fontSize:13, fontWeight:700, cursor:blockDate ? 'pointer' : 'not-allowed', whiteSpace:'nowrap' }}>
            {blockSaving ? '...' : '+ Block Day'}
          </button>
        </div>
        {blockedDays.length === 0
          ? <div style={{ fontSize:12, color:C2.gray, fontStyle:'italic' }}>No days blocked. Clients can book any available date up to a year out.</div>
          : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {blockedDays.map(d => (
                <div key={d.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:C2.beige, borderRadius:8, padding:'8px 12px' }}>
                  <div>
                    <span style={{ fontSize:13, fontWeight:700, color:C2.darkGray }}>
                      {new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' })}
                    </span>
                    {d.note && <span style={{ fontSize:12, color:C2.gray, marginLeft:8 }}>,  {d.note}</span>}
                  </div>
                  <button onClick={() => removeBlockedDay(d.id)}
                    style={{ background:'#FEE2E2', color:'#DC2626', border:'none', borderRadius:6, padding:'4px 10px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
        }
      </div></CollapsibleSection>
      </>)}

      <SettingsSectionHeader
        title="My membership"
        sub="Your password and your plan with us."
        sprigType="sun"
        isOpen={openSections.membership}
        onToggle={() => toggleSection('membership')}
      />

      {openSections.membership && (<>
      {/* Change Password */}
      <CollapsibleSection
        id="password"
        label="Change password"
        summary="Set a new password"
        status="done"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>}
        isOpen={openRow === 'password'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:10, maxWidth:360 }}>
          <input
            type="password" value={pwNew} onChange={e => setPwNew(e.target.value)}
            placeholder="New password (min 8 characters)"
            style={{ padding:'9px 12px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:14, outline:'none' }}
          />
          <input
            type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
            placeholder="Confirm new password"
            style={{ padding:'9px 12px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:14, outline:'none' }}
          />
          <button onClick={changePassword} disabled={pwSaving}
            style={{ background:C2.forest, color:'#fff', border:'none', padding:'10px 20px', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', alignSelf:'flex-start', opacity:pwSaving?0.6:1 }}>
            {pwSaving ? 'Updating...' : 'Update Password'}
          </button>
          {pwMsg && (
            <div style={{ fontSize:13, fontWeight:600, color: pwMsg.type==='ok' ? '#16A34A' : '#DC2626', marginTop:4 }}>
              {pwMsg.type==='ok' ? '✓ ' : '⚠ '}{pwMsg.text}
            </div>
          )}
        </div>
      </div></CollapsibleSection>

      {/* Plan */}
      <CollapsibleSection
        id="plan"
        label="Your plan"
        summary={(!therapist?.plan || therapist?.plan === 'free') ? 'Bronze · Free' : therapist?.plan === 'silver' ? 'Silver · $19/mo' : 'Gold · $49/mo'}
        status="done"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 11h18M7 15h3"/></svg>}
        isOpen={openRow === 'plan'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
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
      </div></CollapsibleSection>
      </>)}
    </div>
  );
}

export default function Dashboard({ view }) {
  const { therapist, signOut } = useAuth();
  const navigate = useNavigate();
  const { clientId, sessionId } = useParams();
  const isMobile = useMobile();
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
      const { data: services } = await supabase.from('services').select('id').eq('therapist_id', therapist.id).eq('active', true);
      const { data: availability } = await supabase.from('availability').select('id,active').eq('therapist_id', therapist.id);
      // Lapsed clients for nudge
      const lapsedMs = (lapsedDays || 60) * 24 * 60 * 60 * 1000;
      const lapsedClients = (clients || []).filter(c => c.last_session_date && (Date.now() - new Date(c.last_session_date).getTime()) >= lapsedMs);
      setStats({ clients: clients?.length || 0, sessions: sessions?.length || 0, services: services || [], availability: availability || [], lapsedClients });
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
      <header style={{ background: C.white, borderBottom: `1px solid ${C.lightGray}`, padding: isMobile ? '10px 14px' : '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <BMLogo size={isMobile ? 26 : 30} variant="dark" showWordmark={false} />
          <div>
            <h1 style={{ fontSize: isMobile ? '15px' : '16px', fontWeight: '700', color: C.forest, margin: 0, lineHeight: 1.1 }}>MyBodyMap</h1>
            <p style={{ fontSize: '10px', color: C.gray, margin: 0 }}>{therapist?.business_name || 'Dashboard'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', fontWeight: '700', color: C.forest, background: '#F0FDF4', border: '1px solid #86EFAC', padding: '3px 8px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
            🌿 Silver · Free
          </span>
          {isMobile ? (
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              style={{
                background: C.white,
                border: `1px solid ${C.lightGray}`,
                color: C.gray,
                padding: '6px 8px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          ) : (
            <button onClick={handleLogout} style={{ background: C.white, border: `1px solid ${C.lightGray}`, color: C.gray, padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
              Sign Out
            </button>
          )}
        </div>
      </header>

      {showBookmarkNudge && !isMobile && (
        <div style={{ background: '#2A5741', color: 'white', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📲</span>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Add MyBodyMap to your home screen for instant access, use Share → Add to Home Screen</p>
          </div>
          <button onClick={() => setShowBookmarkNudge(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>Got it ✓</button>
        </div>
      )}

      {/* Desktop tab nav, hidden on mobile */}
      {!isMobile && (
        <div className="bm-dash-pad" style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px 0' }}>
          <div style={{ background: C.white, borderRadius: '12px', padding: '6px', marginBottom: '24px', display: 'flex', gap: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto', scrollbarWidth: 'none' }}>
            <button onClick={() => navigate('/dashboard')} style={{ flexShrink:0, background: (view === 'clients' || view === 'sessions' || view === 'session-detail') ? C.sage : 'transparent', color: (view === 'clients' || view === 'sessions' || view === 'session-detail') ? C.white : C.gray, border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Clients</button>
            <button onClick={() => navigate('/dashboard/schedule')} style={{ background: view === 'schedule' ? C.sage : 'transparent', color: view === 'schedule' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', flexShrink: 0 }}>Schedule</button>
            <button onClick={() => navigate('/dashboard/billing')} style={{ background: view === 'billing' ? C.sage : 'transparent', color: view === 'billing' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', flexShrink: 0 }}>Billing</button>
            {therapist?.ai_enabled !== false && (
              <button onClick={() => navigate('/dashboard/ai')} style={{ background: view === 'ai' ? C.sage : 'transparent', color: view === 'ai' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', flexShrink: 0 }}>AI</button>
            )}
            <button onClick={() => navigate('/dashboard/outreach')} style={{ background: view === 'outreach' ? C.sage : 'transparent', color: view === 'outreach' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', flexShrink: 0 }}>Outreach</button>
            <button onClick={() => navigate('/dashboard/gifts')} style={{ background: view === 'gifts' ? C.sage : 'transparent', color: view === 'gifts' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', flexShrink: 0 }}>Gifts</button>
            <button onClick={() => navigate('/dashboard/settings')} style={{ background: view === 'settings' ? C.sage : 'transparent', color: view === 'settings' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', flexShrink: 0 }}>Settings</button>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="bm-dash-pad" style={{
        maxWidth: isMobile ? '100%' : '1200px',
        margin: '0 auto',
        padding: isMobile ? '12px 12px 90px' : '0 16px 32px',
      }}>
        <div style={{
          background: C.white,
          borderRadius: isMobile ? '16px' : '12px',
          padding: isMobile ? '16px' : '32px',
          minHeight: '400px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          {view === 'clients' && (
            <>
              <OnboardingChecklist
                therapist={therapist}
                services={stats?.services || []}
                availability={stats?.availability || []}
                sessions={stats?.sessions || 0}
                clients={stats?.clients || 0}
                onNavigate={(v) => navigate(`/dashboard/${v}`)}
              />
              <ActivationNudge sessions={stats?.sessions || 0} />
              <LapsedClientAlert
                clients={stats?.lapsedClients || []}
                onNavigate={(v) => navigate(`/dashboard/${v}`)}
              />
              <BookingLinkNudge
                therapist={therapist}
                bookings={stats?.sessions || 0}
              />
              <ClientList
                therapistId={therapist?.id}
                onSelectClient={(c) => navigate(`/dashboard/clients/${c.id}`)}
                lapsedDays={lapsedDays}
                customUrl={therapist?.custom_url || ''}
              />
            </>
          )}
          {view === 'sessions' && client && (
            <SessionList
              client={client}
              therapist={therapist}
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
            <><ScheduleDashboard therapist={therapist} />{isMobile && <PageEnd />}</>
          )}
          {view === 'billing' && (
            <><BillingDashboard therapist={therapist} />{isMobile && <PageEnd />}</>
          )}
          {view === 'ai' && therapist && therapist.ai_enabled !== false && (
            <><AIDashboard therapist={therapist} />{isMobile && <PageEnd />}</>
          )}
          {view === 'ai' && therapist && therapist.ai_enabled === false && (
            <div style={{ maxWidth: 560, margin: '40px auto', padding: '32px 24px', background: C.white, borderRadius: 14, border: `1.5px solid ${C.lightGray}`, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.gray, marginBottom: 6 }}>AI features off</div>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: C.forest, margin: '0 0 10px' }}>MyBodyMap AI is turned off.</h2>
              <p style={{ fontSize: 14, color: C.gray, lineHeight: 1.6, margin: '0 0 20px' }}>You turned off AI features in Settings. Turn them back on anytime to use the chat, pre-session briefs, and Practice Pulse digest. Your data is unchanged.</p>
              <button onClick={() => navigate('/dashboard/settings')}
                style={{ background: C.forest, color: C.white, border: 'none', borderRadius: 999, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Open Settings →
              </button>
            </div>
          )}
          {view === 'outreach' && therapist && (
            <><Outreach therapist={therapist} lapsedDays={lapsedDays} />{isMobile && <PageEnd />}</>
          )}
          {view === 'settings' && (
            <div style={{ paddingBottom: isMobile ? 120 : 0 }}>
              <SettingsPanel therapist={therapist} lapsedDays={lapsedDays} setLapsedDays={setLapsedDays} />
              {isMobile && <PageEnd />}
            </div>
          )}
          {view === 'gifts' && therapist && (
            <><GiftCertificates therapist={therapist} />{isMobile && <PageEnd />}</>
          )}
        </div>

        <div className="no-print" style={{ display: isMobile ? 'none' : 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '24px' }}>
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
        <button onClick={() => { setShowSendModal(true); setSendPhone(''); setSendCopied(false); }}
          style={{ position: 'fixed', bottom: isMobile ? '80px' : '32px', right: isMobile ? '16px' : '32px', background: '#2A5741', color: 'white', border: 'none', borderRadius: '50px', padding: isMobile ? '14px 22px' : '16px 28px', fontSize: isMobile ? '14px' : '16px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 8px 24px rgba(42,87,65,0.4)', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 999 }}>
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
              <a href={sendPhone.replace(/\D/g,'').length >= 10 ? 'sms:' + sendPhone.replace(/\D/g,'') + '?body=' + encodeURIComponent('Hi! Please fill out my quick intake form before your session: ' + window.location.origin + '/' + (therapist?.custom_url || '')) : undefined} onClick={e => { if(sendPhone.replace(/\D/g,'').length < 10) { e.preventDefault(); return; } if (therapist?.id) { import('../lib/activation').then(({ trackActivation }) => trackActivation(therapist.id, 'sent_first_intake')).catch(()=>{}); } setTimeout(() => setShowSendModal(false), 500); }} style={{ display: 'block', textAlign: 'center', background: sendPhone.replace(/\D/g,'').length >= 10 ? '#2A5741' : '#C8BFB0', color: 'white', padding: '14px', borderRadius: '50px', fontWeight: '700', fontSize: '15px', textDecoration: 'none', cursor: sendPhone.replace(/\D/g,'').length >= 10 ? 'pointer' : 'not-allowed' }}>
                💬 Open in Messages →
              </a>
              <button onClick={() => { navigator.clipboard.writeText(window.location.origin + '/' + (therapist?.custom_url || '')); setSendCopied(true); setTimeout(() => setSendCopied(false), 2000); if (therapist?.id) { import('../lib/activation').then(({ trackActivation }) => trackActivation(therapist.id, 'sent_first_intake')).catch(()=>{}); } }} style={{ background: sendCopied ? '#E8F5EE' : '#F5F0E8', border: '1.5px solid ' + (sendCopied ? '#6B9E80' : '#E8E4DC'), color: sendCopied ? '#2A5741' : '#6B7280', padding: '12px', borderRadius: '50px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                {sendCopied ? '✓ Copied!' : '📋 Copy Link Only'}
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', marginTop: '16px', marginBottom: 0 }}>🔒 Only shared with you</p>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      {isMobile && (
        <MobileBottomNav
          active={view === 'clients' || view === 'sessions' || view === 'session-detail' ? 'clients' : view || 'clients'}
          onChange={(tab) => {
            const routes = {
              clients: '/dashboard',
              schedule: '/dashboard/schedule',
              billing: '/dashboard/billing',
              outreach: '/dashboard/outreach',
              settings: '/dashboard/settings',
              ai: '/dashboard/ai',
              gifts: '/dashboard/gifts',
            };
            navigate(routes[tab] || '/dashboard');
          }}
          onSignOut={handleLogout}
          therapist={therapist}
        />
      )}

      {/* PWA install banner */}
      <PWAInstallBanner therapist={therapist} />
    </div>
  );
}
