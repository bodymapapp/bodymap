// src/components/InlineTimeInput.jsx
//
// Time input that the user types directly into. No native browser
// dropdown. No three-field hour/minute/AM-PM contraption. One text
// field, smart parser, normalizes on blur.
//
// Per HK design principle May 9 2026: "Drop downs reeks of excel
// formula and websites from 1990s." Use this anywhere a therapist
// picks a time of day. Companion to InlineSaveNumberInput.
//
// USAGE
//   <InlineTimeInput
//     value="13:30"
//     onChange={t => setBlockStartTime(t)}
//     placeholder="Start"
//   />
//
// PROPS
//   value         Current value in 24-hour HH:MM format (string).
//                 Empty string when nothing is set.
//   onChange      Callback invoked on every successful parse with the
//                 normalized HH:MM string. Empty string if cleared.
//   placeholder   Visible when value is empty. "Start time", "End time".
//   width         Override width. Defaults responsive 110px.
//   disabled      Lock the input.
//   ariaLabel     Accessibility label. Pass a verbose one like
//                 "Start time of blocked window".
//
// PARSING
//   The user can type any of these and the parser normalizes:
//     "2pm"      → 14:00
//     "2p"       → 14:00
//     "2 pm"     → 14:00
//     "2:30pm"   → 14:30
//     "230pm"    → 14:30
//     "1430"     → 14:30
//     "14:30"    → 14:30
//     "9"        → 09:00 (single digits assumed AM)
//     "9am"      → 09:00
//     "12"       → 12:00 (noon)
//     "12am"     → 00:00 (midnight)
//   Invalid input keeps the prior value and shows a brief red shake.

import React, { useState, useEffect, useRef } from 'react';

const C = {
  forest: '#2A5741',
  sage: '#6B9E80',
  cream: '#FBFAF4',
  border: '#E8E4DC',
  ink: '#1F2937',
  inkSoft: '#6B7280',
  inkFade: '#9CA3AF',
  red: '#DC2626',
  redSoft: '#FEE2E2',
};

// Parse a typed string to canonical 24h "HH:MM" or null on failure.
// Tolerates whitespace, punctuation, am/pm in any case, and bare digits.
function parseTime(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return '';  // Empty means cleared, not invalid.

  // Detect am/pm marker. Strip it from the digit-extraction step.
  let ampm = null;
  let cleaned = s;
  if (cleaned.endsWith('am') || cleaned.endsWith('a.m.') || cleaned.endsWith('a')) {
    ampm = 'am';
    cleaned = cleaned.replace(/\s*a\.?m\.?$|\s*a$/, '');
  } else if (cleaned.endsWith('pm') || cleaned.endsWith('p.m.') || cleaned.endsWith('p')) {
    ampm = 'pm';
    cleaned = cleaned.replace(/\s*p\.?m\.?$|\s*p$/, '');
  }

  // Strip everything except digits and a single colon.
  const digits = cleaned.replace(/[^\d:]/g, '').trim();
  if (!digits) return null;

  let hours, minutes;
  if (digits.includes(':')) {
    const [h, m] = digits.split(':');
    hours = parseInt(h, 10);
    minutes = parseInt(m, 10);
    if (isNaN(hours) || isNaN(minutes)) return null;
  } else {
    // No colon. Treat as a packed number: 1, 12, 230, 1430.
    const n = parseInt(digits, 10);
    if (isNaN(n)) return null;
    if (digits.length <= 2) {
      hours = n;
      minutes = 0;
    } else if (digits.length === 3) {
      hours = Math.floor(n / 100);
      minutes = n % 100;
    } else if (digits.length === 4) {
      hours = Math.floor(n / 100);
      minutes = n % 100;
    } else {
      return null;
    }
  }

  if (minutes < 0 || minutes > 59) return null;

  // Apply am/pm if provided, otherwise infer.
  if (ampm === 'am') {
    if (hours < 1 || hours > 12) return null;
    if (hours === 12) hours = 0;
  } else if (ampm === 'pm') {
    if (hours < 1 || hours > 12) return null;
    if (hours !== 12) hours += 12;
  } else {
    // No am/pm marker.
    if (hours < 0 || hours > 23) return null;
    // Bare digits 1-7 are ambiguous. We assume the THERAPIST means
    // a working-day hour: 1-7 with no marker is afternoon (13-19).
    // 8-11 with no marker is morning. 12 is noon.
    // This matches how massage therapists actually book sessions.
    if (hours >= 1 && hours <= 7) {
      hours += 12;
    }
  }

  if (hours < 0 || hours > 23) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Format a canonical "HH:MM" string for display as "1:30 PM".
function formatTime12(value) {
  if (!value) return '';
  const [h, m] = value.split(':');
  const hh = parseInt(h, 10);
  if (isNaN(hh)) return '';
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const hr = hh % 12 === 0 ? 12 : hh % 12;
  return `${hr}:${m} ${ampm}`;
}

export default function InlineTimeInput({
  value,
  onChange,
  placeholder = 'Time',
  width = 110,
  disabled = false,
  ariaLabel,
}) {
  const [text, setText] = useState(formatTime12(value));
  const [focused, setFocused] = useState(false);
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef(null);

  // Sync local text when the canonical value changes externally
  // (e.g. parent resets to '' after save).
  useEffect(() => {
    if (!focused) setText(formatTime12(value));
  }, [value, focused]);

  function commit() {
    const next = parseTime(text);
    if (next === null) {
      // Invalid. Revert visible text to last good value and shake.
      setText(formatTime12(value));
      setShaking(true);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => setShaking(false), 400);
      return;
    }
    // Successful parse, including the empty-string case (user cleared).
    if (next !== value) {
      onChange(next);
    }
    setText(formatTime12(next));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      aria-label={ariaLabel || placeholder}
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={(e) => {
        setFocused(true);
        // Select all so typing replaces the value cleanly.
        e.target.select();
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.target.blur();
        } else if (e.key === 'Escape') {
          setText(formatTime12(value));
          e.target.blur();
        }
      }}
      style={{
        width,
        padding: '8px 10px',
        border: `1.5px solid ${shaking ? C.red : (focused ? C.forest : C.border)}`,
        borderRadius: 10,
        background: disabled ? '#F3F4F6' : (focused ? '#fff' : C.cream),
        fontSize: 14,
        fontWeight: 700,
        color: disabled ? C.inkFade : C.forest,
        outline: 'none',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        cursor: disabled ? 'not-allowed' : 'text',
        transition: 'border-color 0.15s, background 0.15s',
        animation: shaking ? 'inline-time-shake 0.4s ease-in-out' : 'none',
      }}
    />
  );
}

// Inject the shake keyframes once. Cheap and idempotent.
if (typeof document !== 'undefined' && !document.getElementById('inline-time-shake-style')) {
  const style = document.createElement('style');
  style.id = 'inline-time-shake-style';
  style.textContent = `
    @keyframes inline-time-shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-3px); }
      75% { transform: translateX(3px); }
    }
  `;
  document.head.appendChild(style);
}
