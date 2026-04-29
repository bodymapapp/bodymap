// src/components/PackagesCard.jsx
//
// Settings card for therapists to define multi-session packages.
// Triggered by Erica Pearre's Facebook question (April 2026): "Can you
// sell packages?" HK confirmed yes.
//
// MVP scope: CRUD for package definitions only. Selling (taking money) and
// redemption (drawing down a session against a booking) come next session.

import React from "react";
import { supabase } from "../lib/supabase";

const C = { sage:'#6B9E80', forest:'#2A5741', beige:'#F0EAD9', gray:'#6B7280', lightGray:'#E8E4DC', white:'#FFFFFF' };

const PRESETS = [
  { name: '3-Session Bundle', session_count: 3, price: 270, description: 'Save $15 on 3 sessions' },
  { name: '5-Session Bundle', session_count: 5, price: 425, description: 'Save $50 on 5 sessions' },
  { name: '10-Session Bundle', session_count: 10, price: 800, description: 'Save $150 on 10 sessions' },
  { name: 'Custom...', session_count: 5, price: 400, description: '' },
];

export default function PackagesCard({ therapist }) {
  const [packages, setPackages] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [draft, setDraft] = React.useState({ name:'', session_count:5, price:400, expires_in_days:'', description:'' });

  React.useEffect(() => {
    if (!therapist?.id) return;
    supabase.from('packages').select('*').eq('therapist_id', therapist.id)
      .order('display_order').order('created_at')
      .then(({ data }) => { setPackages(data || []); setLoading(false); });
  }, [therapist?.id]);

  function handlePreset(name) {
    if (name === 'Custom...') { setDraft({ name:'', session_count:5, price:400, expires_in_days:'', description:'' }); return; }
    const p = PRESETS.find(x => x.name === name);
    if (p) setDraft({ name:p.name, session_count:p.session_count, price:p.price, expires_in_days:'', description:p.description });
  }

  async function addPackage() {
    if (!draft.name.trim() || !draft.session_count || !draft.price) return;
    setSaving(true);
    const { data, error } = await supabase.from('packages').insert({
      therapist_id: therapist.id,
      name: draft.name.trim(),
      session_count: Number(draft.session_count),
      price: Number(draft.price),
      expires_in_days: draft.expires_in_days ? Number(draft.expires_in_days) : null,
      description: draft.description.trim() || null,
      active: true,
    }).select().single();
    setSaving(false);
    if (error) { alert('Could not save package. Make sure the SQL migration has been applied.'); return; }
    setPackages(p => [...p, data]);
    setDraft({ name:'', session_count:5, price:400, expires_in_days:'', description:'' });
  }

  async function togglePackage(p) {
    await supabase.from('packages').update({ active: !p.active }).eq('id', p.id);
    setPackages(arr => arr.map(x => x.id === p.id ? { ...x, active: !x.active } : x));
  }

  async function deletePackage(id) {
    if (!window.confirm('Remove this package? Existing customer purchases stay valid; this just stops new sales.')) return;
    await supabase.from('packages').delete().eq('id', id);
    setPackages(arr => arr.filter(x => x.id !== id));
  }

  const perSession = (p) => p.session_count > 0 ? (Number(p.price) / p.session_count).toFixed(0) : '0';

  return (
    <div style={{ background:C.white, border:`1.5px solid ${C.lightGray}`, borderRadius:14, padding:24, marginBottom:20 }}>
      <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:C.gray, margin:'0 0 6px 0' }}>📦 Packages</p>
      <p style={{ fontSize:'12px', color:C.gray, margin:'0 0 16px 0', lineHeight:1.5 }}>Multi-session bundles your clients buy upfront, like a 5-pack at a discount. Define them here, then sell to clients from their profile.</p>

      {loading ? <p style={{ fontSize:13, color:C.gray }}>Loading…</p> : (
        <>
          {packages.length > 0 && (
            <div style={{ marginBottom:16 }}>
              {packages.map(p => (
                <div key={p.id} style={{ padding:'12px 14px', background:p.active ? '#FAFAF6' : '#F3F4F6', border:`1px solid ${C.lightGray}`, borderRadius:10, marginBottom:6, opacity:p.active?1:0.55 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:14, color:C.forest }}>{p.name}</div>
                      <div style={{ fontSize:12, color:C.gray, marginTop:2 }}>
                        {p.session_count} sessions · ${Number(p.price).toFixed(0)} total · ${perSession(p)}/session
                        {p.expires_in_days ? ` · expires after ${p.expires_in_days} days` : ''}
                      </div>
                      {p.description && <div style={{ fontSize:12, color:C.gray, marginTop:2, fontStyle:'italic' }}>{p.description}</div>}
                    </div>
                    <button onClick={() => togglePackage(p)} style={{ background:p.active?'#fff':C.sage, color:p.active?C.gray:'#fff', border:`1px solid ${C.lightGray}`, borderRadius:8, padding:'5px 10px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                      {p.active ? 'Hide' : 'Show'}
                    </button>
                    <button onClick={() => deletePackage(p.id)} style={{ background:'transparent', color:C.gray, border:'none', fontSize:18, cursor:'pointer', padding:'2px 6px' }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background:C.beige, padding:14, borderRadius:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.forest, marginBottom:10 }}>Add a new package</div>
            <select onChange={e => handlePreset(e.target.value)} value=""
              style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, marginBottom:8, background:'#fff' }}>
              <option value="">Pick a preset or write your own…</option>
              {PRESETS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <input type="text" value={draft.name} onChange={e => setDraft(d => ({ ...d, name:e.target.value }))}
              placeholder="Package name (e.g. 5-Session Bundle)"
              style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, marginBottom:8, boxSizing:'border-box' }} />
            <input type="text" value={draft.description} onChange={e => setDraft(d => ({ ...d, description:e.target.value }))}
              placeholder="Description (optional)"
              style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, marginBottom:8, boxSizing:'border-box' }} />
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C.gray, fontWeight:600, display:'block', marginBottom:3 }}>Sessions</label>
                <input type="number" value={draft.session_count} onChange={e => setDraft(d => ({ ...d, session_count:e.target.value }))} min="1"
                  style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, boxSizing:'border-box' }} />
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C.gray, fontWeight:600, display:'block', marginBottom:3 }}>Price ($)</label>
                <input type="number" value={draft.price} onChange={e => setDraft(d => ({ ...d, price:e.target.value }))} min="0"
                  style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, boxSizing:'border-box' }} />
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C.gray, fontWeight:600, display:'block', marginBottom:3 }}>Expires (days)</label>
                <input type="number" value={draft.expires_in_days} onChange={e => setDraft(d => ({ ...d, expires_in_days:e.target.value }))} placeholder="never" min="0"
                  style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, boxSizing:'border-box' }} />
              </div>
            </div>
            <button onClick={addPackage} disabled={saving || !draft.name.trim() || !draft.session_count || !draft.price}
              style={{ width:'100%', background:saving?C.sage:C.forest, color:'#fff', border:'none', borderRadius:8, padding:'10px', fontSize:13, fontWeight:700, cursor:'pointer', opacity:(draft.name.trim() && draft.session_count && draft.price)?1:0.5 }}>
              {saving ? 'Saving…' : '+ Add this package'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
