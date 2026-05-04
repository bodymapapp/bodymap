import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const C = { forest:'#2A5741', sage:'#6B9E80', blush:'#F9A8B4', rose:'#E85C79', rosePale:'#FCE7F3', cream:'#FFF9F3', white:'#FFFFFF', dark:'#1F2937', gray:'#6B7280', light:'#E8E4DC' };

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Botanical decoration SVG - subtle leaves & flowers
function BotanicalFlourish({ style, color = '#F9A8B4', opacity = 0.5 }) {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" style={style} fill="none">
      <g opacity={opacity}>
        <path d="M20 80 Q 30 50, 50 40 Q 70 50, 80 80" stroke="#6B9E80" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
        <ellipse cx="30" cy="55" rx="5" ry="9" fill="#6B9E80" opacity="0.5" transform="rotate(-35 30 55)"/>
        <ellipse cx="70" cy="55" rx="5" ry="9" fill="#6B9E80" opacity="0.5" transform="rotate(35 70 55)"/>
        <circle cx="50" cy="38" r="4" fill={color}/>
        <circle cx="50" cy="38" r="2" fill="#fff"/>
        <circle cx="38" cy="30" r="2.5" fill={color} opacity="0.7"/>
        <circle cx="62" cy="30" r="2.5" fill={color} opacity="0.7"/>
      </g>
    </svg>
  );
}

// Visual gift card preview - the actual "card" recipients would feel excited to receive
function GiftCardPreview({ amount, recipient, purchaser, message, code, compact = false }) {
  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(135deg, #FFF1F5 0%, #FFE4E6 40%, #FEF3F2 100%)',
      borderRadius: 20,
      padding: compact ? '20px 22px' : '28px 26px',
      border: '1.5px solid #FBCFE8',
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(249,168,180,0.18), 0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Decorative corner flourish */}
      <BotanicalFlourish style={{ position: 'absolute', top: -18, right: -18, transform: 'rotate(25deg)' }} opacity={0.4} />
      <BotanicalFlourish style={{ position: 'absolute', bottom: -22, left: -22, transform: 'rotate(-145deg) scale(0.7)' }} opacity={0.3} />

      {/* Little flag / ribbon marker */}
      <div style={{
        position: 'absolute', top: 0, left: 24,
        width: 32, height: compact ? 36 : 42,
        background: 'linear-gradient(180deg, #E85C79, #D14560)',
        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%)',
        boxShadow: '0 2px 6px rgba(232,92,121,0.3)',
      }}/>

      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Top: "A gift for you" */}
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 11, fontWeight: 400, color: C.rose, letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 4, marginLeft: compact ? 44 : 48 }}>
          ♡ A gift for you
        </div>

        {/* Recipient name */}
        {recipient && (
          <div style={{ fontFamily: 'Georgia, serif', fontSize: compact ? 20 : 26, fontWeight: 700, color: C.dark, marginBottom: compact ? 4 : 8, fontStyle: 'italic', letterSpacing: '-0.01em' }}>
            Dear {recipient},
          </div>
        )}

        {/* Amount - big and proud */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: compact ? 8 : 14 }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: compact ? 14 : 16, color: C.gray, fontStyle: 'italic' }}>Worth</span>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: compact ? 34 : 44, fontWeight: 700, color: C.forest, letterSpacing: '-0.02em' }}>
            ${amount}
          </span>
          <span style={{ fontSize: compact ? 11 : 12, color: C.gray, fontWeight: 600 }}>of care</span>
        </div>

        {/* Message */}
        {message && (
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: compact ? 13 : 14,
            color: '#4B5563',
            fontStyle: 'italic',
            lineHeight: 1.55,
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.55)',
            borderLeft: `2.5px solid ${C.blush}`,
            borderRadius: '4px 12px 12px 4px',
            marginBottom: compact ? 8 : 14,
          }}>
            "{message}"
          </div>
        )}

        {/* From */}
        {purchaser && (
          <div style={{ fontSize: compact ? 12 : 13, color: C.gray, marginBottom: compact ? 10 : 14 }}>
            With love, <span style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontWeight: 600, color: C.dark }}>{purchaser}</span>
          </div>
        )}

        {/* Code */}
        <div style={{
          marginTop: compact ? 10 : 16,
          paddingTop: compact ? 10 : 14,
          borderTop: '1px dashed rgba(232,92,121,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 9, color: C.gray, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 2 }}>Redemption code</div>
            <code style={{ fontSize: compact ? 13 : 15, fontWeight: 700, color: C.forest, letterSpacing: '0.08em', fontFamily: 'ui-monospace, Menlo, monospace' }}>{code}</code>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GiftCertificates({ therapist }) {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ amount: '', recipient_name: '', recipient_email: '', purchaser_name: '', message: '' });
  const [clients, setClients] = useState([]);
  const [purchaserSuggestions, setPurchaserSuggestions] = useState([]);
  const [recipientSuggestions, setRecipientSuggestions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(null);
  // Resend-email button state. resendingId tracks which row's button is
  // currently in-flight (for spinner). resendResult shows the most recent
  // success/failure feedback for ~4 seconds after a resend completes.
  const [resendingId, setResendingId] = useState(null);
  const [resendResult, setResendResult] = useState(null);
  const [previewCert, setPreviewCert] = useState(null);

  useEffect(() => {
    load();
    loadClients();
  }, [therapist.id]);

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id,name,email,phone').eq('therapist_id', therapist.id).order('name');
    setClients(data || []);
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('gift_certificates')
      .select('*')
      .eq('therapist_id', therapist.id)
      .order('created_at', { ascending: false });
    setCerts(data || []);
    setLoading(false);
  }

  // Sends (or re-sends) the recipient email for a given gift certificate row.
  // Returns { ok: true } on success, { ok: false, reason } on failure.
  // Logs every failure visibly to the browser console so HK can see what
  // is going wrong instead of silent swallowing.
  async function sendRecipientEmail(certId, { force = false } = {}) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
      if (!accessToken) {
        console.error('[gift-card-email] no auth token, cannot send');
        return { ok: false, reason: 'no_auth' };
      }
      if (!supabaseUrl) {
        console.error('[gift-card-email] REACT_APP_SUPABASE_URL not set in build');
        return { ok: false, reason: 'no_url' };
      }
      const res = await fetch(`${supabaseUrl}/functions/v1/send-gift-certificate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ gift_certificate_id: certId, force }),
      });
      if (!res.ok) {
        let body = '';
        try { body = await res.text(); } catch { /* ignore */ }
        console.error(`[gift-card-email] send failed: HTTP ${res.status}`, body);
        return { ok: false, reason: `http_${res.status}`, body };
      }
      const data = await res.json();
      if (data?.skipped) {
        console.info('[gift-card-email] already sent earlier; pass force:true to resend');
        return { ok: true, skipped: true };
      }
      console.info('[gift-card-email] sent successfully', data);
      return { ok: true };
    } catch (err) {
      console.error('[gift-card-email] exception:', err);
      return { ok: false, reason: 'exception', error: String(err) };
    }
  }

  async function create() {
    if (!form.amount || isNaN(form.amount) || parseFloat(form.amount) <= 0) return;
    setCreating(true);
    const code = genCode();

    const { data: inserted, error } = await supabase.from('gift_certificates').insert({
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
    }).select().single();

    if (error || !inserted) {
      console.error('[gift-card] insert failed:', error);
      setCreating(false);
      return;
    }

    // Fire email send. Awaited so we surface failures, but kept short
    // so the UX still feels snappy. If it takes >3s, the form already
    // cleared; that's acceptable.
    if (form.recipient_email && form.recipient_email.trim()) {
      const result = await sendRecipientEmail(inserted.id);
      if (!result.ok) {
        // Don't block the success state — gift card exists, email can
        // be resent from the row card. But surface a soft warning so
        // the user knows to retry.
        console.warn('[gift-card-email] create succeeded but email send failed; resend from the row card');
      }
    }

    setCreating(false);
    setForm({ amount: '', recipient_name: '', recipient_email: '', purchaser_name: '', message: '' });
    setShowForm(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    load();
  }

  // Resend the email for an existing gift certificate. Used by the
  // "Resend email" button on each active gift cert row card.
  // Sets per-row state so the button shows pending/sent feedback.
  async function resendEmail(certId) {
    setResendingId(certId);
    setResendResult(null);
    const result = await sendRecipientEmail(certId, { force: true });
    setResendingId(null);
    setResendResult({ certId, ok: result.ok, reason: result.reason });
    setTimeout(() => setResendResult(null), 4000);
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

  const active = certs.filter(c => c.status === 'active');
  const past = certs.filter(c => c.status !== 'active');

  const presetAmounts = [65, 85, 120, 150, 200];

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      {/* Hero header, warm, storytelling, feminine */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #FFF1F5 0%, #FFE4E6 35%, #FFF9F3 100%)',
        borderRadius: 24,
        padding: '28px 24px',
        marginBottom: 24,
        border: '1.5px solid #FBCFE8',
        overflow: 'hidden',
        boxShadow: '0 2px 14px rgba(249,168,180,0.15)',
      }}>
        {/* Botanical decorations */}
        <BotanicalFlourish style={{ position: 'absolute', top: -20, right: -10, transform: 'rotate(15deg)' }} />
        <BotanicalFlourish style={{ position: 'absolute', bottom: -30, left: -20, transform: 'rotate(-160deg) scale(0.8)' }} opacity={0.35} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 540 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: C.rose, letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>
            ♡ Gift Cards
          </div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 700, color: C.dark, margin: '0 0 10px', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
            Give the gift of <em style={{ color: C.rose, fontStyle: 'italic' }}>feeling good.</em>
          </h2>
          <p style={{ fontSize: 14, color: '#5B6470', margin: '0 0 22px', lineHeight: 1.65 }}>
            For the mother who gives everything. The friend going through a hard season. The partner who deserves to be cared for. A gift card from you is an hour of peace, wrapped in kindness.
          </p>
          <button onClick={() => setShowForm(!showForm)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: showForm ? 'rgba(255,255,255,0.7)' : 'linear-gradient(135deg, #E85C79, #D14560)',
              color: showForm ? C.rose : '#fff',
              border: showForm ? `1.5px solid ${C.blush}` : 'none',
              borderRadius: 24,
              padding: '12px 22px',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              boxShadow: showForm ? 'none' : '0 4px 14px rgba(232,92,121,0.35)',
              fontFamily: 'Georgia, serif',
              letterSpacing: '0.01em',
              transition: 'all 0.15s',
              WebkitTapHighlightColor: 'transparent',
            }}>
            {showForm ? '× Close' : <>
              <span style={{ fontSize: 16 }}>♡</span>
              Create a gift card
            </>}
          </button>
        </div>
      </div>

      {/* Success toast */}
      {saved && (
        <div style={{
          background: 'linear-gradient(135deg, #FFF1F5, #ECFDF5)',
          border: '1.5px solid #BBF7D0',
          borderRadius: 14,
          padding: '14px 18px',
          marginBottom: 18,
          fontSize: 14, color: C.forest, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>🌸</span>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, marginBottom: 1 }}>Beautifully done.</div>
            <div style={{ fontSize: 12, color: C.gray, fontWeight: 500 }}>Your gift card is ready to share.</div>
          </div>
        </div>
      )}

      {/* Create form, warm, gentle */}
      {showForm && (
        <div style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF9F3 100%)',
          borderRadius: 18,
          padding: 24,
          border: '1.5px solid #FBCFE8',
          marginBottom: 22,
          boxShadow: '0 4px 20px rgba(249,168,180,0.1)',
        }}>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: C.dark, margin: '0 0 4px', fontStyle: 'italic' }}>A new gift, with care</h3>
            <p style={{ fontSize: 13, color: C.gray, margin: 0, lineHeight: 1.5 }}>Fill in a few details. Someone on your list is about to feel very loved.</p>
          </div>

          {/* Live preview at top - so they see what they're creating */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 10, color: C.gray, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>Preview</div>
            <GiftCardPreview
              amount={form.amount || '___'}
              recipient={form.recipient_name || 'friend'}
              purchaser={form.purchaser_name || therapist?.full_name?.split(' ')[0]}
              message={form.message || 'An hour of peace, just for you.'}
              code="XXXX-XXXX-XXXX"
              compact
            />
          </div>

          {/* Amount presets */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.dark, display:'block', marginBottom: 8, fontFamily: 'Georgia, serif' }}>Choose an amount</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {presetAmounts.map(amt => (
                <button key={amt} onClick={() => setForm(f => ({ ...f, amount: String(amt) }))}
                  style={{
                    background: form.amount == amt ? 'linear-gradient(135deg, #E85C79, #D14560)' : '#fff',
                    color: form.amount == amt ? '#fff' : C.dark,
                    border: form.amount == amt ? 'none' : `1.5px solid ${C.light}`,
                    borderRadius: 22,
                    padding: '9px 18px',
                    fontSize: 14, fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'Georgia, serif',
                    boxShadow: form.amount == amt ? '0 2px 8px rgba(232,92,121,0.3)' : 'none',
                    transition: 'all 0.15s',
                  }}>
                  ${amt}
                </button>
              ))}
            </div>
            <input type="number" min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="or enter a custom amount"
              style={{ width: '100%', padding: '12px 14px', border: `1.5px solid ${C.light}`, borderRadius: 12, fontSize: 15, boxSizing: 'border-box', outline: 'none', fontFamily: 'Georgia, serif' }} />
          </div>

          {/* Names */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }} className="bm-2col">
            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>From</label>
              <input type="text" value={form.purchaser_name}
                onChange={e => {
                  const val = e.target.value;
                  setForm(f => ({ ...f, purchaser_name: val }));
                  setPurchaserSuggestions(val.length > 0 ? clients.filter(c => c.name?.toLowerCase().includes(val.toLowerCase())).slice(0, 5) : []);
                }}
                placeholder="Who's giving?"
                style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${C.light}`, borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
              {purchaserSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: `1.5px solid ${C.light}`, borderRadius: 10, zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', marginTop: 4, overflow: 'hidden' }}>
                  {purchaserSuggestions.map(c => (
                    <div key={c.id} onClick={() => { setForm(f => ({ ...f, purchaser_name: c.name })); setPurchaserSuggestions([]); }}
                      style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: `1px solid ${C.light}` }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FFF9F3'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <div style={{ fontWeight: 600, color: C.dark }}>{c.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>To</label>
              <input type="text" value={form.recipient_name}
                onChange={e => {
                  const val = e.target.value;
                  setForm(f => ({ ...f, recipient_name: val }));
                  setRecipientSuggestions(val.length > 0 ? clients.filter(c => c.name?.toLowerCase().includes(val.toLowerCase())).slice(0, 5) : []);
                }}
                placeholder="Who's receiving?"
                style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${C.light}`, borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
              {recipientSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: `1.5px solid ${C.light}`, borderRadius: 10, zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', marginTop: 4, overflow: 'hidden' }}>
                  {recipientSuggestions.map(c => (
                    <div key={c.id} onClick={() => { setForm(f => ({ ...f, recipient_name: c.name, recipient_email: c.email || '' })); setRecipientSuggestions([]); }}
                      style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: `1px solid ${C.light}` }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FFF9F3'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <div style={{ fontWeight: 600, color: C.dark }}>{c.name}</div>
                      {c.email && <div style={{ fontSize: 11, color: C.gray }}>{c.email}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Recipient Email</label>
            <input type="email" value={form.recipient_email} onChange={e => setForm(f => ({ ...f, recipient_email: e.target.value }))}
              placeholder="So we can send her the beautiful card"
              style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${C.light}`, borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>A little note</label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Thinking of you. You deserve this..."
              rows={2}
              style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${C.light}`, borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none', resize: 'vertical', fontFamily: 'Georgia, serif', fontStyle: 'italic', lineHeight: 1.5 }} />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={create} disabled={creating || !form.amount}
              style={{
                flex: 1, minWidth: 180,
                background: creating || !form.amount ? '#E5E1D8' : 'linear-gradient(135deg, #E85C79, #D14560)',
                color: creating || !form.amount ? '#9CA3AF' : '#fff',
                border: 'none', borderRadius: 12,
                padding: '13px 22px',
                fontSize: 14, fontWeight: 700, cursor: creating || !form.amount ? 'not-allowed' : 'pointer',
                fontFamily: 'Georgia, serif',
                boxShadow: creating || !form.amount ? 'none' : '0 4px 14px rgba(232,92,121,0.3)',
              }}>
              {creating ? 'Creating with love...' : '♡ Create this gift'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ background: 'transparent', color: C.gray, border: `1.5px solid ${C.light}`, borderRadius: 12, padding: '13px 22px', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.gray, fontSize: 14 }}>Loading your gift cards...</div>
      ) : (
        <>
          {active.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: C.dark, fontStyle: 'italic' }}>
                  Gifts, waiting to be opened
                </div>
                <div style={{ fontSize: 12, color: C.gray, fontWeight: 600 }}>{active.length} active</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {active.map(cert => (
                  <div key={cert.id} style={{ position: 'relative' }}>
                    <GiftCardPreview
                      amount={cert.amount?.toFixed(0)}
                      recipient={cert.recipient_name}
                      purchaser={cert.purchaser_name}
                      message={cert.message}
                      code={cert.code}
                    />
                    {/* Actions row below the card */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button onClick={() => copy(cert.code)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          background: copied === cert.code ? '#F0FDF4' : '#fff',
                          border: `1.5px solid ${copied === cert.code ? '#86EFAC' : C.light}`,
                          color: copied === cert.code ? C.forest : C.gray,
                          borderRadius: 20,
                          padding: '7px 14px',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}>
                        {copied === cert.code ? '✓ Code copied' : '📋 Copy code'}
                      </button>
                      {/* Print button: opens the standalone print page in a new
                          tab. Therapist picks size in the in-page selector and
                          uses the browser print dialog. Available on every
                          active gift cert regardless of recipient_email. */}
                      <button onClick={() => window.open(`/gift-card/print/${cert.id}`, '_blank')}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          background: '#fff',
                          border: `1.5px solid ${C.light}`,
                          color: C.gray,
                          borderRadius: 20,
                          padding: '7px 14px',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}>
                        🖨️ Print
                      </button>
                      {/* Resend email button. Only shown if a recipient email
                          was captured. Idempotency check on the server is
                          bypassed via force:true so the button always triggers
                          a fresh send. Per-row spinner via resendingId. */}
                      {cert.recipient_email && (
                        <button onClick={() => resendEmail(cert.id)}
                          disabled={resendingId === cert.id}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: (resendResult?.certId === cert.id && resendResult?.ok)
                              ? '#F0FDF4'
                              : (resendResult?.certId === cert.id && !resendResult?.ok)
                                ? '#FEF2F2'
                                : '#fff',
                            border: `1.5px solid ${
                              (resendResult?.certId === cert.id && resendResult?.ok)
                                ? '#86EFAC'
                                : (resendResult?.certId === cert.id && !resendResult?.ok)
                                  ? '#FCA5A5'
                                  : C.light
                            }`,
                            color: (resendResult?.certId === cert.id && resendResult?.ok)
                              ? C.forest
                              : (resendResult?.certId === cert.id && !resendResult?.ok)
                                ? '#DC2626'
                                : C.gray,
                            borderRadius: 20,
                            padding: '7px 14px',
                            fontSize: 12, fontWeight: 600,
                            cursor: resendingId === cert.id ? 'wait' : 'pointer',
                            opacity: resendingId === cert.id ? 0.7 : 1,
                          }}>
                          {resendingId === cert.id
                            ? '⏳ Sending...'
                            : (resendResult?.certId === cert.id && resendResult?.ok)
                              ? '✓ Email sent'
                              : (resendResult?.certId === cert.id && !resendResult?.ok)
                                ? '✗ Send failed'
                                : '✉️ Resend email'}
                        </button>
                      )}
                      {cert.remaining < cert.amount && (
                        <div style={{ fontSize: 12, color: C.gray, fontStyle: 'italic' }}>
                          ${cert.remaining?.toFixed(0)} of ${cert.amount?.toFixed(0)} remaining
                        </div>
                      )}
                      <button onClick={() => deactivate(cert.id)}
                        style={{ marginLeft: 'auto', background: 'transparent', color: '#DC2626', border: '1.5px solid #FECACA', borderRadius: 20, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {active.length === 0 && !showForm && !loading && (
            <div style={{
              position: 'relative',
              background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF9F3 100%)',
              borderRadius: 18,
              padding: '48px 28px',
              textAlign: 'center',
              border: `1.5px dashed ${C.blush}`,
              overflow: 'hidden',
            }}>
              <BotanicalFlourish style={{ position: 'absolute', top: -25, right: 10, transform: 'rotate(20deg)' }} opacity={0.3} />
              <BotanicalFlourish style={{ position: 'absolute', bottom: -30, left: 10, transform: 'rotate(-150deg)' }} opacity={0.25} />

              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>💝</div>
                <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: C.dark, margin: '0 0 8px', fontStyle: 'italic' }}>
                  Your first gift awaits
                </h3>
                <p style={{ fontSize: 14, color: C.gray, marginBottom: 22, lineHeight: 1.6, maxWidth: 360, margin: '0 auto 22px' }}>
                  Someone on your list is having a hard week. A birthday. An anniversary. A "just because." Gift cards travel where flowers can't.
                </p>
                <button onClick={() => setShowForm(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: 'linear-gradient(135deg, #E85C79, #D14560)',
                    color: '#fff', border: 'none',
                    borderRadius: 24,
                    padding: '12px 24px',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(232,92,121,0.3)',
                    fontFamily: 'Georgia, serif',
                  }}>
                  ♡ Create your first gift
                </button>
              </div>
            </div>
          )}

          {/* Past / redeemed, smaller, humble */}
          {past.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: C.gray, fontStyle: 'italic', marginBottom: 12 }}>
                Already opened ({past.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {past.map(cert => (
                  <div key={cert.id} style={{ background: '#FAFAF7', borderRadius: 12, padding: '12px 16px', border: `1px solid ${C.light}`, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.75 }}>
                    <span style={{ fontSize: 14 }}>{cert.status === 'redeemed' ? '✨' : '🗂'}</span>
                    <code style={{ fontSize: 13, fontWeight: 700, color: C.gray, letterSpacing: '0.06em', flex: 1, fontFamily: 'ui-monospace, Menlo, monospace' }}>{cert.code}</code>
                    {cert.recipient_name && <span style={{ fontSize: 12, color: C.gray, fontStyle: 'italic' }}>for {cert.recipient_name}</span>}
                    <div style={{ fontSize: 13, color: C.gray, fontWeight: 600 }}>${cert.amount?.toFixed(0)}</div>
                    <div style={{ background: cert.status === 'redeemed' ? '#F3F4F6' : '#FEF2F2', color: cert.status === 'redeemed' ? C.gray : '#DC2626', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
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
