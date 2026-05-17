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
import SeedDefaults from "./SeedDefaults";
import InlineEditField from "./InlineEditField";
import InlineEditDescription from "./InlineEditDescription";

const C = { sage:'#6B9E80', forest:'#2A5741', beige:'#F0EAD9', gray:'#6B7280', lightGray:'#E8E4DC', white:'#FFFFFF' };

const PRESETS = [
  { name: '3-Session Bundle', session_count: 3, price: 270, description: 'Save $15 on 3 sessions' },
  { name: '5-Session Bundle', session_count: 5, price: 425, description: 'Save $50 on 5 sessions' },
  { name: '10-Session Bundle', session_count: 10, price: 800, description: 'Save $150 on 10 sessions' },
  { name: 'Custom...', session_count: 5, price: 400, description: '' },
];

// Five default packages we offer to seed when a therapist hasn't built any.
// Median pricing for solo LMTs ($85-90/session base, save $10-25 per 5 sessions).
const SEED_PRESETS = [
  { name: '3-Session Starter', session_count: 3, price: 270, description: 'Save $15 on 3 sessions, expires in 90 days', expires_in_days: 90 },
  { name: '5-Session Bundle', session_count: 5, price: 425, description: 'Save $50 on 5 sessions, our most popular', expires_in_days: 180 },
  { name: '10-Session Pack', session_count: 10, price: 800, description: 'Save $150 on 10 sessions', expires_in_days: 365 },
  { name: 'Couples 3-Pack', session_count: 3, price: 540, description: 'For couples, save $30 on 3 sessions', expires_in_days: 180 },
  { name: 'New Client Trio', session_count: 3, price: 240, description: 'First-time client special, $80 each', expires_in_days: 60 },
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

  async function seedDefaults(indices) {
    const rows = indices.map(i => ({
      therapist_id: therapist.id,
      ...SEED_PRESETS[i],
      active: true,
    }));
    const { data } = await supabase.from('packages').insert(rows).select();
    if (data) setPackages(arr => [...arr, ...data]);
  }

  async function updatePackage(id, patch) {
    const prev = packages.find(p => p.id === id);
    if (!prev) return;
    setPackages(arr => arr.map(x => x.id === id ? { ...x, ...patch } : x));
    const { error } = await supabase.from('packages').update(patch).eq('id', id);
    if (error) {
      console.error('updatePackage failed:', error);
      setPackages(arr => arr.map(x => x.id === id ? prev : x));
    }
  }

  const perSession = (p) => p.session_count > 0 ? (Number(p.price) / p.session_count).toFixed(0) : '0';

  return (
    <div style={{ background:C.white, border:`1.5px solid ${C.lightGray}`, borderRadius:14, padding:24, marginBottom:20 }}>
      <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:C.gray, margin:'0 0 6px 0' }}>Packages</p>
      <p style={{ fontSize:'12px', color:C.gray, margin:'0 0 16px 0', lineHeight:1.5 }}>Multi-session bundles your clients buy upfront, like a 5-pack at a discount. Define them here, then sell to clients from their profile.</p>

      {loading ? <p style={{ fontSize:13, color:C.gray }}>Loading…</p> : (
        <>
          {packages.length === 0 && (
            <SeedDefaults
              title="Suggested packages"
              items={SEED_PRESETS.map(p => ({
                label: p.name,
                sub: `${p.session_count} sessions · $${p.price} · ${p.description}`,
              }))}
              onSeed={seedDefaults}
            />
          )}
          {packages.length > 0 && (
            <div style={{ marginBottom:16 }}>
              {packages.map(p => (
                <div key={p.id} style={{ padding:'12px 14px', background:p.active ? '#FAFAF6' : '#F3F4F6', border:`1px solid ${C.lightGray}`, borderRadius:10, marginBottom:6, opacity:p.active?1:0.55 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    {/* Inner content column — flex-direction: column with
                        explicit gap forces each child onto its own row
                        regardless of internal margin/padding tricks.
                        Previous approach (block-level wrapper div) failed
                        because InlineEditField uses negative margins for
                        hover padding compensation, which collapsed the
                        apparent vertical gap. flex-column + gap is
                        bulletproof. */}
                    <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:8 }}>
                      {/* Title — own row */}
                      <InlineEditField
                        value={p.name}
                        type="text"
                        width="100%"
                        align="left"
                        fontSize={14}
                        fontWeight={600}
                        color={C.forest}
                        ariaLabel={`Edit package name`}
                        onSave={(v) => updatePackage(p.id, { name: String(v).trim() })}
                      />
                      {/* Meta row — own row, pills can wrap inside */}
                      <div style={{ fontSize:12, color:C.gray, display:'inline-flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        <InlineEditField
                          value={Number(p.session_count)}
                          type="number"
                          suffix="sessions"
                          min={1}
                          max={50}
                          step={1}
                          width={32}
                          fontSize={12}
                          color={C.gray}
                          ariaLabel={`Sessions in ${p.name}`}
                          onSave={(v) => updatePackage(p.id, { session_count: v })}
                        />
                        <span style={{ color:'#D1D5DB' }}>·</span>
                        <InlineEditField
                          value={Number(p.price)}
                          type="number"
                          prefix="$"
                          min={0}
                          max={9999}
                          step={10}
                          width={56}
                          fontSize={12}
                          color={C.gray}
                          ariaLabel={`Total price for ${p.name}`}
                          onSave={(v) => updatePackage(p.id, { price: v })}
                        />
                        <span style={{ color:'#9CA3AF' }}>total</span>
                        <span style={{ color:'#D1D5DB' }}>·</span>
                        <span style={{ color:'#9CA3AF' }}>${perSession(p)}/session</span>
                        {p.expires_in_days != null && (
                          <>
                            <span style={{ color:'#D1D5DB' }}>·</span>
                            <span>expires after </span>
                            <InlineEditField
                              value={Number(p.expires_in_days)}
                              type="number"
                              suffix="days"
                              min={1}
                              max={3650}
                              step={30}
                              width={42}
                              fontSize={12}
                              color={C.gray}
                              ariaLabel={`Expires after ${p.name}`}
                              onSave={(v) => updatePackage(p.id, { expires_in_days: v })}
                            />
                          </>
                        )}
                      </div>
                      {/* Description — own row. Always renders so
                          therapists can ADD a description to existing
                          packages, not just edit ones that already had
                          one (placeholder shows when empty). */}
                      <InlineEditDescription
                        value={p.description || ''}
                        placeholder="Add a description (optional)"
                        ariaLabel={`Edit description for ${p.name}`}
                        onSave={(v) => updatePackage(p.id, { description: String(v).trim() || null })}
                      />
                    </div>
                    <button onClick={() => togglePackage(p)} style={{ background:p.active?'#fff':C.sage, color:p.active?C.gray:'#fff', border:`1px solid ${C.lightGray}`, borderRadius:8, padding:'5px 10px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                      {p.active ? 'Hide' : 'Show'}
                    </button>
                    <button onClick={() => deletePackage(p.id)} aria-label={`Delete ${p.name || 'this package'}`} style={{ background:'transparent', color:C.gray, border:'1px solid transparent', fontSize:12, fontWeight:700, cursor:'pointer', padding:'4px 12px', borderRadius:999, transition:'all 0.15s' }} onMouseEnter={(e)=>{e.currentTarget.style.background='#FEF2F2';e.currentTarget.style.color='#DC2626';e.currentTarget.style.borderColor='#FCA5A5';}} onMouseLeave={(e)=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=C.gray;e.currentTarget.style.borderColor='transparent';}}>Delete</button>
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
