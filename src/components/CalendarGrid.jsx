// src/components/CalendarGrid.jsx
//
// HK May 27 2026: comprehensive rebuild per feedback round 3.
//
// Three primary actions in one row:
//   - Block a date range (filled green button, opens modal)
//   - Block specific weekdays (opens weekday picker)
//   - Block all US holidays (one tap blocks all 11 federal holidays)
//
// Day cell color system (no letters or stars inside cells):
//   - Available      cream
//   - Blocked        mid gray with white text
//   - Holiday        green tint with dark green text (informational only)
//   - Growth op      gold tint with amber text
//   - Today          cream with 2px forest border
//   - Past           pale, not interactive
//
// Priority when states overlap: Blocked > Growth > Holiday > Today border.
//
// Interactions: tap to toggle block. Drag across days for range. Drag
// uses pointer events so it works on mobile + desktop unified. Past
// dates disabled. Holidays display green but tapping still toggles
// block, in which case they go gray.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

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
    { key: 'memorial',      name: 'Memorial Day',     date: fmt(lastWeekday(year, 4, 1)) },
    { key: 'juneteenth',    name: 'Juneteenth',       date: fmt(new Date(year, 5, 19)) },
    { key: 'july-4',        name: 'Independence Day', date: fmt(new Date(year, 6, 4)) },
    { key: 'labor',         name: 'Labor Day',        date: fmt(nthWeekday(year, 8, 1, 1)) },
    { key: 'columbus',      name: 'Columbus Day',     date: fmt(nthWeekday(year, 9, 2, 1)) },
    { key: 'veterans',      name: 'Veterans Day',     date: fmt(new Date(year, 10, 11)) },
    { key: 'thanksgiving',  name: 'Thanksgiving',     date: fmt(nthWeekday(year, 10, 4, 4)) },
    { key: 'christmas',     name: 'Christmas Day',    date: fmt(new Date(year, 11, 25)) },
    { key: 'good-friday',   name: 'Good Friday',      date: fmt(goodFriday) },
    { key: 'easter',        name: 'Easter Sunday',    date: fmt(easterDate) },
    { key: 'christmas-eve', name: 'Christmas Eve',    date: fmt(new Date(year, 11, 24)) },
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
    { key: 'valentines',     name: "Valentine's Day",         date: fmt(new Date(year, 1, 14)),  audience: 'all',     why: 'Couples massage and gift cards' },
    { key: 'mothers-day',    name: "Mother's Day",            date: fmt(nthWeekday(year, 4, 2, 0)), audience: 'mothers', why: 'Gift cards for moms' },
    { key: 'fathers-day',    name: "Father's Day",            date: fmt(nthWeekday(year, 5, 3, 0)), audience: 'fathers', why: 'Gift cards for dads' },
    { key: 'summer-start',   name: 'Summer break starts',     date: fmt(new Date(year, 5, 21)),  audience: 'parents', why: 'Self-care kickoff' },
    { key: 'back-to-school', name: 'Back to school week',     date: fmt(new Date(year, 7, 19)),  audience: 'parents', why: 'First session of the school year' },
    { key: 'halloween',      name: 'Halloween week',          date: fmt(new Date(year, 9, 31)),  audience: 'all',     why: 'Promo opportunity' },
    { key: 'black-friday',   name: 'Black Friday',            date: fmt(nthWeekday(year, 10, 4, 5)), audience: 'all', why: 'Gift card promotion' },
    { key: 'holiday-gift',   name: 'Holiday gift season',     date: fmt(new Date(year, 11, 1)),  audience: 'all',     why: 'Gift cards peak season' },
    { key: 'new-year-resolutions', name: 'New Year resolutions', date: fmt(new Date(year, 0, 8)), audience: 'all',  why: 'Self-care goals are top of mind' },
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

  const [popover, setPopover] = useState(null);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState([]);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [pending, setPending] = useState(false);
  const [confirmHolidays, setConfirmHolidays] = useState(false);

  // Drag interaction state. dragStart is a date string; dragOver is
  // the currently-hovered date string during drag. dragMoved becomes
  // true if the pointer moves to a different day than start, which
  // distinguishes a drag from a tap on release.
  const [dragStart, setDragStart] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const dragMovedRef = useRef(false);

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
      if (data) setBlockedDays(prev => [...prev, ...data]);
    }
    setPending(false);
  }

  async function blockAllUSHolidays() {
    setPending(true);
    const year = anchorMonth.getFullYear();
    const allHolidays = [...computeHolidays(year), ...computeHolidays(year + 1)];
    const datesToBlock = [];
    for (const h of allHolidays) {
      const hd = parseLocalDate(h.date);
      if (hd < today) continue;
      const existing = blockedDays.find(b => b.date === h.date && !b.start_time && !b.end_time);
      if (!existing) datesToBlock.push(h.date);
    }
    if (datesToBlock.length > 0) {
      const { data } = await supabase.from('blocked_days')
        .insert(datesToBlock.map(date => ({ therapist_id: therapist.id, date, block_type: 'off' })))
        .select();
      if (data) setBlockedDays(prev => [...prev, ...data]);
    }
    setConfirmHolidays(false);
    setPending(false);
  }

  async function addRecurringRule(weeklyDays) {
    if (!weeklyDays || weeklyDays.length === 0) return;
    const { data } = await supabase
      .from('recurring_blocks')
      .insert({ therapist_id: therapist.id, weekly_days: weeklyDays, start_date: fmtLocalDate(today) })
      .select()
      .single();
    if (data) setRecurringBlocks(prev => [...prev, data]);
  }

  async function removeRecurringRule(ruleId) {
    await supabase.from('recurring_blocks').delete().eq('id', ruleId);
    setRecurringBlocks(prev => prev.filter(r => r.id !== ruleId));
    setRecurringExceptions(prev => prev.filter(e => e.recurring_block_id !== ruleId));
  }

  async function addRecurringException(ruleId, dateStr) {
    const { data } = await supabase
      .from('recurring_block_exceptions')
      .insert({ therapist_id: therapist.id, recurring_block_id: ruleId, exception_date: dateStr })
      .select()
      .single();
    if (data) setRecurringExceptions(prev => [...prev, data]);
  }

  // ─── Drag handlers (pointer events, work on mobile + desktop) ───

  function onDayPointerDown(dateStr, e) {
    if (pending) return;
    const d = parseLocalDate(dateStr);
    if (d < today) return;
    setDragStart(dateStr);
    setDragOver(dateStr);
    dragMovedRef.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onDayPointerEnter(dateStr) {
    if (!dragStart) return;
    if (dateStr !== dragStart) dragMovedRef.current = true;
    setDragOver(dateStr);
  }

  async function onPointerUp() {
    if (!dragStart) return;
    if (dragMovedRef.current && dragOver && dragOver !== dragStart) {
      await blockRange(dragStart, dragOver);
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

    if (growthMoment || status?.type === 'recurring') {
      const cell = document.querySelector(`[data-date="${dateStr}"]`);
      if (cell) {
        const rect = cell.getBoundingClientRect();
        setPopover({
          dateStr,
          x: rect.left + rect.width / 2,
          y: rect.bottom + 8,
          status,
          growthMoment,
        });
      }
      return;
    }
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

  // ─── Top bar: tagline + small help button ────────────────────────

  const TopBar = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
      <div style={{
        fontFamily: 'Georgia, serif',
        fontSize: 13,
        fontStyle: 'italic',
        color: C.inkMute,
        flex: 1,
      }}>
        Tap to block. Tap again to unblock. Drag for a range.
      </div>
      <button
        type="button"
        aria-label={showCoaching ? 'Hide help' : 'Show help'}
        onClick={() => setShowCoaching(v => !v)}
        style={{
          background: showCoaching ? C.forest : C.white,
          color: showCoaching ? C.white : C.forest,
          border: `1.5px solid ${C.forest}`,
          borderRadius: '50%',
          width: 30, height: 30,
          padding: 0,
          cursor: 'pointer',
          fontWeight: 500,
          fontSize: 15,
          fontFamily: 'inherit',
          flexShrink: 0,
        }}>?</button>
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
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: 14,
            fontWeight: 500,
            color: C.goldDeep,
            marginBottom: 6,
          }}>
            What you can do here:
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 13, color: C.ink, lineHeight: 1.65 }}>
            <li><strong>Tap a day</strong> to block it. Tap again to unblock.</li>
            <li><strong>Drag</strong> across days to block a range fast.</li>
            <li><strong>Block a date range</strong> button opens a form for precise dates.</li>
            <li><strong>Block specific weekdays</strong> sets a recurring rule (every Saturday, etc.).</li>
            <li><strong>Block all US holidays</strong> blocks every federal holiday for the next 12 months.</li>
            <li><strong>Green days</strong> are upcoming US holidays (informational).</li>
            <li><strong>Gold days</strong> are growth opportunities (Mother's Day, etc.). Tap to learn more.</li>
          </ul>
          <button
            type="button"
            onClick={() => {
              setShowCoaching(false);
              if (onCoachingSeen) onCoachingSeen();
            }}
            style={{
              background: C.growthBorder,
              color: C.white,
              border: 'none',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginTop: 10,
            }}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Action bar: three primary actions ───────────────────────────

  const ActionBar = (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
      gap: 10,
      marginBottom: 14,
    }}>
      <button
        type="button"
        onClick={() => setShowRangeModal(true)}
        style={{
          background: C.forest,
          color: C.white,
          border: 'none',
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}>📅 Block a date range</button>
      <button
        type="button"
        onClick={() => setShowAddRecurring(v => !v)}
        style={{
          background: showAddRecurring ? C.forest : C.white,
          color: showAddRecurring ? C.white : C.forestDeep,
          border: `1.5px solid ${C.forest}`,
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}>🔁 Block specific weekdays</button>
      <button
        type="button"
        onClick={() => setConfirmHolidays(true)}
        style={{
          background: C.white,
          color: C.forestDeep,
          border: `1.5px solid ${C.forest}`,
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}>🎉 Block all US holidays</button>
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
      <div style={{ fontSize: 13, color: C.ink, fontWeight: 500, marginBottom: 3 }}>
        Block every:
      </div>
      <div style={{ fontSize: 12, color: C.inkMute, marginBottom: 12, lineHeight: 1.5 }}>
        Pick one or more weekdays. They will be blocked going forward, every week.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {DAY_LABELS.map((label, i) => {
          const isSelected = selectedDays.includes(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i])}
              style={{
                background: isSelected ? C.forest : C.white,
                color: isSelected ? C.white : C.forestDeep,
                border: `1.5px solid ${isSelected ? C.forest : C.line}`,
                borderRadius: 999,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                minWidth: 60,
              }}>{label}</button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={async () => {
          await addRecurringRule(selectedDays);
          setSelectedDays([]);
          setShowAddRecurring(false);
        }}
        disabled={selectedDays.length === 0}
        style={{
          background: selectedDays.length === 0 ? C.line : C.forest,
          color: C.white,
          border: 'none',
          borderRadius: 8,
          padding: '9px 16px',
          fontSize: 13,
          fontWeight: 500,
          cursor: selectedDays.length === 0 ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}>
        Save recurring rule
      </button>
    </div>
  );

  // ─── Recurring rule pills ────────────────────────────────────────

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
            <button
              type="button"
              onClick={() => removeRecurringRule(rule.id)}
              aria-label="Remove rule"
              style={{
                background: 'rgba(255,255,255,0.25)', color: C.white,
                border: 'none', borderRadius: '50%',
                width: 20, height: 20,
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
      display: 'flex', flexWrap: 'wrap', gap: 14,
      padding: '10px 14px', marginBottom: 14,
      background: C.white, border: `1px solid ${C.line}`, borderRadius: 10,
      fontSize: 12, color: C.inkMute, alignItems: 'center',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 18, height: 18, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 4 }} />
        Available
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 18, height: 18, background: C.blockedBg, borderRadius: 4 }} />
        Blocked
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 18, height: 18, background: C.holidayBg, border: `1px solid ${C.holidayBorder}`, borderRadius: 4 }} />
        Holiday
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 18, height: 18, background: C.growthBg, border: `1px solid ${C.growthBorder}`, borderRadius: 4 }} />
        Growth opportunity
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 18, height: 18, background: C.cream, border: `2px solid ${C.forest}`, borderRadius: 4 }} />
        Today
      </span>
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
        }}>
          {MONTH_NAMES[month]} {year}
        </div>
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

            // Priority: past → blocked/drag → growth → holiday → today
            if (isPast) {
              bg = C.creamSoft;
              textColor = C.inkDim;
            } else if (inDragRange) {
              bg = C.blockedBg;
              textColor = C.white;
              borderColor = C.forest;
              borderWidth = 2;
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
                  minHeight: 36,
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

  // ─── Popover ──────────────────────────────────────────────────────

  function Popover() {
    if (!popover) return null;
    const { status, growthMoment, dateStr } = popover;
    const dateLabel = parseLocalDate(dateStr).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });

    return (
      <>
        <div onClick={() => setPopover(null)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
        <div style={{
          position: 'fixed',
          left: Math.min(popover.x - 140, window.innerWidth - 290),
          top: popover.y,
          zIndex: 51,
          background: C.white,
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          padding: 16,
          boxShadow: '0 8px 24px rgba(28, 43, 34, 0.12)',
          width: 280,
        }}>
          <div style={{
            fontSize: 12, fontWeight: 500, color: C.inkMute,
            textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8,
          }}>{dateLabel}</div>

          {growthMoment && (
            <div style={{
              background: C.goldSoft,
              border: `1px solid ${C.growthBorder}`,
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.goldDeep, marginBottom: 4 }}>
                {growthMoment.name}
              </div>
              <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.5, marginBottom: 8 }}>
                {growthMoment.why}
              </div>
              <div style={{ fontSize: 11, color: C.inkMute, fontStyle: 'italic', lineHeight: 1.5 }}>
                Coming soon: AI-suggested campaigns based on your client base.
              </div>
            </div>
          )}

          {status?.type === 'recurring' && (
            <div>
              <div style={{ fontSize: 13, color: C.ink, marginBottom: 10, lineHeight: 1.5 }}>
                Blocked by recurring rule (every {status.source.weekly_days.map(d => DAY_LABELS[d]).join(', ')}).
              </div>
              <button
                type="button"
                onClick={async () => {
                  await addRecurringException(status.source.id, dateStr);
                  setPopover(null);
                }}
                style={{
                  background: C.forest, color: C.white, border: 'none',
                  borderRadius: 8, padding: '10px 14px',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'inherit', width: '100%',
                }}>Unblock just this day</button>
            </div>
          )}

          {!status?.type && (
            <button
              type="button"
              onClick={() => setPopover(null)}
              style={{
                background: C.creamSoft, color: C.ink,
                border: `1px solid ${C.line}`,
                borderRadius: 8, padding: '10px 14px',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'inherit', width: '100%',
              }}>Got it</button>
          )}
        </div>
      </>
    );
  }

  // ─── Range modal ─────────────────────────────────────────────────

  function RangeModal() {
    if (!showRangeModal) return null;
    const todayStr = fmtLocalDate(today);
    return (
      <>
        <div onClick={() => setShowRangeModal(false)} style={{
          position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15, 23, 42, 0.4)',
        }} />
        <div style={{
          position: 'fixed', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)', zIndex: 101,
          background: C.white, borderRadius: 14, padding: 20,
          width: 'min(420px, 92vw)',
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
              style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: `1.5px solid ${C.line}`, borderRadius: 8, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: C.inkMute, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>To</label>
            <input type="date" value={rangeEnd} min={rangeStart || todayStr} onChange={e => setRangeEnd(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: `1.5px solid ${C.line}`, borderRadius: 8, fontFamily: 'inherit', boxSizing: 'border-box' }} />
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
                flex: 2, background: (!rangeStart || !rangeEnd || pending) ? C.line : C.forest,
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

  // ─── US holidays bulk confirmation modal ─────────────────────────

  function HolidayConfirmModal() {
    if (!confirmHolidays) return null;
    const year = anchorMonth.getFullYear();
    const allHolidays = [...computeHolidays(year), ...computeHolidays(year + 1)]
      .filter(h => parseLocalDate(h.date) >= today)
      .slice(0, 15);

    return (
      <>
        <div onClick={() => setConfirmHolidays(false)} style={{
          position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15, 23, 42, 0.4)',
        }} />
        <div style={{
          position: 'fixed', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)', zIndex: 101,
          background: C.white, borderRadius: 14, padding: 20,
          width: 'min(480px, 92vw)',
          maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 12px 40px rgba(15, 23, 42, 0.25)',
        }}>
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 500,
            color: C.forestDeep, marginBottom: 8,
          }}>Block all US holidays?</div>
          <div style={{ fontSize: 13, color: C.inkMute, marginBottom: 14, lineHeight: 1.5 }}>
            This will block every US federal holiday and observed religious holiday for the next 12 months. You can unblock any single one afterward by tapping it.
          </div>
          <div style={{
            background: C.creamSoft, borderRadius: 10, padding: 12, marginBottom: 18,
            fontSize: 12, color: C.ink, lineHeight: 1.7,
            maxHeight: 200, overflowY: 'auto',
          }}>
            {allHolidays.map(h => {
              const dateStr = parseLocalDate(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return (
                <div key={h.key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{h.name}</span>
                  <span style={{ color: C.inkMute }}>{dateStr}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setConfirmHolidays(false)}
              style={{ flex: 1, background: C.white, color: C.inkMute, border: `1.5px solid ${C.line}`, borderRadius: 10, padding: '11px 14px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="button" onClick={blockAllUSHolidays} disabled={pending}
              style={{
                flex: 2, background: pending ? C.line : C.forest,
                color: C.white, border: 'none', borderRadius: 10, padding: '11px 14px',
                fontSize: 14, fontWeight: 500,
                cursor: pending ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}>{pending ? 'Blocking...' : 'Block all'}</button>
          </div>
        </div>
      </>
    );
  }

  // ─── Top-level render ─────────────────────────────────────────────

  return (
    <div onPointerUp={onPointerUp} onPointerCancel={onPointerUp} style={{ userSelect: 'none' }}>
      {TopBar}
      {Coaching}
      {ActionBar}
      {AddRecurringForm}
      {RecurringPills}
      {Legend}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" onClick={() => navigateMonths(-1)}
          style={{ background: C.white, border: `1.5px solid ${C.line}`, borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 500, color: C.forestDeep, cursor: 'pointer', fontFamily: 'inherit' }}>‹ Prev</button>
        <button type="button" onClick={() => {
          const d = new Date(); d.setDate(1); d.setHours(0,0,0,0);
          setAnchorMonth(d);
        }}
          style={{ background: C.white, border: `1.5px solid ${C.line}`, borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 500, color: C.forestDeep, cursor: 'pointer', fontFamily: 'inherit' }}>Today</button>
        <button type="button" onClick={() => navigateMonths(1)}
          style={{ background: C.white, border: `1.5px solid ${C.line}`, borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 500, color: C.forestDeep, cursor: 'pointer', fontFamily: 'inherit' }}>Next ›</button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : `repeat(${monthsToShow}, 1fr)`,
        gap: 12,
      }}>
        {monthsToRender.map((m, i) => <MonthGrid key={i} monthDate={m} />)}
      </div>

      <Popover />
      <RangeModal />
      <HolidayConfirmModal />
    </div>
  );
}
