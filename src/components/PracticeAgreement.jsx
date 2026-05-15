// src/components/PracticeAgreement.jsx
//
// Single unified editor for the practice agreement. Replaces the
// previously-separate Waiver / Booking Policies / Cancellation
// Policy editors from the therapist UX surface.
//
// HK May 14 2026: 'There should be an intake form and then everything
// else on policies on just one document. Therapist sends that
// document for esignature for modern clients and for a pen
// signature for older clients.'
//
// UX:
//   - Document parses into sections by H2 (## ) headers
//   - Each section is tappable -> expands inline to a textarea
//   - Tap outside the textarea to collapse
//   - Top of card: 'Load industry standard' button (when text is
//     empty), or 'Reset to standard' (when custom text exists)
//   - Bottom: 'Save' (only enabled when changed) + 'Download as PDF'
//   - Mobile: each section renders as a tappable card, expands to
//     full-width textarea on tap

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  DEFAULT_PRACTICE_AGREEMENT,
  parseAgreementSections,
  sectionsToMarkdown,
} from '../lib/practiceAgreement';

const C = {
  forest: '#2A5741',
  forestMid: '#3D6B4C',
  sage:   '#5C7A4F',
  ink:    '#1F2937',
  gray:   '#6B7280',
  line:   '#E5E7EB',
  lineSoft: '#F3F4F6',
  cream:  '#FAF6EE',
  beige:  '#F5EFE0',
  paper:  '#FFFFFF',
  warn:   '#FEF3C7',
  warnBd: '#FCD34D',
  amber:  '#92400E',
};

export default function PracticeAgreement({ therapist }) {
  const initialText = therapist?.practice_agreement_text || '';
  const [text, setText] = useState(initialText);
  const [editingSection, setEditingSection] = useState(null); // index
  const [editingBody, setEditingBody] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    setText(therapist?.practice_agreement_text || '');
  }, [therapist?.practice_agreement_text]);

  const sections = parseAgreementSections(text);
  const isEmpty = !text || text.trim().length === 0;
  const dirty = text !== initialText;

  async function save() {
    if (!therapist?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('therapists')
        .update({
          practice_agreement_text: text,
          practice_agreement_enabled: true,
          practice_agreement_updated_at: new Date().toISOString(),
        })
        .eq('id', therapist.id);
      if (error) throw error;
      setSavedAt(new Date());
    } catch (e) {
      console.error('[PracticeAgreement] save failed:', e);
      alert('Save failed. Please try again or refresh the page.');
    } finally {
      setSaving(false);
    }
  }

  function loadStandard() {
    if (text && text.trim() && !window.confirm('Replace your current agreement with the industry-standard text? Your existing edits will be lost.')) {
      return;
    }
    setText(DEFAULT_PRACTICE_AGREEMENT);
  }

  function startEdit(idx) {
    const s = sections[idx];
    setEditingSection(idx);
    setEditingTitle(s.title);
    setEditingBody(s.body);
    // Focus the textarea on next tick
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function commitEdit() {
    if (editingSection === null) return;
    const next = [...sections];
    next[editingSection] = {
      ...next[editingSection],
      title: editingTitle,
      body: editingBody,
    };
    setText(sectionsToMarkdown(next));
    setEditingSection(null);
  }

  function cancelEdit() {
    setEditingSection(null);
    setEditingBody('');
    setEditingTitle('');
  }

  function downloadPdf() {
    // Open the print-friendly view in a new tab. Browser print dialog
    // becomes "Save as PDF" on every modern browser. No extra deps,
    // no server roundtrip, works on mobile (Safari, Chrome) and desktop.
    const url = `/dashboard/practice-agreement/print?print=1`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function deleteSection(idx) {
    if (!window.confirm(`Remove the section "${sections[idx].title}"? You can always add it back by editing the document.`)) return;
    const next = sections.filter((_, i) => i !== idx);
    setText(sectionsToMarkdown(next));
  }

  function addSection() {
    const title = window.prompt('Section heading? (e.g. "Membership policy")', '');
    if (!title || !title.trim()) return;
    const next = [...sections, { title: title.trim(), body: '', level: 2 }];
    setText(sectionsToMarkdown(next));
    // Open the new section for editing
    setTimeout(() => startEdit(next.length - 1), 100);
  }

  // ─── EMPTY STATE ─────────────────────────────────────────────
  if (isEmpty) {
    return (
      <div style={{
        background: C.cream,
        border: `1.5px solid ${C.beige}`,
        borderRadius: 12,
        padding: '20px 22px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: C.forest,
          fontFamily: 'Georgia, serif',
          marginBottom: 6,
        }}>
          Start with the industry standard
        </div>
        <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.6, marginBottom: 14 }}>
          We've drafted a complete practice agreement based on ABMP and AMTA standards. Tap to load it, then edit any section to fit your practice.
        </div>
        <button
          onClick={loadStandard}
          style={{
            background: C.forest,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '11px 22px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(42,87,65,0.2)',
          }}
        >
          Load industry standard
        </button>
      </div>
    );
  }

  // ─── PREVIEW MODE ────────────────────────────────────────────
  if (previewing) {
    return (
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => setPreviewing(false)}
            style={{
              background: 'transparent',
              border: `1.5px solid ${C.line}`,
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 700,
              color: C.ink,
              cursor: 'pointer',
            }}
          >
            ← Back to editor
          </button>
          <span style={{ fontSize: 11, color: C.gray, fontWeight: 600 }}>
            This is what your client sees
          </span>
        </div>
        <div style={{
          background: C.paper,
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          padding: '20px 24px',
          maxHeight: 600,
          overflowY: 'auto',
          fontSize: 13.5,
          lineHeight: 1.65,
          color: C.ink,
        }}>
          <AgreementRenderer text={text} />
        </div>
      </div>
    );
  }

  // ─── EDITOR ──────────────────────────────────────────────────
  return (
    <div>
      {/* Header row: action buttons */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 14,
        flexWrap: 'wrap',
      }}>
        <button
          onClick={() => setPreviewing(true)}
          style={pillButton(C, 'paper')}
        >
          Preview as client →
        </button>
        <button
          onClick={downloadPdf}
          style={pillButton(C, 'paper')}
        >
          Download / Print PDF
        </button>
        <button
          onClick={addSection}
          style={pillButton(C, 'paper')}
        >
          + Add section
        </button>
        <button
          onClick={loadStandard}
          style={pillButton(C, 'paper')}
        >
          Reset to standard
        </button>
      </div>

      {/* Helper note */}
      <div style={{
        background: C.cream,
        border: `1px solid ${C.beige}`,
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 12,
        color: C.gray,
        lineHeight: 1.55,
        marginBottom: 14,
      }}>
        Tap any section to edit it. Add or remove sections to fit your practice. Your client signs this whole document with one signature at intake. Industry sourced from ABMP and AMTA standards.
      </div>

      {/* Section list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sections.map((s, i) => (
          <SectionRow
            key={i}
            section={s}
            isEditing={editingSection === i}
            editingTitle={editingTitle}
            editingBody={editingBody}
            setEditingTitle={setEditingTitle}
            setEditingBody={setEditingBody}
            textareaRef={textareaRef}
            onStart={() => startEdit(i)}
            onCommit={commitEdit}
            onCancel={cancelEdit}
            onDelete={() => deleteSection(i)}
            C={C}
          />
        ))}
      </div>

      {/* Save row */}
      <div style={{
        marginTop: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, color: C.gray }}>
          {savedAt && !dirty ? `✓ Saved ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` :
           dirty ? 'Unsaved changes' :
           'No changes'}
        </span>
        <button
          onClick={save}
          disabled={!dirty || saving}
          style={{
            background: dirty && !saving ? C.forest : '#D1D5DB',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 20px',
            fontSize: 13,
            fontWeight: 700,
            cursor: dirty && !saving ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
          }}
        >
          {saving ? 'Saving…' : 'Save agreement'}
        </button>
      </div>
    </div>
  );
}

// ─── SectionRow ────────────────────────────────────────────────
function SectionRow({ section, isEditing, editingTitle, editingBody, setEditingTitle, setEditingBody, textareaRef, onStart, onCommit, onCancel, onDelete, C }) {
  if (isEditing) {
    return (
      <div style={{
        background: C.paper,
        border: `1.5px solid ${C.forestMid}`,
        borderRadius: 10,
        padding: 12,
        boxShadow: '0 2px 8px rgba(42,87,65,0.10)',
      }}>
        {section.level === 2 && (
          <input
            value={editingTitle}
            onChange={e => setEditingTitle(e.target.value)}
            placeholder="Section title"
            style={{
              width: '100%',
              border: `1px solid ${C.line}`,
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'Georgia, serif',
              color: C.ink,
              marginBottom: 8,
              boxSizing: 'border-box',
            }}
          />
        )}
        <textarea
          ref={textareaRef}
          value={editingBody}
          onChange={e => setEditingBody(e.target.value)}
          rows={Math.max(4, editingBody.split('\n').length + 1)}
          style={{
            width: '100%',
            border: `1px solid ${C.line}`,
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: 13,
            lineHeight: 1.55,
            fontFamily: 'inherit',
            color: C.ink,
            boxSizing: 'border-box',
            resize: 'vertical',
            minHeight: 80,
          }}
        />
        <div style={{
          display: 'flex',
          gap: 8,
          marginTop: 10,
          flexWrap: 'wrap',
        }}>
          <button
            onClick={onCommit}
            style={{
              background: C.forest,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Apply
          </button>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: `1px solid ${C.line}`,
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: C.gray,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          {section.level === 2 && (
            <button
              onClick={onDelete}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#DC2626',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              Remove section
            </button>
          )}
        </div>
      </div>
    );
  }

  // Collapsed view
  const preview = section.body.split('\n').filter(l => l.trim()).slice(0, 2).join(' ');
  return (
    <div
      onClick={onStart}
      style={{
        background: C.paper,
        border: `1px solid ${C.line}`,
        borderRadius: 10,
        padding: 12,
        cursor: 'pointer',
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.forestMid; e.currentTarget.style.background = C.cream; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.background = C.paper; }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: section.body ? 4 : 0,
      }}>
        <div style={{
          fontSize: section.level === 1 ? 15 : 13.5,
          fontWeight: 700,
          fontFamily: 'Georgia, serif',
          color: section.level === 1 ? C.forest : C.ink,
        }}>
          {section.title || '(untitled section)'}
        </div>
        <span style={{ fontSize: 11, color: C.gray, fontWeight: 600 }}>
          Tap to edit
        </span>
      </div>
      {preview && (
        <div style={{
          fontSize: 12,
          color: C.gray,
          lineHeight: 1.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {preview}
        </div>
      )}
    </div>
  );
}

// ─── AgreementRenderer ────────────────────────────────────────
// Render markdown agreement as styled HTML for preview + client view
export function AgreementRenderer({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let inList = false;
  let listItems = [];

  function flushList() {
    if (inList && listItems.length) {
      elements.push(
        <ul key={`l-${elements.length}`} style={{ margin: '8px 0 12px 0', paddingLeft: 22 }}>
          {listItems.map((li, i) => <li key={i} style={{ marginBottom: 4 }}>{li}</li>)}
        </ul>
      );
    }
    inList = false;
    listItems = [];
  }

  lines.forEach((line, idx) => {
    if (line.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={idx} style={{
          fontSize: 22,
          fontWeight: 700,
          fontFamily: 'Georgia, serif',
          color: '#2A5741',
          margin: '0 0 14px 0',
        }}>{line.replace(/^#\s+/, '')}</h1>
      );
    } else if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={idx} style={{
          fontSize: 16,
          fontWeight: 700,
          fontFamily: 'Georgia, serif',
          color: '#1F2937',
          margin: '18px 0 6px 0',
        }}>{line.replace(/^##\s+/, '')}</h2>
      );
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) { inList = true; listItems = []; }
      listItems.push(line.replace(/^[-*]\s+/, ''));
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      elements.push(
        <p key={idx} style={{ margin: '0 0 10px 0', lineHeight: 1.65 }}>
          {line}
        </p>
      );
    }
  });
  flushList();
  return <>{elements}</>;
}

function pillButton(C, variant) {
  return {
    background: variant === 'paper' ? C.paper : C.cream,
    border: `1px solid ${C.line}`,
    borderRadius: 999,
    padding: '7px 14px',
    fontSize: 12,
    fontWeight: 700,
    color: C.ink,
    cursor: 'pointer',
    transition: 'all 0.12s',
  };
}
