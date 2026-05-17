// src/components/MarkAsPaidModal.jsx
//
// Phase 12: Record an offline payment (cash, Venmo, Zelle, etc) for
// a booking. Companion to CheckoutModal: separate flow because the
// mental model is different:
//
//   CheckoutModal:  'collect payment now through this app'
//   MarkAsPaidModal: 'payment already happened outside the app, record it'
//
// Per GlossGenius pattern: 'Mark as paid' is a quieter secondary
// button below 'Checkout' on the calendar slide-over.

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import CloseButton from './CloseButton';

const C = {
  forest: '#2A5741',
  forestDeep: '#1F4030',
  sage: '#6B9E80',
  cream: '#FBFAF4',
  border: '#E8E4DC',
  ink: '#1F2937',
  inkSoft: '#6B7280',
  inkFade: '#9CA3AF',
  redSoft: '#FEF2F2',
};

const METHODS = [
  { value: 'cash',    label: 'Cash',     icon: '💵' },
  { value: 'venmo',   label: 'Venmo',    icon: '🇻' },
  { value: 'zelle',   label: 'Zelle',    icon: '🇿' },
  { value: 'cashapp', label: 'Cash App', icon: '💲' },
  { value: 'check',   label: 'Check',    icon: '✍️' },
  { value: 'other',   label: 'Other',    icon: '·' },
];

export default function MarkAsPaidModal({ appt, therapist, client, defaultAmountCents, onClose, onPaid }) {
  const [amount, setAmount] = useState(((defaultAmountCents || 0) / 100).toFixed(2));
  const [tip, setTip] = useState('');
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const amountCents = Math.round((parseFloat(amount) || 0) * 100);
  const tipCents = Math.round((parseFloat(tip) || 0) * 100);
  const totalCents = amountCents + tipCents;
  const validAmount = amountCents > 0;

  async function save() {
    if (!validAmount) { setErrorMsg('Enter a valid amount.'); return; }
    // Phase 13.4 (HK May 17 2026): bookings.client_id is now always set.
    if (!client?.id) { setErrorMsg('Client record missing on this booking.'); return; }
    setSaving(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.from('session_payments').insert({
        booking_id: appt.id,
        therapist_id: therapist.id,
        client_id: client.id,
        amount_cents: amountCents,
        tip_cents: tipCents,
        payment_method: method,
        payment_method_detail: note || null,
        status: 'succeeded',
        paid_at: new Date().toISOString(),
        created_by_therapist_id: therapist.id,
      });
      if (error) throw new Error(error.message);
      onPaid?.();
      onClose();
    } catch (e) {
      setErrorMsg(e?.message || 'Failed to save.');
      setSaving(false);
    }
  }

  const [isMobileViewport, setIsMobileViewport] = useState(typeof window !== 'undefined' && window.innerWidth < 600);
  useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 600);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    height: '100dvh',
    background: 'rgba(15, 30, 25, 0.55)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: isMobileViewport ? 'stretch' : 'center',
    justifyContent: 'center',
    // Phase 13.8.1 (HK May 17 2026): MobileBottomNav is at zIndex 1000.
    // Modal overlay must be above so its pinned footer (Confirm button)
    // isn't visually clipped by the nav.
    zIndex: 1100,
  };
  const sheetStyle = isMobileViewport
    ? {
        // Phase 13.8.2 (HK May 17 2026): iOS Safari measures '100%'
        // against the layout viewport rather than the visible viewport.
        // The footer was rendering at the bottom of the LAYOUT viewport,
        // which sat below where the user could see on iPhone. Switch
        // to 100dvh (dynamic viewport height) which tracks the visible
        // viewport. Modern Safari/Chrome support this; older browsers
        // would fall back to 100vh via the override below.
        background: '#fff',
        width: '100%',
        height: '100dvh',
        maxHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'none',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }
    : {
        background: '#fff',
        borderRadius: 20,
        width: '100%',
        maxWidth: 540,
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        margin: 16,
      };

  const headerStyle = {
    flex: '0 0 auto',
    padding: isMobileViewport ? '18px 20px 14px' : '20px 24px 14px',
    borderBottom: `1px solid ${C.border}`,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    background: '#fff',
    paddingTop: isMobileViewport ? 'max(18px, env(safe-area-inset-top))' : 20,
  };
  const bodyStyle = {
    flex: '1 1 auto',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    padding: isMobileViewport ? '20px 20px 12px' : '20px 24px 16px',
  };
  const footerStyle = {
    flex: '0 0 auto',
    padding: isMobileViewport ? '12px 20px max(16px, env(safe-area-inset-bottom))' : '16px 24px 20px',
    borderTop: `1px solid ${C.border}`,
    background: '#fff',
    display: 'flex',
    gap: 10,
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 400, color: C.forestDeep, letterSpacing: '-0.01em', lineHeight: 1.15 }}>Mark as paid</div>
            <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 3 }}>Record a payment you took outside the app.</div>
          </div>
          <CloseButton onClick={onClose} label="Close" />
        </div>

        <div style={bodyStyle}>
          {/* Amount + tip */}
          <div style={{ background: C.cream, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px', marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
              <Field label="Amount" value={amount} setValue={setAmount} />
              <Field label="Tip (optional)" value={tip} setValue={setTip} />
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: `1px dashed ${C.border}`, paddingTop: 10 }}>
              <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Total</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.forestDeep, fontFamily: 'Georgia, serif' }}>${(totalCents / 100).toFixed(2)}</div>
            </div>
          </div>

          {/* Method picker */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>Payment method</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {METHODS.map(m => (
                <button key={m.value} type="button" onClick={() => setMethod(m.value)} style={{
                  background: method === m.value ? `linear-gradient(135deg, ${C.forestDeep}, ${C.forest})` : '#fff',
                  color: method === m.value ? '#fff' : C.ink,
                  border: method === m.value ? 'none' : `1.5px solid ${C.border}`,
                  borderRadius: 12,
                  padding: '14px 8px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: method === m.value ? '0 2px 8px rgba(42,87,65,0.18)' : 'none',
                }}>
                  <span style={{ fontSize: 18 }}>{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>Note (optional)</div>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Venmo @sarah-foo, check #1234"
              style={{
                width: '100%',
                border: `1.5px solid ${C.border}`,
                borderRadius: 10,
                padding: '11px 14px',
                fontSize: 14,
                color: C.ink,
                background: '#fff',
                boxSizing: 'border-box',
                outline: 'none',
                fontFamily: 'system-ui, sans-serif',
              }} />
          </div>

          {errorMsg && (
            <div style={{ marginTop: 14, background: C.redSoft, border: `1.5px solid #FCA5A5`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#991B1B', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
              {errorMsg}
            </div>
          )}
        </div>

        <div style={footerStyle}>
          <button type="button" onClick={onClose} disabled={saving} style={{ flex: '0 0 100px', background: 'transparent', color: C.inkSoft, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '15px 16px', fontSize: 14, fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving || !validAmount} style={{
            flex: 1,
            background: saving ? C.inkSoft : `linear-gradient(135deg, ${C.forestDeep}, ${C.forest})`,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '15px 18px',
            fontSize: 16,
            fontWeight: 700,
            cursor: (saving || !validAmount) ? 'wait' : 'pointer',
            opacity: validAmount ? 1 : 0.5,
            boxShadow: saving ? 'none' : '0 4px 14px rgba(31,64,48,0.25)',
            letterSpacing: '0.01em',
          }}>
            {saving ? 'Saving…' : `Confirm $${(totalCents / 100).toFixed(2)} paid`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, setValue }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '8px 12px' }}>
        <span style={{ color: C.inkSoft, fontSize: 16, marginRight: 4 }}>$</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={e => setValue(e.target.value.replace(/[^\d.]/g, ''))}
          onFocus={e => e.target.select()}
          placeholder="0.00"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, fontWeight: 600, color: C.ink, background: 'transparent', width: '100%', minWidth: 0 }}
        />
      </div>
    </div>
  );
}
