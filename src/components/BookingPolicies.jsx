// src/components/BookingPolicies.jsx
//
// Settings card: practice policies the therapist wants clients to
// read and agree to before confirming a booking. Sibling card to
// CancellationPolicy. The two are intentionally designed using the
// same visual pattern so they read as a matched pair inside the
// 'Booking & cancellation policies' section in Settings (4.3):
//
//   1. Amber 'Why this matters' SOP card at the top
//   2. White master-toggle row with on/off Toggle (36x20)
//   3. Body content (textarea + preview + save) only shown when on,
//      mirroring how CancellationPolicy hides its rule rows when off
//
// Different concept from cancellation policy (which is about charging
// fees on late cancels). Booking policies cover practice rules
// (intake punctuality, late arrivals, illness, draping, scope of
// practice, communication channels).
//
// Triggered by Ashley Scalzulli's May 2026 email: 'I'd love to be
// able to add policies that the client has to read before booking.'

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Color palette deliberately mirrors CancellationPolicy.jsx so the
// two cards harmonize when stacked.
const C = {
  forest: '#2A5741',
  sage:   '#5C7A4F',
  ink:    '#1F2937',
  gray:   '#6B7280',
  light:  '#E5E7EB',
  cream:  '#FAF6EE',
  beige:  '#F5EFE0',
  warm:   '#FEF3C7',
  warmBd: '#FCD34D',
};

// Modern toggle switch, same dimensions as CancellationPolicy.
function Toggle({ on, onChange, ariaLabel, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange()}
      aria-label={ariaLabel}
      disabled={disabled}
      style={{
        position: 'relative',
        width: 36, height: 20,
        borderRadius: 999,
        background: on ? C.forest : '#D1D5DB',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.18s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2, left: on ? 18 : 2,
        width: 16, height: 16,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.18s',
      }}/>
    </button>
  );
}

// Default starter draft so therapists are not staring at a blank
// box. Plain text. ALL-CAPS short lines render as section headings
// in PolicyDisplay below.
//
// HK May 14 2026: Alison G. shared a MassageBook policy packet (PDF)
// as her reference for what "professional standard" looks like in the
// LMT industry. Sections she wanted covered:
//   - Cancellation + late arrival (already in CancellationPolicy)
//   - Massage guidelines/expectations (13-point list)
//   - Service termination for harassment, intoxication, inappropriate
//     conduct
//   - Draping policy with specific genital/breast language
//   - Hygiene expectations
//   - Scope of practice + medical disclaimer
//   - Reciprocal termination rights (client OR therapist can stop
//     the session at any time)
// This default now mirrors that structure. Therapists can delete
// any section that doesn't fit their practice.
const DEFAULT_DRAFT = `Welcome! Please read through the practice policies before your session.

INTAKE FORM
Please fill out the intake form at least 24 hours before your appointment so I can prepare for your session. The link is in your confirmation email.

ARRIVING ON TIME
For your first appointment, please arrive 15 minutes early to complete the intake form. For all other appointments, arrive 5 minutes before your scheduled time so we can begin on time. If you arrive late, your session may be shortened to keep me on schedule, and the full session fee still applies. If you are more than 15 minutes late and have not reached out, the session may be cancelled.

ILLNESS
If you are feeling sick (cold, flu, fever, anything contagious) please reschedule. There is no fee to reschedule for illness with reasonable notice. Clients with signs, symptoms, or diagnosed contagious conditions or active infections are asked to notify me and reschedule.

DRAPING AND COMFORT
You will be properly draped with a sheet at all times. Only the area being worked on is uncovered. The breast and genital areas are always covered and never massaged. You decide what level of pressure feels right, and you can ask me to adjust anything at any time.

SCOPE OF PRACTICE
I provide therapeutic massage and bodywork within the scope of practice of a licensed massage therapist. I do not diagnose, prescribe, or treat medical conditions. Massage therapy is not a substitute for medical care. If you have a specific medical concern, please speak with your physician. Clients with acute injuries or conditions outside this scope should consult their doctor.

HEALTH HISTORY
Please provide an accurate and complete health history during intake. Inform me of any new diagnoses, medications, injuries, or changes in your health before each session. This keeps you safe.

HYGIENE AND PREPARATION
Please arrive showered and clean. Please avoid eating a heavy meal during the two hours before your session.

PROFESSIONAL ENVIRONMENT
This is a non-smoking, odor-neutral practice. All clients are treated with respect and dignity. Personal and professional boundaries are respected at all times. Harassment, threatening behavior, sexual advances or requests, or disrespectful language will result in the session being ended immediately, and the full session fee still applies.

INTOXICATION
Clients who arrive under the influence of drugs or alcohol will be asked to leave, and the full session fee still applies.

ENDING THE SESSION
You can ask me to stop the session at any time, for any reason. I can also end the session at any time, for any reason, including the situations described above.

COMMUNICATION
The best way to reach me is by text. I respond within 24 hours on weekdays. For urgent rescheduling, please call.

Thank you for trusting me with your care.`;

export default function BookingPolicies({ therapist }) {
  const [enabled, setEnabled] = useState(!!therapist?.booking_policies_enabled);
  const [text, setText] = useState(therapist?.booking_policies || '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setEnabled(!!therapist?.booking_policies_enabled);
    setText(therapist?.booking_policies || '');
  }, [therapist?.id]);

  const isEmpty = !text.trim();
  const isDirty = (text !== (therapist?.booking_policies || '')) ||
                  (enabled !== !!therapist?.booking_policies_enabled);

  async function toggleEnabled() {
    if (!therapist?.id) return;
    // Cannot enable when text is empty.
    if (!enabled && isEmpty) return;
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      const { error: e } = await supabase
        .from('therapists')
        .update({ booking_policies_enabled: next })
        .eq('id', therapist.id);
      if (e) throw e;
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2000);
    } catch (e) {
      setError(e.message || 'Save failed');
      setEnabled(!next); // revert
    } finally {
      setSaving(false);
    }
  }

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
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2000);
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
    <div style={{ padding: '4px 4px' }}>

      {/* SOP / 'why this exists' explainer. Mirrors the amber card at
          the top of CancellationPolicy. The 70-year-old grandma LMT
          persona deserves a plain explanation before she edits text. */}
      <div style={{
        background: C.warm,
        border: `1px solid ${C.warmBd}`,
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 14,
        fontSize: 12,
        color: '#78350F',
        lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Why have booking policies?</div>
        Most new clients do not know your practice yet. A short list of expectations (intake, arriving on time, illness, draping, communication) prevents awkward moments and sets the tone for a good first session.
        <br/><br/>
        Below: write your policies in plain text, or load a starter template you can edit. Clients see them on your booking page with a checkbox they must tick before confirming.
      </div>

      {/* Master toggle. Same structural pattern as CancellationPolicy. */}
      <div style={{
        background: '#fff', border: `1px solid ${C.light}`,
        borderRadius: 10, padding: '12px 14px', marginBottom: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
            Booking policies {enabled ? 'on' : 'off'}
          </div>
          <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.5 }}>
            {enabled
              ? 'Clients see your policies at booking and must tick a box to agree before they confirm.'
              : isEmpty
                ? 'Write your policies below, then turn on to show them to clients.'
                : 'Turn on to show your policies to clients at booking.'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: saving ? C.gray : (savedAt ? C.forest : C.gray), fontWeight: 600 }}>
            {saving ? '· Saving…' : (savedAt ? '✓ Saved' : '')}
          </span>
          <Toggle on={enabled} onChange={toggleEnabled} disabled={isEmpty && !enabled} ariaLabel="Toggle booking policies" />
        </div>
      </div>

      {/* CONTENT: text editor, preview, save. Visible regardless of
          toggle state so the therapist can compose policies before
          turning them on (parallel to how CancellationPolicy shows the
          rule rows only when enabled; here we keep the editor visible
          so the toggle has something to enable). The Preview card uses
          the same white-bg, light-border, 10px-radius styling as
          CancellationPolicy's preview block. */}

      {/* Editor card */}
      <div style={{
        background: '#fff', border: `1px solid ${C.light}`,
        borderRadius: 10, padding: '14px 14px 12px', marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, letterSpacing: 1.5, marginBottom: 8 }}>
          YOUR POLICIES
        </div>

        {isEmpty && (
          <button
            onClick={useTemplate}
            style={{
              background: C.warm,
              border: `1px solid ${C.warmBd}`,
              color: '#78350F',
              padding: '7px 12px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: 10,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📋</span>
            <span>Use a starter template</span>
          </button>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your booking policies here. Or tap the starter template above to load a draft you can edit."
          rows={12}
          style={{
            width: '100%',
            padding: 12,
            fontSize: 14,
            lineHeight: 1.5,
            fontFamily: 'inherit',
            color: C.ink,
            background: C.cream,
            border: `1px solid ${C.light}`,
            borderRadius: 8,
            resize: 'vertical',
            minHeight: 180,
            boxSizing: 'border-box',
          }}
        />

        <div style={{ fontSize: 11, color: C.gray, marginTop: 6, fontStyle: 'italic', lineHeight: 1.5 }}>
          Line breaks are kept. Headings in ALL CAPS read as section titles. Most therapists end up with 5 to 8 short sections.
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={save}
            disabled={saving || !isDirty}
            style={{
              background: isDirty ? C.forest : '#9CA3AF',
              color: '#fff',
              border: 'none',
              padding: '9px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: isDirty ? 'pointer' : 'not-allowed',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : savedAt ? '✓ Saved' : 'Save'}
          </button>
          {error && (
            <span style={{ fontSize: 12, color: '#B91C1C' }}>{error}</span>
          )}
        </div>
      </div>

      {/* Preview card. Always visible when text exists, matching how
          CancellationPolicy shows its preview block at the bottom. No
          'Preview' button to toggle, no separate gold-dashed styling.
          Just a quiet card that mirrors what clients will see. */}
      {!isEmpty && (
        <div style={{
          background: '#fff', border: `1px solid ${C.light}`,
          borderRadius: 10, padding: '14px 14px 12px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, letterSpacing: 1.5, marginBottom: 10 }}>
            WHAT CLIENTS SEE AT BOOKING
          </div>
          <div style={{
            background: C.cream,
            border: `1px solid ${C.beige}`,
            borderRadius: 8,
            padding: 14,
          }}>
            <PolicyDisplay text={text} />
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              marginTop: 12,
              padding: '8px 10px',
              background: '#fff',
              borderRadius: 8,
              border: `1px dashed ${C.light}`,
              cursor: 'default',
              opacity: 0.85,
            }}>
              <input type="checkbox" checked={false} readOnly style={{ marginTop: 3, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: C.ink, lineHeight: 1.45 }}>
                I have read and agree to these policies.
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// PolicyDisplay: shared renderer used by BOTH the booking-page gate
// and this Settings preview so therapists see exactly what clients
// see, pixel-identical. Plain-text in, structured HTML out:
//   - All-caps short lines (<=64 chars with at least one letter) render
//     as forest-green uppercase tracking 0.12em section headings
//   - Other lines render as body paragraphs at 13.5px, line-height 1.55
//   - Blank lines flush the current paragraph buffer
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
    if (!line) { flushPara(); continue; }
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
        }}>
          {b.text}
        </div>
      ) : (
        <p key={i} style={{
          margin: '0 0 8px',
          fontSize: 13.5,
          lineHeight: 1.55,
          color: C.ink,
        }}>
          {b.text}
        </p>
      ))}
    </div>
  );
}
