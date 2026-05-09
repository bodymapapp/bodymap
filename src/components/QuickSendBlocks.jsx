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

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom: 2 }}>Quick send</div>
          <div style={{ fontSize:12, color:C.gray }}>Tap a block to open, edit, and send. Two clicks.</div>
        </div>
        {hasDeletedStarters && (
          <button onClick={handleRestoreStarters} style={{
            background:'transparent', border:`1px solid ${C.light}`, borderRadius:8,
            padding:'6px 10px', fontSize:11, fontWeight:600, color:C.gray, cursor:'pointer',
          }}>
            Restore starters
          </button>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {templates.map(t => {
          const count = counts[t.id];
          const isLoadingCount = count === undefined;
          const isEmpty = count === 0;
          return (
            <div key={t.id} style={{
              position:'relative',
              background: isEmpty ? '#F9FAFB' : C.white,
              border: `1.5px solid ${isEmpty ? C.light : C.light}`,
              borderRadius: 12,
              padding: '14px 14px 12px',
              opacity: isEmpty ? 0.55 : 1,
              cursor: isEmpty ? 'default' : 'pointer',
              transition: 'all 0.15s',
            }}
            onClick={() => { if (!isEmpty && !isLoadingCount) setModalTemplate(t); }}
            onMouseEnter={(e) => { if (!isEmpty) { e.currentTarget.style.borderColor = C.forest; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.light; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {t.label}
                  </div>
                  <div style={{ fontSize:11, color:C.gray, lineHeight:1.4 }}>
                    {AUDIENCE_LABELS[t.audience_preset] || t.audience_preset}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === t.id ? null : t.id); }}
                  style={{ background:'transparent', border:'none', color:C.gray, fontSize:18, cursor:'pointer', padding:'0 4px', lineHeight:1, flexShrink:0 }}
                  aria-label="Template options">
                  ⋯
                </button>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: isEmpty ? C.gray : C.forest }}>
                {isLoadingCount ? '...' : isEmpty ? '0 matching clients' : `${count} matching client${count === 1 ? '' : 's'}`}
              </div>

              {openMenuId === t.id && (
                <div onClick={e => e.stopPropagation()} style={{
                  position:'absolute', top:36, right:8, zIndex:10,
                  background:C.white, border:`1px solid ${C.light}`, borderRadius:10,
                  boxShadow:'0 4px 16px rgba(0,0,0,0.12)', padding:'6px',
                  minWidth: 140,
                }}>
                  <button onClick={() => { setModalTemplate(t); setOpenMenuId(null); }}
                    style={{ display:'block', width:'100%', textAlign:'left', background:'transparent', border:'none', padding:'8px 10px', fontSize:13, color:C.dark, cursor:'pointer', borderRadius:6 }}
                    onMouseEnter={e => e.currentTarget.style.background = C.beige}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    Edit
                  </button>
                  {t.is_starter && (
                    <button onClick={() => handleResetStarter(t)}
                      style={{ display:'block', width:'100%', textAlign:'left', background:'transparent', border:'none', padding:'8px 10px', fontSize:13, color:C.dark, cursor:'pointer', borderRadius:6 }}
                      onMouseEnter={e => e.currentTarget.style.background = C.beige}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      Reset to default
                    </button>
                  )}
                  <button onClick={() => handleDelete(t)}
                    style={{ display:'block', width:'100%', textAlign:'left', background:'transparent', border:'none', padding:'8px 10px', fontSize:13, color:'#B91C1C', cursor:'pointer', borderRadius:6 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {t.is_starter ? 'Hide' : 'Delete'}
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
