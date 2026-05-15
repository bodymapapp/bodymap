// src/components/PracticeAgreement.jsx
//
// Single live document. Therapist sees the rendered agreement
// EXACTLY as the client will see it: branded header, forest serif
// title, warm amber section dividers, signature block at bottom.
//
// Tap any block to highlight + open a small inline edit chip.
// Edit in place, tap outside to commit.
//
// Quiet '+' affordances between blocks let the therapist add custom
// sections without a top-level button cluttering the chrome.
//
// HK May 14 2026 direction:
//   - One document the therapist edits inline
//   - One signature the client provides at intake
//   - Booking-time hard gate re-acknowledges cancellation policy
//   - Older clients: PDF export with signature lines
//   - Visual quality must match or beat MassageBook's printed PDF
//
// Visual palette: MyBodyMap forest green with warm amber accent
// for headers + signature block (gives a presentation feel that
// the plain green-on-white doesn't).

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  DEFAULT_PRACTICE_AGREEMENT,
  parseAgreementSections,
  sectionsToMarkdown,
} from '../lib/practiceAgreement';

const C = {
  forest: '#2A5741',
  forestDark: '#1F3A2C',
  forestMid: '#3D6B4C',
  sage:   '#5C7A4F',
  ink:    '#1F2937',
  inkSoft:'#374151',
  gray:   '#6B7280',
  graySoft: '#9CA3AF',
  line:   '#E5E7EB',
  lineSoft: '#F3F4F6',
  cream:  '#FAF6EE',
  beige:  '#F5EFE0',
  paper:  '#FFFFFF',
  amber:  '#D97706',
  amberSoft: '#FEF3C7',
  amberBd: '#FCD34D',
  amberInk: '#92400E',
  editBg: '#FFFBEB',
  editBd: '#FBBF24',
};

export default function PracticeAgreement({ therapist }) {
  const initialText = therapist?.practice_agreement_text || '';
  const [text, setText] = useState(initialText);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const editRef = useRef(null);

  useEffect(() => {
    setText(therapist?.practice_agreement_text || '');
  }, [therapist?.practice_agreement_text]);

  useEffect(() => {
    if (!editing) return;
    function onClick(e) {
      if (editRef.current && !editRef.current.contains(e.target)) {
        commitEdit();
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const sections = parseAgreementSections(text);
  const isEmpty = !text || text.trim().length === 0;
  const dirty = text !== initialText;
  const business = therapist?.business_name || therapist?.full_name || 'Your practice';

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
    setEditing({ idx, title: s.title, body: s.body });
  }

  function commitEdit() {
    if (!editing) return;
    const next = [...sections];
    next[editing.idx] = {
      ...next[editing.idx],
      title: editing.title,
      body: editing.body,
    };
    setText(sectionsToMarkdown(next));
    setEditing(null);
  }

  function deleteSection(idx) {
    if (!window.confirm(`Remove the section "${sections[idx].title || 'Untitled'}"?`)) return;
    const next = sections.filter((_, i) => i !== idx);
    setText(sectionsToMarkdown(next));
    setEditing(null);
  }

  function addSectionAt(idx) {
    const title = window.prompt('New section heading? (e.g. "Membership policy")', '');
    if (!title || !title.trim()) return;
    const newSection = { title: title.trim(), body: 'Edit this section to describe your policy.', level: 2 };
    const next = [...sections];
    next.splice(idx, 0, newSection);
    setText(sectionsToMarkdown(next));
    setTimeout(() => startEdit(idx), 50);
  }

  function downloadPdf() {
    window.open('/dashboard/practice-agreement/print?print=1', '_blank', 'noopener,noreferrer');
  }

  // ─── EMPTY STATE ─────────────────────────────────────────────
  if (isEmpty) {
    return (
      <div style={{
        background: C.cream,
        border: `1.5px solid ${C.beige}`,
        borderRadius: 14,
        padding: '24px 24px 22px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 11,
          color: C.amberInk,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}>
          Based on ABMP and AMTA standards
        </div>
        <div style={{
          fontSize: 17,
          fontWeight: 700,
          color: C.forest,
          fontFamily: 'Georgia, serif',
          marginBottom: 8,
        }}>
          Load the industry standard
        </div>
        <div style={{ fontSize: 12.5, color: C.gray, lineHeight: 1.6, marginBottom: 16, maxWidth: 420, margin: '0 auto 16px' }}>
          We have drafted a complete practice agreement based on ABMP and AMTA standards. Combines policies, guidelines, consent, and waiver in one document. Tap to load it, then edit any section inline.
        </div>
        <button
          onClick={loadStandard}
          style={{
            background: C.forest,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '12px 26px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(42,87,65,0.22)',
          }}
        >
          Load industry standard →
        </button>
      </div>
    );
  }

  // ─── LIVE DOCUMENT EDITOR ──────────────────────────────────
  return (
    <div>
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <button onClick={downloadPdf} style={toolbarButton(C)}>📄 Download / Print PDF</button>
        <button onClick={loadStandard} style={toolbarButton(C)}>↻ Reset to standard</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: C.gray }}>
          {savedAt && !dirty ? `✓ Saved ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` :
           dirty ? 'Unsaved changes' :
           'Tap any text to edit'}
        </span>
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            style={{
              background: saving ? '#9CA3AF' : C.forest,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>

      <div style={{
        background: '#fff',
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}>
        <div style={{
          background: `linear-gradient(180deg, ${C.forest} 0%, ${C.forestDark} 100%)`,
          color: '#fff',
          padding: '22px 28px 20px',
        }}>
          <div style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.65)',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}>
            {business}
          </div>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: 4,
          }}>
            Practice Agreement
          </div>
          <div style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '0.04em',
          }}>
            Based on ABMP and AMTA professional standards
          </div>
        </div>

        <div style={{ padding: '18px 28px 32px' }}>
          {sections.map((s, i) => (
            <React.Fragment key={i}>
              <InsertSlot onAdd={() => addSectionAt(i)} C={C} />
              <SectionBlock
                section={s}
                index={i}
                isEditing={editing?.idx === i}
                editing={editing}
                setEditing={setEditing}
                editRef={editRef}
                onCommit={commitEdit}
                onDelete={() => deleteSection(i)}
                startEdit={() => startEdit(i)}
                C={C}
              />
            </React.Fragment>
          ))}
          <InsertSlot onAdd={() => addSectionAt(sections.length)} C={C} />

          <div style={{
            marginTop: 28,
            background: `linear-gradient(180deg, transparent 0%, ${C.amberSoft} 100%)`,
            borderTop: `2px solid ${C.amberBd}`,
            margin: '28px -28px -32px',
            padding: '22px 28px 32px',
          }}>
            <div style={{
              fontSize: 10.5,
              color: C.amberInk,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginBottom: 12,
            }}>
              Signature
            </div>
            <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.65 }}>
              At intake, your client types their full name as their e-signature. We capture the name, timestamp, and the document text exactly as it appeared. For pen signatures, use the Download / Print PDF button above and have them sign on paper.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionBlock({ section, isEditing, editing, setEditing, editRef, onCommit, onDelete, startEdit, C }) {
  const isH1 = section.level === 1;

  if (isEditing) {
    return (
      <div
        ref={editRef}
        style={{
          background: C.editBg,
          border: `2px solid ${C.editBd}`,
          borderRadius: 10,
          padding: '12px 14px',
          margin: '4px -10px 4px',
          boxShadow: '0 2px 12px rgba(217,119,6,0.10)',
        }}
      >
        {section.level === 2 && (
          <input
            value={editing.title}
            onChange={e => setEditing({ ...editing, title: e.target.value })}
            placeholder="Section heading"
            style={{
              width: '100%',
              border: `1px solid ${C.line}`,
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: 'Georgia, serif',
              color: C.ink,
              marginBottom: 8,
              boxSizing: 'border-box',
              background: '#fff',
            }}
            autoFocus
          />
        )}
        <textarea
          value={editing.body}
          onChange={e => setEditing({ ...editing, body: e.target.value })}
          rows={Math.max(3, editing.body.split('\n').length)}
          style={{
            width: '100%',
            border: `1px solid ${C.line}`,
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: 13.5,
            lineHeight: 1.65,
            fontFamily: 'inherit',
            color: C.ink,
            boxSizing: 'border-box',
            resize: 'vertical',
            minHeight: 80,
            background: '#fff',
          }}
          autoFocus={section.level === 1}
        />
        <div style={{
          display: 'flex',
          gap: 8,
          marginTop: 8,
          alignItems: 'center',
        }}>
          <button
            onClick={onCommit}
            style={{
              background: C.forest,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Apply
          </button>
          <button
            onClick={() => setEditing(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: C.gray,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          {section.level === 2 && (
            <>
              <div style={{ flex: 1 }} />
              <button
                onClick={onDelete}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#DC2626',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Remove section
              </button>
            </>
          )}
        </div>
        <div style={{
          fontSize: 10.5,
          color: C.gray,
          marginTop: 8,
          fontStyle: 'italic',
        }}>
          Tip: tap anywhere outside this box to save.
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={startEdit}
      style={{
        cursor: 'pointer',
        borderRadius: 6,
        padding: '2px 4px',
        margin: '0 -4px',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = C.cream; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      {isH1 ? (
        <h2 style={{
          fontSize: 19,
          fontWeight: 700,
          fontFamily: 'Georgia, serif',
          color: C.forest,
          margin: '4px 0 12px',
        }}>
          {section.title || 'Untitled'}
        </h2>
      ) : (
        <h3 style={{
          fontSize: 14.5,
          fontWeight: 700,
          fontFamily: 'Georgia, serif',
          color: C.amberInk,
          margin: '18px 0 6px',
          letterSpacing: '0.01em',
        }}>
          {section.title || '(untitled section)'}
        </h3>
      )}
      <ProseBody body={section.body} C={C} />
    </div>
  );
}

function ProseBody({ body, C }) {
  if (!body) return null;
  const lines = body.split('\n');
  const elements = [];
  let listItems = [];

  function flushList() {
    if (listItems.length) {
      elements.push(
        <ul key={`l-${elements.length}`} style={{ margin: '6px 0 10px 0', paddingLeft: 22 }}>
          {listItems.map((li, i) => (
            <li key={i} style={{ marginBottom: 4, fontSize: 13.5, lineHeight: 1.65, color: C.inkSoft }}>
              {li}
            </li>
          ))}
        </ul>
      );
    }
    listItems = [];
  }

  lines.forEach((line, idx) => {
    if (/^[-*]\s+/.test(line)) {
      listItems.push(line.replace(/^[-*]\s+/, ''));
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      elements.push(
        <p key={idx} style={{
          margin: '0 0 10px 0',
          fontSize: 13.5,
          lineHeight: 1.7,
          color: C.inkSoft,
        }}>
          {line}
        </p>
      );
    }
  });
  flushList();
  return <>{elements}</>;
}

function InsertSlot({ onAdd, C }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: hover ? 22 : 8,
        position: 'relative',
        transition: 'height 0.18s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <button
        onClick={onAdd}
        aria-label="Add section here"
        style={{
          opacity: hover ? 1 : 0,
          background: '#fff',
          border: `1.5px solid ${C.forestMid}`,
          color: C.forestMid,
          width: 24,
          height: 24,
          borderRadius: '50%',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          transition: 'opacity 0.15s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        +
      </button>
    </div>
  );
}

function toolbarButton(C) {
  return {
    background: '#fff',
    border: `1px solid ${C.line}`,
    borderRadius: 999,
    padding: '7px 13px',
    fontSize: 12,
    fontWeight: 600,
    color: C.ink,
    cursor: 'pointer',
    transition: 'all 0.12s',
  };
}

// Renderer for use outside the editor (print, intake, etc.)
export function AgreementRenderer({ text, businessName }) {
  if (!text) return null;
  const sections = parseAgreementSections(text);
  return (
    <div>
      <div style={{
        background: `linear-gradient(180deg, ${C.forest} 0%, ${C.forestDark} 100%)`,
        color: '#fff',
        padding: '22px 28px 20px',
        borderRadius: '14px 14px 0 0',
      }}>
        {businessName && (
          <div style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.65)',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}>
            {businessName}
          </div>
        )}
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 22,
          fontWeight: 700,
          marginBottom: 4,
        }}>
          Practice Agreement
        </div>
        <div style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.7)',
          letterSpacing: '0.04em',
        }}>
          Based on ABMP and AMTA professional standards
        </div>
      </div>
      <div style={{
        background: '#fff',
        padding: '18px 28px 32px',
        borderRadius: '0 0 14px 14px',
      }}>
        {sections.map((s, i) => {
          const isH1 = s.level === 1;
          return (
            <div key={i}>
              {isH1 ? (
                <h2 style={{
                  fontSize: 19,
                  fontWeight: 700,
                  fontFamily: 'Georgia, serif',
                  color: C.forest,
                  margin: '4px 0 12px',
                }}>{s.title}</h2>
              ) : (
                <h3 style={{
                  fontSize: 14.5,
                  fontWeight: 700,
                  fontFamily: 'Georgia, serif',
                  color: C.amberInk,
                  margin: '18px 0 6px',
                }}>{s.title}</h3>
              )}
              <ProseBody body={s.body} C={C} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
