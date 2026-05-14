// src/components/BookingPolicies.jsx
//
// Settings card: 'Booking policies' text the therapist wants clients
// to read and agree to before confirming a booking. Sibling card to
// CancellationPolicy. Separate concept: cancellation is about charging
// fees on late cancels; booking policies cover practice rules (late
// arrivals, intake forms, illness, draping, scope of practice, kids,
// communication channels, anything else the therapist wants to set
// expectations on).
//
// On the booking page, when enabled, the client sees the policy text
// in a scrollable box with a checkbox 'I have read and agree' that
// must be ticked before they can confirm. The agreed-to text and
// timestamp are snapshotted onto the booking row for audit trail.
//
// Triggered by Ashley Scalzulli's May 2026 email: 'I would love to be
// able to add policies that the client has to read before booking.'

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const C = {
  forest: '#1F3A2C',
  sage: '#4A6B54',
  cream: '#FBF8F1',
  paper: '#FFFFFF',
  lineFaint: '#E8E0D0',
  ink: '#1F2937',
  inkSoft: '#6F7B6C',
  muted: '#8A9C90',
  gold: '#C9A84C',
  goldBg: '#FAF3DC',
};

const F = {
  sans: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
};

// Default draft so new therapists are not staring at a blank box.
// Written in plain language. Therapist can edit any of this.
const DEFAULT_DRAFT = `Welcome! A few things to know before your first session:

INTAKE FORM
Please fill out the intake form at least 24 hours before your appointment so I can prepare for your session. The link is in your confirmation email.

ARRIVING ON TIME
If you arrive late, your session may be shortened to keep me on schedule for the next client. The full session fee still applies. If you are more than 15 minutes late and have not reached out, the session may be cancelled.

ILLNESS
If you are feeling sick (cold, flu, fever, anything contagious) please reschedule. There is no fee to reschedule for illness with at least 4 hours notice.

DRAPING AND COMFORT
You will be properly draped at all times. Only the area being worked on is uncovered. You decide what level of pressure feels right and you can ask me to adjust anything at any time.

SCOPE OF PRACTICE
I provide therapeutic massage focused on muscle and tissue health. I do not diagnose medical conditions. If you have a specific medical concern, please speak with your physician.

COMMUNICATION
The best way to reach me is by text. I will respond within 24 hours on weekdays. For urgent rescheduling, please call.

Thank you for trusting me with your care.`;

export default function BookingPolicies({ therapist }) {
  const [enabled, setEnabled] = useState(!!therapist?.booking_policies_enabled);
  const [text, setText] = useState(therapist?.booking_policies || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setEnabled(!!therapist?.booking_policies_enabled);
    setText(therapist?.booking_policies || '');
  }, [therapist?.id]);

  const isEmpty = !text.trim();
  const isDirty = (text !== (therapist?.booking_policies || '')) ||
                  (enabled !== !!therapist?.booking_policies_enabled);

  async function save() {
    if (!therapist?.id) return;
    setSaving(true);
    setError('');
    try {
      const { error: e } = await supabase
        .from('therapists')
        .update({
          booking_policies: text || null,
          booking_policies_enabled: enabled && !isEmpty,
        })
        .eq('id', therapist.id);
      if (e) throw e;
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function useTemplate() {
    setText(DEFAULT_DRAFT);
  }

  return (
    <div style={{
      background: C.paper,
      border: `1px solid ${C.lineFaint}`,
      borderRadius: 12,
      padding: 16,
      fontFamily: F.sans,
    }}>
      {/* Section title + on/off toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: C.muted,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginBottom: 3,
          }}>
            Booking policies
          </div>
          <div style={{
            fontFamily: F.serif,
            fontSize: 17,
            fontWeight: 700,
            color: C.forest,
            lineHeight: 1.25,
          }}>
            Practice rules clients agree to at booking
          </div>
        </div>
        <Toggle on={enabled} onChange={setEnabled} disabled={isEmpty} />
      </div>

      <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.5, marginBottom: 12 }}>
        Write the rules and expectations you want every new client to read before they confirm. Plain text, no formatting needed. Clients see it inside a scrollable box on the booking page with a checkbox to agree.
      </div>

      {/* Template button only when empty */}
      {isEmpty && (
        <button
          onClick={useTemplate}
          style={{
            background: C.goldBg,
            border: `1px solid ${C.gold}`,
            color: C.forest,
            padding: '7px 12px',
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 10,
            fontFamily: F.sans,
          }}
        >
          Use a starter template
        </button>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write your booking policies here. Or tap the starter template above to load a draft you can edit."
        rows={14}
        style={{
          width: '100%',
          padding: 12,
          fontSize: 14,
          lineHeight: 1.5,
          fontFamily: F.sans,
          color: C.ink,
          background: C.cream,
          border: `1px solid ${C.lineFaint}`,
          borderRadius: 10,
          resize: 'vertical',
          minHeight: 200,
          boxSizing: 'border-box',
        }}
      />

      {/* Helper hints */}
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6, fontStyle: 'italic' }}>
        Line breaks are kept. Headings like INTAKE FORM (in caps) read as section titles. Most therapists end up with 5 to 8 short sections.
      </div>

      {/* Preview toggle */}
      {!isEmpty && (
        <button
          onClick={() => setShowPreview(s => !s)}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.sage,
            padding: '8px 0 0',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'underline',
            fontFamily: F.sans,
          }}
        >
          {showPreview ? 'Hide preview' : 'Preview what clients see'}
        </button>
      )}

      {showPreview && !isEmpty && (
        <div style={{
          marginTop: 10,
          background: C.cream,
          border: `1px dashed ${C.gold}`,
          borderRadius: 10,
          padding: 14,
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: C.muted,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}>
            Preview, as clients see it
          </div>
          <PolicyDisplay text={text} />
          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            marginTop: 10,
            padding: '8px 10px',
            background: C.paper,
            borderRadius: 8,
            cursor: 'default',
            opacity: 0.7,
          }}>
            <input type="checkbox" checked={false} readOnly style={{ marginTop: 3 }} />
            <span style={{ fontSize: 13, color: C.ink }}>
              I have read and agree to these policies.
            </span>
          </label>
        </div>
      )}

      {/* Save row */}
      <div style={{
        marginTop: 14,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}>
        <button
          onClick={save}
          disabled={saving || !isDirty}
          style={{
            background: isDirty ? C.forest : '#9CA3AF',
            color: '#fff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: isDirty ? 'pointer' : 'not-allowed',
            fontFamily: F.sans,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
        {isEmpty && enabled && (
          <span style={{ fontSize: 12, color: '#B45309' }}>
            Add some text first, then turn on.
          </span>
        )}
        {error && (
          <span style={{ fontSize: 12, color: '#B91C1C' }}>{error}</span>
        )}
      </div>
    </div>
  );
}

function Toggle({ on, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label="Enable booking policies"
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        border: 'none',
        background: on ? C.sage : '#D1D5DB',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.18s ease',
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3,
        left: on ? 21 : 3,
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        transition: 'left 0.18s ease',
      }} />
    </button>
  );
}

// Same renderer used by the booking page gate, so the preview shown
// in Settings looks pixel-identical to what the client will see.
export function PolicyDisplay({ text }) {
  const lines = (text || '').split(/\r?\n/);
  const blocks = [];
  let buf = [];
  const flushPara = () => {
    if (buf.length) {
      blocks.push({ kind: 'p', text: buf.join(' ').trim() });
      buf = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      continue;
    }
    // ALL-CAPS short line = heading
    if (line.length <= 64 && line === line.toUpperCase() && /[A-Z]/.test(line)) {
      flushPara();
      blocks.push({ kind: 'h', text: line });
      continue;
    }
    buf.push(line);
  }
  flushPara();

  return (
    <div style={{
      maxHeight: 320,
      overflowY: 'auto',
      paddingRight: 4,
    }}>
      {blocks.map((b, i) => b.kind === 'h' ? (
        <div key={i} style={{
          fontSize: 10.5,
          fontWeight: 800,
          color: C.forest,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginTop: i === 0 ? 0 : 14,
          marginBottom: 4,
          fontFamily: F.sans,
        }}>
          {b.text}
        </div>
      ) : (
        <p key={i} style={{
          margin: '0 0 8px',
          fontSize: 13.5,
          lineHeight: 1.55,
          color: C.ink,
          fontFamily: F.sans,
        }}>
          {b.text}
        </p>
      ))}
    </div>
  );
}
