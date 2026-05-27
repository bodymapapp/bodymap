// src/components/YearlyPlanner.jsx
//
// HK May 27 2026 round 4. Audit fixes:
// - Year navigator buttons use RoundIconButton (standardized chevron
//   pattern, no more 1990s circles).
// - Mobile row layout: block pills go on a SECOND visual line below
//   month name to avoid overflow under +Add button. The container
//   stays one logical row but the content reflows.
// - Block name visible: 'B1', 'B2'... at mobile widths if no reason
//   set; full name if reason set. Tap pill for full detail.
// - Add/Edit modal width and date inputs sized for mobile.
// - Native date pickers work but get visual styling so they look
//   like part of the form, not raw OS buttons.
// - Success toast after add/edit/delete.
// - On reason field, helpful examples shown as quick-pick chips.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { RoundIconButton } from './ChevronIcon';

const C = {
  cream: '#FBF8F1',
  creamSoft: '#F5EFE2',
  forest: '#2A5741',
  forestDeep: '#1F4030',
  sage: '#EEF3EE',
  sageBorder: '#9DBEA1',
  ink: '#1F2937',
  inkMute: '#6B7280',
  inkDim: '#9CA3AF',
  line: '#EAE5DA',
  white: '#FFFFFF',
  red: '#DC2626',
  redSoft: '#FEE2E2',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtLocalDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseLocalDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function daysBetween(fromStr, toStr) {
  return Math.round((parseLocalDate(toStr) - parseLocalDate(fromStr)) / 86400000) + 1;
}
function shortDateLabel(dateStr) {
  const d = parseLocalDate(dateStr);
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const REASON_QUICK_PICKS = [
  'Vacation', 'Family event', 'Sick day', 'Conference',
  'Personal day', 'Holiday', 'Continuing education',
];

function groupBlocksByMonth(blockedDays) {
  const fullDayBlocks = (blockedDays || [])
    .filter(b => !b.start_time && !b.end_time && (b.block_type === 'off' || b.block_type == null))
    .map(b => ({ ...b }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const groups = [];
  for (const b of fullDayBlocks) {
    const prev = groups[groups.length - 1];
    if (prev) {
      const prevTo = parseLocalDate(prev.to);
      const cur = parseLocalDate(b.date);
      const diff = Math.round((cur - prevTo) / 86400000);
      if (diff === 1 && (prev.reason || '') === (b.reason || '')) {
        prev.to = b.date;
        prev.ids.push(b.id);
        prev.dates.push(b.date);
        continue;
      }
    }
    groups.push({
      from: b.date,
      to: b.date,
      reason: b.reason || '',
      ids: [b.id],
      dates: [b.date],
    });
  }

  const byMonth = {};
  for (let i = 0; i < 12; i++) byMonth[i] = [];
  for (const g of groups) {
    const startMonth = parseLocalDate(g.from).getMonth();
    byMonth[startMonth].push(g);
  }
  return byMonth;
}

export default function YearlyPlanner({ therapist }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [blockedDays, setBlockedDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingMonth, setEditingMonth] = useState(null);
  const [editingBlock, setEditingBlock] = useState(null);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const loadData = useCallback(async () => {
    if (!therapist?.id) return;
    setLoading(true);
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const { data } = await supabase
      .from('blocked_days')
      .select('*')
      .eq('therapist_id', therapist.id)
      .gte('date', yearStart)
      .lte('date', yearEnd)
      .order('date');
    setBlockedDays(data || []);
    setLoading(false);
  }, [therapist?.id, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const byMonth = useMemo(() => groupBlocksByMonth(blockedDays), [blockedDays]);

  const totalDays = useMemo(() => {
    let total = 0;
    for (let m = 0; m < 12; m++) {
      for (const g of byMonth[m] || []) {
        total += daysBetween(g.from, g.to);
      }
    }
    return total;
  }, [byMonth]);

  async function saveBlock(monthIdx, blockData) {
    setPending(true);
    const { from, to, reason, originalIds } = blockData;

    if (originalIds && originalIds.length > 0) {
      await supabase.from('blocked_days').delete().in('id', originalIds);
    }

    const datesToInsert = [];
    for (let d = parseLocalDate(from); d <= parseLocalDate(to); d.setDate(d.getDate() + 1)) {
      datesToInsert.push({
        therapist_id: therapist.id,
        date: fmtLocalDate(d),
        block_type: 'off',
        reason: reason || null,
      });
    }
    if (datesToInsert.length > 0) {
      await supabase.from('blocked_days').insert(datesToInsert);
    }

    setEditingMonth(null);
    setEditingBlock(null);
    setPending(false);
    loadData();
    showToast(originalIds ? 'Block updated' : `Block added (${datesToInsert.length} day${datesToInsert.length === 1 ? '' : 's'})`);
  }

  async function deleteBlock(ids) {
    setPending(true);
    await supabase.from('blocked_days').delete().in('id', ids);
    setEditingMonth(null);
    setEditingBlock(null);
    setPending(false);
    loadData();
    showToast('Block removed');
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.inkMute, fontSize: 13 }}>
        Loading your year...
      </div>
    );
  }

  // ─── Add / Edit Modal ────────────────────────────────────────────

  function BlockModal() {
    const isEdit = !!editingBlock;
    const editing = isEdit ? editingBlock : null;
    const monthIdx = editingMonth;

    const defaultFrom = editing?.from || `${year}-${String((monthIdx ?? 0) + 1).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(year, (monthIdx ?? 0) + 1, 0).getDate();
    const defaultTo = editing?.to || `${year}-${String((monthIdx ?? 0) + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    const [name, setName] = useState(editing?.reason || '');
    const [from, setFrom] = useState(defaultFrom);
    const [to, setTo] = useState(defaultTo);

    const safeFrom = from && to ? (from < to ? from : to) : from;
    const safeTo = from && to ? (from < to ? to : from) : to;
    const dayCount = from && to ? daysBetween(safeFrom, safeTo) : 0;

    function handleSave() {
      if (!from || !to) return;
      saveBlock(monthIdx, {
        from: safeFrom,
        to: safeTo,
        reason: name.trim(),
        originalIds: editing?.ids || null,
      });
    }

    return (
      <>
        <div onClick={() => { setEditingMonth(null); setEditingBlock(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15, 23, 42, 0.5)' }} />
        <div style={{
          position: 'fixed', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)', zIndex: 101,
          background: C.white, borderRadius: 14, padding: 20,
          width: 'min(440px, 92vw)',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
          boxShadow: '0 12px 40px rgba(15, 23, 42, 0.25)',
        }}>
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 500,
            color: C.forestDeep, marginBottom: 6,
          }}>{isEdit ? 'Edit block' : 'Add block'}</div>
          <div style={{ fontSize: 13, color: C.inkMute, marginBottom: 16, lineHeight: 1.5 }}>
            {MONTHS[monthIdx]} {year}. Name it so you remember why. Range can span months.
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: C.inkMute, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              What is this block for?
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Spring break with family"
              style={{
                width: '100%', padding: '10px 12px', fontSize: 14,
                border: `1.5px solid ${C.line}`, borderRadius: 8,
                fontFamily: 'inherit', boxSizing: 'border-box',
                color: C.ink,
              }}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {REASON_QUICK_PICKS.map(p => {
              const isSelected = name.toLowerCase() === p.toLowerCase();
              return (
                <button key={p} type="button" onClick={() => setName(p)}
                  style={{
                    background: isSelected ? C.forest : C.creamSoft,
                    color: isSelected ? C.white : C.forestDeep,
                    border: `1px solid ${isSelected ? C.forest : C.line}`,
                    borderRadius: 999, padding: '5px 12px',
                    fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}>{p}</button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: C.inkMute, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>From</label>
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 14,
                  border: `1.5px solid ${C.line}`, borderRadius: 8,
                  fontFamily: 'inherit', boxSizing: 'border-box',
                  color: C.ink, background: C.white,
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: C.inkMute, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>To</label>
              <input
                type="date"
                value={to}
                min={from}
                onChange={e => setTo(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 14,
                  border: `1.5px solid ${C.line}`, borderRadius: 8,
                  fontFamily: 'inherit', boxSizing: 'border-box',
                  color: C.ink, background: C.white,
                }}
              />
            </div>
          </div>

          {dayCount > 0 && (
            <div style={{
              background: C.creamSoft, padding: '10px 14px', borderRadius: 8,
              marginBottom: 14, fontSize: 12.5, color: C.ink,
            }}>
              <strong>{dayCount} day{dayCount === 1 ? '' : 's'}</strong> will be blocked ({shortDateLabel(safeFrom)} to {shortDateLabel(safeTo)}).
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
            {isEdit && (
              <button
                type="button"
                onClick={() => deleteBlock(editing.ids)}
                disabled={pending}
                style={{
                  background: C.redSoft, color: C.red,
                  border: `1.5px solid ${C.red}`,
                  borderRadius: 10, padding: '11px 14px',
                  fontSize: 14, fontWeight: 500, cursor: pending ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}>Delete block</button>
            )}
            <div style={{ display: 'flex', gap: 10, flex: 1 }}>
              <button
                type="button"
                onClick={() => { setEditingMonth(null); setEditingBlock(null); }}
                style={{
                  flex: 1, background: C.white, color: C.inkMute,
                  border: `1.5px solid ${C.line}`,
                  borderRadius: 10, padding: '11px 14px',
                  fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>Cancel</button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!from || !to || pending}
                style={{
                  flex: 2,
                  background: (!from || !to || pending) ? C.line : C.forest,
                  color: C.white, border: 'none',
                  borderRadius: 10, padding: '11px 14px',
                  fontSize: 14, fontWeight: 500,
                  cursor: (!from || !to || pending) ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}>{pending ? 'Saving...' : (isEdit ? 'Save changes' : 'Add block')}</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── Toast ───────────────────────────────────────────────────────

  const Toast = toast && (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 200,
      background: toast.type === 'info' ? C.creamSoft : C.forest,
      color: toast.type === 'info' ? C.ink : C.white,
      border: toast.type === 'info' ? `1px solid ${C.line}` : 'none',
      borderRadius: 999,
      padding: '10px 18px',
      fontSize: 13, fontWeight: 500,
      boxShadow: '0 6px 20px rgba(15, 23, 42, 0.18)',
      maxWidth: 'calc(100vw - 32px)',
      textAlign: 'center',
    }}>{toast.message}</div>
  );

  // ─── Month row ───────────────────────────────────────────────────

  function MonthRow({ monthIdx }) {
    const blocks = byMonth[monthIdx] || [];
    const monthDays = blocks.reduce((sum, g) => sum + daysBetween(g.from, g.to), 0);

    // Mobile: stack pills below the month name (text doesn't overflow under +Add)
    // Desktop: single row with pills inline
    return (
      <div style={{
        background: C.cream,
        border: `1px solid ${C.line}`,
        borderRadius: 10,
        padding: isMobile ? '12px 14px' : '12px 14px',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? 10 : 12,
      }}>
        {/* Month name + days + add button on top row (mobile) or left (desktop) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMobile ? 'space-between' : 'flex-start',
          gap: 12,
          minWidth: isMobile ? 'auto' : 130,
          flexShrink: 0,
        }}>
          <div>
            <div style={{
              fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 500,
              color: C.forestDeep,
            }}>{MONTHS[monthIdx]}</div>
            <div style={{ fontSize: 11, color: C.inkMute, marginTop: 1 }}>
              {monthDays > 0 ? `${monthDays} day${monthDays === 1 ? '' : 's'} blocked` : 'No blocks'}
            </div>
          </div>
          {/* On mobile, +Add lives next to the month name on the top row */}
          {isMobile && (
            <button
              type="button"
              onClick={() => { setEditingMonth(monthIdx); setEditingBlock(null); }}
              style={{
                flexShrink: 0,
                background: C.white,
                border: `1.5px solid ${C.forest}`,
                color: C.forestDeep,
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'inherit',
              }}>+ Add</button>
          )}
        </div>

        {/* Block pills row */}
        <div style={{
          flex: 1,
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 2,
          WebkitOverflowScrolling: 'touch',
          minWidth: 0,
        }}>
          {blocks.length === 0 && (
            <span style={{ fontSize: 12, color: C.inkDim, alignSelf: 'center', fontStyle: 'italic' }}>
              No blocks yet
            </span>
          )}
          {blocks.map((g, idx) => {
            const days = daysBetween(g.from, g.to);
            const rangeLabel = g.from === g.to ? shortDateLabel(g.from)
              : `${shortDateLabel(g.from)} – ${shortDateLabel(g.to)}`;
            // Label: B1/B2 on mobile if no reason; full name if reason set
            const shortLabel = `B${idx + 1}`;
            const labelText = g.reason
              ? (isMobile ? g.reason : g.reason)
              : shortLabel;
            return (
              <button
                key={`${g.from}-${idx}`}
                type="button"
                onClick={() => { setEditingMonth(monthIdx); setEditingBlock(g); }}
                title={`${g.reason || `Block ${idx + 1}`} · ${rangeLabel} · ${days} day${days === 1 ? '' : 's'}`}
                style={{
                  flexShrink: 0,
                  background: C.sage,
                  border: `1px solid ${C.sageBorder}`,
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontSize: 12, fontWeight: 500,
                  color: C.forestDeep,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  maxWidth: isMobile ? 200 : 260,
                }}>
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>{labelText}</span>
                <span style={{ color: C.inkMute, fontWeight: 400 }}>·</span>
                <span style={{ color: C.inkMute, fontWeight: 400, whiteSpace: 'nowrap' }}>{rangeLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Desktop: +Add on the right */}
        {!isMobile && (
          <button
            type="button"
            onClick={() => { setEditingMonth(monthIdx); setEditingBlock(null); }}
            style={{
              flexShrink: 0,
              background: C.white,
              border: `1.5px solid ${C.forest}`,
              color: C.forestDeep,
              borderRadius: 999,
              padding: '7px 14px',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>+ Add block</button>
        )}
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{
        background: C.creamSoft, padding: '12px 16px', borderRadius: 10,
        marginBottom: 16, fontSize: 13, color: '#785D14', lineHeight: 1.5,
      }}>
        <strong>Plan your time off for the year in one place.</strong> Add as many blocks per month as you need: vacations, family events, conferences, recovery days. Each block creates a date range that is blocked on your booking calendar.
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
        flexWrap: 'wrap',
      }}>
        <RoundIconButton ariaLabel="Previous year" onClick={() => setYear(y => y - 1)} fontSize={20}>‹</RoundIconButton>
        <div style={{
          fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 500,
          color: C.forestDeep, minWidth: 60, textAlign: 'center',
        }}>{year}</div>
        <RoundIconButton ariaLabel="Next year" onClick={() => setYear(y => y + 1)} fontSize={20}>›</RoundIconButton>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: C.inkMute, flexShrink: 0 }}>
          <strong style={{ color: C.forestDeep }}>{totalDays}</strong> day{totalDays === 1 ? '' : 's'} blocked this year
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 12 }, (_, m) => <MonthRow key={m} monthIdx={m} />)}
      </div>

      <div style={{
        marginTop: 16, padding: '10px 14px',
        background: C.sage, border: `1px solid ${C.sageBorder}`,
        borderRadius: 10, fontSize: 12, color: C.forestDeep, lineHeight: 1.5,
      }}>
        Any block you add here also appears on your Schedule calendar. Same data, two views. Tap any block pill to edit or delete it.
      </div>

      {(editingMonth !== null) && <BlockModal />}
      {Toast}
    </div>
  );
}
