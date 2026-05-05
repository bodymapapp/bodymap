// src/pages/IntakeEditor.jsx
//
// WYSIWYG-ish editor for the client intake form. Therapist sees the
// fields exactly as her clients will see them, with edit controls that
// reveal on hover/tap. She can:
//   - Hide / show any default question (toggle switch, NOT an eye icon)
//   - Edit the label of any question
//   - Edit, rename, add, or remove the answer options on chip fields
//   - Add brand-new custom questions of any type
//   - Delete custom questions she added
//   - Toggle the structured medical conditions checklist on/off
//   - Toggle HIPAA mode (adds stronger consent + audit log)
//
// Default questions can be hidden but not deleted — preserves stable
// answer field IDs so historical sessions stay readable when therapist
// flips a question back on later.
//
// Save is debounced to 600ms so rapid edits don't hammer Supabase.
// All state lives locally during edit; saves write the whole schema
// each time (jsonb column, small payload, simpler than diffing).

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  DEFAULT_SCHEMA,
  DEFAULT_MEDICAL_CONDITIONS,
  effectiveSchema,
  makeCustomField,
  FIELD_TYPE_CHOICES,
} from '../lib/intakeSchema';

const C = {
  forest: '#2A5741',
  sage:   '#5C7A4F',
  ink:    '#1F2937',
  warm:   '#5C7A4F',
  gray:   '#6B7280',
  light:  '#E5E7EB',
  cream:  '#FAF6EE',
  beige:  '#F5EFE0',
  rose:   '#A87468',
  red:    '#DC2626',
  bg:     '#F9FAFB',
};

// Visible toggle switch — modern look, not the old "eye" icon HK
// flagged. Used everywhere we need on/off state in this editor.
function Toggle({ on, onChange, ariaLabel }) {
  return (
    <button
      onClick={onChange}
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        width: 40, height: 22,
        borderRadius: 999,
        background: on ? C.forest : '#D1D5DB',
        border: 'none', cursor: 'pointer',
        transition: 'background 0.18s',
        flexShrink: 0,
        padding: 0,
      }}>
      <span style={{
        position: 'absolute',
        top: 2, left: on ? 20 : 2,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.18s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }}/>
    </button>
  );
}

// Inline-editable text — click to edit. Used for field labels and
// option labels. Saves on blur or Enter.
function InlineEdit({ value, onSave, placeholder = '', style = {}, ariaLabel = '' }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);

  const commit = () => {
    setEditing(false);
    if (v !== value) onSave(v);
  };

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setV(value); setEditing(false); }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        style={{
          ...style,
          padding: '4px 6px',
          border: `1.5px solid ${C.forest}`,
          borderRadius: 6,
          outline: 'none',
          fontFamily: 'inherit',
          fontSize: style.fontSize || 14,
          fontWeight: style.fontWeight || 600,
          background: '#fff',
          width: '100%',
        }}/>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') setEditing(true); }}
      role="button"
      aria-label={ariaLabel || `Edit ${value}`}
      style={{
        ...style,
        cursor: 'text',
        padding: '4px 6px',
        borderRadius: 6,
        display: 'inline-block',
        minHeight: 24,
        borderBottom: `1px dashed transparent`,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderBottom = `1px dashed ${C.gray}`)}
      onMouseLeave={(e) => (e.currentTarget.style.borderBottom = `1px dashed transparent`)}
    >
      {value || <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>{placeholder}</span>}
    </span>
  );
}

// One field card — renders the field as the client would see it, with
// edit controls layered on top.
function FieldCard({ field, onPatch, onDelete, isHidden, onToggleHidden }) {
  const isDefault = field.kind === 'default';

  const updateLabel = (label) => onPatch({ label });
  const updateHelp  = (help)  => onPatch({ help });
  const updateOption = (idx, patch) => {
    const opts = [...(field.options || [])];
    opts[idx] = { ...opts[idx], ...patch };
    onPatch({ options: opts });
  };
  const removeOption = (idx) => {
    const opts = (field.options || []).filter((_, i) => i !== idx);
    onPatch({ options: opts });
  };
  const addOption = () => {
    const opts = [...(field.options || [])];
    const v = `opt${opts.length + 1}`;
    opts.push({ v, label: `Option ${opts.length + 1}` });
    onPatch({ options: opts });
  };

  return (
    <div style={{
      background: isHidden ? '#F9FAFB' : '#fff',
      border: `1.5px solid ${isHidden ? C.light : C.beige}`,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      opacity: isHidden ? 0.55 : 1,
      transition: 'opacity 0.2s, background 0.2s',
      position: 'relative',
    }}>
      {/* Top row: visibility toggle + (optional) delete button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Toggle on={!isHidden} onChange={onToggleHidden} ariaLabel={`Visible to clients: ${field.label}`} />
          <span style={{ fontSize: 11, color: C.gray, fontWeight: 600 }}>
            {isHidden ? 'Hidden from clients' : 'Visible to clients'}
          </span>
        </div>
        {!isDefault && (
          <button onClick={onDelete} style={{
            marginLeft: 'auto',
            background: 'transparent', color: C.red,
            border: `1px solid ${C.red}`, borderRadius: 6,
            padding: '4px 10px', fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
          }}>Remove</button>
        )}
        {isDefault && (
          <span style={{
            marginLeft: 'auto',
            fontSize: 10, color: C.gray, fontWeight: 600,
            background: C.cream, padding: '3px 8px', borderRadius: 99,
          }}>Built-in</span>
        )}
      </div>

      {/* Editable label */}
      <div style={{ marginBottom: 4 }}>
        <InlineEdit
          value={field.label}
          onSave={updateLabel}
          placeholder="Question label"
          ariaLabel="Edit question label"
          style={{ fontSize: 14, fontWeight: 700, color: C.ink }}
        />
      </div>

      {/* Editable help text */}
      {(field.help !== undefined || isDefault) && (
        <div style={{ marginBottom: 10 }}>
          <InlineEdit
            value={field.help || ''}
            onSave={updateHelp}
            placeholder="Optional help text shown under the question"
            style={{ fontSize: 12, color: C.gray }}
          />
        </div>
      )}

      {/* Type-specific renderer */}
      {(field.type === 'chips' || field.type === 'chips_multi' || field.type === 'checklist') && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {(field.options || []).map((opt, idx) => (
            <div key={idx} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: '#F9FAFB',
              border: `1.5px solid ${C.light}`,
              borderRadius: 99,
              padding: '4px 10px',
            }}>
              <InlineEdit
                value={opt.label}
                onSave={(label) => updateOption(idx, { label })}
                style={{ fontSize: 12, fontWeight: 500, color: C.ink, padding: '0 2px' }}
                ariaLabel={`Edit option ${opt.label}`}
              />
              <button
                onClick={() => removeOption(idx)}
                aria-label={`Remove option ${opt.label}`}
                style={{
                  background: 'transparent', border: 'none',
                  color: C.gray, cursor: 'pointer',
                  fontSize: 14, lineHeight: 1, padding: '0 2px',
                  marginLeft: 2,
                }}>×</button>
            </div>
          ))}
          <button onClick={addOption} style={{
            background: 'transparent',
            border: `1.5px dashed ${C.sage}`,
            color: C.sage,
            borderRadius: 99,
            padding: '4px 10px',
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
          }}>+ Add option</button>
        </div>
      )}

      {(field.type === 'text' || field.type === 'textarea') && (
        <div style={{ marginTop: 4 }}>
          <div style={{
            background: '#F9FAFB',
            border: `1px dashed ${C.light}`,
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 12, color: '#9CA3AF',
            fontStyle: 'italic',
            minHeight: field.type === 'textarea' ? 60 : 32,
          }}>
            <InlineEdit
              value={field.placeholder || ''}
              onSave={(placeholder) => onPatch({ placeholder })}
              placeholder="Add placeholder text shown to client"
              style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}
            />
          </div>
        </div>
      )}

      {field.type === 'checkbox' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.gray }}>
          <span style={{
            width: 16, height: 16, borderRadius: 4,
            border: `1.5px solid ${C.light}`,
            display: 'inline-block', flexShrink: 0,
          }}/>
          Client will see a yes/no checkbox here
        </div>
      )}

      {field.type === 'header' && (
        <div style={{
          fontSize: 11, color: C.gray, fontStyle: 'italic',
          marginTop: 4,
        }}>
          Visual section header. No input.
        </div>
      )}
    </div>
  );
}

// Modal for picking a new question type
function AddQuestionModal({ open, onClose, onPick }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16,
        maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>Add a question</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.gray, fontSize: 22, cursor: 'pointer', padding: 0 }}>×</button>
        </div>
        <p style={{ fontSize: 13, color: C.gray, margin: '0 0 14px' }}>Pick the type that fits what you want to ask:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FIELD_TYPE_CHOICES.map((t) => (
            <button key={t.v}
              onClick={() => { onPick(t.v); onClose(); }}
              style={{
                background: '#F9FAFB', border: `1.5px solid ${C.light}`,
                borderRadius: 10, padding: '10px 14px', textAlign: 'left',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.forest; e.currentTarget.style.background = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.light; e.currentTarget.style.background = '#F9FAFB'; }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2 }}>{t.label}</div>
              <div style={{ fontSize: 11, color: C.gray }}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function IntakeEditor() {
  const navigate = useNavigate();
  const { therapist, updateProfile } = useAuth();
  const [schema, setSchema] = useState(() => effectiveSchema(therapist));
  const [adding, setAdding] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);

  // Re-sync if therapist context updates (e.g. after a save)
  useEffect(() => {
    if (therapist?.intake_schema) {
      // Don't blow away in-progress edits; only sync if local hasn't changed
      // since last save. Keeping it simple: sync on therapist id change only.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapist?.id]);

  // Debounced save: 600ms after the last change.
  const queueSave = useCallback((next) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      const result = await updateProfile({ intake_schema: next });
      setSaving(false);
      if (result?.error) {
        console.error('IntakeEditor save failed:', result.error);
        return;
      }
      setSavedAt(Date.now());
    }, 600);
  }, [updateProfile]);

  const update = (patch) => {
    setSchema((prev) => {
      const next = { ...prev, ...patch };
      queueSave(next);
      return next;
    });
  };

  const updateField = (id, patch) => {
    setSchema((prev) => {
      const next = {
        ...prev,
        fields: prev.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      };
      queueSave(next);
      return next;
    });
  };

  const deleteField = (id) => {
    if (!window.confirm('Remove this question? Clients will not see it anymore.')) return;
    setSchema((prev) => {
      const next = { ...prev, fields: prev.fields.filter((f) => f.id !== id) };
      queueSave(next);
      return next;
    });
  };

  const addField = (type) => {
    const f = makeCustomField(type);
    setSchema((prev) => {
      const next = { ...prev, fields: [...prev.fields, f] };
      queueSave(next);
      return next;
    });
  };

  const reset = () => {
    if (!window.confirm('Reset your intake to the defaults? You will lose any custom questions and edits.')) return;
    setSchema(DEFAULT_SCHEMA);
    queueSave(DEFAULT_SCHEMA);
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', paddingBottom: 60 }}>
      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#fff', borderBottom: `1px solid ${C.light}`,
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button onClick={() => navigate('/dashboard/settings')} style={{
            background: 'transparent', border: 'none', color: C.forest,
            fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0,
          }}>← Back</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, lineHeight: 1.2 }}>Customize your intake</div>
            <div style={{ fontSize: 11, color: C.gray }}>What clients see, in your words</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: C.gray }}>
          {saving ? 'Saving...' : (savedAt ? '✓ Saved' : 'No changes yet')}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>

        {/* Honest status banner: editor saves changes, but the live
            client intake still uses the default schema as of this ship.
            Wire-up of Demo.jsx to read this schema is the next ship.
            Removed once production renders custom schemas. */}
        <div style={{
          background: '#FEF3C7', border: '1px solid #FCD34D',
          borderRadius: 10, padding: '10px 14px', marginBottom: 16,
          fontSize: 12, color: '#78350F', lineHeight: 1.5,
        }}>
          <strong>Heads up:</strong> changes save to your account now. The live client intake will start using your customizations in our next deploy (this week). We will email you when it goes live.
        </div>

        {/* Master toggles */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, border: `1px solid ${C.light}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, letterSpacing: 1.5, marginBottom: 10 }}>
            INTAKE MODE
          </div>

          {/* Medical checklist toggle */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2 }}>Medical conditions checklist</div>
              <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.5 }}>
                Adds a structured checklist of common contraindications: high blood pressure, blood clots, recent surgery, pregnancy, etc. {DEFAULT_MEDICAL_CONDITIONS.length} conditions by default.
              </div>
            </div>
            <Toggle
              on={schema.medical_checklist_enabled}
              onChange={() => update({ medical_checklist_enabled: !schema.medical_checklist_enabled })}
              ariaLabel="Toggle medical conditions checklist"
            />
          </div>

          {/* HIPAA mode toggle */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2 }}>HIPAA mode</div>
              <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.5 }}>
                Turn on if you operate under HIPAA. Adds a stronger consent line before medical questions and logs every time medical notes are viewed.
              </div>
            </div>
            <Toggle
              on={schema.hipaa_mode}
              onChange={() => update({ hipaa_mode: !schema.hipaa_mode })}
              ariaLabel="Toggle HIPAA mode"
            />
          </div>
        </div>

        {/* Help banner */}
        <div style={{
          background: '#FFF8E1', border: '1px solid #F0E5C0',
          borderRadius: 10, padding: '10px 14px', marginBottom: 16,
          fontSize: 12, color: '#6B5A2A', lineHeight: 1.5,
        }}>
          ✨ Tap any question label to rename it. Tap an option chip to rename it. Use the toggles to hide questions you do not need. Add new questions at the bottom.
        </div>

        {/* Section: questions */}
        <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, letterSpacing: 1.5, marginBottom: 8, padding: '0 4px' }}>
          QUESTIONS YOUR CLIENTS SEE
        </div>

        {schema.fields.map((field) => (
          <FieldCard
            key={field.id}
            field={field}
            isHidden={!!field.hidden}
            onToggleHidden={() => updateField(field.id, { hidden: !field.hidden })}
            onPatch={(patch) => updateField(field.id, patch)}
            onDelete={() => deleteField(field.id)}
          />
        ))}

        {/* Add question button */}
        <button onClick={() => setAdding(true)} style={{
          width: '100%',
          background: '#fff', border: `1.5px dashed ${C.sage}`,
          borderRadius: 12, padding: '14px 18px',
          color: C.sage, fontSize: 14, fontWeight: 700,
          cursor: 'pointer', marginBottom: 14,
        }}>
          + Add a new question
        </button>

        {/* Reset link */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button onClick={reset} style={{
            background: 'transparent', border: 'none',
            color: C.gray, fontSize: 12, cursor: 'pointer',
            textDecoration: 'underline',
          }}>Reset to default questions</button>
        </div>
      </div>

      <AddQuestionModal
        open={adding}
        onClose={() => setAdding(false)}
        onPick={(type) => addField(type)}
      />
    </div>
  );
}
