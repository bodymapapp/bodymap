// src/components/CouponManager.jsx
//
// Therapist-facing manager for client coupon codes (HK Jun 9 2026).
// Codes clients enter at booking. The discount applies to the service
// price, so the deposit and the remaining balance both drop. Validation
// and the discounted charge are enforced server-side in the deposit
// functions; this screen only creates and lists codes. RLS limits a
// therapist to their own coupons (coupons.therapist_id = auth.uid()).

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const C = {
  forest: '#1f3a2c',
  sage: '#5a7d68',
  cream: '#f6f3ec',
  border: 'rgba(31,58,44,0.12)',
  muted: '#6b7d72',
  danger: '#a23b3b',
};
const serif = 'Georgia, "Times New Roman", serif';

function fmtDiscount(c) {
  return c.discount_type === 'percent'
    ? `${Number(c.discount_value)}% off`
    : `$${Number(c.discount_value).toFixed(2)} off`;
}

function limitsLine(c) {
  const parts = [];
  if (c.new_clients_only) parts.push('first-time clients only');
  if (c.max_redemptions != null) parts.push(`${c.times_redeemed} of ${c.max_redemptions} used`);
  else if (c.times_redeemed > 0) parts.push(`used ${c.times_redeemed} time${c.times_redeemed === 1 ? '' : 's'}`);
  if (c.expires_at) {
    const d = new Date(c.expires_at);
    const past = d.getTime() < Date.now();
    parts.push(`${past ? 'expired' : 'expires'} ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`);
  }
  return parts.join(' · ');
}

export default function CouponManager({ therapist }) {
  const therapistId = therapist?.id;
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [code, setCode] = useState('');
  const [type, setType] = useState('percent');
  const [value, setValue] = useState('');
  const [newOnly, setNewOnly] = useState(false);
  const [expires, setExpires] = useState('');
  const [cap, setCap] = useState('');

  const load = useCallback(async () => {
    if (!therapistId) return;
    setLoading(true);
    const { data, error: e } = await supabase
      .from('coupons').select('*')
      .eq('therapist_id', therapistId)
      .order('created_at', { ascending: false });
    if (!e) setCoupons(data || []);
    setLoading(false);
  }, [therapistId]);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setCode(''); setType('percent'); setValue(''); setNewOnly(false); setExpires(''); setCap(''); setError(null);
  }

  async function createCoupon() {
    setError(null);
    const trimmed = code.trim().toUpperCase();
    const num = Number(value);
    if (!trimmed) { setError('Enter a code, like FIRST15.'); return; }
    if (!num || num <= 0) { setError('Enter a discount greater than zero.'); return; }
    if (type === 'percent' && num > 100) { setError('A percent discount cannot be more than 100.'); return; }
    setSaving(true);
    const row = {
      therapist_id: therapistId,
      code: trimmed,
      discount_type: type,
      discount_value: num,
      active: true,
      new_clients_only: newOnly,
      expires_at: expires ? new Date(expires + 'T23:59:59').toISOString() : null,
      max_redemptions: cap ? Math.max(1, parseInt(cap, 10)) : null,
    };
    const { error: e } = await supabase.from('coupons').insert(row);
    setSaving(false);
    if (e) {
      setError(String(e.message || '').includes('coupons_therapist_code_uniq')
        ? 'You already have a code with that name.'
        : 'Could not save that code. Please try again.');
      return;
    }
    resetForm(); setShowForm(false); load();
  }

  async function toggleActive(c) {
    await supabase.from('coupons').update({ active: !c.active }).eq('id', c.id);
    load();
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: `1px solid ${C.border}`, fontSize: 16, fontFamily: serif,
    color: C.forest, background: '#fff', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 13, fontWeight: 700, color: C.sage, marginBottom: 6, display: 'block' };

  return (
    <div style={{ padding: '4px 2px' }}>
      <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.5, margin: '0 0 14px' }}>
        Create a code your clients type in when they book. The discount comes off the
        session price, so their deposit and what they owe at the session both go down.
      </p>

      {loading ? (
        <p style={{ color: C.muted, fontSize: 14 }}>Loading your codes.</p>
      ) : coupons.length === 0 ? (
        <p style={{ color: C.muted, fontSize: 14, margin: '0 0 14px' }}>No codes yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {coupons.map((c) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, padding: '12px 14px', borderRadius: 12,
              border: `1px solid ${C.border}`, background: c.active ? '#fff' : C.cream,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: serif, fontSize: 17, fontWeight: 700, color: C.forest }}>
                  {c.code} <span style={{ fontWeight: 400, color: C.sage }}>· {fmtDiscount(c)}</span>
                </div>
                {limitsLine(c) && (
                  <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>{limitsLine(c)}</div>
                )}
                {!c.active && <div style={{ fontSize: 12.5, color: C.danger, marginTop: 3, fontWeight: 600 }}>Turned off</div>}
              </div>
              <button type="button" onClick={() => toggleActive(c)} style={{
                flexShrink: 0, padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${C.border}`, background: '#fff', color: C.sage,
                fontSize: 13, fontWeight: 700,
              }}>
                {c.active ? 'Turn off' : 'Turn on'}
              </button>
            </div>
          ))}
        </div>
      )}

      {!showForm ? (
        <button type="button" onClick={() => { resetForm(); setShowForm(true); }} style={{
          padding: '12px 18px', borderRadius: 999, cursor: 'pointer', border: 'none',
          background: C.forest, color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: serif,
        }}>
          Add a code
        </button>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, background: '#fff' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Code (what clients type)</label>
            <input style={{ ...inputStyle, textTransform: 'uppercase' }} value={code}
              onChange={(e) => setCode(e.target.value)} placeholder="FIRST15" maxLength={40} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Discount type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setType('percent')} style={{
                  flex: 1, padding: '11px 0', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                  border: `1px solid ${type === 'percent' ? C.forest : C.border}`,
                  background: type === 'percent' ? C.forest : '#fff', color: type === 'percent' ? '#fff' : C.sage,
                }}>Percent</button>
                <button type="button" onClick={() => setType('fixed')} style={{
                  flex: 1, padding: '11px 0', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                  border: `1px solid ${type === 'fixed' ? C.forest : C.border}`,
                  background: type === 'fixed' ? C.forest : '#fff', color: type === 'fixed' ? '#fff' : C.sage,
                }}>Dollars</button>
              </div>
            </div>
            <div style={{ width: 120 }}>
              <label style={labelStyle}>{type === 'percent' ? 'Percent off' : 'Dollars off'}</label>
              <input style={inputStyle} value={value} onChange={(e) => setValue(e.target.value)}
                inputMode="decimal" placeholder={type === 'percent' ? '15' : '20'} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={newOnly} onChange={(e) => setNewOnly(e.target.checked)}
              style={{ width: 20, height: 20 }} />
            <span style={{ fontSize: 15, color: C.forest }}>First-time clients only</span>
          </label>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Expires (optional)</label>
              <input type="date" style={inputStyle} value={expires} onChange={(e) => setExpires(e.target.value)} />
            </div>
            <div style={{ width: 130 }}>
              <label style={labelStyle}>Limit uses (optional)</label>
              <input style={inputStyle} value={cap} onChange={(e) => setCap(e.target.value)}
                inputMode="numeric" placeholder="no limit" />
            </div>
          </div>

          {error && <p style={{ color: C.danger, fontSize: 14, margin: '0 0 12px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={createCoupon} disabled={saving} style={{
              padding: '12px 20px', borderRadius: 999, cursor: saving ? 'default' : 'pointer', border: 'none',
              background: C.forest, color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: serif, opacity: saving ? 0.6 : 1,
            }}>
              {saving ? 'Saving.' : 'Save code'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} style={{
              padding: '12px 20px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${C.border}`, background: '#fff', color: C.sage, fontSize: 15, fontWeight: 700,
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
