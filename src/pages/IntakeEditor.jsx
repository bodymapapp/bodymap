// src/pages/IntakeEditor.jsx
//
// WYSIWYG editor for the entire client intake form.
//
// V3 (after HK feedback that V2 only showed 10 abstract questions):
// The editor now mirrors the FULL intake the way clients experience it,
// in order. Five sections, top to bottom:
//
//   1. Body Map intake (read-only, shown as info card so therapist
//      sees it is part of the form. Cannot be hidden — it is the
//      core differentiator)
//   2. Preferences (the 10 fields, dense rendering)
//   3. Medical conditions checklist (when enabled, all 12 conditions
//      individually hideable + editable + addable)
//   4. Waiver (with link to the existing waiver editor in Settings)
//   5. Custom questions (any added by therapist) + "+ Add new" button
//
// Density tightened further per HK feedback. Cards use minimal padding,
// section headers are slim, no help text by default.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  DEFAULT_SCHEMA,
  effectiveSchema,
  effectiveMedicalConditions,
  makeCustomField,
  makeCustomCondition,
  FIELD_TYPE_CHOICES,
} from '../lib/intakeSchema';

const C = {
  forest: '#2A5741',
  sage:   '#5C7A4F',
  ink:    '#1F2937',
  gray:   '#6B7280',
  light:  '#E5E7EB',
  cream:  '#FAF6EE',
  beige:  '#F5EFE0',
  rose:   '#A87468',
  red:    '#DC2626',
  bg:     '#F9FAFB',
  bodyBg: '#FFF8EE',
};

// Modern toggle switch — replaces the old eye icon HK flagged.
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

// Inline-editable text — click to edit. Save on blur or Enter.
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
          fontSize: style.fontSize || 13,
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

// Section heading — slim, eyebrow style. Used between intake sections
// so therapists see how their form maps to client experience.
function SectionHeading({ icon, title, count, accent }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '14px 4px 6px',
      borderBottom: `1px dashed ${C.light}`,
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: accent || C.forest,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
        }}>{title}</span>
      </div>
      {count !== undefined && (
        <span style={{ fontSize: 10, color: C.gray, fontWeight: 600 }}>
          {count}
        </span>
      )}
    </div>
  );
}

// One preference field — compact card.
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
      borderRadius: 8,
      padding: '8px 10px',
      marginBottom: 6,
      opacity: isHidden ? 0.6 : 1,
      transition: 'opacity 0.2s, background 0.2s',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: isHidden ? 0 : 6,
      }}>
        <Toggle on={!isHidden} onChange={onToggleHidden} ariaLabel={`Visible: ${field.label}`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <InlineEdit
            value={field.label}
            onSave={updateLabel}
            placeholder="Question label"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.ink,
              textDecoration: isHidden ? 'line-through' : 'none',
            }}
          />
        </div>
        {!isDefault && (
          <button onClick={onDelete} aria-label="Remove" style={{
            background: 'transparent', color: C.red,
            border: 'none', cursor: 'pointer',
            fontSize: 16, lineHeight: 1, padding: '0 4px',
            flexShrink: 0,
          }}>×</button>
        )}
      </div>

      {!isHidden && (field.type === 'chips' || field.type === 'chips_multi') && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginLeft: 44 }}>
          {(field.options || []).map((opt, idx) => (
            <div key={idx} style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              background: '#F9FAFB',
              border: `1.5px solid ${C.light}`,
              borderRadius: 99,
              padding: '2px 8px',
            }}>
              <InlineEdit
                value={opt.label}
                onSave={(label) => updateOption(idx, { label })}
                style={{ fontSize: 11, fontWeight: 500, color: C.ink, padding: '0 2px' }}
              />
              <button
                onClick={() => removeOption(idx)}
                style={{
                  background: 'transparent', border: 'none',
                  color: C.gray, cursor: 'pointer',
                  fontSize: 12, lineHeight: 1, padding: '0 2px',
                }}>×</button>
            </div>
          ))}
          <button onClick={addOption} style={{
            background: 'transparent',
            border: `1.5px dashed ${C.sage}`,
            color: C.sage,
            borderRadius: 99,
            padding: '2px 8px',
            fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
          }}>+</button>
        </div>
      )}

      {!isHidden && (field.type === 'text' || field.type === 'textarea') && (
        <div style={{ marginLeft: 44 }}>
          <div style={{
            background: '#F9FAFB',
            border: `1px dashed ${C.light}`,
            borderRadius: 6,
            padding: '5px 9px',
            fontSize: 11, color: '#9CA3AF',
            fontStyle: 'italic',
            minHeight: field.type === 'textarea' ? 28 : 22,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.gray, marginLeft: 44 }}>
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

// One medical condition row — compact, similar to a chip option but
// each as its own row since they need a hide toggle each.
function ConditionRow({ condition, onPatch, onDelete, onToggleHidden }) {
  const isDefault = condition.kind === 'default';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 8px',
      background: condition.hidden ? '#F9FAFB' : '#fff',
      border: `1px solid ${C.light}`,
      borderRadius: 6,
      marginBottom: 4,
      opacity: condition.hidden ? 0.55 : 1,
    }}>
      <Toggle on={!condition.hidden} onChange={onToggleHidden} ariaLabel={`Visible: ${condition.label}`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <InlineEdit
          value={condition.label}
          onSave={(label) => onPatch({ label })}
          placeholder="Condition name"
          style={{
            fontSize: 12, fontWeight: 500, color: C.ink,
            textDecoration: condition.hidden ? 'line-through' : 'none',
          }}
        />
      </div>
      {!isDefault && (
        <button onClick={onDelete} aria-label="Remove" style={{
          background: 'transparent', color: C.red,
          border: 'none', cursor: 'pointer',
          fontSize: 14, lineHeight: 1, padding: '0 4px',
          flexShrink: 0,
        }}>×</button>
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
              }}>
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
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const saveTimer = useRef(null);

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
    if (!window.confirm('Remove this question?')) return;
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

  // Medical condition helpers — work against effectiveMedicalConditions
  // so the first edit materializes the default list into the schema.
  const conditions = effectiveMedicalConditions(schema);

  const updateCondition = (idx, patch) => {
    const list = conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    setSchema((prev) => {
      const next = { ...prev, medical_conditions: list };
      queueSave(next);
      return next;
    });
  };

  const deleteCondition = (idx) => {
    if (!window.confirm('Remove this condition?')) return;
    const list = conditions.filter((_, i) => i !== idx);
    setSchema((prev) => {
      const next = { ...prev, medical_conditions: list };
      queueSave(next);
      return next;
    });
  };

  const addCondition = () => {
    const list = [...conditions, makeCustomCondition()];
    setSchema((prev) => {
      const next = { ...prev, medical_conditions: list };
      queueSave(next);
      return next;
    });
  };

  const reset = () => {
    if (!window.confirm('Reset your intake to the defaults? You will lose any custom changes.')) return;
    setSchema(DEFAULT_SCHEMA);
    queueSave(DEFAULT_SCHEMA);
  };

  // Counts for the progress card. Body Map + Waiver are always present
  // and not hideable, so they always count toward "visible" totals.
  const visiblePrefs = schema.fields.filter((f) => !f.hidden && f.kind === 'default').length;
  const customPrefs = schema.fields.filter((f) => !f.hidden && f.kind === 'custom').length;
  const totalPrefs = schema.fields.length;
  const visibleConditions = schema.medical_checklist_enabled ? conditions.filter((c) => !c.hidden).length : 0;
  const totalConditions = schema.medical_checklist_enabled ? conditions.length : 0;

  return (
    <div style={{ background: C.bg, minHeight: '100vh', paddingBottom: 60 }}>
      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#fff', borderBottom: `1px solid ${C.light}`,
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button onClick={() => navigate('/dashboard/settings')} style={{
            background: 'transparent', border: 'none', color: C.forest,
            fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0,
          }}>← Back</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, lineHeight: 1.2 }}>Customize your intake</div>
            <div style={{ fontSize: 11, color: C.gray }}>What clients see, in your words</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: saving ? C.gray : (savedAt ? C.forest : C.gray), fontWeight: 600 }}>
          {saving ? '· Saving…' : (savedAt ? '✓ Saved' : 'No changes yet')}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '14px 12px' }}>

        {/* Phase 1 honesty banner */}
        <div style={{
          background: '#FEF3C7', border: '1px solid #FCD34D',
          borderRadius: 8, padding: '7px 11px', marginBottom: 10,
          fontSize: 11, color: '#78350F', lineHeight: 1.5,
        }}>
          <strong>Heads up:</strong> changes save now. The live client intake will use these in our next deploy.
        </div>

        {/* Progress card */}
        <div style={{
          background: '#fff', borderRadius: 10, padding: '10px 12px',
          marginBottom: 10, border: `1px solid ${C.light}`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Your intake at a glance</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, fontSize: 10, color: C.gray }}>
            <span style={{ background: C.cream, padding: '2px 7px', borderRadius: 99 }}>🗺️ Body Map · always on</span>
            <span style={{ background: C.cream, padding: '2px 7px', borderRadius: 99 }}>🎯 {visiblePrefs} preference{visiblePrefs === 1 ? '' : 's'} visible</span>
            {schema.medical_checklist_enabled && (
              <span style={{ background: C.cream, padding: '2px 7px', borderRadius: 99 }}>🩺 {visibleConditions} of {totalConditions} medical conditions</span>
            )}
            {schema.hipaa_mode && <span style={{ background: C.cream, padding: '2px 7px', borderRadius: 99 }}>🔒 HIPAA mode</span>}
            {customPrefs > 0 && <span style={{ background: C.cream, padding: '2px 7px', borderRadius: 99 }}>+{customPrefs} custom</span>}
            <span style={{ background: C.cream, padding: '2px 7px', borderRadius: 99 }}>✍️ Waiver</span>
          </div>
        </div>

        {/* Master toggles — compressed */}
        <div style={{
          background: '#fff', borderRadius: 10, padding: 10, marginBottom: 10,
          border: `1px solid ${C.light}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>Medical conditions checklist</div>
              <div style={{ fontSize: 10, color: C.gray }}>Adds a structured contraindications checklist</div>
            </div>
            <Toggle
              on={schema.medical_checklist_enabled}
              onChange={() => update({ medical_checklist_enabled: !schema.medical_checklist_enabled })}
              ariaLabel="Medical checklist"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>HIPAA mode</div>
              <div style={{ fontSize: 10, color: C.gray }}>Stronger consent + view audit log</div>
            </div>
            <Toggle
              on={schema.hipaa_mode}
              onChange={() => update({ hipaa_mode: !schema.hipaa_mode })}
              ariaLabel="HIPAA mode"
            />
          </div>
        </div>

        {/* === SECTION 1: Body Map (read-only info) === */}
        <SectionHeading icon="🗺️" title="Step 1 · Body Map" count="Always shown" />
        <div style={{
          background: C.bodyBg,
          border: `1px solid ${C.beige}`,
          borderRadius: 10,
          padding: 12,
          marginBottom: 10,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {/* tiny SVG body silhouette as a visual anchor */}
          <svg width="32" height="48" viewBox="0 0 32 48" style={{ flexShrink: 0 }}>
            <circle cx="16" cy="6" r="5" fill="none" stroke={C.sage} strokeWidth="1.5"/>
            <path d="M16 11 L16 28 M10 14 L22 14 M10 14 L8 24 M22 14 L24 24 M16 28 L12 44 M16 28 L20 44" stroke={C.sage} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2 }}>Front + back body map</div>
            <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.45 }}>
              Clients tap focus areas, avoid zones, and pressure preferences directly on a body diagram. This is your differentiator and is always part of the intake.
            </div>
          </div>
        </div>

        {/* === SECTION 2: Preferences === */}
        <SectionHeading icon="🎯" title="Step 2 · Preferences" count={`${visiblePrefs} of ${totalPrefs} visible`} />
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

        {/* === SECTION 3: Medical conditions checklist === */}
        {schema.medical_checklist_enabled && (
          <>
            <SectionHeading icon="🩺" title="Step 3 · Medical conditions" count={`${visibleConditions} of ${totalConditions} visible`} />
            <div style={{ background: '#fff', borderRadius: 10, padding: 10, marginBottom: 10, border: `1px solid ${C.light}` }}>
              {conditions.map((cond, idx) => (
                <ConditionRow
                  key={cond.v}
                  condition={cond}
                  onPatch={(p) => updateCondition(idx, p)}
                  onDelete={() => deleteCondition(idx)}
                  onToggleHidden={() => updateCondition(idx, { hidden: !cond.hidden })}
                />
              ))}
              <button onClick={addCondition} style={{
                width: '100%',
                background: 'transparent',
                border: `1.5px dashed ${C.sage}`,
                color: C.sage,
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 11, fontWeight: 600,
                cursor: 'pointer',
                marginTop: 4,
              }}>+ Add a condition</button>
            </div>
          </>
        )}

        {/* === SECTION 4: Waiver (links to existing waiver editor) === */}
        <SectionHeading icon="✍️" title="Step 4 · Waiver" count={therapist?.waiver_enabled === false ? 'Off' : 'Required'} />
        <div style={{
          background: '#fff',
          border: `1px solid ${C.light}`,
          borderRadius: 10,
          padding: 12,
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
            {therapist?.waiver_text ? 'Custom waiver text saved' : 'Standard release'}
          </div>
          <div style={{ fontSize: 11, color: C.gray, marginBottom: 10, lineHeight: 1.5 }}>
            Edit your waiver text, signatures, and consent language in Settings. Stored 7 years per ESIGN.
          </div>
          <button onClick={() => navigate('/dashboard/settings#waiver')} style={{
            background: C.forest, color: '#fff',
            border: 'none', borderRadius: 8,
            padding: '7px 14px',
            fontSize: 12, fontWeight: 700,
            cursor: 'pointer',
          }}>Edit waiver text →</button>
        </div>

        {/* === SECTION 5: Add a new question === */}
        <SectionHeading icon="✨" title="Add your own questions" />
        <button onClick={() => setAdding(true)} style={{
          width: '100%',
          background: '#fff', border: `1.5px dashed ${C.sage}`,
          borderRadius: 10, padding: '10px 16px',
          color: C.sage, fontSize: 13, fontWeight: 700,
          cursor: 'pointer', marginBottom: 10,
        }}>
          + Add a new question
        </button>
        <div style={{ fontSize: 10, color: C.gray, textAlign: 'center', lineHeight: 1.5, marginBottom: 16 }}>
          New questions appear after preferences in the client flow.
        </div>

        {/* Reset link */}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button onClick={reset} style={{
            background: 'transparent', border: 'none',
            color: C.gray, fontSize: 11, cursor: 'pointer',
            textDecoration: 'underline',
          }}>Reset to defaults</button>
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
