// src/components/EventsCard.jsx
//
// Settings card for therapists to schedule group classes / events.
// Triggered by Venus Yvette-Lmt's Facebook question (April 2026):
// "Can one use this to schedule classes/events?" HK confirmed: not yet
// but we can add it. This is that.
//
// MVP scope: CRUD for events. Public registration page + Stripe deposit
// flow come next session.

import React from "react";
import { supabase } from "../lib/supabase";
import SeedDefaults from "./SeedDefaults";
import InlineEditField from "./InlineEditField";

const C = { sage:'#6B9E80', forest:'#2A5741', beige:'#F0EAD9', gray:'#6B7280', lightGray:'#E8E4DC', white:'#FFFFFF' };

const PRESETS = [
  { name: 'Stretch & Restore', capacity: 8, price: 35, description: '60-minute group stretch and breathwork' },
  { name: 'Self-Massage Workshop', capacity: 10, price: 45, description: '90-minute hands-on workshop, take home techniques' },
  { name: 'Couples Massage Class', capacity: 6, price: 75, description: 'Learn to massage your partner, 90 minutes' },
  { name: 'Custom...', capacity: 8, price: 35, description: '' },
];

// Five seed presets covering the most common solo-LMT classes / events.
// Times default to next Saturday 10am-11am for the seed pass; therapist
// can edit each event's date/time after creation.
function seedSlot(weeksFromNow, hour) {
  const d = new Date();
  d.setDate(d.getDate() + 7 * weeksFromNow + (6 - d.getDay())); // next Saturday-ish
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
const SEED_PRESETS = [
  { name: 'Stretch & Restore', capacity: 8, price: 35, description: '60-minute group stretch and breathwork', starts_at: seedSlot(1, 10), ends_at: seedSlot(1, 11) },
  { name: 'Self-Massage Workshop', capacity: 10, price: 45, description: '90-minute hands-on workshop with take-home techniques', starts_at: seedSlot(2, 10), ends_at: seedSlot(2, 11) },
  { name: 'Couples Massage Class', capacity: 6, price: 75, description: 'Learn to massage your partner, 90 minutes', starts_at: seedSlot(3, 14), ends_at: seedSlot(3, 15) },
  { name: 'Restorative Yin Class', capacity: 12, price: 25, description: '75-minute floor practice for tight hips and lower back', starts_at: seedSlot(2, 17), ends_at: seedSlot(2, 18) },
  { name: 'New Mom Self-Care Workshop', capacity: 8, price: 40, description: 'Postpartum stretches and tension release, 75 minutes', starts_at: seedSlot(4, 11), ends_at: seedSlot(4, 12) },
];

// Default to one week from now at 10am-11am for new events
function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(10, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}
function defaultEnd() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(11, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export default function EventsCard({ therapist }) {
  const [events, setEvents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [draft, setDraft] = React.useState({
    name:'', capacity:8, price:35, description:'', location:'',
    starts_at: defaultStart(), ends_at: defaultEnd(),
  });

  React.useEffect(() => {
    if (!therapist?.id) return;
    supabase.from('events').select('*').eq('therapist_id', therapist.id)
      .order('starts_at', { ascending: false })
      .then(({ data }) => { setEvents(data || []); setLoading(false); });
  }, [therapist?.id]);

  function handlePreset(name) {
    if (name === 'Custom...') {
      setDraft({ name:'', capacity:8, price:35, description:'', location:'', starts_at: defaultStart(), ends_at: defaultEnd() });
      return;
    }
    const p = PRESETS.find(x => x.name === name);
    if (p) setDraft(d => ({ ...d, name:p.name, capacity:p.capacity, price:p.price, description:p.description }));
  }

  async function addEvent() {
    if (!draft.name.trim() || !draft.starts_at || !draft.ends_at) return;
    setSaving(true);
    const { data, error } = await supabase.from('events').insert({
      therapist_id: therapist.id,
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      location: draft.location.trim() || null,
      starts_at: new Date(draft.starts_at).toISOString(),
      ends_at: new Date(draft.ends_at).toISOString(),
      capacity: Number(draft.capacity) || 1,
      price: Number(draft.price) || 0,
      status: 'scheduled',
    }).select().single();
    setSaving(false);
    if (error) { alert('Could not save event. Make sure the SQL migration has been applied.'); return; }
    setEvents(arr => [data, ...arr]);
    setDraft({ name:'', capacity:8, price:35, description:'', location:'', starts_at: defaultStart(), ends_at: defaultEnd() });
  }

  async function cancelEvent(id) {
    if (!window.confirm('Cancel this event? Registered attendees should be notified separately.')) return;
    await supabase.from('events').update({ status: 'canceled' }).eq('id', id);
    setEvents(arr => arr.map(e => e.id === id ? { ...e, status: 'canceled' } : e));
  }

  async function deleteEvent(id) {
    if (!window.confirm('Permanently delete this event and all registrations?')) return;
    await supabase.from('events').delete().eq('id', id);
    setEvents(arr => arr.filter(e => e.id !== id));
  }

  async function seedDefaults(indices) {
    const rows = indices.map(i => ({
      therapist_id: therapist.id,
      ...SEED_PRESETS[i],
      status: 'draft',
    }));
    const { data } = await supabase.from('events').insert(rows).select();
    if (data) setEvents(arr => [...arr, ...data]);
  }

  async function updateEvent(id, patch) {
    const prev = events.find(e => e.id === id);
    if (!prev) return;
    setEvents(arr => arr.map(x => x.id === id ? { ...x, ...patch } : x));
    const { error } = await supabase.from('events').update(patch).eq('id', id);
    if (error) {
      console.error('updateEvent failed:', error);
      setEvents(arr => arr.map(x => x.id === id ? prev : x));
    }
  }

  function fmtEventTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
  }

  const statusColors = {
    scheduled: { bg:'#DCFCE7', color:'#16A34A' },
    full: { bg:'#FEF3C7', color:'#D97706' },
    canceled: { bg:'#FEE2E2', color:'#DC2626' },
    complete: { bg:'#F3F4F6', color:'#6B7280' },
    draft: { bg:'#E0E7FF', color:'#4F46E5' },
  };

  return (
    <div style={{ background:C.white, border:`1.5px solid ${C.lightGray}`, borderRadius:14, padding:24, marginBottom:20 }}>
      <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:C.gray, margin:'0 0 6px 0' }}>Classes & Events</p>
      <p style={{ fontSize:'12px', color:C.gray, margin:'0 0 16px 0', lineHeight:1.5 }}>Group sessions, workshops, and classes. Schedule them here. Clients register via your booking page.</p>

      {loading ? <p style={{ fontSize:13, color:C.gray }}>Loading…</p> : (
        <>
          {events.length === 0 && (
            <SeedDefaults
              title="Suggested classes & events"
              items={SEED_PRESETS.map(p => ({
                label: p.name,
                sub: `Capacity ${p.capacity} · $${p.price} · ${p.description}`,
              }))}
              onSeed={seedDefaults}
              ctaLabel="Add all 5 as drafts (set dates after)"
            />
          )}
          {events.length > 0 && (
            <div style={{ marginBottom:16 }}>
              {events.map(e => {
                const sc = statusColors[e.status] || statusColors.scheduled;
                return (
                  <div key={e.id} style={{ padding:'12px 14px', background:'#FAFAF6', border:`1px solid ${C.lightGray}`, borderRadius:10, marginBottom:6 }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2, flexWrap:'wrap' }}>
                          <span style={{ fontWeight:600, fontSize:14, color:C.forest }}>{e.name}</span>
                          <span style={{ background:sc.bg, color:sc.color, fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, textTransform:'uppercase', letterSpacing:'0.04em' }}>{e.status}</span>
                        </div>
                        <div style={{ fontSize:12, color:C.gray }}>
                          {fmtEventTime(e.starts_at)} – {new Date(e.ends_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })}
                        </div>
                        <div style={{ fontSize:12, color:C.gray, marginTop:2, display:'inline-flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                          <InlineEditField
                            value={Number(e.capacity)}
                            type="number"
                            min={1}
                            max={500}
                            step={1}
                            width={32}
                            fontSize={12}
                            color={C.gray}
                            ariaLabel={`Capacity for ${e.name}`}
                            onSave={(v) => updateEvent(e.id, { capacity: v })}
                          />
                          <span style={{ color:'#9CA3AF' }}>spots</span>
                          <span style={{ color:'#D1D5DB' }}>·</span>
                          <InlineEditField
                            value={Number(e.price)}
                            type="number"
                            prefix="$"
                            suffix="/person"
                            min={0}
                            max={9999}
                            step={5}
                            width={56}
                            fontSize={12}
                            color={C.gray}
                            ariaLabel={`Price per person for ${e.name}`}
                            onSave={(v) => updateEvent(e.id, { price: v })}
                          />
                          {e.location ? <><span style={{ color:'#D1D5DB' }}>·</span><span>{e.location}</span></> : null}
                        </div>
                        {e.description && <div style={{ fontSize:12, color:C.gray, marginTop:2, fontStyle:'italic' }}>{e.description}</div>}
                      </div>
                      {e.status !== 'canceled' && e.status !== 'complete' && (
                        <button onClick={() => cancelEvent(e.id)} style={{ background:'#fff', color:C.gray, border:`1px solid ${C.lightGray}`, borderRadius:8, padding:'5px 10px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                          Cancel
                        </button>
                      )}
                      <button onClick={() => deleteEvent(e.id)} aria-label={`Delete ${e.name || 'this event'}`} style={{ background:'transparent', color:C.gray, border:'1px solid transparent', fontSize:12, fontWeight:700, cursor:'pointer', padding:'4px 12px', borderRadius:999, transition:'all 0.15s' }} onMouseEnter={(ev)=>{ev.currentTarget.style.background='#FEF2F2';ev.currentTarget.style.color='#DC2626';ev.currentTarget.style.borderColor='#FCA5A5';}} onMouseLeave={(ev)=>{ev.currentTarget.style.background='transparent';ev.currentTarget.style.color=C.gray;ev.currentTarget.style.borderColor='transparent';}}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ background:C.beige, padding:14, borderRadius:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.forest, marginBottom:10 }}>Schedule a new event</div>
            <select onChange={e => handlePreset(e.target.value)} value=""
              style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, marginBottom:8, background:'#fff' }}>
              <option value="">Pick a preset or write your own…</option>
              {PRESETS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <input type="text" value={draft.name} onChange={e => setDraft(d => ({ ...d, name:e.target.value }))}
              placeholder="Event name (e.g. Stretch & Restore Workshop)"
              style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, marginBottom:8, boxSizing:'border-box' }} />
            <input type="text" value={draft.description} onChange={e => setDraft(d => ({ ...d, description:e.target.value }))}
              placeholder="Short description (optional)"
              style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, marginBottom:8, boxSizing:'border-box' }} />
            <input type="text" value={draft.location} onChange={e => setDraft(d => ({ ...d, location:e.target.value }))}
              placeholder="Location (e.g. Sugar Land studio, 123 Main)"
              style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, marginBottom:8, boxSizing:'border-box' }} />
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C.gray, fontWeight:600, display:'block', marginBottom:3 }}>Starts</label>
                <input type="datetime-local" value={draft.starts_at} onChange={e => setDraft(d => ({ ...d, starts_at:e.target.value }))}
                  style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, boxSizing:'border-box' }} />
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C.gray, fontWeight:600, display:'block', marginBottom:3 }}>Ends</label>
                <input type="datetime-local" value={draft.ends_at} onChange={e => setDraft(d => ({ ...d, ends_at:e.target.value }))}
                  style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C.gray, fontWeight:600, display:'block', marginBottom:3 }}>Capacity</label>
                <input type="number" value={draft.capacity} onChange={e => setDraft(d => ({ ...d, capacity:e.target.value }))} min="1"
                  style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, boxSizing:'border-box' }} />
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C.gray, fontWeight:600, display:'block', marginBottom:3 }}>$/person</label>
                <input type="number" value={draft.price} onChange={e => setDraft(d => ({ ...d, price:e.target.value }))} min="0"
                  style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, boxSizing:'border-box' }} />
              </div>
            </div>
            <button onClick={addEvent} disabled={saving || !draft.name.trim() || !draft.starts_at || !draft.ends_at}
              style={{ width:'100%', background:saving?C.sage:C.forest, color:'#fff', border:'none', borderRadius:8, padding:'10px', fontSize:13, fontWeight:700, cursor:'pointer', opacity:(draft.name.trim() && draft.starts_at && draft.ends_at)?1:0.5 }}>
              {saving ? 'Saving…' : '+ Schedule this event'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
