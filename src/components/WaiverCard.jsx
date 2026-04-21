import React from 'react';
import { supabase } from '../lib/supabase';
import { DEFAULT_WAIVER_TEXT } from '../lib/waiver';

export default function WaiverCard({ therapist, C2 }) {
  const [enabled, setEnabled] = React.useState(therapist?.waiver_enabled !== false);
  const [text, setText] = React.useState(therapist?.waiver_text || DEFAULT_WAIVER_TEXT);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [showWhy, setShowWhy] = React.useState(false);
  const [restored, setRestored] = React.useState(false);

  async function toggle() {
    const newVal = !enabled;
    setEnabled(newVal);
    await supabase.from('therapists').update({ waiver_enabled: newVal }).eq('id', therapist.id);
  }

  async function save() {
    setSaving(true);
    await supabase.from('therapists').update({ waiver_text: text }).eq('id', therapist.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function restoreDefault() {
    setText(DEFAULT_WAIVER_TEXT);
    setRestored(true);
    setTimeout(() => setRestored(false), 2000);
  }

  return (
    <div style={{ background: C2.white, border: `1.5px solid ${C2.lightGray}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.gray, margin: '0 0 6px 0' }}>🛡️ Waiver & Consent</p>
          <p style={{ fontSize: 14, color: C2.darkGray, lineHeight: 1.6, margin: 0, fontFamily: 'Georgia, serif' }}>
            A signed waiver protects you legally. Your clients agree to it automatically when they submit their intake. No extra step for them.
          </p>
        </div>
        <button
          onClick={toggle}
          aria-label={enabled ? 'Waiver on' : 'Waiver off'}
          style={{
            width: 44, height: 26, borderRadius: 13,
            background: enabled ? C2.forest : '#D1D5DB',
            border: 'none',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
        >
          <div style={{
            position: 'absolute',
            top: 3, left: enabled ? 21 : 3,
            width: 20, height: 20,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>

      {/* Why do I need this? */}
      <button
        onClick={() => setShowWhy(v => !v)}
        style={{ background: 'transparent', border: 'none', padding: 0, color: C2.sage, fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', marginBottom: 12 }}
      >
        {showWhy ? 'Hide explanation' : 'Why do I need this?'}
      </button>

      {showWhy && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>
          A waiver is a standard legal protection. It confirms that your client understands what a massage is, has shared their health information honestly, and accepts responsibility for informing you of changes. If a client ever has a bad reaction and tries to hold you liable, a signed waiver is your first line of defense. Every state recognizes digital waivers as legally binding under the ESIGN Act.
        </div>
      )}

      {enabled && (
        <>
          {/* Waiver text box */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.gray, display: 'block', marginBottom: 6 }}>
              Waiver text (your clients will see this)
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 14px',
                border: `1.5px solid ${C2.lightGray}`,
                borderRadius: 10,
                fontSize: 13, lineHeight: 1.6,
                fontFamily: 'Georgia, serif',
                color: C2.darkGray,
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>

          <p style={{ fontSize: 11, color: C2.gray, lineHeight: 1.5, margin: '0 0 14px' }}>
            This is a widely-used template. Most solo therapists use it as-is. If you want it reviewed, show it to a local attorney.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                background: saved ? '#E8F5EE' : C2.forest,
                color: saved ? C2.forest : '#fff',
                border: saved ? '1.5px solid #86EFAC' : 'none',
                padding: '10px 18px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save waiver'}
            </button>
            <button
              onClick={restoreDefault}
              style={{
                background: restored ? '#E8F5EE' : 'transparent',
                color: restored ? C2.forest : C2.gray,
                border: `1.5px solid ${restored ? '#86EFAC' : C2.lightGray}`,
                padding: '10px 18px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {restored ? '✓ Restored' : '↻ Restore default'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
