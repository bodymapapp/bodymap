// src/components/ClientProfile/AboutCard.jsx
//
// Inline-editable client identity card. Replaces the 'Edit Client'
// modal, which had recurring layout bugs every time the viewport
// changed shape. Each row is tap-to-edit in place: see the value,
// tap it, it turns into an input, Enter or blur saves. No dialog.
// No back-button. No 'unsaved changes' alert.
//
// Pattern: same Notion / Linear cell-edit idiom InlineEditField
// already implements for the catalog rows. This is the structured-
// form sibling: four single-row fields stacked, with a wider
// 'Notes' textarea cell at the bottom.
//
// Save behavior: each cell saves on blur (or Enter for text inputs,
// Cmd-Enter for the textarea). Saving sets a soft 'Saved ✓' ghost
// for ~1.5s next to the just-edited row. No global save button.
//
// Sample clients (client.__sample) short-circuit Supabase writes
// and just update local state, same pattern the SessionList modal
// used.

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const C = {
  paper:  '#FFFFFF',
  cream:  '#FBF8F1',
  ink:    '#1F2937',
  inkSoft:'#475569',
  muted:  '#94A3B8',
  line:   '#E2E8F0',
  lineSoft:'#EEF2F7',
  forest: '#1F3A2C',
  sage:   '#5C7A4F',
  saved:  '#16A34A',
  error:  '#DC2626',
  hover:  '#F8FAFC',
  focus:  '#2A5741',
};

const F = {
  sans: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
};

export default function AboutCard({ client, onUpdated, pulse = false }) {
  // Local mirror of the values shown. Updates after save so the
  // cell shows the new value without a re-fetch.
  const [name, setName] = useState(client?.name || '');
  const [email, setEmail] = useState(client?.email || '');
  const [phone, setPhone] = useState(client?.phone || '');
  const [notes, setNotes] = useState(client?.notes || '');
  // 'name' | 'email' | 'phone' | 'notes' | null for the soft 'saved' ghost
  const [justSaved, setJustSaved] = useState(null);
  // 'name' | etc for inline error message
  const [errorOn, setErrorOn] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Reset local state if the parent swaps to a different client.
  useEffect(() => {
    setName(client?.name || '');
    setEmail(client?.email || '');
    setPhone(client?.phone || '');
    setNotes(client?.notes || '');
  }, [client?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pulse animation when the hero pencil button is tapped. Outer
  // wrapper gets the bm-cp-attn class for ~1.4s, then it clears.
  const cardRef = useRef(null);
  const [pulsing, setPulsing] = useState(false);
  useEffect(() => {
    if (!pulse) return;
    setPulsing(true);
    if (cardRef.current && cardRef.current.scrollIntoView) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const t = setTimeout(() => setPulsing(false), 1400);
    return () => clearTimeout(t);
  }, [pulse]);

  const isSample = !!client?.__sample;

  async function saveField(field, value) {
    setErrorOn(null);
    setErrorMsg('');

    // Validation. Name is required; email is loosely validated.
    if (field === 'name') {
      if (!value || !value.trim()) {
        setErrorOn('name');
        setErrorMsg('Name is required.');
        setName(client?.name || '');
        return;
      }
    }
    if (field === 'email') {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
        setErrorOn('email');
        setErrorMsg('That email looks off.');
        return;
      }
    }

    // Sample client: short-circuit. UI flips to saved, no DB write.
    if (isSample) {
      setJustSaved(field);
      setTimeout(() => setJustSaved(null), 1500);
      return;
    }

    const payload = {};
    if (field === 'name')  payload.name  = value.trim();
    if (field === 'email') payload.email = value.trim().toLowerCase() || null;
    if (field === 'phone') payload.phone = value.trim() || null;
    if (field === 'notes') payload.notes = value.trim() || null;

    const { error } = await supabase
      .from('clients')
      .update(payload)
      .eq('id', client.id);

    if (error) {
      setErrorOn(field);
      setErrorMsg('Save failed. Try again.');
      // Revert local state to what the parent had
      if (field === 'name')  setName(client?.name || '');
      if (field === 'email') setEmail(client?.email || '');
      if (field === 'phone') setPhone(client?.phone || '');
      if (field === 'notes') setNotes(client?.notes || '');
      return;
    }

    setJustSaved(field);
    setTimeout(() => setJustSaved(null), 1500);
    if (onUpdated) onUpdated(payload);
  }

  return (
    <div
      ref={cardRef}
      style={{
        background: 'transparent',
        borderRadius: 10,
        padding: '4px 2px',
        fontFamily: F.sans,
        outline: pulsing ? `2px solid ${C.focus}` : '2px solid transparent',
        outlineOffset: pulsing ? 4 : 0,
        boxShadow: pulsing ? '0 0 0 6px rgba(42,87,65,0.12)' : 'none',
        transition: 'box-shadow 0.25s ease, outline-color 0.25s ease',
      }}
    >
      <Row
        label="Name"
        value={name}
        setValue={setName}
        onSave={(v) => saveField('name', v)}
        justSaved={justSaved === 'name'}
        error={errorOn === 'name' ? errorMsg : ''}
        required
      />
      <Row
        label="Email"
        value={email}
        setValue={setEmail}
        onSave={(v) => saveField('email', v)}
        justSaved={justSaved === 'email'}
        error={errorOn === 'email' ? errorMsg : ''}
        type="email"
        placeholder="Add email"
      />
      <Row
        label="Phone"
        value={phone}
        setValue={setPhone}
        onSave={(v) => saveField('phone', v)}
        justSaved={justSaved === 'phone'}
        error={errorOn === 'phone' ? errorMsg : ''}
        type="tel"
        placeholder="Add phone"
      />
      <RowMultiline
        label="Notes"
        value={notes}
        setValue={setNotes}
        onSave={(v) => saveField('notes', v)}
        justSaved={justSaved === 'notes'}
        error={errorOn === 'notes' ? errorMsg : ''}
        placeholder="Internal notes about this client"
      />
    </div>
  );
}

// Single-line tap-to-edit row. Click anywhere on the row body to
// enter edit mode. Blur or Enter saves. Esc cancels.
function Row({ label, value, setValue, onSave, justSaved, error, required, type = 'text', placeholder = 'Add value' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select?.();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft === value) return;
    setValue(draft);
    onSave(draft);
  }
  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(70px, 90px) 1fr',
      alignItems: 'center',
      padding: '10px 4px',
      borderBottom: `1px solid ${C.lineSoft}`,
      gap: 12,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        {label}{required && <span style={{ color: C.error, marginLeft: 2 }}>*</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            }}
            type={type}
            placeholder={placeholder}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '6px 8px',
              border: `1.5px solid ${C.focus}`,
              borderRadius: 8,
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
              background: C.paper,
              color: C.ink,
              boxSizing: 'border-box',
            }}
            inputMode={type === 'tel' ? 'tel' : type === 'email' ? 'email' : 'text'}
            autoCapitalize={type === 'email' ? 'none' : 'sentences'}
            autoCorrect={type === 'email' ? 'off' : 'on'}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            aria-label={`Edit ${label}`}
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: 'left',
              padding: '6px 8px',
              background: 'transparent',
              border: '1.5px solid transparent',
              borderRadius: 8,
              fontSize: 14,
              fontFamily: 'inherit',
              color: value ? C.ink : C.muted,
              cursor: 'pointer',
              fontStyle: value ? 'normal' : 'italic',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {value || placeholder}
          </button>
        )}
        {justSaved && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.saved,
            flexShrink: 0,
            opacity: 0.9,
          }}>
            ✓ Saved
          </span>
        )}
        {error && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.error,
            flexShrink: 0,
          }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

// Multi-line textarea row for the Notes field. Same click-to-edit
// pattern; Cmd/Ctrl + Enter commits, Esc cancels, blur commits.
function RowMultiline({ label, value, setValue, onSave, justSaved, error, placeholder = 'Add notes' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      // Place cursor at end so existing text is preserved naturally
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft === value) return;
    setValue(draft);
    onSave(draft);
  }
  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(70px, 90px) 1fr',
      alignItems: 'flex-start',
      padding: '10px 4px',
      gap: 12,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        paddingTop: 8,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4, minWidth: 0 }}>
        {editing ? (
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); cancel(); }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
            }}
            rows={3}
            placeholder={placeholder}
            style={{
              padding: '8px 10px',
              border: `1.5px solid ${C.focus}`,
              borderRadius: 8,
              fontSize: 14,
              lineHeight: 1.45,
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical',
              background: C.paper,
              color: C.ink,
              boxSizing: 'border-box',
              minHeight: 70,
            }}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            aria-label={`Edit ${label}`}
            style={{
              textAlign: 'left',
              padding: '8px 10px',
              background: 'transparent',
              border: '1.5px solid transparent',
              borderRadius: 8,
              fontSize: 14,
              lineHeight: 1.45,
              fontFamily: 'inherit',
              color: value ? C.ink : C.muted,
              cursor: 'pointer',
              fontStyle: value ? 'normal' : 'italic',
              whiteSpace: 'pre-wrap',
              transition: 'background 0.12s',
              minHeight: 38,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {value || placeholder}
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4, minHeight: 14 }}>
          {justSaved && (
            <span style={{ fontSize: 11, fontWeight: 600, color: C.saved }}>✓ Saved</span>
          )}
          {error && (
            <span style={{ fontSize: 11, fontWeight: 600, color: C.error }}>{error}</span>
          )}
          {editing && !error && (
            <span style={{ fontSize: 10.5, color: C.muted, fontStyle: 'italic' }}>
              Esc to cancel, Cmd-Enter to save
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
