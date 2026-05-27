// src/components/YearlyPlanner.jsx
//
// HK May 27 2026: Settings-side power tool for planning all time off
// for the year up front. Lives at Settings 2.6 "Plan your year."
//
// Layout: 12 month rows that stay fixed height. Each row shows:
//   - Month name + total days blocked summary
//   - Block pills inline (horizontally scrolling if many)
//   - "+ Add block" button on the right
//
// Each block has a name (user-provided), date range, optional reason.
// Tapping a pill opens an edit modal. Tapping "+ Add block" opens an
// add modal pre-scoped to that month.
//
// Data source: same blocked_days table as Schedule's CalendarGrid.
// Blocks added here show up on Schedule's calendar and vice versa.
// We add an optional 'reason' to blocked_days for the block name
// (e.g. "Spring break with family"). If a row has reason set, it
// gets surfaced here as a named block. Otherwise it groups as a
// "Block 1" / "Block 2" generic name.
//
// Groups consecutive blocked_days rows into a single "block" entry
// for display. So if Mar 22-29 are all blocked individually but all
// share reason="Spring break", they render as ONE pill, not eight.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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
  const a = parseLocalDate(fromStr);
  const b = parseLocalDate(toStr);
  return Math.round((b - a) / 86400000) + 1;
}
function shortDateLabel(dateStr) {
  const d = parseLocalDate(dateStr);
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// Group consecutive blocked dates with the same reason into one block
// entry. Sorting then walking the list.
function groupBlocksByMonth(blockedDays) {
  // Only full-day blocks with block_type='off' or null
  const fullDayBlocks = (blockedDays || [])
    .filter(b => !b.start_time && !b.end_time && (b.block_type === 'off' || b.block_type == null))
    .map(b => ({ ...b }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const groups = []; // {from, to, reason, ids: [], dates: []}
  for (const b of fullDayBlocks) {
    const prev = groups[groups.length - 1];
    if (prev) {
      const prevTo = parseLocalDate(prev.to);
      const cur = parseLocalDate(b.date);
      const diff = Math.round((cur - prevTo) / 86400000);
      // Same reason AND consecutive day => extend group
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

  // Bucket by month of the START date
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
    // blockData = { from, to, reason, originalIds (optional, for edit) }
    setPending(true);
    const { from, to, reason, originalIds } = blockData;

    // For edit: delete old rows first
    if (originalIds && originalIds.length > 0) {
      await supabase.from('blocked_days').delete().in('id', originalIds);
    }

    // Insert one row per day in the range with the same reason
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
  }

  async function deleteBlock(ids) {
    setPending(true);
    await supabase.from('blocked_days').delete().in('id', ids);
    setEditingMonth(null);
    setEditingBlock(null);
    setPending(false);
    loadData();
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.inkMute, fontSize: 13 }}>
        Loading your year...
      </div>
    );
  }

  // ─── Edit / Add modal ────────────────────────────────────────────

  function BlockModal() {
    const isEdit = !!editingBlock;
    const editing = isEdit ? editingBlock : null;
    const monthIdx = editingMonth;

    // Form state
    const [name, setName] = useState(editing?.reason || '');
    const [from, setFrom] = useState(editing?.from || `${year}-${String((monthIdx ?? 0) + 1).padStart(2, '0')}-01`);
    const [to, setTo] = useState(editing?.to || `${year}-${String((monthIdx ?? 0) + 1).padStart(2, '0')}-01`);

    function handleSave() {
      if (!from || !to) return;
      const lo = from < to ? from : to;
      const hi = from < to ? to : from;
      saveBlock(monthIdx, {
        from: lo,
        to: hi,
        reason: name.trim(),
        originalIds: editing?.ids || null,
      });
    }

    return (
      <>
        <div onClick={() => { setEditingMonth(null); setEditingBlock(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15, 23, 42, 0.4)' }} />
        <div style={{
          position: 'fixed', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)', zIndex: 101,
          background: C.white, borderRadius: 14, padding: 20,
          width: 'min(440px, 92vw)',
          boxShadow: '0 12px 40px rgba(15, 23, 42, 0.25)',
        }}>
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 500,
            color: C.forestDeep, marginBottom: 6,
          }}>{isEdit ? 'Edit block' : 'Add block'} for {MONTHS[monthIdx]} {year}</div>
          <div style={{ fontSize: 13, color: C.inkMute, marginBottom: 16, lineHeight: 1.5 }}>
            Name it so you remember why later. Date range can span months.
          </div>

          <div style={{ marginBottom: 12 }}>
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
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
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
                }}
              />
            </div>
          </div>

          {from && to && (
            <div style={{
              background: C.creamSoft, padding: '10px 14px', borderRadius: 8,
              marginBottom: 14, fontSize: 12, color: C.ink,
            }}>
              <strong>{daysBetween(from < to ? from : to, from < to ? to : from)} day{daysBetween(from < to ? from : to, from < to ? to : from) === 1 ? '' : 's'}</strong> will be blocked.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
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
                }}>Delete</button>
            )}
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
      </>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Header: description + year navigator + total */}
      <div style={{
        background: C.creamSoft, padding: '12px 16px', borderRadius: 10,
        marginBottom: 16, fontSize: 13, color: '#785D14', lineHeight: 1.5,
      }}>
        <strong>Plan your time off for the year in one place.</strong> Add as many blocks per month as you need: vacations, family events, conferences, recovery days. Each block creates a date range that is blocked on your booking calendar.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setYear(y => y - 1)}
          style={{
            background: C.white, border: `1.5px solid ${C.line}`,
            borderRadius: '50%', width: 32, height: 32, padding: 0,
            cursor: 'pointer', color: C.forestDeep, fontWeight: 500,
          }}>‹</button>
        <div style={{
          fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 500,
          color: C.forestDeep, minWidth: 60, textAlign: 'center',
        }}>{year}</div>
        <button
          type="button"
          onClick={() => setYear(y => y + 1)}
          style={{
            background: C.white, border: `1.5px solid ${C.line}`,
            borderRadius: '50%', width: 32, height: 32, padding: 0,
            cursor: 'pointer', color: C.forestDeep, fontWeight: 500,
          }}>›</button>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: C.inkMute }}>
          <strong style={{ color: C.forestDeep }}>{totalDays}</strong> day{totalDays === 1 ? '' : 's'} blocked this year
        </div>
      </div>

      {/* 12 month rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 12 }, (_, m) => {
          const blocks = byMonth[m] || [];
          const monthDays = blocks.reduce((sum, g) => sum + daysBetween(g.from, g.to), 0);

          return (
            <div key={m} style={{
              background: C.cream,
              border: `1px solid ${C.line}`,
              borderRadius: 10,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              minHeight: 56,
            }}>
              {/* Month name + summary, fixed width on left */}
              <div style={{ minWidth: 110, flexShrink: 0 }}>
                <div style={{
                  fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 500,
                  color: C.forestDeep,
                }}>{MONTHS[m]}</div>
                <div style={{ fontSize: 11, color: C.inkMute, marginTop: 1 }}>
                  {monthDays > 0 ? `${monthDays} day${monthDays === 1 ? '' : 's'} blocked` : 'No blocks'}
                </div>
              </div>

              {/* Block pills, scroll horizontally if too many */}
              <div style={{
                flex: 1,
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                paddingBottom: 2,
                WebkitOverflowScrolling: 'touch',
              }}>
                {blocks.length === 0 && (
                  <span style={{ fontSize: 12, color: C.inkDim, alignSelf: 'center', fontStyle: 'italic' }}>
                    No blocks yet
                  </span>
                )}
                {blocks.map((g, idx) => {
                  const days = daysBetween(g.from, g.to);
                  const rangeLabel = g.from === g.to ? shortDateLabel(g.from)
                    : `${shortDateLabel(g.from)} to ${shortDateLabel(g.to)}`;
                  const blockName = g.reason || `Block ${idx + 1}`;
                  return (
                    <button
                      key={`${g.from}-${idx}`}
                      type="button"
                      onClick={() => { setEditingMonth(m); setEditingBlock(g); }}
                      style={{
                        flexShrink: 0,
                        background: C.sage,
                        border: `1px solid ${C.sageBorder}`,
                        borderRadius: 999,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 500,
                        color: C.forestDeep,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        maxWidth: 240,
                      }}
                      title={`${blockName} (${rangeLabel}, ${days} day${days === 1 ? '' : 's'})`}>
                      <span style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>{blockName}</span>
                      <span style={{ color: C.inkMute, fontWeight: 400 }}>·</span>
                      <span style={{ color: C.inkMute, fontWeight: 400, whiteSpace: 'nowrap' }}>{rangeLabel}</span>
                    </button>
                  );
                })}
              </div>

              {/* Add block button on the right */}
              <button
                type="button"
                onClick={() => { setEditingMonth(m); setEditingBlock(null); }}
                style={{
                  flexShrink: 0,
                  background: C.white,
                  border: `1.5px solid ${C.forest}`,
                  color: C.forestDeep,
                  borderRadius: 999,
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}>+ Add block</button>
            </div>
          );
        })}
      </div>

      {/* Info footer */}
      <div style={{
        marginTop: 16, padding: '10px 14px',
        background: C.sage, border: `1px solid ${C.sageBorder}`,
        borderRadius: 10, fontSize: 12, color: C.forestDeep, lineHeight: 1.5,
      }}>
        Any block you add here also appears on your Schedule calendar. Same data, two views. Tap any block pill to edit or delete it.
      </div>

      {(editingMonth !== null) && <BlockModal />}
    </div>
  );
}
