import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280', light:'#E8E4DC', danger:'#EF4444' };

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code; // e.g. ABCD-EFGH-JKLM
}

export default function GiftCertificates({ therapist }) {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ amount: '', recipient_name: '', recipient_email: '', purchaser_name: '', message: '' });
  const [showForm, setShowForm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => { load(); }, [therapist.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('gift_certificates')
      .select('*')
      .eq('therapist_id', therapist.id)
      .order('created_at', { ascending: false });
    setCerts(data || []);
    setLoading(false);
  }

  async function create() {
    if (!form.amount || isNaN(form.amount) || parseFloat(form.amount) <= 0) return;
    setCreating(true);
    const code = genCode();
    const { error } = await supabase.from('gift_certificates').insert({
      therapist_id: therapist.id,
      code,
      amount: parseFloat(form.amount),
      remaining: parseFloat(form.amount),
      recipient_name: form.recipient_name || null,
      recipient_email: form.recipient_email || null,
      purchaser_name: form.purchaser_name || null,
      message: form.message || null,
      status: 'active',
      created_at: new Date().toISOString(),
    });
    setCreating(false);
    if (!error) {
      setForm({ amount: '', recipient_name: '', recipient_email: '', purchaser_name: '', message: '' });
      setShowForm(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      load();
    }
  }

  async function deactivate(id) {
    await supabase.from('gift_certificates').update({ status: 'cancelled' }).eq('id', id);
    load();
  }

  function copy(code) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  const statusColor = s => s === 'active' ? '#16A34A' : s === 'redeemed' ? '#6B7280' : '#DC2626';
  const statusBg = s => s === 'active' ? '#F0FDF4' : s === 'redeemed' ? '#F9FAFB' : '#FEF2F2';

  const active = certs.filter(c => c.status === 'active');
  const past = certs.filter(c => c.status !== 'active');

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:C.dark, margin:0 }}>Gift Certificates</h2>
          <p style={{ fontSize:13, color:C.gray, margin:'4px 0 0' }}>Issue and track gift certificates for your practice</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ background:C.forest, color:'#fff', border:'none', borderRadius:10, padding:'10px 18px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          + Issue Certificate
        </button>
      </div>

      {saved && (
        <div style={{ background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#16A34A', fontWeight:600 }}>
          ✅ Gift certificate created successfully!
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div style={{ background:C.white, borderRadius:14, padding:24, border:`1.5px solid ${C.light}`, marginBottom:20, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:C.dark, margin:'0 0 16px' }}>New Gift Certificate</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }} className="bm-2col">
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:C.gray, display:'block', marginBottom:6 }}>Amount ($) *</label>
              <input type="number" min="1" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}
                placeholder="e.g. 85"
                style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${C.light}`, borderRadius:8, fontSize:14, boxSizing:'border-box', outline:'none' }} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:C.gray, display:'block', marginBottom:6 }}>Purchaser Name</label>
              <input type="text" value={form.purchaser_name} onChange={e=>setForm(f=>({...f,purchaser_name:e.target.value}))}
                placeholder="Who is buying this?"
                style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${C.light}`, borderRadius:8, fontSize:14, boxSizing:'border-box', outline:'none' }} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:C.gray, display:'block', marginBottom:6 }}>Recipient Name</label>
              <input type="text" value={form.recipient_name} onChange={e=>setForm(f=>({...f,recipient_name:e.target.value}))}
                placeholder="Who will receive this?"
                style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${C.light}`, borderRadius:8, fontSize:14, boxSizing:'border-box', outline:'none' }} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:C.gray, display:'block', marginBottom:6 }}>Recipient Email</label>
              <input type="email" value={form.recipient_email} onChange={e=>setForm(f=>({...f,recipient_email:e.target.value}))}
                placeholder="Optional — to send the certificate"
                style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${C.light}`, borderRadius:8, fontSize:14, boxSizing:'border-box', outline:'none' }} />
            </div>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:700, color:C.gray, display:'block', marginBottom:6 }}>Personal Message</label>
            <textarea value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))}
              placeholder="Optional message to include with the certificate..."
              rows={3}
              style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${C.light}`, borderRadius:8, fontSize:14, boxSizing:'border-box', outline:'none', resize:'vertical', fontFamily:'system-ui' }} />
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={create} disabled={creating || !form.amount}
              style={{ background:creating||!form.amount?C.sage:C.forest, color:'#fff', border:'none', borderRadius:8, padding:'11px 20px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              {creating ? 'Creating…' : 'Create Certificate'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ background:'transparent', color:C.gray, border:`1.5px solid ${C.light}`, borderRadius:8, padding:'11px 20px', fontSize:14, cursor:'pointer' }}>
              Cancel
            </button>
          </div>
          <p style={{ fontSize:11, color:C.gray, marginTop:10 }}>A unique code will be generated. The client presents this code when booking or at the session to apply the credit.</p>
        </div>
      )}

      {/* Active Certificates */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:C.gray, fontSize:14 }}>Loading…</div>
      ) : (
        <>
          {active.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Active ({active.length})</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {active.map(cert => (
                  <div key={cert.id} style={{ background:C.white, borderRadius:12, padding:'16px 20px', border:`1.5px solid ${C.light}`, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:200 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <code style={{ fontSize:15, fontWeight:800, color:C.forest, letterSpacing:'0.05em' }}>{cert.code}</code>
                        <button onClick={() => copy(cert.code)}
                          style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:12, color:C.gray }}>
                          {copied === cert.code ? '✅ Copied' : '📋'}
                        </button>
                      </div>
                      <div style={{ fontSize:13, color:C.gray }}>
                        {cert.recipient_name && <span style={{ marginRight:12 }}>To: <strong>{cert.recipient_name}</strong></span>}
                        {cert.purchaser_name && <span>From: <strong>{cert.purchaser_name}</strong></span>}
                      </div>
                      {cert.message && <div style={{ fontSize:12, color:C.gray, marginTop:4, fontStyle:'italic' }}>"{cert.message}"</div>}
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:20, fontWeight:800, color:C.forest }}>${cert.remaining?.toFixed(0)}</div>
                      {cert.remaining < cert.amount && (
                        <div style={{ fontSize:11, color:C.gray }}>of ${cert.amount?.toFixed(0)}</div>
                      )}
                      <div style={{ background:statusBg(cert.status), color:statusColor(cert.status), borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700, marginTop:4, display:'inline-block' }}>
                        {cert.status}
                      </div>
                    </div>
                    <button onClick={() => deactivate(cert.id)}
                      style={{ background:'transparent', color:'#DC2626', border:'1px solid #FECACA', borderRadius:8, padding:'6px 12px', fontSize:12, cursor:'pointer', flexShrink:0 }}>
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active.length === 0 && !showForm && (
            <div style={{ background:C.white, borderRadius:14, padding:'40px 24px', textAlign:'center', border:`1.5px dashed ${C.light}` }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🎁</div>
              <div style={{ fontSize:15, fontWeight:600, color:C.dark, marginBottom:6 }}>No active gift certificates</div>
              <div style={{ fontSize:13, color:C.gray, marginBottom:20 }}>Issue one when a client wants to give the gift of massage.</div>
              <button onClick={() => setShowForm(true)}
                style={{ background:C.forest, color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                Issue First Certificate
              </button>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Past</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {past.map(cert => (
                  <div key={cert.id} style={{ background:'#F9FAFB', borderRadius:10, padding:'12px 16px', border:`1px solid ${C.light}`, display:'flex', alignItems:'center', gap:12, opacity:0.7 }}>
                    <code style={{ fontSize:14, fontWeight:700, color:C.gray, letterSpacing:'0.05em', flex:1 }}>{cert.code}</code>
                    <div style={{ fontSize:13, color:C.gray }}>${cert.amount?.toFixed(0)}</div>
                    <div style={{ background:statusBg(cert.status), color:statusColor(cert.status), borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700 }}>
                      {cert.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
