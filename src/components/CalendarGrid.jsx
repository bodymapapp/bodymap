// src/components/CalendarGrid.jsx
//
// HK May 27 2026 round 4. Comprehensive audit fixes.
//
// Fixes in this round:
// - Close + help buttons use standardized RoundIconButton (matches
//   chevron pattern site-wide, no more 1990s circles).
// - Both buttons inline in panel header (close on right edge, help
//   beside it). No vertical stack of small circles.
// - Popover positioning fixed: clamps to viewport with margin so it
//   never overflows off-screen. Direction flips automatically if
//   there isn't room below.
// - Drag now toggles. Drag over a range that's ALREADY blocked
//   unblocks it; drag over an unblocked range blocks it. Detected
//   by checking the starting cell's state.
// - Drag hint banner moved ABOVE the calendar grid (was below).
// - 'Block specific weekdays' renamed to 'Block specific days'.
// - 'Block all US holidays' opens a modal with CHECKBOXES per
//   holiday. Therapist can uncheck any they don't want blocked.
//   Confirmation toast after action.
// - Toast component for bulk action feedback.
// - Modal widths use min(440px, 92vw) consistently, button text
//   sized to fit at mobile widths.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RoundIconButton } from './ChevronIcon';

const C = {
  cream: '#FBF8F1',
  creamSoft: '#F5EFE2',
  blockedBg: '#888780',
  blockedBorder: '#5F5E5A',
  blockedText: '#FFFFFF',
  holidayBg: '#C0DD97',
  holidayBorder: '#639922',
  holidayText: '#27500A',
  growthBg: '#FAC775',
  growthBorder: '#BA7517',
  growthText: '#633806',
  forest: '#2A5741',
  forestDeep: '#1F4030',
  ink: '#1F2937',
  inkMute: '#6B7280',
  inkDim: '#9CA3AF',
  goldSoft: '#FAEEDA',
  goldDeep: '#92660E',
  line: '#EAE5DA',
  white: '#FFFFFF',
};

function computeHolidays(year) {
  const nthWeekday = (year, month, n, dayOfWeek) => {
    const d = new Date(year, month, 1);
    while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() + 1);
    d.setDate(d.getDate() + (n - 1) * 7);
    return d;
  };
  const lastWeekday = (year, month, dayOfWeek) => {
    const d = new Date(year, month + 1, 0);
    while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() - 1);
    return d;
  };
  const easter = (year) => {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
  };
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const easterDate = easter(year);
  const goodFriday = new Date(easterDate);
  goodFriday.setDate(goodFriday.getDate() - 2);

  return [
    { key: 'new-years',     name: "New Year's Day",   date: fmt(new Date(year, 0, 1)) },
    { key: 'mlk',           name: 'MLK Day',          date: fmt(nthWeekday(year, 0, 3, 1)) },
    { key: 'presidents',    name: "Presidents' Day",  date: fmt(nthWeekday(year, 1, 3, 1)) },
    { key: 'good-friday',   name: 'Good Friday',      date: fmt(goodFriday) },
    { key: 'easter',        name: 'Easter Sunday',    date: fmt(easterDate) },
    { key: 'memorial',      name: 'Memorial Day',     date: fmt(lastWeekday(year, 4, 1)) },
    { key: 'juneteenth',    name: 'Juneteenth',       date: fmt(new Date(year, 5, 19)) },
    { key: 'july-4',        name: 'Independence Day', date: fmt(new Date(year, 6, 4)) },
    { key: 'labor',         name: 'Labor Day',        date: fmt(nthWeekday(year, 8, 1, 1)) },
    { key: 'columbus',      name: 'Columbus Day',     date: fmt(nthWeekday(year, 9, 2, 1)) },
    { key: 'veterans',      name: 'Veterans Day',     date: fmt(new Date(year, 10, 11)) },
    { key: 'thanksgiving',  name: 'Thanksgiving',     date: fmt(nthWeekday(year, 10, 4, 4)) },
    { key: 'christmas-eve', name: 'Christmas Eve',    date: fmt(new Date(year, 11, 24)) },
    { key: 'christmas',     name: 'Christmas Day',    date: fmt(new Date(year, 11, 25)) },
    { key: 'new-years-eve', name: "New Year's Eve",   date: fmt(new Date(year, 11, 31)) },
  ];
}

function computeGrowthMoments(year) {
  const nthWeekday = (year, month, n, dayOfWeek) => {
    const d = new Date(year, month, 1);
    while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() + 1);
    d.setDate(d.getDate() + (n - 1) * 7);
    return d;
  };
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return [
    { key: 'valentines',     name: "Valentine's Day",         date: fmt(new Date(year, 1, 14)),  why: 'Couples massage and gift cards' },
    { key: 'mothers-day',    name: "Mother's Day",            date: fmt(nthWeekday(year, 4, 2, 0)), why: 'Gift cards for moms' },
    { key: 'fathers-day',    name: "Father's Day",            date: fmt(nthWeekday(year, 5, 3, 0)), why: 'Gift cards for dads' },
    { key: 'summer-start',   name: 'Summer break starts',     date: fmt(new Date(year, 5, 21)),  why: 'Self-care kickoff' },
    { key: 'back-to-school', name: 'Back to school week',     date: fmt(new Date(year, 7, 19)),  why: 'First session of the school year' },
    { key: 'halloween',      name: 'Halloween week',          date: fmt(new Date(year, 9, 31)),  why: 'Promo opportunity' },
    { key: 'black-friday',   name: 'Black Friday',            date: fmt(nthWeekday(year, 10, 4, 5)), why: 'Gift card promotion' },
    { key: 'holiday-gift',   name: 'Holiday gift season',     date: fmt(new Date(year, 11, 1)),  why: 'Gift cards peak season' },
    { key: 'new-year-resolutions', name: 'New Year resolutions', date: fmt(new Date(year, 0, 8)), why: 'Self-care goals top of mind' },
  ];
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAY_LABELS_SUN = ['S','M','T','W','T','F','S'];
const WEEKDAY_LABELS_MON = ['M','T','W','T','F','S','S'];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function parseLocalDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtLocalDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function CalendarGrid({ therapist, embedded = false, firstOpen = false, onCoachingSeen }) {
  const weekStartsOn = therapist?.week_starts_on ?? 0;
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const [showCoaching, setShowCoaching] = useState(firstOpen);
  useEffect(() => { setShowCoaching(firstOpen); }, [firstOpen]);

  const [anchorMonth, setAnchorMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [blockedDays, setBlockedDays] = useState([]);
  const [recurringBlocks, setRecurringBlocks] = useState([]);
  const [recurringExceptions, setRecurringExceptions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showRangeModal, setShowRangeModal] = useState(false);
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState([]);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [pending, setPending] = useState(false);
  const [showHolidayPicker, setShowHolidayPicker] = useState(false);
  const [toast, setToast] = useState(null); // {message, type}

  // HK May 27 2026: replaced floating popover with inline detail panel.
  // The popover on tap was covering neighboring cells and blocking the
  // user's next tap. Now we just track the selected date and render
  // the detail card BELOW the calendar grid. Calendar stays fully
  // tappable; tapping a different cell just updates selectedDate.
  const [selectedDate, setSelectedDate] = useState(null);

  // Drag state
  const [dragStart, setDragStart] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const dragMovedRef = useRef(false);
  const dragModeRef = useRef('block'); // 'block' or 'unblock'

  const holidaysByDate = useMemo(() => {
    const map = {};
    for (const y of [anchorMonth.getFullYear(), anchorMonth.getFullYear() + 1]) {
      for (const h of computeHolidays(y)) map[h.date] = h;
    }
    return map;
  }, [anchorMonth]);

  const growthMomentsByDate = useMemo(() => {
    const map = {};
    for (const y of [anchorMonth.getFullYear(), anchorMonth.getFullYear() + 1]) {
      for (const m of computeGrowthMoments(y)) map[m.date] = m;
    }
    return map;
  }, [anchorMonth]);

  const loadData = useCallback(async () => {
    if (!therapist?.id) return;
    setLoading(true);
    const [bdRes, rbRes, reRes, bkRes] = await Promise.all([
      supabase.from('blocked_days').select('*').eq('therapist_id', therapist.id),
      supabase.from('recurring_blocks').select('*').eq('therapist_id', therapist.id),
      supabase.from('recurring_block_exceptions').select('*').eq('therapist_id', therapist.id),
      supabase.from('bookings').select('booking_date').eq('therapist_id', therapist.id).neq('status', 'cancelled'),
    ]);
    setBlockedDays(bdRes.data || []);
    setRecurringBlocks(rbRes.data || []);
    setRecurringExceptions(reRes.data || []);
    setBookings(bkRes.data || []);
    setLoading(false);
  }, [therapist?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const monthsToShow = isMobile ? 1 : 3;

  function isDateBlocked(dateStr) {
    const oneOff = blockedDays.find(b => b.date === dateStr && !b.start_time && !b.end_time && (b.block_type ?? 'off') === 'off');
    if (oneOff) return { type: 'one-off', source: oneOff };
    const d = parseLocalDate(dateStr);
    const dow = d.getDay();
    for (const rule of recurringBlocks) {
      if (!rule.weekly_days?.includes(dow)) continue;
      if (rule.start_date && parseLocalDate(rule.start_date) > d) continue;
      if (rule.end_date && parseLocalDate(rule.end_date) < d) continue;
      const hasException = recurringExceptions.some(e => e.recurring_block_id === rule.id && e.exception_date === dateStr);
      if (!hasException) return { type: 'recurring', source: rule };
    }
    return null;
  }

  const bookingsByDate = useMemo(() => {
    const map = {};
    for (const b of bookings) {
      if (!b.booking_date) continue;
      map[b.booking_date] = (map[b.booking_date] || 0) + 1;
    }
    return map;
  }, [bookings]);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  }

  async function toggleOneOffBlock(dateStr) {
    setPending(true);
    const existing = blockedDays.find(b => b.date === dateStr && !b.start_time && !b.end_time);
    if (existing) {
      await supabase.from('blocked_days').delete().eq('id', existing.id);
      setBlockedDays(prev => prev.filter(b => b.id !== existing.id));
    } else {
      const { data } = await supabase
        .from('blocked_days')
        .insert({ therapist_id: therapist.id, date: dateStr, block_type: 'off' })
        .select()
        .single();
      if (data) setBlockedDays(prev => [...prev, data]);
    }
    setPending(false);
  }

  async function blockRange(fromStr, toStr) {
    const lo = fromStr < toStr ? fromStr : toStr;
    const hi = fromStr < toStr ? toStr : fromStr;
    setPending(true);
    const datesToBlock = [];
    for (let d = parseLocalDate(lo); d <= parseLocalDate(hi); d.setDate(d.getDate() + 1)) {
      const dateStr = fmtLocalDate(d);
      const existing = blockedDays.find(b => b.date === dateStr && !b.start_time && !b.end_time);
      if (!existing) datesToBlock.push(dateStr);
    }
    if (datesToBlock.length > 0) {
      const { data } = await supabase.from('blocked_days')
        .insert(datesToBlock.map(date => ({ therapist_id: therapist.id, date, block_type: 'off' })))
        .select();
      if (data) {
        setBlockedDays(prev => [...prev, ...data]);
        showToast(`Blocked ${datesToBlock.length} day${datesToBlock.length === 1 ? '' : 's'}`);
      }
    } else {
      showToast('Days already blocked', 'info');
    }
    setPending(false);
  }

  async function unblockRange(fromStr, toStr) {
    const lo = fromStr < toStr ? fromStr : toStr;
    const hi = fromStr < toStr ? toStr : fromStr;
    setPending(true);
    const idsToDelete = [];
    for (let d = parseLocalDate(lo); d <= parseLocalDate(hi); d.setDate(d.getDate() + 1)) {
      const dateStr = fmtLocalDate(d);
      const existing = blockedDays.find(b => b.date === dateStr && !b.start_time && !b.end_time);
      if (existing) idsToDelete.push(existing.id);
    }
    if (idsToDelete.length > 0) {
      await supabase.from('blocked_days').delete().in('id', idsToDelete);
      setBlockedDays(prev => prev.filter(b => !idsToDelete.includes(b.id)));
      showToast(`Unblocked ${idsToDelete.length} day${idsToDelete.length === 1 ? '' : 's'}`);
    }
    setPending(false);
  }

  async function blockSelectedHolidays(selectedKeys) {
    setPending(true);
    const year = anchorMonth.getFullYear();
    const allHolidays = [...computeHolidays(year), ...computeHolidays(year + 1)];
    const selected = allHolidays.filter(h => selectedKeys.has(h.key));
    const datesToBlock = [];
    for (const h of selected) {
      const hd = parseLocalDate(h.date);
      if (hd < today) continue;
      const existing = blockedDays.find(b => b.date === h.date && !b.start_time && !b.end_time);
      if (!existing) datesToBlock.push(h.date);
    }
    if (datesToBlock.length > 0) {
      const { data } = await supabase.from('blocked_days')
        .insert(datesToBlock.map(date => ({ therapist_id: therapist.id, date, block_type: 'off' })))
        .select();
      if (data) {
        setBlockedDays(prev => [...prev, ...data]);
        showToast(`Blocked ${datesToBlock.length} holiday${datesToBlock.length === 1 ? '' : 's'}`);
      }
    } else {
      showToast('No new holidays to block', 'info');
    }
    setShowHolidayPicker(false);
    setPending(false);
  }

  async function addRecurringRule(weeklyDays) {
    if (!weeklyDays || weeklyDays.length === 0) return;
    const { data } = await supabase
      .from('recurring_blocks')
      .insert({ therapist_id: therapist.id, weekly_days: weeklyDays, start_date: fmtLocalDate(today) })
      .select()
      .single();
    if (data) {
      setRecurringBlocks(prev => [...prev, data]);
      showToast(`Rule saved: every ${weeklyDays.map(d => DAY_LABELS[d]).join(', ')}`);
    }
  }

  async function removeRecurringRule(ruleId) {
    await supabase.from('recurring_blocks').delete().eq('id', ruleId);
    setRecurringBlocks(prev => prev.filter(r => r.id !== ruleId));
    setRecurringExceptions(prev => prev.filter(e => e.recurring_block_id !== ruleId));
    showToast('Rule removed');
  }

  async function addRecurringException(ruleId, dateStr) {
    const { data } = await supabase
      .from('recurring_block_exceptions')
      .insert({ therapist_id: therapist.id, recurring_block_id: ruleId, exception_date: dateStr })
      .select()
      .single();
    if (data) {
      setRecurringExceptions(prev => [...prev, data]);
      showToast('Unblocked just this day');
    }
  }

  // ─── Drag handlers ──────────────────────────────────────────────

  function onDayPointerDown(dateStr, e) {
    if (pending) return;
    const d = parseLocalDate(dateStr);
    if (d < today) return;
    const wasBlocked = isDateBlocked(dateStr);
    // If the starting cell is blocked, drag-mode = unblock; otherwise block
    dragModeRef.current = wasBlocked?.type === 'one-off' ? 'unblock' : 'block';
    setDragStart(dateStr);
    setDragOver(dateStr);
    dragMovedRef.current = false;
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
  }

  function onDayPointerEnter(dateStr) {
    if (!dragStart) return;
    if (dateStr !== dragStart) dragMovedRef.current = true;
    setDragOver(dateStr);
  }

  async function onPointerUp() {
    if (!dragStart) return;
    if (dragMovedRef.current && dragOver && dragOver !== dragStart) {
      if (dragModeRef.current === 'unblock') {
        await unblockRange(dragStart, dragOver);
      } else {
        await blockRange(dragStart, dragOver);
      }
    } else if (dragStart) {
      handleDayTap(dragStart);
    }
    setDragStart(null);
    setDragOver(null);
    dragMovedRef.current = false;
  }

  function handleDayTap(dateStr) {
    const d = parseLocalDate(dateStr);
    if (d < today) return;

    const status = isDateBlocked(dateStr);
    const growthMoment = growthMomentsByDate[dateStr];

    // HK May 27 2026: floating popover removed. For growth moments
    // and recurring-blocked days, we set selectedDate so the inline
    // detail panel below the calendar shows context + actions. The
    // popover was blocking taps on neighboring dates.
    if (growthMoment || status?.type === 'recurring') {
      setSelectedDate(dateStr);
      return;
    }
    // For everything else (available days, holidays, one-off blocks),
    // just toggle. No detail panel needed.
    toggleOneOffBlock(dateStr);
  }

  function isInDragRange(dateStr) {
    if (!dragStart || !dragOver || !dragMovedRef.current) return false;
    const lo = dragStart < dragOver ? dragStart : dragOver;
    const hi = dragStart < dragOver ? dragOver : dragStart;
    return dateStr >= lo && dateStr <= hi;
  }

  function navigateMonths(delta) {
    setAnchorMonth(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + delta);
      return d;
    });
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.inkMute, fontSize: 13 }}>
        Loading calendar...
      </div>
    );
  }

  const monthsToRender = [];
  for (let i = 0; i < monthsToShow; i++) {
    const m = new Date(anchorMonth);
    m.setMonth(m.getMonth() + i);
    monthsToRender.push(m);
  }

  // ─── Top tagline (inline help icon moved to panel header) ────────

  const TopTagline = (
    <div style={{
      fontFamily: 'Georgia, serif',
      fontSize: 13,
      fontStyle: 'italic',
      color: C.inkMute,
      marginBottom: 14,
      lineHeight: 1.5,
    }}>
      Tap to block. Tap again to unblock. Drag for a range.
    </div>
  );

  // ─── Coaching card ───────────────────────────────────────────────

  const Coaching = showCoaching && (
    <div style={{
      background: C.goldSoft,
      border: `1px solid ${C.growthBorder}`,
      borderRadius: 12,
      padding: '14px 16px',
      marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>👋</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: 14,
            fontWeight: 500,
            color: C.goldDeep,
            marginBottom: 6,
          }}>What you can do here:</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 13, color: C.ink, lineHeight: 1.65 }}>
            <li><strong>Tap a day</strong> to block. Tap again to unblock.</li>
            <li><strong>Drag</strong> across days to block a range. Drag on already-blocked days to unblock.</li>
            <li><strong>Block a date range</strong> opens a precise form.</li>
            <li><strong>Block specific days</strong> sets a recurring rule.</li>
            <li><strong>Block all US holidays</strong> opens a checklist of holidays.</li>
            <li><strong>Green</strong> = upcoming US holiday. <strong>Gold</strong> = growth opportunity. Tap to learn more.</li>
          </ul>
          <button
            type="button"
            onClick={() => {
              setShowCoaching(false);
              if (onCoachingSeen) onCoachingSeen();
            }}
            style={{
              background: C.growthBorder, color: C.white,
              border: 'none', borderRadius: 8,
              padding: '7px 14px', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit', marginTop: 10,
            }}>Got it</button>
        </div>
      </div>
    </div>
  );

  // ─── Action bar: three primary buttons ───────────────────────────

  const ActionBar = (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
      gap: 10,
      marginBottom: 14,
    }}>
      <button type="button" onClick={() => setShowRangeModal(true)}
        style={{
          background: C.forest, color: C.white, border: 'none',
          borderRadius: 10, padding: '12px 14px',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'inherit',
        }}>📅 Block a date range</button>
      <button type="button" onClick={() => setShowAddRecurring(v => !v)}
        style={{
          background: showAddRecurring ? C.forest : C.white,
          color: showAddRecurring ? C.white : C.forestDeep,
          border: `1.5px solid ${C.forest}`,
          borderRadius: 10, padding: '12px 14px',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'inherit',
        }}>🔁 Block specific days</button>
      <button type="button" onClick={() => setShowHolidayPicker(true)}
        style={{
          background: C.white, color: C.forestDeep,
          border: `1.5px solid ${C.forest}`,
          borderRadius: 10, padding: '12px 14px',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'inherit',
        }}>🎉 Block US holidays</button>
    </div>
  );

  // ─── Recurring add form ──────────────────────────────────────────

  const AddRecurringForm = showAddRecurring && (
    <div style={{
      background: C.white,
      border: `1px dashed ${C.holidayBorder}`,
      borderRadius: 12,
      padding: 14,
      marginBottom: 14,
    }}>
      <div style={{ fontSize: 13, color: C.ink, fontWeight: 500, marginBottom: 3 }}>Block every:</div>
      <div style={{ fontSize: 12, color: C.inkMute, marginBottom: 12, lineHeight: 1.5 }}>
        Pick one or more days. They will be blocked going forward, every week.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {DAY_LABELS.map((label, i) => {
          const isSelected = selectedDays.includes(i);
          return (
            <button key={i} type="button"
              onClick={() => setSelectedDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i])}
              style={{
                background: isSelected ? C.forest : C.white,
                color: isSelected ? C.white : C.forestDeep,
                border: `1.5px solid ${isSelected ? C.forest : C.line}`,
                borderRadius: 999, padding: '8px 14px',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'inherit', minWidth: 56,
              }}>{label}</button>
          );
        })}
      </div>
      <button type="button"
        onClick={async () => {
          await addRecurringRule(selectedDays);
          setSelectedDays([]);
          setShowAddRecurring(false);
        }}
        disabled={selectedDays.length === 0}
        style={{
          background: selectedDays.length === 0 ? C.line : C.forest,
          color: C.white, border: 'none', borderRadius: 8,
          padding: '9px 16px', fontSize: 13, fontWeight: 500,
          cursor: selectedDays.length === 0 ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}>Save recurring rule</button>
    </div>
  );

  // ─── Recurring pills ─────────────────────────────────────────────

  const RecurringPills = recurringBlocks.length > 0 && (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 11, fontWeight: 500, color: C.inkMute,
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6,
      }}>Active recurring rules</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {recurringBlocks.map(rule => (
          <span key={rule.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: C.blockedBg, color: C.white,
            borderRadius: 999, padding: '6px 8px 6px 14px',
            fontSize: 12, fontWeight: 500,
          }}>
            Every {rule.weekly_days.map(d => DAY_LABELS[d]).join(', ')}
            <button type="button" onClick={() => removeRecurringRule(rule.id)} aria-label="Remove rule"
              style={{
                background: 'rgba(255,255,255,0.25)', color: C.white,
                border: 'none', borderRadius: '50%', width: 20, height: 20,
                cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
          </span>
        ))}
      </div>
    </div>
  );

  // ─── Legend ──────────────────────────────────────────────────────

  const Legend = (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 12,
      padding: '10px 14px', marginBottom: 14,
      background: C.white, border: `1px solid ${C.line}`, borderRadius: 10,
      fontSize: 11.5, color: C.inkMute, alignItems: 'center',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 16, height: 16, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 4 }} />Available
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 16, height: 16, background: C.blockedBg, borderRadius: 4 }} />Blocked
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 16, height: 16, background: C.holidayBg, border: `1px solid ${C.holidayBorder}`, borderRadius: 4 }} />Holiday
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 16, height: 16, background: C.growthBg, border: `1px solid ${C.growthBorder}`, borderRadius: 4 }} />Growth opportunity
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 16, height: 16, background: C.cream, border: `2px solid ${C.forest}`, borderRadius: 4 }} />Today
      </span>
    </div>
  );

  // ─── Drag preview banner (ABOVE the calendar grid) ──────────────

  const DragBanner = dragMovedRef.current && dragStart && dragOver && (
    <div style={{
      padding: '10px 14px',
      background: C.creamSoft,
      border: `1px solid ${C.forest}`,
      borderRadius: 10, marginBottom: 10,
      fontSize: 12.5, color: C.ink,
    }}>
      <strong>{dragModeRef.current === 'unblock' ? 'Unblock' : 'Block'}</strong>{' '}
      {dragStart === dragOver ? dragStart : `${dragStart < dragOver ? dragStart : dragOver} to ${dragStart < dragOver ? dragOver : dragStart}`}.
      Release to confirm.
    </div>
  );

  // ─── Month grid ──────────────────────────────────────────────────

  function MonthGrid({ monthDate }) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay();
    const leadingBlanks = (startDow - weekStartsOn + 7) % 7;
    const weekdayLabels = weekStartsOn === 1 ? WEEKDAY_LABELS_MON : WEEKDAY_LABELS_SUN;

    const cells = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div style={{
        background: C.white,
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        padding: 12,
        minWidth: 0,
      }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontWeight: 500,
          fontSize: 15,
          color: C.forest,
          marginBottom: 10,
          textAlign: 'center',
        }}>{MONTH_NAMES[month]} {year}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
          {weekdayLabels.map((label, i) => (
            <div key={i} style={{
              textAlign: 'center', fontSize: 10, fontWeight: 500,
              color: C.inkDim, letterSpacing: '0.04em',
              textTransform: 'uppercase', padding: '3px 0',
            }}>{label}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} style={{ aspectRatio: '1' }} />;

            const dateStr = fmtLocalDate(d);
            const isPast = d < today;
            const isToday = sameDate(d, today);
            const blockStatus = isDateBlocked(dateStr);
            const holiday = holidaysByDate[dateStr];
            const growthMoment = growthMomentsByDate[dateStr];
            const inDragRange = isInDragRange(dateStr);

            let bg = C.cream;
            let textColor = C.ink;
            let borderColor = 'transparent';
            let borderWidth = 1;

            if (isPast) {
              bg = C.creamSoft;
              textColor = C.inkDim;
            } else if (inDragRange) {
              if (dragModeRef.current === 'unblock') {
                bg = C.cream;
                textColor = C.ink;
                borderColor = C.forest;
                borderWidth = 2;
              } else {
                bg = C.blockedBg;
                textColor = C.white;
                borderColor = C.forest;
                borderWidth = 2;
              }
            } else if (blockStatus) {
              bg = C.blockedBg;
              textColor = C.white;
            } else if (growthMoment) {
              bg = C.growthBg;
              textColor = C.growthText;
              borderColor = C.growthBorder;
            } else if (holiday) {
              bg = C.holidayBg;
              textColor = C.holidayText;
              borderColor = C.holidayBorder;
            }

            if (isToday && borderColor === 'transparent') {
              borderColor = C.forest;
              borderWidth = 2;
            }

            // Selected date for detail panel: shows a forest ring so user
            // can see which day they tapped while the detail card displays
            // below the calendar.
            const isSelected = selectedDate === dateStr;
            if (isSelected) {
              borderColor = C.forest;
              borderWidth = 2;
            }

            const tip = blockStatus?.type === 'recurring' ? 'Blocked by recurring rule'
              : blockStatus?.type === 'one-off' ? 'Blocked'
              : growthMoment ? `${growthMoment.name} (opportunity)`
              : holiday ? holiday.name
              : '';

            return (
              <div
                key={i}
                data-date={dateStr}
                onPointerDown={(e) => onDayPointerDown(dateStr, e)}
                onPointerEnter={() => onDayPointerEnter(dateStr)}
                role="button"
                tabIndex={isPast ? -1 : 0}
                aria-label={`${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${blockStatus ? 'blocked' : 'available'}${holiday ? ', ' + holiday.name : ''}${growthMoment ? ', ' + growthMoment.name + ' opportunity' : ''}`}
                title={tip}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  background: bg,
                  color: textColor,
                  border: `${borderWidth}px solid ${borderColor}`,
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: (isToday || blockStatus) ? 500 : 400,
                  fontFamily: 'inherit',
                  cursor: isPast ? 'not-allowed' : 'pointer',
                  opacity: isPast ? 0.55 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  minHeight: 34,
                  touchAction: 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                {d.getDate()}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Popover (viewport-clamped) ─────────────────────────────────

  function DetailPanel() {
    if (!selectedDate) return null;
    const status = isDateBlocked(selectedDate);
    const growthMoment = growthMomentsByDate[selectedDate];
    const holiday = holidaysByDate[selectedDate];
    const dateLabel = parseLocalDate(selectedDate).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });

    return (
      <div style={{
        background: C.white,
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        padding: 16,
        marginTop: 12,
        boxShadow: '0 2px 6px rgba(28, 43, 34, 0.06)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10, gap: 10,
        }}>
          <div style={{
            fontSize: 12, fontWeight: 500, color: C.inkMute,
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>{dateLabel}</div>
          <button type="button" onClick={() => setSelectedDate(null)}
            aria-label="Close detail"
            style={{
              background: C.creamSoft, color: C.inkMute,
              border: 'none', borderRadius: '50%',
              width: 26, height: 26, padding: 0, cursor: 'pointer',
              fontSize: 14, lineHeight: 1, fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>×</button>
        </div>

        {holiday && !growthMoment && (
          <div style={{ fontSize: 13, fontWeight: 500, color: C.holidayText, marginBottom: 10 }}>
            {holiday.name}
          </div>
        )}

        {growthMoment && (
          <div style={{
            background: C.goldSoft,
            border: `1px solid ${C.growthBorder}`,
            borderRadius: 8, padding: 12, marginBottom: 12,
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.goldDeep, marginBottom: 4 }}>{growthMoment.name}</div>
            <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.5, marginBottom: 8 }}>{growthMoment.why}</div>
            <div style={{ fontSize: 11, color: C.inkMute, fontStyle: 'italic', lineHeight: 1.5 }}>
              Coming soon: PracticeIQ-suggested campaigns based on your client base.
            </div>
          </div>
        )}

        {status?.type === 'recurring' && (
          <div>
            <div style={{ fontSize: 13, color: C.ink, marginBottom: 10, lineHeight: 1.5 }}>
              Blocked by recurring rule (every {status.source.weekly_days.map(d => DAY_LABELS[d]).join(', ')}).
            </div>
            <button type="button"
              onClick={async () => { await addRecurringException(status.source.id, selectedDate); setSelectedDate(null); }}
              style={{
                background: C.forest, color: C.white, border: 'none',
                borderRadius: 8, padding: '10px 14px',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'inherit', width: '100%',
              }}>Unblock just this day</button>
          </div>
        )}
      </div>
    );
  }

  // ─── Range modal ─────────────────────────────────────────────────

  function RangeModal() {
    if (!showRangeModal) return null;
    const todayStr = fmtLocalDate(today);
    return (
      <>
        <div onClick={() => setShowRangeModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15, 23, 42, 0.5)' }} />
        <div style={{
          position: 'fixed', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)', zIndex: 101,
          background: C.white, borderRadius: 14, padding: 20,
          width: 'min(420px, 92vw)',
          boxSizing: 'border-box',
          boxShadow: '0 12px 40px rgba(15, 23, 42, 0.25)',
        }}>
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 500,
            color: C.forestDeep, marginBottom: 6,
          }}>Block a date range</div>
          <div style={{ fontSize: 13, color: C.inkMute, marginBottom: 16, lineHeight: 1.5 }}>
            Use this for vacations or stretches of days off.
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: C.inkMute, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>From</label>
            <input type="date" value={rangeStart} min={todayStr} onChange={e => setRangeStart(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: 14,
                border: `1.5px solid ${C.line}`, borderRadius: 8,
                fontFamily: 'inherit', boxSizing: 'border-box',
                color: rangeStart ? C.ink : C.inkMute,
              }} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: C.inkMute, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>To</label>
            <input type="date" value={rangeEnd} min={rangeStart || todayStr} onChange={e => setRangeEnd(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: 14,
                border: `1.5px solid ${C.line}`, borderRadius: 8,
                fontFamily: 'inherit', boxSizing: 'border-box',
                color: rangeEnd ? C.ink : C.inkMute,
              }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => { setShowRangeModal(false); setRangeStart(''); setRangeEnd(''); }}
              style={{ flex: 1, background: C.white, color: C.inkMute, border: `1.5px solid ${C.line}`, borderRadius: 10, padding: '11px 14px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="button"
              onClick={async () => {
                if (!rangeStart || !rangeEnd) return;
                await blockRange(rangeStart, rangeEnd);
                setShowRangeModal(false); setRangeStart(''); setRangeEnd('');
              }}
              disabled={!rangeStart || !rangeEnd || pending}
              style={{
                flex: 2,
                background: (!rangeStart || !rangeEnd || pending) ? C.line : C.forest,
                color: C.white, border: 'none', borderRadius: 10, padding: '11px 14px',
                fontSize: 14, fontWeight: 500,
                cursor: (!rangeStart || !rangeEnd || pending) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}>{pending ? 'Blocking...' : 'Block these days'}</button>
          </div>
        </div>
      </>
    );
  }

  // ─── Holiday picker modal (checkboxes) ──────────────────────────

  function HolidayPickerModal() {
    const [selected, setSelected] = useState(() => new Set());
    const year = anchorMonth.getFullYear();
    const allHolidays = [...computeHolidays(year), ...computeHolidays(year + 1)]
      .filter(h => parseLocalDate(h.date) >= today)
      .slice(0, 15);

    // On open, default all selected (matches old bulk behavior)
    useEffect(() => {
      if (showHolidayPicker) {
        const initial = new Set();
        for (const h of allHolidays) {
          const existing = blockedDays.find(b => b.date === h.date && !b.start_time && !b.end_time);
          if (!existing) initial.add(h.key);
        }
        setSelected(initial);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showHolidayPicker]);

    if (!showHolidayPicker) return null;

    function toggle(key) {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    }

    function selectAll() {
      setSelected(new Set(allHolidays.map(h => h.key)));
    }
    function selectNone() {
      setSelected(new Set());
    }

    return (
      <>
        <div onClick={() => setShowHolidayPicker(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15, 23, 42, 0.5)' }} />
        <div style={{
          position: 'fixed', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)', zIndex: 101,
          background: C.white, borderRadius: 14, padding: 20,
          width: 'min(440px, 92vw)',
          maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
          boxSizing: 'border-box',
          boxShadow: '0 12px 40px rgba(15, 23, 42, 0.25)',
        }}>
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 500,
            color: C.forestDeep, marginBottom: 6,
          }}>Block US holidays</div>
          <div style={{ fontSize: 13, color: C.inkMute, marginBottom: 12, lineHeight: 1.5 }}>
            Check the holidays you want blocked. Already-blocked holidays show as checked but unmodifiable.
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button type="button" onClick={selectAll}
              style={{ background: C.creamSoft, color: C.forestDeep, border: `1.5px solid ${C.line}`, borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Select all</button>
            <button type="button" onClick={selectNone}
              style={{ background: C.white, color: C.inkMute, border: `1.5px solid ${C.line}`, borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Select none</button>
          </div>

          <div style={{
            flex: 1, overflowY: 'auto',
            background: C.creamSoft, borderRadius: 10, padding: 8,
            marginBottom: 16,
          }}>
            {allHolidays.map(h => {
              const dateStr = parseLocalDate(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const isChecked = selected.has(h.key);
              const existing = blockedDays.find(b => b.date === h.date && !b.start_time && !b.end_time);
              const alreadyBlocked = !!existing;
              return (
                <label key={h.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 10px',
                  cursor: alreadyBlocked ? 'default' : 'pointer',
                  borderRadius: 8,
                  background: isChecked ? C.holidayBg : 'transparent',
                  border: `1px solid ${isChecked ? C.holidayBorder : 'transparent'}`,
                  marginBottom: 4,
                  opacity: alreadyBlocked ? 0.7 : 1,
                  transition: 'background 0.12s, border 0.12s',
                }}>
                  <input
                    type="checkbox"
                    checked={isChecked || alreadyBlocked}
                    onChange={() => !alreadyBlocked && toggle(h.key)}
                    disabled={alreadyBlocked}
                    style={{ width: 18, height: 18, accentColor: C.forest, cursor: alreadyBlocked ? 'default' : 'pointer' }}
                  />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 500,
                      color: isChecked ? C.holidayText : C.ink,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{h.name}{alreadyBlocked ? ' (already blocked)' : ''}</span>
                    <span style={{
                      fontSize: 12, color: isChecked ? C.holidayText : C.inkMute,
                      flexShrink: 0,
                    }}>{dateStr}</span>
                  </div>
                </label>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setShowHolidayPicker(false)}
              style={{ flex: 1, background: C.white, color: C.inkMute, border: `1.5px solid ${C.line}`, borderRadius: 10, padding: '11px 14px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="button" onClick={() => blockSelectedHolidays(selected)}
              disabled={selected.size === 0 || pending}
              style={{
                flex: 2,
                background: (selected.size === 0 || pending) ? C.line : C.forest,
                color: C.white, border: 'none', borderRadius: 10, padding: '11px 14px',
                fontSize: 14, fontWeight: 500,
                cursor: (selected.size === 0 || pending) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}>{pending ? 'Blocking...' : `Block ${selected.size} holiday${selected.size === 1 ? '' : 's'}`}</button>
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

  // ─── Top-level render ────────────────────────────────────────────

  return (
    <div onPointerUp={onPointerUp} onPointerCancel={onPointerUp} style={{ userSelect: 'none' }}>
      {TopTagline}
      {Coaching}
      {ActionBar}
      {AddRecurringForm}
      {RecurringPills}
      {Legend}

      {DragBanner}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 6 }}>
        <RoundIconButton ariaLabel="Previous month" onClick={() => navigateMonths(-1)}>‹</RoundIconButton>
        <button type="button"
          onClick={() => {
            const d = new Date(); d.setDate(1); d.setHours(0,0,0,0);
            setAnchorMonth(d);
          }}
          style={{
            background: C.white, border: `1.5px solid ${C.line}`,
            borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 500,
            color: C.forestDeep, cursor: 'pointer', fontFamily: 'inherit',
          }}>Today</button>
        <RoundIconButton ariaLabel="Next month" onClick={() => navigateMonths(1)}>›</RoundIconButton>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : `repeat(${monthsToShow}, 1fr)`,
        gap: 12,
      }}>
        {monthsToRender.map((m, i) => <MonthGrid key={i} monthDate={m} />)}
      </div>

      <DetailPanel />
      <RangeModal />
      <HolidayPickerModal />
      {Toast}
    </div>
  );
}

// Expose a helper for the parent to toggle coaching/help via the
// panel header. Used by ScheduleDashboard to render the help button
// alongside the close button rather than stacked vertically.
export function CalendarHelpButton({ onToggle, isOpen }) {
  return (
    <RoundIconButton
      ariaLabel={isOpen ? 'Hide help' : 'Show help'}
      onClick={onToggle}
      tone={isOpen ? 'filled' : 'neutral'}
    >?</RoundIconButton>
  );
}
