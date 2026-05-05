// src/components/CancellationPolicy.jsx
//
// Settings UI for configuring the cancellation policy.
//
// Built for the 70-year-old grandma LMT persona: every line reads as
// "if this happens, then that happens." No jargon. No rule-builder
// abstractions. Sensible defaults so most therapists never touch it
// beyond toggling on.
//
// Above the rules, an SOP/explainer card answers "why have a
// cancellation policy?" in plain English. Below the rules, a preview
// shows exactly what clients will see at booking — auto-generated
// from the rule values, with optional override.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  DEFAULT_POLICY,
  effectivePolicy,
  generatePolicyText,
} from '../lib/cancellationPolicy';

const C = {
  forest: '#2A5741',
  sage:   '#5C7A4F',
  ink:    '#1F2937',
  gray:   '#6B7280',
  light:  '#E5E7EB',
  cream:  '#FAF6EE',
  beige:  '#F5EFE0',
  rose:   '#A87468',
  warm:   '#FEF3C7',
  warmBd: '#FCD34D',
  bg:     '#F9FAFB',
};

// Modern toggle switch — same style as IntakeEditor.
function Toggle({ on, onChange, ariaLabel }) {
  return (
    <button
      onClick={onChange}
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        width: 36, height: 20,
        borderRadius: 999,
        background: on ? C.forest : '#D1D5DB',
        border: 'none', cursor: 'pointer',
        transition: 'background 0.18s',
        flexShrink: 0,
        padding: 0,
      }}>
      <span style={{
        position: 'absolute',
        top: 2, left: on ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.18s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }}/>
    </button>
  );
}

// Small percent input. Range 0-100, no decimals. Tab/click to edit.
function PercentInput({ value, onChange, ariaLabel }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <input
        type="number"
        min="0"
        max="100"
        value={value}
        onChange={(e) => {
          const v = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
          onChange(v);
        }}
        aria-label={ariaLabel}
        style={{
          width: 48,
          padding: '4px 6px',
          border: `1.5px solid ${C.light}`,
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 700,
          textAlign: 'right',
          color: C.forest,
          fontFamily: 'inherit',
        }}
      />
      <span style={{ fontSize: 13, fontWeight: 700, color: C.forest }}>%</span>
    </span>
  );
}

// One "if/then" rule row. Plain English on the left, percent on the right.
function RuleRow({ ifText, value, onChange, ariaLabel }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '8px 4px',
      borderBottom: `1px dashed ${C.light}`,
      flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 220, fontSize: 13, color: C.ink, lineHeight: 1.5 }}>
        {ifText}
      </div>
      <div style={{ flexShrink: 0 }}>
        <PercentInput value={value} onChange={onChange} ariaLabel={ariaLabel} />
      </div>
    </div>
  );
}

export default function CancellationPolicy({ therapist }) {
  const { updateProfile } = useAuth();
  const [policy, setPolicy] = useState(() => effectivePolicy(therapist));
  const [enabled, setEnabled] = useState(!!therapist?.cancellation_policy_enabled);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const saveTimer = useRef(null);
  const [editingText, setEditingText] = useState(false);

  // Debounced save: 600ms after the last change.
  const queueSave = useCallback((nextPolicy, nextEnabled) => {
    setSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const result = await updateProfile({
        cancellation_policy: nextPolicy,
        cancellation_policy_enabled: nextEnabled,
      });
      setSaving(false);
      if (result?.error) {
        console.error('CancellationPolicy save failed:', result.error);
        return;
      }
      setSavedAt(Date.now());
    }, 600);
  }, [updateProfile]);

  const update = (patch) => {
    setPolicy((prev) => {
      const next = { ...prev, ...patch };
      queueSave(next, enabled);
      return next;
    });
  };

  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    queueSave(policy, next);
  };

  const previewText = generatePolicyText({ ...policy, enabled });

  return (
    <div style={{ padding: '4px 4px' }}>

      {/* SOP / "why this exists" explainer at the top. The 70-year-old
          grandma LMT persona deserves a plain explanation before she
          hits the rule rows. Hotels and airlines anchor the comparison. */}
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
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Why have a cancellation policy?</div>
        Most hotels and airlines charge you if you cancel last-minute. Your time is just as valuable. A clear policy keeps clients honest and protects your earnings when someone changes plans late or does not show up.
        <br/><br/>
        Below: set what happens for cancels, reschedules, and no-shows. We give you sensible defaults. You can leave them as-is or change the percentages. Your clients see this in plain English at booking, before they confirm.
      </div>

      {/* Master toggle */}
      <div style={{
        background: '#fff', border: `1px solid ${C.light}`,
        borderRadius: 10, padding: '12px 14px', marginBottom: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
            Cancellation policy {enabled ? 'on' : 'off'}
          </div>
          <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.5 }}>
            {enabled
              ? 'Clients see your policy at booking. Card capture and auto-charge come in the next deploy.'
              : 'Turn on to show clients your policy at booking and start protecting your time.'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: saving ? C.gray : (savedAt ? C.forest : C.gray), fontWeight: 600 }}>
            {saving ? '· Saving…' : (savedAt ? '✓ Saved' : '')}
          </span>
          <Toggle on={enabled} onChange={toggleEnabled} ariaLabel="Toggle cancellation policy" />
        </div>
      </div>

      {/* RULES — only shown when policy is on. Hides clutter for therapists
          who do not need this feature yet. */}
      {enabled && (
        <>
          {/* Cancel rules */}
          <div style={{
            background: '#fff', border: `1px solid ${C.light}`,
            borderRadius: 10, padding: '14px 14px 4px', marginBottom: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, letterSpacing: 1.5, marginBottom: 4 }}>
              IF A CLIENT CANCELS
            </div>
            <RuleRow
              ifText="More than 24 hours before the appointment"
              value={policy.cancel_24h_plus_percent}
              onChange={(v) => update({ cancel_24h_plus_percent: v })}
              ariaLabel="Cancel more than 24 hours percent"
            />
            <RuleRow
              ifText="Within 24 hours of the appointment"
              value={policy.cancel_2_to_24h_percent}
              onChange={(v) => update({ cancel_2_to_24h_percent: v })}
              ariaLabel="Cancel within 24 hours percent"
            />
            <RuleRow
              ifText="Within 2 hours of the appointment"
              value={policy.cancel_under_2h_percent}
              onChange={(v) => update({ cancel_under_2h_percent: v })}
              ariaLabel="Cancel within 2 hours percent"
            />
          </div>

          {/* Reschedule rules */}
          <div style={{
            background: '#fff', border: `1px solid ${C.light}`,
            borderRadius: 10, padding: '14px 14px 4px', marginBottom: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, letterSpacing: 1.5, marginBottom: 4 }}>
              IF A CLIENT RESCHEDULES
            </div>
            <RuleRow
              ifText="More than 24 hours before the appointment"
              value={policy.reschedule_24h_plus_percent}
              onChange={(v) => update({ reschedule_24h_plus_percent: v })}
              ariaLabel="Reschedule more than 24 hours percent"
            />
            <RuleRow
              ifText="Within 24 hours of the appointment"
              value={policy.reschedule_under_24h_percent}
              onChange={(v) => update({ reschedule_under_24h_percent: v })}
              ariaLabel="Reschedule within 24 hours percent"
            />
          </div>

          {/* No-show rule */}
          <div style={{
            background: '#fff', border: `1px solid ${C.light}`,
            borderRadius: 10, padding: '14px 14px 4px', marginBottom: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, letterSpacing: 1.5, marginBottom: 4 }}>
              IF A CLIENT DOES NOT SHOW UP
            </div>
            <RuleRow
              ifText="At appointment time"
              value={policy.no_show_percent}
              onChange={(v) => update({ no_show_percent: v })}
              ariaLabel="No-show percent"
            />
          </div>

          {/* Card on file */}
          <div style={{
            background: '#fff', border: `1px solid ${C.light}`,
            borderRadius: 10, padding: '14px', marginBottom: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, letterSpacing: 1.5, marginBottom: 8 }}>
              CARD ON FILE AT BOOKING
            </div>
            <div style={{ fontSize: 11, color: C.gray, marginBottom: 10, lineHeight: 1.5 }}>
              Require clients to save a card so the policy above can charge if needed. Cards are stored securely with Stripe. They are only charged if the policy triggers.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Toggle
                on={policy.card_required_first_timers}
                onChange={() => update({ card_required_first_timers: !policy.card_required_first_timers })}
                ariaLabel="Require card from first-time clients"
              />
              <span style={{ fontSize: 12, color: C.ink }}>Require card from new clients (first-timers)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Toggle
                on={policy.card_required_regulars}
                onChange={() => update({ card_required_regulars: !policy.card_required_regulars })}
                ariaLabel="Require card from returning clients"
              />
              <span style={{ fontSize: 12, color: C.ink }}>Require card from returning clients</span>
            </div>
          </div>

          {/* Preview — what client will see at booking */}
          <div style={{
            background: C.cream, border: `1px solid ${C.beige}`,
            borderRadius: 10, padding: '14px', marginBottom: 6,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 8, gap: 8, flexWrap: 'wrap',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, letterSpacing: 1.5 }}>
                WHAT YOUR CLIENTS WILL SEE
              </div>
              <button
                onClick={() => setEditingText((e) => !e)}
                style={{
                  background: 'transparent', border: `1px solid ${C.light}`,
                  color: C.gray, borderRadius: 6,
                  padding: '3px 9px', fontSize: 10, fontWeight: 600,
                  cursor: 'pointer',
                }}>
                {editingText ? 'Use auto-generated' : 'Write my own'}
              </button>
            </div>
            {editingText ? (
              <textarea
                value={policy.custom_text || previewText}
                onChange={(e) => update({ custom_text: e.target.value })}
                rows={8}
                style={{
                  width: '100%',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  border: `1.5px solid ${C.light}`,
                  borderRadius: 8,
                  padding: 10,
                  resize: 'vertical',
                  lineHeight: 1.6,
                  color: C.ink,
                  background: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <pre style={{
                margin: 0,
                fontSize: 12,
                fontFamily: 'inherit',
                whiteSpace: 'pre-wrap',
                color: C.ink,
                lineHeight: 1.6,
              }}>{previewText}</pre>
            )}
          </div>

          {/* Phase 2 honesty banner */}
          <div style={{
            background: C.warm, border: `1px solid ${C.warmBd}`,
            borderRadius: 8, padding: '8px 12px', marginTop: 12,
            fontSize: 11, color: '#78350F', lineHeight: 1.5,
          }}>
            <strong>Heads up:</strong> the policy text shows on your booking page now. Card capture and auto-charging come in the next deploy.
          </div>
        </>
      )}
    </div>
  );
}
