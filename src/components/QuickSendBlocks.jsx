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

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280', light:'#E8E4DC', warmYellow:'#FEF3C7', warmYellowBorder:'#FCD34D' };

export default function QuickSendBlocks({ therapist }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({}); // template_id -> recipient count
  const [openMenuId, setOpenMenuId] = useState(null);
  const [modalTemplate, setModalTemplate] = useState(null);
  const [hasDeletedStarters, setHasDeletedStarters] = useState(false);

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
    </div>
  );
}
