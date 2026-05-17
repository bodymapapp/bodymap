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

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

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
    setSaving(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.from('session_payments').insert({
        booking_id: appt.id,
        therapist_id: therapist.id,
        client_id: client?.id || null,
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

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 30, 25, 0.55)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1000,
  };
  const sheetStyle = {
    background: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxWidth: 520,
    maxHeight: '88vh',
    overflowY: 'auto',
    padding: '24px 22px 32px',
    boxShadow: '0 -12px 48px rgba(0,0,0,0.18)',
    fontFamily: 'system-ui, sans-serif',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={e => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, background: C.border, borderRadius: 999, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400, color: C.forestDeep }}>Mark as paid</div>
            <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>Record a payment you took outside the app.</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, color: C.inkFade, cursor: 'pointer', padding: 4 }}>×</button>
        </div>

        {/* Amount + tip */}
        <div style={{ background: C.cream, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
            <Field label="Amount" value={amount} setValue={setAmount} />
            <Field label="Tip (optional)" value={tip} setValue={setTip} />
          </div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: `1px dashed ${C.border}`, paddingTop: 10 }}>
            <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Total</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.forestDeep }}>${(totalCents / 100).toFixed(2)}</div>
          </div>
        </div>

        {/* Method picker */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>Payment method</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {METHODS.map(m => (
              <button key={m.value} type="button" onClick={() => setMethod(m.value)} style={{
                background: method === m.value ? `linear-gradient(135deg, ${C.forestDeep}, ${C.forest})` : '#fff',
                color: method === m.value ? '#fff' : C.ink,
                border: method === m.value ? 'none' : `1.5px solid ${C.border}`,
                borderRadius: 12,
                padding: '12px 8px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}>
                <span style={{ fontSize: 18 }}>{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>Note (optional)</div>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Venmo @sarah-foo, check #1234"
            style={{
              width: '100%',
              border: `1.5px solid ${C.border}`,
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 14,
              color: C.ink,
              background: '#fff',
              boxSizing: 'border-box',
              outline: 'none',
            }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} disabled={saving} style={{ flex: '0 0 90px', background: 'transparent', color: C.inkSoft, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', fontSize: 14, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving || !validAmount} style={{
            flex: 1,
            background: saving ? C.inkSoft : `linear-gradient(135deg, ${C.forestDeep}, ${C.forest})`,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '12px 18px',
            fontSize: 15,
            fontWeight: 700,
            cursor: (saving || !validAmount) ? 'wait' : 'pointer',
            opacity: validAmount ? 1 : 0.5,
          }}>
            {saving ? 'Saving…' : `Record $${(totalCents / 100).toFixed(2)}`}
          </button>
        </div>

        {errorMsg && (
          <div style={{ marginTop: 14, background: C.redSoft, border: `1.5px solid #FCA5A5`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#991B1B', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
            {errorMsg}
          </div>
        )}
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
          placeholder="0.00"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, fontWeight: 600, color: C.ink, background: 'transparent', width: '100%', minWidth: 0 }}
        />
      </div>
    </div>
  );
}
