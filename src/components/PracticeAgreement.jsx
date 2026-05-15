// src/components/PracticeAgreement.jsx
//
// HK May 14 2026 redesign brief: 'the current policies are not even
// as good as MassageBook form. Theirs is colorful, comes out nicely
// in orange and their logo, is easy to read. We have provided 12
// edit buttons again increasing work. Can you think of a better
// alternative and design.'
//
// THE NEW APPROACH:
//
//   - ONE scrollable preview, branded, looks exactly like what the
//     client will see
//   - Tap any paragraph / heading to edit it in place
//     (contenteditable with a thin amber border, no separate
//     textarea, no card-list breakup)
//   - Tap outside (or press Esc) commits the edit
//   - Floating Save bar appears at the bottom when dirty
//   - Quiet "+" between sections to add a new section
//   - Per-section "remove" appears on hover/tap of H2
//   - MyBodyMap forest green primary + warm amber accent on
//     headers and the signature block
//   - "Download / Print PDF" button uses the same render path,
//     no separate template
//
// The therapist is editing the live document. No more "12 edit
// buttons increasing work."

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  DEFAULT_PRACTICE_AGREEMENT,
} from '../lib/practiceAgreement';

const C = {
  forest:     '#2A5741',
  forestMid:  '#3D6B4C',
  forestInk:  '#1F3A2C',
  sage:       '#5C7A4F',
  amber:      '#B87840',
  amberPale:  '#F5EDD8',
  amberLine:  '#D4B070',
  ink:        '#1F2937',
  inkDim:     '#4B5563',
  gray:       '#6B7280',
  line:       '#E5E7EB',
  lineSoft:   '#F3F4F6',
  cream:      '#FAF6EE',
  beige:      '#F5EFE0',
  paper:      '#FFFFFF',
  pageBg:     '#FBF8F1',
  saved:      '#16A34A',
};

function parseBlocks(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const blocks = [];
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (line.startsWith('# ')) {
      blocks.push({ kind: 'h1', text: line.slice(2) });
    } else if (line.startsWith('## ')) {
      blocks.push({ kind: 'h2', text: line.slice(3) });
    } else if (/^[-*]\s+/.test(line)) {
      blocks.push({ kind: 'li', text: line.replace(/^[-*]\s+/, '') });
    } else if (line.trim() === '') {
      // skip blank lines
    } else {
      blocks.push({ kind: 'p', text: line });
    }
  }
  return blocks;
}

function blocksToMarkdown(blocks) {
  return blocks.map(b => {
    if (b.kind === 'h1') return `# ${b.text}`;
    if (b.kind === 'h2') return `## ${b.text}`;
    if (b.kind === 'li') return `- ${b.text}`;
    return b.text;
  }).join('\n\n');
}

export default function PracticeAgreement({ therapist }) {
  const initialText = therapist?.practice_agreement_text || '';
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [editingIdx, setEditingIdx] = useState(null);
  const [hoveredH2, setHoveredH2] = useState(null);

  useEffect(() => {
    setText(therapist?.practice_agreement_text || '');
  }, [therapist?.practice_agreement_text]);

  const blocks = parseBlocks(text);
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

  const commitBlockEdit = useCallback((idx, newText) => {
    setText(prev => {
      const cur = parseBlocks(prev);
      if (idx < 0 || idx >= cur.length) return prev;
      cur[idx] = { ...cur[idx], text: newText };
      return blocksToMarkdown(cur);
    });
    setEditingIdx(null);
  }, []);

  function removeBlock(idx) {
    if (!window.confirm('Remove this line?')) return;
    setText(prev => {
      const cur = parseBlocks(prev);
      cur.splice(idx, 1);
      return blocksToMarkdown(cur);
    });
  }

  function removeSection(h2Idx) {
    const cur = parseBlocks(text);
    if (!window.confirm(`Remove the "${cur[h2Idx].text}" section and everything under it?`)) return;
    let end = cur.length;
    for (let i = h2Idx + 1; i < cur.length; i++) {
      if (cur[i].kind === 'h2') { end = i; break; }
    }
    cur.splice(h2Idx, end - h2Idx);
    setText(blocksToMarkdown(cur));
  }

  function addSectionAfter(idx) {
    const title = window.prompt('Section heading (e.g. "Membership policy")', '');
    if (!title || !title.trim()) return;
    setText(prev => {
      const cur = parseBlocks(prev);
      cur.splice(idx + 1, 0,
        { kind: 'h2', text: title.trim() },
        { kind: 'p', text: 'Edit this section to fit your practice.' },
      );
      return blocksToMarkdown(cur);
    });
  }

  function downloadPdf() {
    window.open('/dashboard/practice-agreement/print?print=1', '_blank', 'noopener,noreferrer');
  }

  // Empty state: prominent CTA, no clutter
  if (!text || !text.trim()) {
    return (
      <div style={{
        background: `linear-gradient(135deg, ${C.cream} 0%, ${C.beige} 100%)`,
        border: `1.5px solid ${C.amberLine}`,
        borderRadius: 14,
        padding: '28px 24px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.amber,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}>
          Industry standard, ready to use
        </div>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 19,
          fontWeight: 700,
          color: C.forest,
          marginBottom: 10,
        }}>
          Your Practice Agreement
        </div>
        <div style={{
          fontSize: 13,
          color: C.gray,
          lineHeight: 1.6,
          marginBottom: 18,
          maxWidth: 460,
          margin: '0 auto 18px',
        }}>
          Load a complete agreement based on ABMP and AMTA standards, then tap any paragraph to make it yours.
        </div>
        <button
          onClick={loadStandard}
          style={{
            background: C.forest,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '12px 26px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: `0 4px 12px ${C.forest}33`,
          }}
        >
          Load industry standard
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 14,
        flexWrap: 'wrap',
      }}>
        <button onClick={downloadPdf} style={pill(C)}>Download / Print PDF</button>
        <button onClick={loadStandard} style={pill(C)}>Reset to standard</button>
        <span style={{
          marginLeft: 'auto',
          fontSize: 11,
          color: C.gray,
          alignSelf: 'center',
        }}>
          Tap any line to edit · click outside to apply
        </span>
      </div>

      <div style={{
        background: '#fff',
        borderRadius: 14,
        border: `1px solid ${C.line}`,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        {/* Branded header */}
        <div style={{
          background: `linear-gradient(135deg, ${C.forest} 0%, ${C.forestInk} 100%)`,
          color: '#fff',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.7)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginBottom: 2,
            }}>
              {therapist?.business_name || therapist?.full_name || 'Your Practice'}
            </div>
            <div style={{
              fontFamily: 'Georgia, serif',
              fontSize: 16,
              fontWeight: 700,
            }}>
              Practice Agreement
            </div>
          </div>
          <div style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.6)',
            textAlign: 'right',
            lineHeight: 1.4,
          }}>
            Based on ABMP and AMTA<br/>standards
          </div>
        </div>

        <div style={{
          padding: '24px 28px 32px',
          background: '#fff',
          maxHeight: 580,
          overflowY: 'auto',
          fontFamily: 'Georgia, serif',
          fontSize: 14,
          lineHeight: 1.65,
          color: C.ink,
        }}>
          {blocks.map((b, i) => {
            const isEditing = editingIdx === i;
            const showAdd = b.kind === 'h2' || b.kind === 'h1';
            return (
              <React.Fragment key={i}>
                <EditableBlock
                  block={b}
                  isEditing={isEditing}
                  onStart={() => setEditingIdx(i)}
                  onCommit={(t) => commitBlockEdit(i, t)}
                  onCancel={() => setEditingIdx(null)}
                  onRemove={() => removeBlock(i)}
                  onRemoveSection={b.kind === 'h2' ? () => removeSection(i) : null}
                  hovered={hoveredH2 === i}
                  onHover={(v) => b.kind === 'h2' && setHoveredH2(v ? i : null)}
                  C={C}
                />
                {showAdd && (
                  <AddDivider onAdd={() => addSectionAfter(i)} C={C} />
                )}
              </React.Fragment>
            );
          })}

          {/* Signature block, always rendered, never editable. */}
          <div style={{
            marginTop: 36,
            paddingTop: 18,
            borderTop: `1px solid ${C.line}`,
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.amber,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 14,
            }}>
              Client signature
            </div>
            <div style={{
              fontSize: 13,
              color: C.gray,
              lineHeight: 1.6,
            }}>
              The client signs once at intake, capturing this entire agreement. For older clients, tap "Download / Print PDF" above to print a paper version.
            </div>
            <div style={{
              marginTop: 14,
              background: C.amberPale,
              border: `1px solid ${C.amberLine}`,
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 12,
              color: C.amber,
              fontFamily: 'system-ui, sans-serif',
              lineHeight: 1.5,
            }}>
              <strong>Note:</strong> at booking time, clients also confirm your specific cancellation fee as a hard gate. They cannot complete a booking without acknowledging the fee structure you set under "Cancellation fee + auto-charge" below.
            </div>
          </div>
        </div>
      </div>

      {dirty && (
        <div style={{
          position: 'sticky',
          bottom: 12,
          marginTop: 14,
          background: '#fff',
          border: `1.5px solid ${C.forestMid}`,
          borderRadius: 12,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          boxShadow: '0 8px 20px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.05)',
          zIndex: 10,
        }}>
          <span style={{ fontSize: 13, color: C.forest, fontWeight: 600 }}>
            You have unsaved changes
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setText(initialText)}
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
              Discard
            </button>
            <button
              onClick={save}
              disabled={saving}
              style={{
                background: C.forest,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '7px 18px',
                fontSize: 12,
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: `0 2px 6px ${C.forest}33`,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {!dirty && savedAt && (
        <div style={{ marginTop: 10, textAlign: 'right' }}>
          <span style={{ fontSize: 11, color: C.saved, fontWeight: 600 }}>
            ✓ Saved {savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>
      )}
    </div>
  );
}

function EditableBlock({ block, isEditing, onStart, onCommit, onCancel, onRemove, onRemoveSection, hovered, onHover, C }) {
  const ref = useRef(null);
  const startText = useRef(block.text);

  useEffect(() => {
    if (isEditing) {
      startText.current = block.text;
      setTimeout(() => {
        if (ref.current) {
          ref.current.focus();
          const range = document.createRange();
          range.selectNodeContents(ref.current);
          range.collapse(false);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }, 0);
    }
  }, [isEditing, block.text]);

  function handleBlur() {
    if (!ref.current) return;
    const newText = ref.current.innerText.trim();
    if (newText === '' && block.kind !== 'h1') {
      onRemove();
      return;
    }
    if (newText !== startText.current) onCommit(newText);
    else onCancel();
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (ref.current) ref.current.innerText = startText.current;
      onCancel();
      ref.current?.blur();
    } else if (e.key === 'Enter' && (block.kind === 'h1' || block.kind === 'h2')) {
      e.preventDefault();
      ref.current?.blur();
    }
  }

  const wrapperStyle = {
    position: 'relative',
    transition: 'background 0.12s, outline-color 0.12s',
    borderRadius: 6,
  };
  const editingStyle = isEditing ? {
    background: C.amberPale,
    outline: `2px solid ${C.amberLine}`,
    outlineOffset: 4,
  } : {};

  if (block.kind === 'h1') {
    return (
      <div style={{ ...wrapperStyle, ...editingStyle, marginBottom: 18 }}>
        <h1
          ref={ref}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onClick={!isEditing ? onStart : undefined}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{
            fontSize: 22,
            fontWeight: 700,
            fontFamily: 'Georgia, serif',
            color: C.forest,
            margin: 0,
            cursor: isEditing ? 'text' : 'pointer',
            outline: 'none',
          }}
        >
          {block.text}
        </h1>
      </div>
    );
  }

  if (block.kind === 'h2') {
    return (
      <div
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        style={{ ...wrapperStyle, ...editingStyle, marginTop: 20, marginBottom: 6 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2
            ref={ref}
            contentEditable={isEditing}
            suppressContentEditableWarning
            onClick={!isEditing ? onStart : undefined}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{
              fontSize: 17,
              fontWeight: 700,
              fontFamily: 'Georgia, serif',
              color: C.ink,
              margin: 0,
              flex: 1,
              cursor: isEditing ? 'text' : 'pointer',
              outline: 'none',
              borderLeft: `3px solid ${C.amber}`,
              paddingLeft: 10,
            }}
          >
            {block.text}
          </h2>
          {hovered && !isEditing && onRemoveSection && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemoveSection(); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#DC2626',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px',
                opacity: 0.7,
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
            >
              Remove section
            </button>
          )}
        </div>
      </div>
    );
  }

  if (block.kind === 'li') {
    return (
      <div style={{
        ...wrapperStyle, ...editingStyle,
        display: 'flex', gap: 10, paddingLeft: 8, marginBottom: 4,
      }}>
        <span style={{
          color: C.sage, flexShrink: 0, marginTop: 2,
          fontFamily: 'system-ui, sans-serif',
        }}>•</span>
        <p
          ref={ref}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onClick={!isEditing ? onStart : undefined}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{
            margin: 0, flex: 1,
            cursor: isEditing ? 'text' : 'pointer',
            outline: 'none',
          }}
        >
          {block.text}
        </p>
      </div>
    );
  }

  return (
    <div style={{ ...wrapperStyle, ...editingStyle, marginBottom: 10 }}>
      <p
        ref={ref}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onClick={!isEditing ? onStart : undefined}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{
          margin: 0, padding: '2px 4px',
          cursor: isEditing ? 'text' : 'pointer',
          outline: 'none',
        }}
      >
        {block.text}
      </p>
    </div>
  );
}

function AddDivider({ onAdd, C }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onAdd}
      style={{ height: 16, position: 'relative', cursor: 'pointer' }}
    >
      <div style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        height: 1,
        background: hover ? C.amberLine : 'transparent',
        transform: 'translateY(-50%)',
        transition: 'background 0.15s',
      }} />
      {hover && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: C.amber,
          color: '#fff',
          borderRadius: 12,
          padding: '2px 10px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
        }}>
          + add section
        </div>
      )}
    </div>
  );
}

function pill(C) {
  return {
    background: '#fff',
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

// AgreementRenderer exported for backward-compat with
// PracticeAgreementPrint + ClientIntake which import it.
export function AgreementRenderer({ text }) {
  if (!text) return null;
  const blocks = parseBlocks(text);
  const elements = [];
  let listBuffer = [];

  function flushList() {
    if (listBuffer.length) {
      elements.push(
        <ul key={`l-${elements.length}`} style={{
          margin: '8px 0 14px 0',
          paddingLeft: 22,
        }}>
          {listBuffer.map((li, i) => (
            <li key={i} style={{ marginBottom: 5 }}>{li}</li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
  }

  blocks.forEach((b, i) => {
    if (b.kind === 'h1') {
      flushList();
      elements.push(
        <h1 key={i} style={{
          fontSize: 22,
          fontWeight: 700,
          fontFamily: 'Georgia, serif',
          color: C.forest,
          margin: '0 0 14px 0',
        }}>{b.text}</h1>
      );
    } else if (b.kind === 'h2') {
      flushList();
      elements.push(
        <h2 key={i} style={{
          fontSize: 16,
          fontWeight: 700,
          fontFamily: 'Georgia, serif',
          color: C.ink,
          margin: '18px 0 6px 0',
          borderLeft: `3px solid ${C.amber}`,
          paddingLeft: 10,
        }}>{b.text}</h2>
      );
    } else if (b.kind === 'li') {
      listBuffer.push(b.text);
    } else {
      flushList();
      elements.push(
        <p key={i} style={{ margin: '0 0 10px 0', lineHeight: 1.65 }}>
          {b.text}
        </p>
      );
    }
  });
  flushList();
  return <>{elements}</>;
}
