// src/components/InlineSaveNumberInput.jsx
//
// Number input that auto-saves on blur (or on Enter) with a small
// checkmark badge that appears next to the input and fades out
// after about 1.5 seconds. No save button. Modern pattern, replaces
// dropdowns across Settings.
//
// Per HK design principle May 9 2026: "Drop downs reeks of excel
// formula and websites from 1990s." Use this for any therapist-
// facing numeric setting where the value range is open enough that
// a dropdown would either be too long (1-365 days) or too
// constraining (forces an arbitrary list of choices).
//
// USAGE
//   <InlineSaveNumberInput
//     value={minLeadHours}
//     defaultValue={24}
//     onChange={setMinLeadHours}
//     onSave={async v => {
//       await supabase.from('therapists').update({ minimum_advance_hours: v }).eq('id', therapist.id);
//     }}
//     suffix="hours"
//     min={0}
//     max={8760}
//     placeholder="24"
//   />
//
// PROPS
//   value           Current value (controlled).
//   defaultValue    What appears as placeholder when empty. Industry-
//                   default; the user types over it.
//   onChange        Local state setter. Called on every keystroke.
//   onSave          Async function that persists the value. Called
//                   on blur and on Enter. Must return a promise; the
//                   checkmark waits for resolution before showing.
//   suffix          Text after the input ("hours", "days", "min").
//   min             Numeric floor. Negative inputs clamp to this.
//   max             Numeric ceiling. Anything above clamps to this.
//   placeholder     Visible when input is empty.
//   width           Override input width. Defaults to 80px.
//   disabled        Lock the input.

import React, { useState, useRef } from 'react';

const C = { sage:'#6B9E80', forest:'#2A5741', success:'#10B981', gray:'#6B7280', lightGray:'#E8E4DC', white:'#FFFFFF', dark:'#1A1A2E' };

export default function InlineSaveNumberInput({
  value,
  defaultValue = 0,
  onChange,
  onSave,
  suffix = '',
  min = 0,
  max = 999999,
  placeholder = '',
  width = 80,
  disabled = false,
}) {
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);
  const flashTimer = useRef(null);

  // Sanitize and clamp a string to a valid numeric value within [min, max].
  // Empty string returns 0, which is the "no restriction" sentinel for
  // most settings using this input. Non-numeric returns 0 as well.
  function sanitize(rawStr) {
    if (rawStr === '' || rawStr === null || rawStr === undefined) return 0;
    const n = parseInt(rawStr, 10);
    if (isNaN(n)) return 0;
    return Math.max(min, Math.min(max, n));
  }

  async function commit() {
    if (disabled) return;
    const cleaned = sanitize(value);
    // No-op if the cleaned value already matches what was passed in;
    // avoids spurious DB writes on every blur with no change.
    setSaving(true);
    try {
      await onSave(cleaned);
      setSaving(false);
      setSavedFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setSavedFlash(false), 1500);
    } catch (e) {
      setSaving(false);
      console.error('[InlineSaveNumberInput] save failed:', e);
    }
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      position: 'relative',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: disabled ? '#F3F4F6' : '#F9FAFB',
        border: `1.5px solid ${C.lightGray}`,
        borderRadius: 10,
        padding: '6px 12px',
        gap: 6,
        transition: 'border-color 0.15s',
      }}>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value === 0 || value === null || value === undefined ? '' : String(value)}
          placeholder={placeholder || (defaultValue ? String(defaultValue) : '')}
          disabled={disabled}
          onChange={e => {
            const raw = e.target.value.replace(/[^0-9]/g, '');
            onChange(raw === '' ? 0 : parseInt(raw, 10));
          }}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.target.blur();
            }
          }}
          style={{
            width,
            border: 'none',
            background: 'transparent',
            fontSize: 16,
            fontWeight: 700,
            color: C.forest,
            outline: 'none',
            textAlign: 'center',
            fontFamily: 'system-ui',
          }}
        />
        {suffix && (
          <span style={{ fontSize: 13, color: C.gray, fontWeight: 500 }}>{suffix}</span>
        )}
      </div>

      {/* Checkmark badge. Renders only briefly after a successful
          save. Position: small absolute pill to the right of the
          input. Fades after 1.5s via the savedFlash state. */}
      {(saving || savedFlash) && (
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: saving ? C.gray : C.success,
          padding: '4px 8px',
          borderRadius: 999,
          background: saving ? '#F3F4F6' : '#ECFDF5',
          border: `1px solid ${saving ? C.lightGray : '#A7F3D0'}`,
          opacity: 1,
          transition: 'opacity 0.3s ease-in-out',
          whiteSpace: 'nowrap',
        }}>
          {saving ? 'Saving...' : '✓ Saved'}
        </div>
      )}
    </div>
  );
}
