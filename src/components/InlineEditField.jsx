// src/components/InlineEditField.jsx
//
// Tap-to-edit field for catalog rows (service price, add-on duration,
// package price, etc). Click → input. Blur or Enter → save via onSave
// callback. Esc → cancel.
//
// Visual: looks like static text until tapped. On hover (desktop only)
// shows a soft underline hint. On focus, it's a normal input. No edit
// pencil icon — the whole text IS the affordance.
//
// Built specifically for the inline edit pattern HK chose (option A,
// Notion/Linear style: autosave on blur, no commit button).

import React from "react";

export default function InlineEditField({
  value,
  onSave,        // async (newValue) => void
  type = 'text', // 'text' | 'number'
  prefix,        // e.g. '$'
  suffix,        // e.g. 'min'
  min,
  max,
  step,
  width = 56,    // default narrow for prices
  align = 'right',
  fontSize = 13,
  fontWeight = 500,
  color = '#1F3A2C',
  ariaLabel = 'Edit',
  formatValue,   // (v) => string for display
  parseValue,    // (s) => raw value for save
  readOnly = false, // client view: render the value as static text, no editing
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(String(value ?? ''));
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (!editing) setDraft(String(value ?? ''));
  }, [value, editing]);

  React.useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  async function commit() {
    if (saving) return;
    const parsed = parseValue ? parseValue(draft) : (type === 'number' ? Number(draft) : draft.trim());
    if (parsed === value || parsed === String(value)) {
      setEditing(false);
      return;
    }
    if (type === 'number' && (Number.isNaN(parsed) || parsed === '')) {
      setDraft(String(value ?? ''));
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(parsed);
    } catch (e) {
      console.error('InlineEdit save failed:', e);
      setDraft(String(value ?? ''));
    }
    setSaving(false);
    setEditing(false);
  }

  function cancel() {
    setDraft(String(value ?? ''));
    setEditing(false);
  }

  const display = formatValue ? formatValue(value) : (
    `${prefix || ''}${value ?? ''}${suffix ? ' ' + suffix : ''}`
  );

  if (readOnly) {
    return <span style={{ fontSize, fontWeight, color }}>{display}</span>;
  }

  if (editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {prefix && <span style={{ fontSize, fontWeight, color: '#9CA3AF' }}>{prefix}</span>}
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            else if (type === 'number' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
              e.preventDefault();
              const cur = Number(draft) || 0;
              const stepBy = e.shiftKey ? 5 : (step || 1);
              const next = e.key === 'ArrowUp' ? cur + stepBy : cur - stepBy;
              const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, next));
              setDraft(String(clamped));
            }
          }}
          min={min}
          max={max}
          step={step}
          aria-label={ariaLabel}
          style={{
            width,
            border: `1.5px solid #2A5741`,
            borderRadius: 6,
            padding: '3px 6px',
            fontSize,
            fontWeight,
            color,
            outline: 'none',
            textAlign: align,
            background: '#fff',
            fontFamily: 'inherit',
          }}
          disabled={saving}
        />
        {suffix && <span style={{ fontSize, fontWeight, color: '#9CA3AF' }}>{suffix}</span>}
      </span>
    );
  }

  return (
    <span
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(true); }
      }}
      style={{
        fontSize,
        fontWeight,
        color,
        cursor: 'pointer',
        padding: '3px 6px',
        margin: '-3px -6px',
        borderRadius: 6,
        borderBottom: '1px dashed transparent',
        transition: 'all 0.12s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(42,87,65,0.06)';
        e.currentTarget.style.borderBottom = '1px dashed rgba(42,87,65,0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderBottom = '1px dashed transparent';
      }}
    >{display}</span>
  );
}
