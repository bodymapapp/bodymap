// src/components/MembershipsCard.jsx
//
// Settings card for therapists to define recurring monthly memberships.
// Triggered by Erica Pearre's Facebook question (April 2026): "Can you
// sell packages?" -- HK confirmed both packages and memberships.
//
// MVP scope: CRUD for membership tier definitions only. Stripe recurring
// billing wiring + monthly credit allocation come next session.

import React from "react";
import { supabase } from "../lib/supabase";
import SeedDefaults from "./SeedDefaults";
import InlineEditField from "./InlineEditField";
import InlineEditDescription from "./InlineEditDescription";

const C = { sage:'#6B9E80', forest:'#2A5741', beige:'#F0EAD9', gray:'#6B7280', lightGray:'#E8E4DC', white:'#FFFFFF' };

const PRESETS = [
  { name: 'Monthly Member', monthly_price: 89, monthly_session_credits: 1, max_carryover_credits: 1, addon_discount_percent: 10, description: 'One session a month, 10% off add-ons' },
  { name: 'Premium Member', monthly_price: 169, monthly_session_credits: 2, max_carryover_credits: 2, addon_discount_percent: 15, description: 'Two sessions a month, 15% off add-ons' },
  { name: 'Custom...', monthly_price: 89, monthly_session_credits: 1, max_carryover_credits: 0, addon_discount_percent: 0, description: '' },
];

// Five seed presets covering the most common membership tiers solo LMTs sell.
const SEED_PRESETS = [
  { name: 'Wellness Monthly', monthly_price: 79, monthly_session_credits: 1, max_carryover_credits: 1, addon_discount_percent: 10, description: 'One 60-min session a month, 10% off add-ons' },
  { name: 'Wellness Premium', monthly_price: 149, monthly_session_credits: 2, max_carryover_credits: 1, addon_discount_percent: 15, description: 'Two sessions a month, 15% off add-ons' },
  { name: 'Wellness Plus', monthly_price: 219, monthly_session_credits: 3, max_carryover_credits: 1, addon_discount_percent: 20, description: 'Three sessions a month, 20% off add-ons' },
  { name: 'Couples Monthly', monthly_price: 159, monthly_session_credits: 1, max_carryover_credits: 1, addon_discount_percent: 10, description: 'One couples session a month' },
  { name: 'Quarterly Saver', monthly_price: 65, monthly_session_credits: 1, max_carryover_credits: 3, addon_discount_percent: 5, description: 'One session per month, carry over up to 3' },
];

export default function MembershipsCard({ therapist }) {
  const [memberships, setMemberships] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [draft, setDraft] = React.useState({ name:'', monthly_price:89, monthly_session_credits:1, max_carryover_credits:0, addon_discount_percent:0, description:'' });

  React.useEffect(() => {
    if (!therapist?.id) return;
    supabase.from('memberships').select('*').eq('therapist_id', therapist.id)
      .order('display_order').order('created_at')
      .then(({ data }) => { setMemberships(data || []); setLoading(false); });
  }, [therapist?.id]);

  function handlePreset(name) {
    if (name === 'Custom...') { setDraft({ name:'', monthly_price:89, monthly_session_credits:1, max_carryover_credits:0, addon_discount_percent:0, description:'' }); return; }
    const p = PRESETS.find(x => x.name === name);
    if (p) setDraft({ ...p });
  }

  async function addMembership() {
    if (!draft.name.trim() || !draft.monthly_price) return;
    setSaving(true);
    const { data, error } = await supabase.from('memberships').insert({
      therapist_id: therapist.id,
      name: draft.name.trim(),
      monthly_price: Number(draft.monthly_price),
      monthly_session_credits: Number(draft.monthly_session_credits) || 1,
      max_carryover_credits: Number(draft.max_carryover_credits) || 0,
      addon_discount_percent: Number(draft.addon_discount_percent) || 0,
      description: draft.description.trim() || null,
      active: true,
    }).select().single();
    setSaving(false);
    if (error) { alert('Could not save membership. Make sure the SQL migration has been applied.'); return; }
    setMemberships(m => [...m, data]);
    setDraft({ name:'', monthly_price:89, monthly_session_credits:1, max_carryover_credits:0, addon_discount_percent:0, description:'' });
  }

  async function toggleMembership(m) {
    await supabase.from('memberships').update({ active: !m.active }).eq('id', m.id);
    setMemberships(arr => arr.map(x => x.id === m.id ? { ...x, active: !x.active } : x));
  }

  async function deleteMembership(id) {
    if (!window.confirm('Remove this membership? Existing subscribers stay active; this just stops new signups.')) return;
    await supabase.from('memberships').delete().eq('id', id);
    setMemberships(arr => arr.filter(x => x.id !== id));
  }

  async function seedDefaults(indices) {
    const rows = indices.map(i => ({
      therapist_id: therapist.id,
      ...SEED_PRESETS[i],
      active: true,
    }));
    const { data } = await supabase.from('memberships').insert(rows).select();
    if (data) setMemberships(arr => [...arr, ...data]);
  }

  async function updateMembership(id, patch) {
    const prev = memberships.find(m => m.id === id);
    if (!prev) return;
    setMemberships(arr => arr.map(x => x.id === id ? { ...x, ...patch } : x));
    const { error } = await supabase.from('memberships').update(patch).eq('id', id);
    if (error) {
      console.error('updateMembership failed:', error);
      setMemberships(arr => arr.map(x => x.id === id ? prev : x));
    }
  }

  return (
    <div style={{ background:C.white, border:`1.5px solid ${C.lightGray}`, borderRadius:14, padding:24, marginBottom:20 }}>
      <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:C.gray, margin:'0 0 6px 0' }}>Memberships</p>
      <p style={{ fontSize:'12px', color:C.gray, margin:'0 0 16px 0', lineHeight:1.5 }}>Recurring monthly plans. Members get included sessions and optional discounts. Define tiers here; sign clients up from their profile.</p>

      {loading ? <p style={{ fontSize:13, color:C.gray }}>Loading…</p> : (
        <>
          {memberships.length === 0 && (
            <SeedDefaults
              title="Suggested memberships"
              items={SEED_PRESETS.map(p => ({
                label: p.name,
                sub: `$${p.monthly_price}/mo · ${p.monthly_session_credits} session(s)/mo${p.addon_discount_percent > 0 ? ` · ${p.addon_discount_percent}% off add-ons` : ''}`,
              }))}
              onSeed={seedDefaults}
            />
          )}
          {memberships.length > 0 && (
            <div style={{ marginBottom:16 }}>
              {memberships.map(m => (
                <div key={m.id} style={{ padding:'12px 14px', background:m.active ? '#FAFAF6' : '#F3F4F6', border:`1px solid ${C.lightGray}`, borderRadius:10, marginBottom:6, opacity:m.active?1:0.55 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      {/* Editable membership name. Same Ashley Scalzulli
                          ask as PackagesCard: title was display-only,
                          had to recreate to rename. Now inline-editable.
                          Wrapped in a block-level div so the title sits
                          on its own line and the meta-row pills drop
                          below cleanly. */}
                      <div style={{ display: 'block', marginBottom: 4 }}>
                        <InlineEditField
                          value={m.name}
                          type="text"
                          width="100%"
                          align="left"
                          fontSize={14}
                          fontWeight={600}
                          color={C.forest}
                          ariaLabel={`Edit membership name`}
                          onSave={(v) => updateMembership(m.id, { name: String(v).trim() })}
                        />
                      </div>
                      <div style={{ fontSize:12, color:C.gray, marginTop:2, display:'inline-flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        <InlineEditField
                          value={Number(m.monthly_price)}
                          type="number"
                          prefix="$"
                          suffix="/mo"
                          min={0}
                          max={9999}
                          step={5}
                          width={56}
                          fontSize={12}
                          color={C.gray}
                          ariaLabel={`Monthly price for ${m.name}`}
                          onSave={(v) => updateMembership(m.id, { monthly_price: v })}
                        />
                        <span style={{ color:'#D1D5DB' }}>·</span>
                        <InlineEditField
                          value={Number(m.monthly_session_credits)}
                          type="number"
                          min={1}
                          max={31}
                          step={1}
                          width={28}
                          fontSize={12}
                          color={C.gray}
                          ariaLabel={`Sessions per month for ${m.name}`}
                          onSave={(v) => updateMembership(m.id, { monthly_session_credits: v })}
                        />
                        <span style={{ color:'#9CA3AF' }}>session{m.monthly_session_credits !== 1 ? 's' : ''}/mo</span>
                        {(m.addon_discount_percent > 0 || true) && (
                          <>
                            <span style={{ color:'#D1D5DB' }}>·</span>
                            <InlineEditField
                              value={Number(m.addon_discount_percent) || 0}
                              type="number"
                              suffix="%"
                              min={0}
                              max={100}
                              step={5}
                              width={32}
                              fontSize={12}
                              color={C.gray}
                              ariaLabel={`Add-on discount for ${m.name}`}
                              onSave={(v) => updateMembership(m.id, { addon_discount_percent: v })}
                            />
                            <span style={{ color:'#9CA3AF' }}>off add-ons</span>
                          </>
                        )}
                      </div>
                      {/* Editable description. Was display-only and only
                          shown when non-empty. Now always rendered so
                          therapists can ADD a description to existing
                          memberships, not just edit ones that had one. */}
                      <div style={{ marginTop:4 }}>
                        <InlineEditDescription
                          value={m.description || ''}
                          placeholder="Add a description (optional)"
                          ariaLabel={`Edit description for ${m.name}`}
                          onSave={(v) => updateMembership(m.id, { description: String(v).trim() || null })}
                        />
                      </div>
                    </div>
                    <button onClick={() => toggleMembership(m)} style={{ background:m.active?'#fff':C.sage, color:m.active?C.gray:'#fff', border:`1px solid ${C.lightGray}`, borderRadius:8, padding:'5px 10px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                      {m.active ? 'Hide' : 'Show'}
                    </button>
                    <button onClick={() => deleteMembership(m.id)} style={{ background:'transparent', color:C.gray, border:'none', fontSize:18, cursor:'pointer', padding:'2px 6px' }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background:C.beige, padding:14, borderRadius:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.forest, marginBottom:10 }}>Add a new tier</div>
            <select onChange={e => handlePreset(e.target.value)} value=""
              style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, marginBottom:8, background:'#fff' }}>
              <option value="">Pick a preset or write your own…</option>
              {PRESETS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <input type="text" value={draft.name} onChange={e => setDraft(d => ({ ...d, name:e.target.value }))}
              placeholder="Tier name (e.g. Monthly Member)"
              style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, marginBottom:8, boxSizing:'border-box' }} />
            <input type="text" value={draft.description} onChange={e => setDraft(d => ({ ...d, description:e.target.value }))}
              placeholder="What members get (optional)"
              style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, marginBottom:8, boxSizing:'border-box' }} />
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C.gray, fontWeight:600, display:'block', marginBottom:3 }}>$/month</label>
                <input type="number" value={draft.monthly_price} onChange={e => setDraft(d => ({ ...d, monthly_price:e.target.value }))} min="0"
                  style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, boxSizing:'border-box' }} />
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C.gray, fontWeight:600, display:'block', marginBottom:3 }}>Sessions/mo</label>
                <input type="number" value={draft.monthly_session_credits} onChange={e => setDraft(d => ({ ...d, monthly_session_credits:e.target.value }))} min="0"
                  style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C.gray, fontWeight:600, display:'block', marginBottom:3 }}>Carry-over</label>
                <input type="number" value={draft.max_carryover_credits} onChange={e => setDraft(d => ({ ...d, max_carryover_credits:e.target.value }))} min="0"
                  style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, boxSizing:'border-box' }} />
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C.gray, fontWeight:600, display:'block', marginBottom:3 }}>Add-on % off</label>
                <input type="number" value={draft.addon_discount_percent} onChange={e => setDraft(d => ({ ...d, addon_discount_percent:e.target.value }))} min="0" max="100"
                  style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.lightGray}`, borderRadius:8, fontSize:13, boxSizing:'border-box' }} />
              </div>
            </div>
            <button onClick={addMembership} disabled={saving || !draft.name.trim() || !draft.monthly_price}
              style={{ width:'100%', background:saving?C.sage:C.forest, color:'#fff', border:'none', borderRadius:8, padding:'10px', fontSize:13, fontWeight:700, cursor:'pointer', opacity:(draft.name.trim() && draft.monthly_price)?1:0.5 }}>
              {saving ? 'Saving…' : '+ Add this membership'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
