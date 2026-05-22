// src/components/QuickSendBlocks.jsx
//
// Top-of-Outreach-page quick-send section. Renders 5 starter
// template blocks plus any custom templates the therapist has
// created. Each block is one click to open the send modal.
//
// HK direction May 9 2026: "We need on top maybe a few blocks or
// one click ways to send an email to X clients that are
// preconfigured. When they click on this preconfigured email, it
// should be a two click process. They click on the box, a modal
// appears which already has the email, they make any final edits,
// second click is send."
//
// Implementation:
//   - Mount: ensure 5 starter templates exist for this therapist
//   - Load: fetch all templates (starter + custom, deleted_at NULL)
//   - For each template: count its audience asynchronously, gray
//     out blocks with 0 matching recipients
//   - Click handler: opens QuickSendModal with the chosen template
//   - "..." menu per block: Edit / Reset / Delete
//   - "+ New template" button creates a custom block
//   - "Restore starter templates" button if any starters were deleted

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  ensureStartersSeeded,
  getAudienceRecipients,
  AUDIENCE_LABELS,
  resetStarterToDefault,
  softDeleteTemplate,
  restoreStarters,
  STARTER_TEMPLATES,
} from '../lib/outreachQuicksend';
import QuickSendModal from './QuickSendModal';
import CustomQuickSendModal from './CustomQuickSendModal';

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280', light:'#E8E4DC', warmYellow:'#FEF3C7', warmYellowBorder:'#FCD34D' };

export default function QuickSendBlocks({ therapist }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({}); // template_id -> recipient count
  const [openMenuId, setOpenMenuId] = useState(null);
  const [modalTemplate, setModalTemplate] = useState(null);
  const [hasDeletedStarters, setHasDeletedStarters] = useState(false);
  // HK May 22 2026 Tier 1 item 3: Custom Send modal state. Opens
  // when the therapist taps the first card on the row. Two-step
  // picker + composer flow.
  const [customOpen, setCustomOpen] = useState(false);
  // Custom send flow (HK May 22 2026): therapist taps the Custom
  // card, picks any combination of clients, then writes whatever
  // they want. customPickerOpen toggles the picker; customRecipients
  // is the chosen list passed to QuickSendModal. The blank template
  // gets a sensible default subject + body the therapist edits.
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [customRecipients, setCustomRecipients] = useState(null);

  useEffect(() => {
    if (!therapist?.id) return;
    let cancelled = false;
    (async () => {
      // Lazy-seed starter templates on first visit
      await ensureStartersSeeded(therapist.id);
      // Load all active templates
      const { data } = await supabase
        .from('outreach_templates')
        .select('*')
        .eq('therapist_id', therapist.id)
        .is('deleted_at', null)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (cancelled) return;
      setTemplates(data || []);
      setLoading(false);
      // Check if any starters are soft-deleted (for restore button)
      const { count } = await supabase
        .from('outreach_templates')
        .select('*', { count: 'exact', head: true })
        .eq('therapist_id', therapist.id)
        .eq('is_starter', true)
        .not('deleted_at', 'is', null);
      if (cancelled) return;
      setHasDeletedStarters((count || 0) > 0);

      // Fetch audience counts for each template in parallel
      const countResults = await Promise.all(
        (data || []).map(async (t) => {
          const recips = await getAudienceRecipients(t.audience_preset, therapist.id);
          return [t.id, recips.length];
        })
      );
      if (cancelled) return;
      setCounts(Object.fromEntries(countResults));
    })();
    return () => { cancelled = true; };
  }, [therapist?.id]);

  async function handleResetStarter(template) {
    if (!template.is_starter) return;
    const ok = window.confirm(`Reset "${template.label}" to its original wording? Your edits will be lost.`);
    if (!ok) return;
    await resetStarterToDefault(therapist.id, template.starter_key);
    // Refresh
    const { data } = await supabase
      .from('outreach_templates')
      .select('*')
      .eq('therapist_id', therapist.id)
      .is('deleted_at', null)
      .order('display_order', { ascending: true });
    setTemplates(data || []);
    setOpenMenuId(null);
  }

  async function handleDelete(template) {
    const word = template.is_starter ? 'Hide' : 'Delete';
    const ok = window.confirm(`${word} "${template.label}"?${template.is_starter ? ' (You can restore starter templates anytime.)' : ''}`);
    if (!ok) return;
    await softDeleteTemplate(therapist.id, template.id);
    setTemplates(arr => arr.filter(t => t.id !== template.id));
    if (template.is_starter) setHasDeletedStarters(true);
    setOpenMenuId(null);
  }

  async function handleRestoreStarters() {
    await restoreStarters(therapist.id);
    const { data } = await supabase
      .from('outreach_templates')
      .select('*')
      .eq('therapist_id', therapist.id)
      .is('deleted_at', null)
      .order('display_order', { ascending: true });
    setTemplates(data || []);
    setHasDeletedStarters(false);
    // Refetch counts
    const countResults = await Promise.all(
      (data || []).map(async (t) => {
        const recips = await getAudienceRecipients(t.audience_preset, therapist.id);
        return [t.id, recips.length];
      })
    );
    setCounts(Object.fromEntries(countResults));
  }

  function handleSent() {
    // After send, just close. Counts will be stale until next mount.
    // Could re-fetch counts here if we wanted live recount.
    setModalTemplate(null);
  }

  if (loading) {
    return (
      <div style={{ padding:'14px 16px', fontSize:13, color:C.gray }}>Loading quick-send templates...</div>
    );
  }

  // Map each starter_key (or audience_preset for custom) to a soft
  // emoji icon and accent color so blocks visually differentiate.
  const ACCENTS = {
    welcome_new:        { emoji: '🌱', tint: '#F0F8F2' },
    miss_you:           { emoji: '💌', tint: '#FBF4ED' },
    ready_when_you_are: { emoji: '🍃', tint: '#F0F6F0' },
    package_balance:    { emoji: '🎁', tint: '#FAF3EE' },
    special_this_month: { emoji: '✨', tint: '#F7F3EB' },
  };

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 14 }}>
        <div>
          <div style={{
            fontFamily:'Georgia, serif',
            fontSize: 17, fontWeight: 700, color: C.dark,
            marginBottom: 3, letterSpacing: '0.01em',
          }}>
            Quick send
          </div>
          <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.5 }}>
            Two taps to a thoughtful note. Pick a moment, edit if you like, send.
          </div>
        </div>
        {hasDeletedStarters && (
          <button onClick={handleRestoreStarters} style={{
            background:'transparent', border:`1px solid ${C.light}`, borderRadius: 999,
            padding:'7px 14px', fontSize: 11, fontWeight: 600, color: C.gray, cursor:'pointer',
          }}>
            Restore starters
          </button>
        )}
      </div>

      {/* Vertical stack on mobile; two columns on wider screens.
          Wide cards breathe; the three-element row inside (icon,
          name+audience, count pill) is comfortable to scan. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 12,
      }}>
        {/* Custom card (HK May 22 2026): always first. Lets therapist
            pick any clients and write any message. Visually
            differentiated with a dashed sage border so it reads as
            'compose anything' rather than 'preset template'. */}
        <button
          onClick={() => setCustomOpen(true)}
          style={{
            position: 'relative',
            background: '#FAFAF6',
            border: `1.5px dashed ${C.sage}`,
            borderRadius: 16,
            padding: '18px 18px 16px',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'inherit',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F2F7F3'; e.currentTarget.style.borderColor = C.forest; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#FAFAF6'; e.currentTarget.style.borderColor = C.sage; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: '#fff',
              border: `1.5px solid ${C.sage}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
            }}>
              ✍️
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: C.dark, marginBottom: 2 }}>
                Custom message
              </div>
              <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.45 }}>
                Pick one or more clients and write whatever you'd like to say.
              </div>
            </div>
          </div>
        </button>

        {templates.map(t => {
          const count = counts[t.id];
          const isLoadingCount = count === undefined;
          const isEmpty = count === 0;
          const accent = ACCENTS[t.starter_key] || { emoji: '✉️', tint: '#F5F0E8' };
          return (
            <div key={t.id} style={{
              position:'relative',
              background: isEmpty ? '#FAFAF6' : '#FFFFFF',
              border: `1.5px solid ${isEmpty ? '#EAE5DA' : '#DDD4C2'}`,
              borderRadius: 16,
              padding: '18px 18px 16px',
              opacity: isEmpty ? 0.7 : 1,
              cursor: isEmpty ? 'default' : 'pointer',
              transition: 'all 0.18s ease',
              boxShadow: isEmpty ? 'none' : '0 1px 2px rgba(70, 90, 65, 0.04)',
            }}
            onClick={() => { if (!isEmpty && !isLoadingCount) setModalTemplate(t); }}
            onMouseEnter={(e) => { if (!isEmpty) { e.currentTarget.style.borderColor = C.forest; e.currentTarget.style.boxShadow = '0 6px 18px rgba(42,87,65,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = isEmpty ? '#EAE5DA' : '#DDD4C2'; e.currentTarget.style.boxShadow = isEmpty ? 'none' : '0 1px 2px rgba(70, 90, 65, 0.04)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ display:'flex', alignItems:'flex-start', gap: 14 }}>
                {/* Soft circular accent with emoji */}
                <div style={{
                  flexShrink: 0,
                  width: 44, height: 44, borderRadius: '50%',
                  background: accent.tint,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                }}>
                  {accent.emoji}
                </div>

                {/* Title + audience */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily:'Georgia, serif',
                    fontSize: 16, fontWeight: 700,
                    color: isEmpty ? '#7A7468' : '#3D4A42',
                    marginBottom: 4, lineHeight: 1.25,
                  }}>
                    {t.label}
                  </div>
                  <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.5 }}>
                    {AUDIENCE_LABELS[t.audience_preset] || t.audience_preset}
                  </div>
                  <div style={{
                    marginTop: 10,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 11px', borderRadius: 999,
                    background: isEmpty ? '#F0EDE6' : '#EDF4EC',
                    border: `1px solid ${isEmpty ? '#E0DBCD' : '#C9DCC2'}`,
                    fontSize: 11, fontWeight: 600,
                    color: isEmpty ? '#8C8676' : C.forest,
                    fontStyle: isEmpty ? 'italic' : 'normal',
                  }}>
                    {isLoadingCount
                      ? 'counting...'
                      : isEmpty
                        ? 'no one fits right now'
                        : `${count} ready`}
                  </div>
                </div>

                {/* "..." menu button */}
                <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === t.id ? null : t.id); }}
                  style={{
                    background:'transparent', border:'none',
                    color: '#9A9486', fontSize: 18, cursor:'pointer',
                    padding: '4px 6px', lineHeight: 1, flexShrink: 0,
                    borderRadius: 6,
                  }}
                  onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.background = '#F5F0E8'; }}
                  onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.background = 'transparent'; }}
                  aria-label="Template options">
                  ⋯
                </button>
              </div>

              {openMenuId === t.id && (
                <div onClick={e => e.stopPropagation()} style={{
                  position:'absolute', top: 44, right: 12, zIndex: 10,
                  background:'#FFFFFF', border:'1px solid #E0DBCD', borderRadius: 12,
                  boxShadow:'0 8px 28px rgba(70,90,65,0.15)', padding: 6,
                  minWidth: 160,
                }}>
                  <button onClick={() => { setModalTemplate(t); setOpenMenuId(null); }}
                    style={{ display:'block', width:'100%', textAlign:'left', background:'transparent', border:'none', padding:'9px 12px', fontSize:13, color:'#3D4A42', cursor:'pointer', borderRadius: 8, fontFamily:'system-ui' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F5F0E8'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    ✏️ &nbsp; Edit
                  </button>
                  {t.is_starter && (
                    <button onClick={() => handleResetStarter(t)}
                      style={{ display:'block', width:'100%', textAlign:'left', background:'transparent', border:'none', padding:'9px 12px', fontSize:13, color:'#3D4A42', cursor:'pointer', borderRadius: 8, fontFamily:'system-ui' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F5F0E8'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      🔄 &nbsp; Reset to default
                    </button>
                  )}
                  <button onClick={() => handleDelete(t)}
                    style={{ display:'block', width:'100%', textAlign:'left', background:'transparent', border:'none', padding:'9px 12px', fontSize:13, color:'#A04040', cursor:'pointer', borderRadius: 8, fontFamily:'system-ui' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8ECEC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {t.is_starter ? '🙈 \u00a0 Hide' : '🗑️ \u00a0 Delete'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modalTemplate && (
        <QuickSendModal
          template={modalTemplate}
          therapist={therapist}
          onClose={() => setModalTemplate(null)}
          onSent={handleSent}
        />
      )}

      {/* Step 1 of custom send: pick clients */}
      {customPickerOpen && (
        <CustomClientPicker
          therapist={therapist}
          onCancel={() => setCustomPickerOpen(false)}
          onPicked={(recipients) => {
            setCustomPickerOpen(false);
            setCustomRecipients(recipients);
          }}
        />
      )}

      {/* Step 2 of custom send: compose. Same QuickSendModal as the
          template path, but with a blank template the therapist
          fills in inline. recipients are pre-set, so the modal
          shows 'Will send to N clients' from the start. */}
      {customRecipients && (
        <QuickSendModal
          template={{
            id: 'custom_send',
            name: 'Custom message',
            subject: '',
            body: 'Hi {{first_name}},\n\n\n\nTake care,\n{{therapist_name}}',
            audience_preset: 'custom',
          }}
          therapist={therapist}
          recipients={customRecipients}
          onClose={() => setCustomRecipients(null)}
          onSent={() => setCustomRecipients(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CustomClientPicker (HK May 22 2026): a focused modal for the
// Custom send flow. Therapist can search by name, multi-select,
// and confirm. Returns { id, first_name, last_name, name, email,
// phone } shaped recipients the QuickSendModal expects.
//
// Design choices:
//   - Search box at top, no fuzzy matching (substring on name+email
//     is plenty for solo-practice scale)
//   - Each row has a checkbox-style tile, taps anywhere on the row
//     to toggle
//   - 'Select all matching' pill at top when search is active
//   - 'Continue with N selected' button, disabled at 0
//   - 'Cancel' returns to the quick-send blocks
//   - Honors the 70yr persona: large hit targets, plain language,
//     no jargon, no power-user shortcuts
// ─────────────────────────────────────────────────────────────────
function CustomClientPicker({ therapist, onCancel, onPicked }) {
  const [allClients, setAllClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!therapist?.id) { setLoading(false); return; }
      const { data } = await supabase
        .from('clients')
        .select('id, name, email, phone')
        .eq('therapist_id', therapist.id)
        .order('name', { ascending: true });
      if (cancelled) return;
      setAllClients(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [therapist?.id]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? allClients.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q))
    : allClients;

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAllVisible() {
    setSelected(prev => {
      const next = new Set(prev);
      filtered.forEach(c => next.add(c.id));
      return next;
    });
  }
  function clearAll() {
    setSelected(new Set());
  }

  function confirm() {
    if (selected.size === 0) return;
    const chosen = allClients
      .filter(c => selected.has(c.id))
      .map(c => {
        const parts = (c.name || '').split(/\s+/);
        return {
          id: c.id,
          first_name: parts[0] || 'there',
          last_name: parts.slice(1).join(' ') || '',
          name: c.name,
          email: c.email,
          phone: c.phone,
        };
      });
    onPicked(chosen);
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(20,30,25,0.4)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#fff',
        width: '100%',
        maxWidth: 560,
        maxHeight: '90vh',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: `1px solid ${C.light}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{
              fontFamily: 'Georgia, serif',
              fontSize: 18,
              fontWeight: 700,
              color: C.dark,
            }}>
              Pick clients
            </div>
            <button
              onClick={onCancel}
              style={{
                background: 'transparent',
                border: 'none',
                color: C.gray,
                fontSize: 22,
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div style={{ fontSize: 12.5, color: C.gray, lineHeight: 1.45, marginBottom: 12 }}>
            Tap each client you'd like to include. {selected.size > 0 && <strong style={{ color: C.forest }}>{selected.size} selected</strong>}
          </div>
          <input
            type="text"
            placeholder="Search by name or email"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 14,
              border: `1.5px solid ${C.light}`,
              borderRadius: 10,
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
          {q && filtered.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={selectAllVisible}
                style={{
                  background: '#fff',
                  border: `1px solid ${C.sage}`,
                  color: C.forest,
                  padding: '5px 12px',
                  borderRadius: 999,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Select all {filtered.length} matching
              </button>
              {selected.size > 0 && (
                <button
                  onClick={clearAll}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${C.light}`,
                    color: C.gray,
                    padding: '5px 12px',
                    borderRadius: 999,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Clear selection
                </button>
              )}
            </div>
          )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: C.gray }}>
              Loading your clients...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: C.gray }}>
              {q ? `No clients match "${query}"` : 'No clients yet. Add some from the Clients tab.'}
            </div>
          ) : (
            filtered.map(c => {
              const isSelected = selected.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '12px 20px',
                    background: isSelected ? '#F0F9F4' : 'transparent',
                    border: 'none',
                    borderBottom: `1px solid ${C.light}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                >
                  {/* Checkbox tile */}
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: `2px solid ${isSelected ? C.forest : C.light}`,
                    background: isSelected ? C.forest : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 13, fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {isSelected ? '✓' : ''}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: C.dark,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {c.name || '(no name)'}
                    </div>
                    {(c.email || c.phone) && (
                      <div style={{
                        fontSize: 11.5, color: C.gray, marginTop: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {c.email || c.phone}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: `1px solid ${C.light}`,
          display: 'flex',
          gap: 10,
          background: '#FAFAF6',
        }}>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: `1.5px solid ${C.light}`,
              color: C.gray,
              padding: '11px 18px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={selected.size === 0}
            style={{
              flex: 1,
              background: selected.size === 0 ? C.light : C.forest,
              border: 'none',
              color: '#fff',
              padding: '11px 18px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {selected.size === 0
              ? 'Pick at least one client'
              : `Continue with ${selected.size} selected →`}
          </button>
        </div>
      </div>
    </div>
  );
}
