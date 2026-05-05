// src/pages/IntakeEditor.jsx
//
// WYSIWYG editor for the client intake form.
//
// V2 (after HK feedback on first cut):
// - Compressed field cards (less padding so 10 questions don't feel
//   like an endless scroll)
// - Progress indicator at top (X of N visible to clients)
// - "Saving..." indicator fires immediately on any change, not after
//   the 600ms debounce completes
// - Order matches the live intake (Demo.jsx PS sections)
//
// Therapists can:
//   - Hide / show any default question (toggle switch, NOT eye icon)
//   - Edit the label of any question
//   - Edit, rename, add, or remove the answer options on chip fields
//   - Add brand-new custom questions of any type
//   - Delete custom questions she added
//   - Toggle the structured medical conditions checklist on/off
//   - Toggle HIPAA mode (adds stronger consent + audit log)

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

// Modern toggle switch — replaces the old-school eye icon HK flagged.
// Compact 36x20 size to keep field cards dense.
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
          padding: '3px 5px',
          border: `1.5px solid ${C.forest}`,
          borderRadius: 5,
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
        padding: '3px 5px',
        borderRadius: 5,
        display: 'inline-block',
        minHeight: 22,
        borderBottom: `1px dashed transparent`,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderBottom = `1px dashed ${C.gray}`)}
      onMouseLeave={(e) => (e.currentTarget.style.borderBottom = `1px dashed transparent`)}
    >
      {value || <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>{placeholder}</span>}
    </span>
  );
}

// One field card — compact rendering. Padding tightened from 16 to 10
// after HK feedback that the editor felt endless.
function FieldCard({ field, onPatch, onDelete, isHidden, onToggleHidden }) {
  const isDefault = field.kind === 'default';

  const updateLabel = (label) => onPatch({ label });
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
      border: `1px solid ${isHidden ? C.light : C.beige}`,
      borderRadius: 10,
      padding: '10px 12px',
      marginBottom: 8,
      opacity: isHidden ? 0.6 : 1,
      transition: 'opacity 0.2s, background 0.2s',
    }}>
      {/* Top row: toggle + label + (delete or built-in chip) — all on one line */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: field.type === 'header' ? 0 : 8,
      }}>
        <Toggle on={!isHidden} onChange={onToggleHidden} ariaLabel={`Visible to clients: ${field.label}`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <InlineEdit
            value={field.label}
            onSave={updateLabel}
            placeholder="Question label"
            ariaLabel="Edit question label"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.ink,
              textDecoration: isHidden ? 'line-through' : 'none',
            }}
          />
        </div>
        {!isDefault ? (
          <button onClick={onDelete} aria-label="Remove this question" style={{
            background: 'transparent', color: C.red,
            border: 'none', cursor: 'pointer',
            fontSize: 16, lineHeight: 1, padding: '0 4px',
            flexShrink: 0,
          }}>×</button>
        ) : (
          <span style={{
            fontSize: 9, color: C.gray, fontWeight: 600,
            background: C.cream, padding: '2px 7px', borderRadius: 99,
            flexShrink: 0,
          }}>BUILT-IN</span>
        )}
      </div>

      {/* Type-specific renderer (skip if hidden — saves vertical space) */}
      {!isHidden && (field.type === 'chips' || field.type === 'chips_multi' || field.type === 'checklist') && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginLeft: 46 }}>
          {(field.options || []).map((opt, idx) => (
            <div key={idx} style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              background: '#F9FAFB',
              border: `1.5px solid ${C.light}`,
              borderRadius: 99,
              padding: '3px 8px',
            }}>
              <InlineEdit
                value={opt.label}
                onSave={(label) => updateOption(idx, { label })}
                style={{ fontSize: 11, fontWeight: 500, color: C.ink, padding: '0 2px' }}
                ariaLabel={`Edit option ${opt.label}`}
              />
              <button
                onClick={() => removeOption(idx)}
                aria-label={`Remove option ${opt.label}`}
                style={{
                  background: 'transparent', border: 'none',
                  color: C.gray, cursor: 'pointer',
                  fontSize: 13, lineHeight: 1, padding: '0 2px',
                }}>×</button>
            </div>
          ))}
          <button onClick={addOption} style={{
            background: 'transparent',
            border: `1.5px dashed ${C.sage}`,
            color: C.sage,
            borderRadius: 99,
            padding: '3px 8px',
            fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
          }}>+</button>
        </div>
      )}

      {!isHidden && (field.type === 'text' || field.type === 'textarea') && (
        <div style={{ marginLeft: 46 }}>
          <div style={{
            background: '#F9FAFB',
            border: `1px dashed ${C.light}`,
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 11, color: '#9CA3AF',
            fontStyle: 'italic',
            minHeight: field.type === 'textarea' ? 32 : 24,
          }}>
            <InlineEdit
              value={field.placeholder || ''}
              onSave={(placeholder) => onPatch({ placeholder })}
              placeholder="Placeholder text"
              style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}
            />
          </div>
        </div>
      )}

      {!isHidden && field.type === 'checkbox' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.gray, marginLeft: 46 }}>
          <span style={{
            width: 14, height: 14, borderRadius: 3,
            border: `1.5px solid ${C.light}`,
            display: 'inline-block', flexShrink: 0,
          }}/>
          Yes/no checkbox
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
  // Two-state save indicator: "saving" fires immediately on any edit;
  // "savedAt" fires when the debounced save completes. HK reported the
  // first version felt unresponsive because the indicator only updated
  // after 600ms of debounce — so any rapid change felt like nothing
  // was happening.
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const saveTimer = useRef(null);

  // Debounced save: 600ms after the last change.
  const queueSave = useCallback((next) => {
    setSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
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

  // Completion stats: how many fields are visible to clients vs total.
  // Plus medical checklist + HIPAA toggle status. Used by the progress
  // bar at top of the editor so therapists see how customized they are.
  const visibleFields = schema.fields.filter((f) => !f.hidden);
  const totalFields = schema.fields.length;
  const customFields = schema.fields.filter((f) => f.kind === 'custom').length;
  const completionPct = totalFields === 0 ? 0 : Math.round((visibleFields.length / totalFields) * 100);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: saving ? C.gray : (savedAt ? C.forest : C.gray), fontWeight: 600 }}>
          {saving ? '· Saving…' : (savedAt ? '✓ Saved' : 'No changes yet')}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 14px' }}>

        {/* Honest status banner (Phase 1: editor saves but Demo.jsx live render not wired yet) */}
        <div style={{
          background: '#FEF3C7', border: '1px solid #FCD34D',
          borderRadius: 10, padding: '8px 12px', marginBottom: 12,
          fontSize: 11, color: '#78350F', lineHeight: 1.5,
        }}>
          <strong>Heads up:</strong> changes save now. The live client intake will use these in our next deploy this week. We will email you when it goes live.
        </div>

        {/* PROGRESS BAR — visible-fields completion plus a one-line summary
            of how customized the intake is. Replaces the "endless scroll"
            feeling HK called out by giving therapists an at-a-glance view
            of how much they've already done. */}
        <div style={{
          background: '#fff',
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: 12,
          border: `1px solid ${C.light}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: C.ink }}>Your intake at a glance</span>
            <span style={{ color: C.gray }}>{visibleFields.length} of {totalFields} visible</span>
          </div>
          {/* progress bar */}
          <div style={{ height: 5, background: C.light, borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{
              height: '100%',
              width: `${completionPct}%`,
              background: `linear-gradient(90deg, ${C.sage}, ${C.forest})`,
              transition: 'width 0.3s ease',
            }}/>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 10, color: C.gray }}>
            {schema.medical_checklist_enabled && <span style={{ background: C.cream, padding: '2px 7px', borderRadius: 99 }}>🩺 Medical checklist on</span>}
            {schema.hipaa_mode && <span style={{ background: C.cream, padding: '2px 7px', borderRadius: 99 }}>🔒 HIPAA mode on</span>}
            {customFields > 0 && <span style={{ background: C.cream, padding: '2px 7px', borderRadius: 99 }}>+{customFields} custom {customFields === 1 ? 'question' : 'questions'}</span>}
          </div>
        </div>

        {/* Master toggles — compressed into a single card */}
        <div style={{ background: '#fff', borderRadius: 10, padding: 12, marginBottom: 12, border: `1px solid ${C.light}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, letterSpacing: 1.5, marginBottom: 8 }}>
            INTAKE MODE
          </div>

          {/* Medical checklist toggle */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 1 }}>Medical conditions checklist</div>
              <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.4 }}>
                Adds {DEFAULT_MEDICAL_CONDITIONS.length} common contraindications: high BP, blood clots, recent surgery, pregnancy, etc.
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
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 1 }}>HIPAA mode</div>
              <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.4 }}>
                Adds stronger consent and logs every time medical notes are viewed. Turn on if you operate under HIPAA.
              </div>
            </div>
            <Toggle
              on={schema.hipaa_mode}
              onChange={() => update({ hipaa_mode: !schema.hipaa_mode })}
              ariaLabel="Toggle HIPAA mode"
            />
          </div>
        </div>

        {/* Help banner — compact one-liner */}
        <div style={{
          background: '#FFF8E1', border: '1px solid #F0E5C0',
          borderRadius: 8, padding: '8px 12px', marginBottom: 10,
          fontSize: 11, color: '#6B5A2A', lineHeight: 1.5,
        }}>
          ✨ Tap a label or chip to rename. Toggle to hide. Add new at the bottom.
        </div>

        {/* Section: questions */}
        <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, letterSpacing: 1.5, marginBottom: 6, padding: '0 4px' }}>
          QUESTIONS YOUR CLIENTS SEE — IN ORDER
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
          borderRadius: 10, padding: '10px 16px',
          color: C.sage, fontSize: 13, fontWeight: 700,
          cursor: 'pointer', marginBottom: 10,
        }}>
          + Add a new question
        </button>

        {/* Reset link */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button onClick={reset} style={{
            background: 'transparent', border: 'none',
            color: C.gray, fontSize: 11, cursor: 'pointer',
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
