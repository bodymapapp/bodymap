// src/components/PracticeAgreement.jsx
//
// Client Agreement editor v3 -- paper-feel document, table of contents,
// editorial typography, refined signature block. Designed for the
// 70-year-old client persona to feel comfortable and the therapist
// to feel proud showing it.
//
// HK May 14 2026: 'The design looks a little bit better, but I don't
// think it is there yet. Make sure you improve it by two to three
// times. Add a table of contents so that the seventy year old persona
// is fully clear on what they're looking at. Make sure that everything
// we saw in the massage book form is there and even better.'
//
// THE APPROACH:
//
//   - Paper-feel container with warm off-white background, soft
//     shadow, deckle-edge feel via inset border accents
//   - Editorial branded header: monogram accent + business name +
//     'Client Agreement and Informed Consent' title + ABMP/AMTA
//     attribution as a small kicker line
//   - Table of Contents: numbered list with section titles, leading
//     dots, in roman numeral style. Tap a section in editor to jump
//     to it (smooth scroll)
//   - Section numbers: H2 sections prefixed I., II., III. etc.
//   - Refined typography: Georgia for headlines, system serif for
//     body, generous line height, drop-cap-like first letter on
//     intro paragraph
//   - Refined signature block: classic three-column legal contract
//     layout (printed name | signature | date), amber accent on
//     'Signature' label
//   - Inline contenteditable: tap any block, thin amber outline,
//     blur to commit, Esc to cancel. Same UX as v2 but on a much
//     better-looking canvas.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { DEFAULT_PRACTICE_AGREEMENT, renderAgreementForClient } from '../lib/practiceAgreement';

// Resolve dynamic tokens like {cancel_under_24h} to live percentage
// values from the therapist's cancellation_policy. Used at DISPLAY
// time only; the raw markdown stored on the therapist record keeps
// the tokens so editing in one place (cancellation policy editor)
// keeps the agreement in sync. When the therapist taps a block to
// edit, they see the raw token so they understand what's dynamic.
function resolveTokens(rawText, therapist) {
  if (!rawText || !therapist) return rawText || '';
  if (!/\{(cancel|reschedule|no_show)/.test(rawText)) return rawText;
  // Borrow the full render path for consistency
  return renderAgreementForClient(rawText, therapist);
}

const C = {
  forest:       '#2A5741',
  forestMid:    '#3D6B4C',
  forestInk:    '#1F3A2C',
  forestDeep:   '#162D22',
  sage:         '#5C7A4F',
  amber:        '#B87840',
  amberDeep:    '#A0612C',
  amberPale:    '#F5EDD8',
  amberLine:    '#D4B070',
  ink:          '#1F2937',
  inkSoft:      '#374151',
  gray:         '#6B7280',
  grayLight:    '#9CA3AF',
  line:         '#E5E7EB',
  lineSoft:     '#F3F4F6',
  paper:        '#FDFBF6',  // warm off-white "paper" tone
  paperEdge:    '#F2EDDF',  // slightly darker paper edge
  cream:        '#FAF6EE',
  saved:        '#16A34A',
};

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

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
      // skip blank
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

// Build TOC from blocks: each H2 with its position index
function buildToc(blocks) {
  const toc = [];
  blocks.forEach((b, idx) => {
    if (b.kind === 'h2') {
      toc.push({ idx, title: b.text, number: toc.length + 1 });
    }
  });
  return toc;
}

export default function PracticeAgreement({ therapist }) {
  const initialText = therapist?.practice_agreement_text || '';
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [editingIdx, setEditingIdx] = useState(null);
  const [hoveredH2, setHoveredH2] = useState(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const scrollContainerRef = useRef(null);
  const blockRefs = useRef({});

  useEffect(() => {
    setText(therapist?.practice_agreement_text || '');
  }, [therapist?.practice_agreement_text]);

  const blocks = parseBlocks(text);
  const toc = buildToc(blocks);
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
      console.error('[ClientAgreement] save failed:', e);
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

  function jumpToSection(idx) {
    const el = blockRefs.current[idx];
    if (el && scrollContainerRef.current) {
      const containerTop = scrollContainerRef.current.getBoundingClientRect().top;
      const elementTop = el.getBoundingClientRect().top;
      const scrollOffset = elementTop - containerTop + scrollContainerRef.current.scrollTop - 16;
      scrollContainerRef.current.scrollTo({ top: scrollOffset, behavior: 'smooth' });
    }
  }

  // Empty state
  if (!text || !text.trim()) {
    return (
      <div style={{
        background: `linear-gradient(135deg, ${C.cream} 0%, ${C.amberPale} 100%)`,
        border: `1.5px solid ${C.amberLine}`,
        borderRadius: 14,
        padding: '32px 24px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: C.amberDeep,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}>
          Industry standard, ready to use
        </div>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 22,
          fontWeight: 700,
          color: C.forest,
          marginBottom: 10,
          letterSpacing: '-0.01em',
        }}>
          Your Client Agreement
        </div>
        <div style={{
          fontSize: 13.5,
          color: C.gray,
          lineHeight: 1.65,
          marginBottom: 22,
          maxWidth: 460,
          margin: '0 auto 22px',
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
            padding: '13px 28px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: `0 4px 14px ${C.forest}33`,
            letterSpacing: '0.02em',
          }}
        >
          Load industry standard
        </button>
      </div>
    );
  }

  const businessName = therapist?.business_name || therapist?.full_name || 'Your Practice';
  const monogram = businessName.split(/\s+/).map(w => w[0]?.toUpperCase()).slice(0, 2).join('');

  return (
    <div style={{ position: 'relative' }}>
      {/* Toolbar above the document */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 14,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <button onClick={() => setShowSendModal(true)} style={pill(C, 'primary')}>
          ✉ Send for signature
        </button>
        <button onClick={downloadPdf} style={pill(C)}>
          ⬇ Download / Print PDF
        </button>
        <button onClick={loadStandard} style={pill(C)}>
          Reset to standard
        </button>
        <span style={{
          marginLeft: 'auto',
          fontSize: 11,
          color: C.gray,
          alignSelf: 'center',
          fontStyle: 'italic',
        }}>
          Tap any line to edit
        </span>
      </div>

      {/* Live-percentage note. Only shown when the agreement text
          contains cancellation tokens, so therapists who customized
          their agreement (and removed the tokens) don't see this. */}
      {/\{(cancel|reschedule|no_show)/.test(text) && (
        <div style={{
          background: '#FFF8E7',
          border: '1px solid #F3D88E',
          borderRadius: 10,
          padding: '9px 12px',
          marginBottom: 14,
          fontSize: 11.5,
          color: '#7A5A18',
          lineHeight: 1.5,
        }}>
          The cancellation percentages in your agreement fill in automatically from your cancellation settings below. Edit them once in the cancellation editor and the numbers update everywhere.
        </div>
      )}

      {/* THE DOCUMENT -- paper feel */}
      <div style={{
        background: C.paper,
        borderRadius: 14,
        border: `1px solid ${C.paperEdge}`,
        overflow: 'hidden',
        boxShadow: '0 6px 24px rgba(31,58,44,0.10), 0 1px 3px rgba(31,58,44,0.06)',
      }}>
        {/* Branded header -- editorial style */}
        <div style={{
          background: `linear-gradient(180deg, ${C.forestInk} 0%, ${C.forest} 100%)`,
          color: '#fff',
          padding: '22px 28px 20px',
          position: 'relative',
        }}>
          {/* Amber accent line */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${C.amber} 0%, ${C.amberDeep} 50%, ${C.amber} 100%)`,
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Monogram circle */}
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: `1.5px solid rgba(255,255,255,0.35)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Georgia, serif',
              fontSize: 16,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
              background: 'rgba(255,255,255,0.05)',
            }}>
              {monogram}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.75)',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                marginBottom: 3,
              }}>
                {businessName}
              </div>
              <div style={{
                fontFamily: 'Georgia, serif',
                fontSize: 19,
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '-0.005em',
                lineHeight: 1.2,
              }}>
                Client Agreement & Informed Consent
              </div>
            </div>
          </div>
          <div style={{
            marginTop: 12,
            fontSize: 10.5,
            color: 'rgba(255,255,255,0.6)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontWeight: 600,
            borderTop: '1px solid rgba(255,255,255,0.12)',
            paddingTop: 10,
          }}>
            Based on ABMP and AMTA professional standards
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div
          ref={scrollContainerRef}
          style={{
            background: C.paper,
            maxHeight: 640,
            overflowY: 'auto',
            // Subtle inner shadow for paper-edge feel
            boxShadow: 'inset 0 0 60px rgba(146,116,52,0.04)',
          }}
        >
          <div style={{
            padding: '28px 36px 36px',
            fontFamily: 'Georgia, serif',
            fontSize: 14.5,
            lineHeight: 1.75,
            color: C.inkSoft,
            maxWidth: 640,
            margin: '0 auto',
          }}>
            {/* Table of Contents -- sits between the H1 (preamble) and first H2 */}
            {toc.length > 1 && (
              <div style={{
                background: C.cream,
                border: `1px solid ${C.amberPale}`,
                borderRadius: 10,
                padding: '18px 22px',
                marginBottom: 28,
                marginTop: 4,
              }}>
                <div style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: C.amberDeep,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                  fontFamily: 'system-ui, sans-serif',
                }}>
                  Contents
                </div>
                <ol style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  fontFamily: 'Georgia, serif',
                }}>
                  {toc.map(item => (
                    <li
                      key={item.idx}
                      onClick={() => jumpToSection(item.idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        padding: '4px 0',
                        cursor: 'pointer',
                        fontSize: 13.5,
                        color: C.inkSoft,
                        transition: 'color 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = C.forest}
                      onMouseLeave={e => e.currentTarget.style.color = C.inkSoft}
                    >
                      <span style={{
                        fontFamily: 'Georgia, serif',
                        fontStyle: 'italic',
                        color: C.amberDeep,
                        fontSize: 12,
                        marginRight: 10,
                        minWidth: 24,
                        flexShrink: 0,
                      }}>
                        {ROMAN[item.number] || item.number}.
                      </span>
                      <span style={{ flex: 1 }}>{item.title}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* The blocks */}
            {blocks.map((b, i) => {
              const isEditing = editingIdx === i;
              const showAdd = b.kind === 'h2' || b.kind === 'h1';
              const sectionNumber = b.kind === 'h2'
                ? toc.find(t => t.idx === i)?.number
                : null;
              return (
                <React.Fragment key={i}>
                  <EditableBlock
                    block={b}
                    sectionNumber={sectionNumber}
                    isEditing={isEditing}
                    therapist={therapist}
                    onStart={() => setEditingIdx(i)}
                    onCommit={(t) => commitBlockEdit(i, t)}
                    onCancel={() => setEditingIdx(null)}
                    onRemove={() => removeBlock(i)}
                    onRemoveSection={b.kind === 'h2' ? () => removeSection(i) : null}
                    hovered={hoveredH2 === i}
                    onHover={(v) => b.kind === 'h2' && setHoveredH2(v ? i : null)}
                    setRef={(el) => { blockRefs.current[i] = el; }}
                    C={C}
                  />
                  {showAdd && (
                    <AddDivider onAdd={() => addSectionAfter(i)} C={C} />
                  )}
                </React.Fragment>
              );
            })}

            {/* Signature block -- classic legal contract layout */}
            <SignatureBlock C={C} />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          background: C.paperEdge,
          padding: '10px 28px',
          fontSize: 10,
          color: C.gray,
          textAlign: 'center',
          letterSpacing: '0.04em',
          borderTop: `1px solid ${C.line}`,
          fontFamily: 'system-ui, sans-serif',
        }}>
          {businessName} · Generated by MyBodyMap · Based on ABMP and AMTA standards
        </div>
      </div>

      {/* Floating save bar */}
      {dirty && (
        <div style={{
          position: 'sticky',
          bottom: 12,
          marginTop: 14,
          background: '#fff',
          border: `1.5px solid ${C.forestMid}`,
          borderRadius: 12,
          padding: '11px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          boxShadow: '0 12px 28px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.05)',
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
                padding: '8px 14px',
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
                padding: '8px 20px',
                fontSize: 12,
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: `0 2px 8px ${C.forest}33`,
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

      {showSendModal && (
        <SendForSignatureModal
          therapist={therapist}
          onClose={() => setShowSendModal(false)}
          C={C}
        />
      )}
    </div>
  );
}

// ─── EditableBlock ────────────────────────────────────────────
function EditableBlock({ block, sectionNumber, isEditing, therapist, onStart, onCommit, onCancel, onRemove, onRemoveSection, hovered, onHover, setRef, C }) {
  const editRef = useRef(null);
  const startText = useRef(block.text);

  // Display text shows resolved tokens (live percentages). When the
  // block is being edited, the contenteditable shows the RAW text
  // so the therapist sees and can move the {tokens} themselves.
  const displayText = resolveTokens(block.text, therapist);
  const hasTokens = displayText !== block.text;

  useEffect(() => {
    if (isEditing) {
      startText.current = block.text;
      setTimeout(() => {
        if (editRef.current) {
          editRef.current.focus();
          const range = document.createRange();
          range.selectNodeContents(editRef.current);
          range.collapse(false);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }, 0);
    }
  }, [isEditing, block.text]);

  function handleBlur() {
    if (!editRef.current) return;
    const newText = editRef.current.innerText.trim();
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
      if (editRef.current) editRef.current.innerText = startText.current;
      onCancel();
      editRef.current?.blur();
    } else if (e.key === 'Enter' && (block.kind === 'h1' || block.kind === 'h2')) {
      e.preventDefault();
      editRef.current?.blur();
    }
  }

  const editingStyle = isEditing ? {
    background: C.amberPale,
    outline: `2px solid ${C.amberLine}`,
    outlineOffset: 4,
    borderRadius: 4,
  } : {};

  if (block.kind === 'h1') {
    return (
      <div ref={setRef} style={{ ...editingStyle, marginBottom: 22 }}>
        <h1
          ref={editRef}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onClick={!isEditing ? onStart : undefined}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{
            fontSize: 26,
            fontWeight: 700,
            fontFamily: 'Georgia, serif',
            color: C.forest,
            margin: 0,
            letterSpacing: '-0.01em',
            cursor: isEditing ? 'text' : 'pointer',
            outline: 'none',
            lineHeight: 1.25,
          }}
        >
          {isEditing ? block.text : displayText}
        </h1>
      </div>
    );
  }

  if (block.kind === 'h2') {
    return (
      <div
        ref={setRef}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        style={{ ...editingStyle, marginTop: 32, marginBottom: 10 }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          {sectionNumber != null && (
            <span style={{
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              color: C.amberDeep,
              fontSize: 14,
              fontWeight: 600,
              flexShrink: 0,
              minWidth: 26,
            }}>
              {ROMAN[sectionNumber] || sectionNumber}.
            </span>
          )}
          <h2
            ref={editRef}
            contentEditable={isEditing}
            suppressContentEditableWarning
            onClick={!isEditing ? onStart : undefined}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{
              fontSize: 17.5,
              fontWeight: 700,
              fontFamily: 'Georgia, serif',
              color: C.ink,
              margin: 0,
              flex: 1,
              cursor: isEditing ? 'text' : 'pointer',
              outline: 'none',
              letterSpacing: '-0.005em',
            }}
          >
            {isEditing ? block.text : displayText}
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
                fontFamily: 'system-ui, sans-serif',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
            >
              Remove section
            </button>
          )}
        </div>
        {/* Underline rule below H2 */}
        <div style={{
          height: 1,
          background: `linear-gradient(90deg, ${C.amber}66 0%, transparent 100%)`,
          marginTop: 6,
          marginLeft: sectionNumber != null ? 38 : 0,
        }} />
      </div>
    );
  }

  if (block.kind === 'li') {
    return (
      <div
        ref={setRef}
        style={{ ...editingStyle, display: 'flex', gap: 12, paddingLeft: 8, marginBottom: 6 }}
      >
        <span style={{
          color: C.amber,
          flexShrink: 0,
          marginTop: 3,
          fontFamily: 'Georgia, serif',
          fontWeight: 700,
        }}>•</span>
        <p
          ref={editRef}
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
          {isEditing ? block.text : displayText}
        </p>
      </div>
    );
  }

  // paragraph
  return (
    <div ref={setRef} style={{ ...editingStyle, marginBottom: 14 }}>
      <p
        ref={editRef}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onClick={!isEditing ? onStart : undefined}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{
          margin: 0,
          padding: '3px 4px',
          cursor: isEditing ? 'text' : 'pointer',
          outline: 'none',
          textAlign: 'justify',
          hyphens: 'auto',
        }}
      >
        {isEditing ? block.text : displayText}
      </p>
    </div>
  );
}

// ─── AddDivider ────────────────────────────────────────────────
function AddDivider({ onAdd, C }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onAdd}
      style={{ height: 18, position: 'relative', cursor: 'pointer' }}
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
          borderRadius: 14,
          padding: '3px 12px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontFamily: 'system-ui, sans-serif',
        }}>
          + add section
        </div>
      )}
    </div>
  );
}

// ─── SignatureBlock ────────────────────────────────────────────
function SignatureBlock({ C }) {
  return (
    <div style={{
      marginTop: 48,
      paddingTop: 24,
      borderTop: `2px double ${C.amberLine}`,
    }}>
      <div style={{
        fontSize: 10.5,
        fontWeight: 700,
        color: C.amberDeep,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        marginBottom: 8,
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}>
        Client signature
      </div>
      <p style={{
        margin: '0 0 24px',
        textAlign: 'center',
        fontSize: 13,
        color: C.gray,
        fontStyle: 'italic',
      }}>
        By signing below, you confirm that you have read and understood this agreement, and that you agree to its terms.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20 }}>
        <div>
          <div style={{ borderBottom: `1.5px solid ${C.ink}`, height: 32 }} />
          <div style={{ fontSize: 10.5, color: C.gray, marginTop: 5, fontFamily: 'system-ui, sans-serif', letterSpacing: '0.04em' }}>
            Client name (printed)
          </div>
        </div>
        <div>
          <div style={{ borderBottom: `1.5px solid ${C.ink}`, height: 32 }} />
          <div style={{ fontSize: 10.5, color: C.gray, marginTop: 5, fontFamily: 'system-ui, sans-serif', letterSpacing: '0.04em' }}>
            Date
          </div>
        </div>
      </div>

      <div>
        <div style={{ borderBottom: `1.5px solid ${C.ink}`, height: 44 }} />
        <div style={{ fontSize: 10.5, color: C.gray, marginTop: 5, fontFamily: 'system-ui, sans-serif', letterSpacing: '0.04em' }}>
          Client signature
        </div>
      </div>

      <div style={{
        marginTop: 24,
        padding: '12px 14px',
        background: C.cream,
        border: `1px solid ${C.amberPale}`,
        borderRadius: 8,
        fontSize: 12,
        color: C.inkSoft,
        fontFamily: 'system-ui, sans-serif',
        lineHeight: 1.55,
        textAlign: 'left',
      }}>
        <strong style={{ color: C.amberDeep, letterSpacing: '0.04em' }}>Therapist note:</strong> Clients booking online sign this digitally at intake. For older clients who prefer paper, tap "Download / Print PDF" above. The cancellation fee they confirm at booking time is shown to them as a separate hard gate before they complete their booking, on top of this agreement.
      </div>
    </div>
  );
}

// ─── SendForSignatureModal ─────────────────────────────────
// Therapist picks an existing client (or types a new one), we mint
// a token, save a row in agreement_send_requests, and surface the
// signing link the therapist can send via SMS/email/copy.
function SendForSignatureModal({ therapist, onClose, C }) {
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [pickedClientId, setPickedClientId] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [sentLink, setSentLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('clients')
          .select('id, full_name, email, phone, practice_agreement_signed_at')
          .eq('therapist_id', therapist.id)
          .order('full_name', { ascending: true })
          .limit(200);
        if (mounted) setClients(data || []);
      } catch (e) { /* non-blocking */ }
      finally { if (mounted) setLoadingClients(false); }
    })();
    return () => { mounted = false; };
  }, [therapist?.id]);

  const pickedClient = clients.find(c => c.id === pickedClientId);
  const canSend = !!(pickedClient || manualName.trim());

  async function send() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      // Mint a hard-to-guess token (32 chars)
      const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const payload = {
        token,
        therapist_id: therapist.id,
        client_id: pickedClient?.id || null,
        client_name: pickedClient?.full_name || manualName.trim() || null,
        client_email: pickedClient?.email || manualEmail.trim() || null,
        client_phone: pickedClient?.phone || manualPhone.trim() || null,
      };
      const { error: insErr } = await supabase
        .from('agreement_send_requests')
        .insert(payload);
      if (insErr) throw insErr;

      const link = `${window.location.origin}/agreement-sign/${token}`;
      setSentLink(link);
    } catch (e) {
      console.error('[SendForSignature] failed:', e);
      setError('Could not create the signing link. Please try again, or check your network and refresh.');
    } finally {
      setSending(false);
    }
  }

  function copyLink() {
    if (!sentLink) return;
    navigator.clipboard.writeText(sentLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // SMS body and mailto body construction
  const recipient = pickedClient || { full_name: manualName, email: manualEmail, phone: manualPhone };
  const recipientFirst = (recipient.full_name || '').split(/\s+/)[0] || 'there';
  const businessName = therapist?.business_name || therapist?.full_name || 'your therapist';
  const smsBody = sentLink ? `Hi ${recipientFirst}, here's the client agreement from ${businessName} for you to read and sign: ${sentLink}` : '';
  const emailBody = sentLink ? `Hi ${recipientFirst},\n\nPlease take a few minutes to read and sign the client agreement before our next session:\n\n${sentLink}\n\nThank you,\n${businessName}` : '';
  const emailSubject = `Client agreement to sign · ${businessName}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,30,22,0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#fff',
          borderRadius: 14,
          padding: 0,
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.30)',
        }}
      >
        <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, fontFamily: 'Georgia, serif' }}>Send for signature</div>
            <div style={{ fontSize: 11.5, color: C.gray, marginTop: 2 }}>Client reads, types their name, signs. You get notified.</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.gray, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <div style={{ padding: '18px 22px 20px' }}>
          {!sentLink ? (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Pick an existing client
              </div>
              {loadingClients ? (
                <div style={{ fontSize: 13, color: C.gray, padding: '10px 0' }}>Loading clients…</div>
              ) : (
                <select
                  value={pickedClientId}
                  onChange={e => { setPickedClientId(e.target.value); if (e.target.value) { setManualName(''); setManualEmail(''); setManualPhone(''); } }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1.5px solid ${C.line}`,
                    borderRadius: 10,
                    fontSize: 14,
                    color: C.ink,
                    background: '#fff',
                    boxSizing: 'border-box',
                    marginBottom: 14,
                  }}
                >
                  <option value="">Choose a client</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}{c.practice_agreement_signed_at ? ' (already signed)' : ''}
                    </option>
                  ))}
                </select>
              )}

              <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '6px 0 8px', textAlign: 'center' }}>
                or send to a new contact
              </div>
              <input
                type="text"
                value={manualName}
                onChange={e => { setManualName(e.target.value); if (e.target.value) setPickedClientId(''); }}
                placeholder="Client name"
                style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.line}`, borderRadius: 10, fontSize: 14, color: C.ink, boxSizing: 'border-box', marginBottom: 8 }}
              />
              <input
                type="email"
                value={manualEmail}
                onChange={e => setManualEmail(e.target.value)}
                placeholder="Email (optional)"
                style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.line}`, borderRadius: 10, fontSize: 14, color: C.ink, boxSizing: 'border-box', marginBottom: 8 }}
              />
              <input
                type="tel"
                value={manualPhone}
                onChange={e => setManualPhone(e.target.value)}
                placeholder="Phone (optional)"
                style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.line}`, borderRadius: 10, fontSize: 14, color: C.ink, boxSizing: 'border-box', marginBottom: 14 }}
              />

              {error && (
                <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#991B1B', marginBottom: 12, lineHeight: 1.5 }}>
                  {error}
                </div>
              )}

              <button
                onClick={send}
                disabled={!canSend || sending}
                style={{
                  width: '100%',
                  background: canSend && !sending ? C.forest : '#D1D5DB',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: canSend && !sending ? 'pointer' : 'not-allowed',
                  boxShadow: canSend && !sending ? `0 4px 10px ${C.forest}33` : 'none',
                }}
              >
                {sending ? 'Creating link…' : 'Create signing link →'}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 8 }}>
                Signing link ready. Send it via text, email, or just copy and share however works for {recipientFirst}.
              </div>
              <div style={{
                background: '#FAF6EE',
                border: `1px solid ${C.amberLine}`,
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 12,
                color: C.ink,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                wordBreak: 'break-all',
                marginBottom: 14,
                lineHeight: 1.5,
              }}>
                {sentLink}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={copyLink} style={{ width: '100%', background: copied ? C.saved : C.forest, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                  {copied ? '✓ Copied to clipboard' : '📋 Copy link'}
                </button>
                {recipient.phone && (
                  <a
                    href={`sms:${recipient.phone.replace(/\D/g, '')}?body=${encodeURIComponent(smsBody)}`}
                    style={{ display: 'block', textAlign: 'center', background: '#fff', border: `1.5px solid ${C.line}`, color: C.ink, borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
                  >
                    💬 Open in Messages
                  </a>
                )}
                {recipient.email && (
                  <a
                    href={`mailto:${recipient.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                    style={{ display: 'block', textAlign: 'center', background: '#fff', border: `1.5px solid ${C.line}`, color: C.ink, borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
                  >
                    ✉ Open in Email
                  </a>
                )}
              </div>
              <div style={{ marginTop: 14, fontSize: 11, color: C.gray, lineHeight: 1.5, textAlign: 'center' }}>
                When {recipientFirst} signs, you'll see the signature recorded on their client profile.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function pill(C, variant) {
  if (variant === 'primary') {
    return {
      background: C.forest,
      color: '#fff',
      border: 'none',
      borderRadius: 999,
      padding: '8px 16px',
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all 0.12s',
      boxShadow: `0 2px 6px ${C.forest}33`,
    };
  }
  return {
    background: '#fff',
    border: `1px solid ${C.line}`,
    borderRadius: 999,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 700,
    color: C.ink,
    cursor: 'pointer',
    transition: 'all 0.12s',
  };
}

// ─── AgreementRenderer ────────────────────────────────────────
// Used by PracticeAgreementPrint and ClientIntake. Renders the
// agreement as styled HTML matching the editor preview, so the
// client sees the same paper-feel document the therapist edited.
// Includes the table of contents and roman-numeral section numbers.
export function AgreementRenderer({ text }) {
  if (!text) return null;
  const blocks = parseBlocks(text);
  const toc = buildToc(blocks);
  const elements = [];
  let listBuffer = [];
  let sectionCounter = 0;

  function flushList() {
    if (listBuffer.length) {
      elements.push(
        <ul key={`l-${elements.length}`} style={{
          margin: '10px 0 18px 0',
          paddingLeft: 0,
          listStyle: 'none',
        }}>
          {listBuffer.map((li, i) => (
            <li key={i} style={{
              marginBottom: 8,
              position: 'relative',
              paddingLeft: 22,
              lineHeight: 1.7,
            }}>
              <span style={{
                position: 'absolute',
                left: 6,
                top: 0,
                color: C.amber,
                fontFamily: 'Georgia, serif',
                fontSize: '1.1em',
                fontWeight: 700,
                lineHeight: 1.7,
              }}>•</span>
              {li}
            </li>
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
          fontSize: 24,
          fontWeight: 700,
          fontFamily: 'Georgia, serif',
          color: C.forest,
          margin: '0 0 18px 0',
          letterSpacing: '-0.01em',
          lineHeight: 1.25,
        }}>{b.text}</h1>
      );
      // After H1, render the TOC if there are multiple H2 sections
      if (toc.length > 1) {
        elements.push(
          <div key={`toc-${i}`} style={{
            background: C.cream,
            border: `1px solid ${C.amberPale}`,
            borderRadius: 10,
            padding: '18px 22px',
            margin: '0 0 28px 0',
            pageBreakInside: 'avoid',
          }}>
            <div style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: C.amberDeep,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              marginBottom: 12,
              fontFamily: 'system-ui, sans-serif',
            }}>
              Contents
            </div>
            <ol style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              fontFamily: 'Georgia, serif',
            }}>
              {toc.map(item => (
                <li key={item.idx} style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  padding: '4px 0',
                  fontSize: 13.5,
                  color: C.inkSoft,
                }}>
                  <span style={{
                    fontStyle: 'italic',
                    color: C.amberDeep,
                    fontSize: 12,
                    marginRight: 10,
                    minWidth: 24,
                    flexShrink: 0,
                  }}>
                    {ROMAN[item.number] || item.number}.
                  </span>
                  <span style={{ flex: 1 }}>{item.title}</span>
                </li>
              ))}
            </ol>
          </div>
        );
      }
    } else if (b.kind === 'h2') {
      flushList();
      sectionCounter += 1;
      elements.push(
        <div key={i} style={{ margin: '28px 0 10px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              color: C.amberDeep,
              fontSize: 14,
              fontWeight: 600,
              flexShrink: 0,
              minWidth: 26,
            }}>
              {ROMAN[sectionCounter] || sectionCounter}.
            </span>
            <h2 style={{
              fontSize: 16,
              fontWeight: 700,
              fontFamily: 'Georgia, serif',
              color: C.ink,
              margin: 0,
              letterSpacing: '-0.005em',
            }}>{b.text}</h2>
          </div>
          <div style={{
            height: 1,
            background: `linear-gradient(90deg, ${C.amber}66 0%, transparent 100%)`,
            marginTop: 6,
            marginLeft: 38,
          }} />
        </div>
      );
    } else if (b.kind === 'li') {
      listBuffer.push(b.text);
    } else {
      flushList();
      elements.push(
        <p key={i} style={{
          margin: '0 0 12px 0',
          lineHeight: 1.75,
          textAlign: 'justify',
          hyphens: 'auto',
        }}>
          {b.text}
        </p>
      );
    }
  });
  flushList();
  return <>{elements}</>;
}
