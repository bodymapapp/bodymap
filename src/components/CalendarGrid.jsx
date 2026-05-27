// src/components/CalendarGrid.jsx
//
// World-class calendar grid for blocking time off. Composed of:
//   - Recurring rules as pills above the grid
//   - Holiday quick-pick row of pills
//   - The grid itself (3 months desktop, 1 month mobile)
//   - Growth moments (Mother's Day, etc.) marked with a star icon
//     and a "coming soon" popover (seed for fire #16)
//   - Tap a blocked day -> popover with unblock/edit options
//   - Tap-and-drag to range-select multiple days
//
// Three-color palette (HK May 27 2026):
//   - cream  (default available)
//   - sage   (blocked)
//   - forest (active/today/has-activity)
// Shades and opacity convey nuance without expanding the palette.
//
// Mounted in two places via same component, single DB source of truth:
//   - Schedule tab (cockpit)
//   - Settings -> 2.6 (config room)
//
// Honors therapist.week_starts_on (0=Sunday default, 1=Monday).

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const C = {
  cream: '#FBF8F1',
  creamSoft: '#F5EFE2',
  creamDeep: '#EFE7D2',
  sage: '#D7E4D8',
  sageDeep: '#9DBEA1',
  sageBg: '#EEF3EE',
  forest: '#2A5741',
  forestDeep: '#1F4030',
  forestSoft: '#4B8A6A',
  ink: '#1F2937',
  inkMute: '#6B7280',
  inkDim: '#9CA3AF',
  gold: '#C9A84C',
  goldSoft: '#FAF3DC',
  goldDeep: '#92660E',
  line: '#EAE5DA',
  white: '#FFFFFF',
};

// US federal holidays + commonly observed religious dates.
// Used for the quick-pick row. Date is computed per year so this list
// stays valid year over year.
// HK May 27 2026 design decision 3: B (US federal + observed religious).
// Keep neutral: holidays are optional tags, not auto-blocked.
function computeHolidays(year) {
  // Helpers
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
  // Easter calc (Anonymous Gregorian)
  const easter = (year) => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
  };
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const easterDate = easter(year);
  const goodFriday = new Date(easterDate);
  goodFriday.setDate(goodFriday.getDate() - 2);

  return [
    // US federal holidays
    { key: 'new-years',     name: "New Year's Day",  date: fmt(new Date(year, 0, 1)) },
    { key: 'mlk',           name: 'MLK Day',         date: fmt(nthWeekday(year, 0, 3, 1)) }, // 3rd Mon Jan
    { key: 'presidents',    name: "Presidents' Day", date: fmt(nthWeekday(year, 1, 3, 1)) }, // 3rd Mon Feb
    { key: 'memorial',      name: 'Memorial Day',    date: fmt(lastWeekday(year, 4, 1)) },   // Last Mon May
    { key: 'juneteenth',    name: 'Juneteenth',      date: fmt(new Date(year, 5, 19)) },
    { key: 'july-4',        name: 'Independence Day', date: fmt(new Date(year, 6, 4)) },
    { key: 'labor',         name: 'Labor Day',       date: fmt(nthWeekday(year, 8, 1, 1)) }, // 1st Mon Sep
    { key: 'columbus',      name: 'Columbus Day',    date: fmt(nthWeekday(year, 9, 2, 1)) }, // 2nd Mon Oct
    { key: 'veterans',      name: 'Veterans Day',    date: fmt(new Date(year, 10, 11)) },
    { key: 'thanksgiving',  name: 'Thanksgiving',    date: fmt(nthWeekday(year, 10, 4, 4)) },
    { key: 'christmas',     name: 'Christmas Day',   date: fmt(new Date(year, 11, 25)) },
    // Observed religious / cultural
    { key: 'good-friday',   name: 'Good Friday',     date: fmt(goodFriday) },
    { key: 'easter',        name: 'Easter Sunday',   date: fmt(easterDate) },
    { key: 'christmas-eve', name: 'Christmas Eve',   date: fmt(new Date(year, 11, 24)) },
    { key: 'new-years-eve', name: "New Year's Eve",  date: fmt(new Date(year, 11, 31)) },
  ];
}

// Growth moments for fire #16 seed (HK May 27 2026).
// These dates do NOT block availability. They mark opportunity dates
// the therapist may want to act on (send a promo, schedule a campaign).
// Tap shows a "coming soon" popover. Full feature wired in a future
// commit per BLOCK_PLAN fire #16.
function computeGrowthMoments(year) {
  const nthWeekday = (year, month, n, dayOfWeek) => {
    const d = new Date(year, month, 1);
    while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() + 1);
    d.setDate(d.getDate() + (n - 1) * 7);
    return d;
  };
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return [
    { key: 'valentines',     name: "Valentine's Day",         date: fmt(new Date(year, 1, 14)),  audience: 'all', why: 'Couples massage and gift cards' },
    { key: 'mothers-day',    name: "Mother's Day",            date: fmt(nthWeekday(year, 4, 2, 0)), audience: 'mothers', why: 'Gift cards for moms' },
    { key: 'fathers-day',    name: "Father's Day",            date: fmt(nthWeekday(year, 5, 3, 0)), audience: 'fathers', why: 'Gift cards for dads' },
    { key: 'summer-start',   name: 'Summer break starts',     date: fmt(new Date(year, 5, 21)),  audience: 'parents', why: 'Self-care kickoff' },
    { key: 'back-to-school', name: 'Back to school week',     date: fmt(new Date(year, 7, 19)),  audience: 'parents', why: '"First session of the school year" for parents' },
    { key: 'halloween',      name: 'Halloween week',          date: fmt(new Date(year, 9, 31)),  audience: 'all', why: 'Promo opportunity' },
    { key: 'black-friday',   name: 'Black Friday',            date: fmt(nthWeekday(year, 10, 4, 4 + 1)), audience: 'all', why: 'Gift card promotion' },
    { key: 'holiday-gift',   name: 'Holiday gift season',     date: fmt(new Date(year, 11, 1)),  audience: 'all', why: 'Gift cards peak season' },
    { key: 'new-year-resolutions', name: 'New Year resolutions', date: fmt(new Date(year, 0, 8)), audience: 'all', why: 'Self-care goals are top of mind' },
  ];
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAY_LABELS_SUN = ['S','M','T','W','T','F','S'];
const WEEKDAY_LABELS_MON = ['M','T','W','T','F','S','S'];

// Convert YYYY-MM-DD to local Date (avoiding UTC shift)
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

  // Anchor month for navigation (the leftmost month shown on desktop;
  // the only month shown on mobile)
  const [anchorMonth, setAnchorMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Data state
  const [blockedDays, setBlockedDays] = useState([]);
  const [recurringBlocks, setRecurringBlocks] = useState([]);
  const [recurringExceptions, setRecurringExceptions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Drag-to-range state
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Popover state for day click
  const [popover, setPopover] = useState(null); // {dateStr, x, y, reason}

  // Holiday + growth moment indices keyed by date string
  const holidaysByDate = useMemo(() => {
    const map = {};
    const yearsToScan = [anchorMonth.getFullYear(), anchorMonth.getFullYear() + 1];
    for (const y of yearsToScan) {
      for (const h of computeHolidays(y)) {
        map[h.date] = h;
      }
    }
    return map;
  }, [anchorMonth]);
  const growthMomentsByDate = useMemo(() => {
    const map = {};
    const yearsToScan = [anchorMonth.getFullYear(), anchorMonth.getFullYear() + 1];
    for (const y of yearsToScan) {
      for (const m of computeGrowthMoments(y)) {
        map[m.date] = m;
      }
    }
    return map;
  }, [anchorMonth]);

  // Load data
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

  // Compute monthsToShow based on viewport
  const monthsToShow = isMobile ? 1 : 3;

  // Helper: is a date blocked?
  function isDateBlocked(dateStr) {
    // One-off block (with no time range = full day)
    const oneOff = blockedDays.find(b => b.date === dateStr && !b.start_time && !b.end_time && (b.block_type ?? 'off') === 'off');
    if (oneOff) return { type: 'one-off', source: oneOff };

    // Recurring rule
    const d = parseLocalDate(dateStr);
    const dow = d.getDay();
    for (const rule of recurringBlocks) {
      if (!rule.weekly_days?.includes(dow)) continue;
      if (rule.start_date && parseLocalDate(rule.start_date) > d) continue;
      if (rule.end_date && parseLocalDate(rule.end_date) < d) continue;
      // Check for exception
      const hasException = recurringExceptions.some(e =>
        e.recurring_block_id === rule.id && e.exception_date === dateStr
      );
      if (!hasException) return { type: 'recurring', source: rule };
    }

    return null;
  }

  // Bookings map by date
  const bookingsByDate = useMemo(() => {
    const map = {};
    for (const b of bookings) {
      if (!b.booking_date) continue;
      map[b.booking_date] = (map[b.booking_date] || 0) + 1;
    }
    return map;
  }, [bookings]);

  // ─── Recurring rules: add / remove ─────────────────────────────

  async function addRecurringRule(weeklyDays) {
    if (!weeklyDays || weeklyDays.length === 0) return;
    const { data, error } = await supabase
      .from('recurring_blocks')
      .insert({
        therapist_id: therapist.id,
        weekly_days: weeklyDays,
        start_date: fmtLocalDate(today),
      })
      .select()
      .single();
    if (!error && data) {
      setRecurringBlocks(prev => [...prev, data]);
    }
  }

  async function removeRecurringRule(ruleId) {
    await supabase.from('recurring_blocks').delete().eq('id', ruleId);
    setRecurringBlocks(prev => prev.filter(r => r.id !== ruleId));
    setRecurringExceptions(prev => prev.filter(e => e.recurring_block_id !== ruleId));
  }

  // ─── One-off block: toggle ─────────────────────────────────────

  async function toggleOneOffBlock(dateStr) {
    // If already blocked one-off, remove it
    const existing = blockedDays.find(b => b.date === dateStr && !b.start_time && !b.end_time);
    if (existing) {
      await supabase.from('blocked_days').delete().eq('id', existing.id);
      setBlockedDays(prev => prev.filter(b => b.id !== existing.id));
      return;
    }
    // Otherwise insert
    const { data, error } = await supabase
      .from('blocked_days')
      .insert({
        therapist_id: therapist.id,
        date: dateStr,
        block_type: 'off',
      })
      .select()
      .single();
    if (!error && data) {
      setBlockedDays(prev => [...prev, data]);
    }
  }

  // ─── Recurring exception (unblock just this one) ───────────────

  async function addRecurringException(ruleId, dateStr) {
    const { data, error } = await supabase
      .from('recurring_block_exceptions')
      .insert({
        therapist_id: therapist.id,
        recurring_block_id: ruleId,
        exception_date: dateStr,
      })
      .select()
      .single();
    if (!error && data) {
      setRecurringExceptions(prev => [...prev, data]);
    }
  }

  async function removeRecurringException(exceptionId) {
    await supabase.from('recurring_block_exceptions').delete().eq('id', exceptionId);
    setRecurringExceptions(prev => prev.filter(e => e.id !== exceptionId));
  }

  // ─── Holiday block (one-off insert if not already blocked) ────

  async function toggleHolidayBlock(holiday) {
    await toggleOneOffBlock(holiday.date);
  }

  // ─── Day click handler ─────────────────────────────────────────

  function handleDayClick(dateStr, e) {
    const d = parseLocalDate(dateStr);
    if (d < today) return; // past dates are not interactive

    const status = isDateBlocked(dateStr);
    const growthMoment = growthMomentsByDate[dateStr];
    const holiday = holidaysByDate[dateStr];

    // If the day is a growth moment OR an existing block, show popover
    if (status || growthMoment) {
      const rect = e.currentTarget.getBoundingClientRect();
      setPopover({
        dateStr,
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
        status,
        growthMoment,
        holiday,
      });
      return;
    }

    // Otherwise toggle as one-off block
    toggleOneOffBlock(dateStr);
  }

  // ─── Drag-to-range handlers ────────────────────────────────────

  function handleDayMouseDown(dateStr, e) {
    const d = parseLocalDate(dateStr);
    if (d < today) return;
    setDragStart(dateStr);
    setDragEnd(dateStr);
    setIsDragging(false); // becomes true if mouse moves
  }

  function handleDayMouseEnter(dateStr) {
    if (dragStart) {
      setDragEnd(dateStr);
      if (dateStr !== dragStart) setIsDragging(true);
    }
  }

  function handleDayMouseUp() {
    if (dragStart && dragEnd && isDragging) {
      // Range select: block every available day in the range
      const start = parseLocalDate(dragStart);
      const end = parseLocalDate(dragEnd);
      const lo = start < end ? start : end;
      const hi = start < end ? end : start;
      const datesToToggle = [];
      for (let d = new Date(lo); d <= hi; d.setDate(d.getDate() + 1)) {
        const dateStr = fmtLocalDate(d);
        if (!isDateBlocked(dateStr)) {
          datesToToggle.push(dateStr);
        }
      }
      // Bulk insert
      if (datesToToggle.length > 0) {
        supabase.from('blocked_days')
          .insert(datesToToggle.map(date => ({
            therapist_id: therapist.id,
            date,
            block_type: 'off',
          })))
          .select()
          .then(({ data }) => {
            if (data) setBlockedDays(prev => [...prev, ...data]);
          });
      }
    }
    setDragStart(null);
    setDragEnd(null);
    setIsDragging(false);
  }

  // Detect if a date is in the active drag range
  function isInDragRange(dateStr) {
    if (!isDragging || !dragStart || !dragEnd) return false;
    const d = parseLocalDate(dateStr);
    const start = parseLocalDate(dragStart);
    const end = parseLocalDate(dragEnd);
    const lo = start < end ? start : end;
    const hi = start < end ? end : start;
    return d >= lo && d <= hi;
  }

  // ─── Month grid rendering ─────────────────────────────────────

  function MonthGrid({ monthDate }) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Compute leading blanks based on week start
    const startDow = firstDay.getDay();
    const leadingBlanks = (startDow - weekStartsOn + 7) % 7;

    const weekdayLabels = weekStartsOn === 1 ? WEEKDAY_LABELS_MON : WEEKDAY_LABELS_SUN;

    // Build a flat array of cells (blanks + days)
    const cells = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      cells.push(new Date(year, month, d));
    }
    // Pad trailing to multiple of 7
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div style={{
        background: C.white,
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        padding: 14,
        minWidth: 0,
      }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontWeight: 700,
          fontSize: 15,
          color: C.forest,
          marginBottom: 12,
          textAlign: 'center',
        }}>
          {MONTH_NAMES[month]} {year}
        </div>

        {/* Weekday header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
          marginBottom: 6,
        }}>
          {weekdayLabels.map((label, i) => (
            <div key={i} style={{
              textAlign: 'center',
              fontSize: 10,
              fontWeight: 700,
              color: C.inkDim,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              padding: '4px 0',
            }}>{label}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
        }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} style={{ aspectRatio: '1' }} />;

            const dateStr = fmtLocalDate(d);
            const isPast = d < today;
            const isToday = sameDate(d, today);
            const blockStatus = isDateBlocked(dateStr);
            const holiday = holidaysByDate[dateStr];
            const growthMoment = growthMomentsByDate[dateStr];
            const hasBookings = (bookingsByDate[dateStr] || 0) > 0;
            const inDragRange = isInDragRange(dateStr);

            // Background color (3-color palette + shades)
            let bg = C.cream;
            let textColor = C.ink;
            if (isPast) {
              bg = C.creamSoft;
              textColor = C.inkDim;
            } else if (inDragRange) {
              bg = C.sage;
              textColor = C.forestDeep;
            } else if (blockStatus) {
              bg = C.sage;
              textColor = C.forestDeep;
            } else if (holiday) {
              bg = C.creamDeep;
            }

            // Border (today gets a forest border)
            const border = isToday ? `2px solid ${C.forest}` : `1px solid transparent`;

            return (
              <button
                key={i}
                type="button"
                onClick={(e) => handleDayClick(dateStr, e)}
                onMouseDown={(e) => handleDayMouseDown(dateStr, e)}
                onMouseEnter={() => handleDayMouseEnter(dateStr)}
                onMouseUp={handleDayMouseUp}
                disabled={isPast}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  background: bg,
                  color: textColor,
                  border,
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: isToday ? 700 : 500,
                  fontFamily: 'inherit',
                  cursor: isPast ? 'not-allowed' : 'pointer',
                  opacity: isPast ? 0.5 : 1,
                  transition: 'background 0.12s',
                  WebkitTapHighlightColor: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
                title={
                  holiday ? holiday.name :
                  growthMoment ? `${growthMoment.name} (opportunity)` :
                  blockStatus?.type === 'recurring' ? 'Blocked by recurring rule' :
                  blockStatus?.type === 'one-off' ? 'Blocked' :
                  ''
                }
              >
                {d.getDate()}

                {/* Recurring indicator dot (small forest dot in corner) */}
                {blockStatus?.type === 'recurring' && (
                  <span style={{
                    position: 'absolute',
                    bottom: 3, right: 3,
                    width: 5, height: 5,
                    borderRadius: '50%',
                    background: C.forest,
                  }} />
                )}

                {/* Booking activity dot */}
                {hasBookings && !blockStatus && (
                  <span style={{
                    position: 'absolute',
                    bottom: 3, right: 3,
                    width: 5, height: 5,
                    borderRadius: '50%',
                    background: C.forestSoft,
                  }} />
                )}

                {/* Growth moment star */}
                {growthMoment && !isPast && (
                  <span style={{
                    position: 'absolute',
                    top: 2, right: 3,
                    fontSize: 10,
                    color: C.gold,
                    lineHeight: 1,
                  }}>★</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Recurring pills + holiday quick-pick UI ───────────────────

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState([]);

  function RecurringPills() {
    return (
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
        alignItems: 'center',
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.inkMute,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginRight: 4,
        }}>Recurring rules</span>

        {recurringBlocks.length === 0 && (
          <span style={{ fontSize: 12, color: C.inkDim }}>None yet</span>
        )}

        {recurringBlocks.map(rule => (
          <span key={rule.id} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: C.sageBg,
            border: `1px solid ${C.sageDeep}`,
            color: C.forestDeep,
            borderRadius: 999,
            padding: '5px 10px 5px 12px',
            fontSize: 12,
            fontWeight: 600,
          }}>
            Every {rule.weekly_days.map(d => dayLabels[d]).join(', ')}
            <button
              type="button"
              onClick={() => removeRecurringRule(rule.id)}
              aria-label="Remove rule"
              style={{
                background: 'transparent',
                border: 'none',
                color: C.forestDeep,
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
                width: 16, height: 16,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.6,
              }}>×</button>
          </span>
        ))}

        <button
          type="button"
          onClick={() => setShowAddRecurring(v => !v)}
          style={{
            background: showAddRecurring ? C.forest : C.white,
            color: showAddRecurring ? C.white : C.forestDeep,
            border: `1px solid ${C.forestDeep}`,
            borderRadius: 999,
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
          {showAddRecurring ? 'Cancel' : '+ Add rule'}
        </button>
      </div>
    );
  }

  function AddRecurringForm() {
    if (!showAddRecurring) return null;
    return (
      <div style={{
        background: C.creamSoft,
        border: `1px dashed ${C.sageDeep}`,
        borderRadius: 10,
        padding: 12,
        marginBottom: 14,
      }}>
        <div style={{ fontSize: 12, color: C.inkMute, marginBottom: 8 }}>
          Select which days to block. Tap "Save rule" to apply going forward.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {dayLabels.map((label, i) => {
            const isSelected = selectedDays.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setSelectedDays(prev =>
                    prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                  );
                }}
                style={{
                  background: isSelected ? C.forest : C.white,
                  color: isSelected ? C.white : C.forestDeep,
                  border: `1px solid ${isSelected ? C.forest : C.line}`,
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  minWidth: 50,
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
            borderRadius: 999,
            padding: '7px 16px',
            fontSize: 12,
            fontWeight: 700,
            cursor: selectedDays.length === 0 ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}>
          Save rule
        </button>
      </div>
    );
  }

  function HolidayQuickPick() {
    // Show holidays in the next 90 days only
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + 90);
    const upcoming = Object.values(holidaysByDate)
      .filter(h => {
        const d = parseLocalDate(h.date);
        return d >= today && d <= cutoff;
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);

    if (upcoming.length === 0) return null;

    return (
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
        alignItems: 'center',
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.inkMute,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginRight: 4,
        }}>Upcoming holidays</span>
        {upcoming.map(h => {
          const isBlocked = blockedDays.some(b => b.date === h.date && !b.start_time && !b.end_time);
          return (
            <button
              key={h.key}
              type="button"
              onClick={() => toggleHolidayBlock(h)}
              style={{
                background: isBlocked ? C.sage : C.creamSoft,
                color: isBlocked ? C.forestDeep : C.ink,
                border: `1px solid ${isBlocked ? C.sageDeep : C.line}`,
                borderRadius: 999,
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
              {isBlocked ? '✓ ' : ''}{h.name}
            </button>
          );
        })}
      </div>
    );
  }

  // ─── Popover ───────────────────────────────────────────────────

  function Popover() {
    if (!popover) return null;
    const { status, growthMoment, holiday, dateStr } = popover;
    const dateLabel = parseLocalDate(dateStr).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });

    return (
      <>
        <div
          onClick={() => setPopover(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
          }}
        />
        <div style={{
          position: 'fixed',
          left: Math.min(popover.x - 140, window.innerWidth - 290),
          top: popover.y,
          zIndex: 51,
          background: C.white,
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          padding: 14,
          boxShadow: '0 8px 24px rgba(28, 43, 34, 0.12)',
          width: 280,
        }}>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: C.inkMute,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 6,
          }}>{dateLabel}</div>

          {holiday && (
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 8 }}>
              {holiday.name}
            </div>
          )}

          {growthMoment && (
            <div style={{
              background: C.goldSoft,
              border: `1px solid ${C.gold}`,
              borderRadius: 8,
              padding: 10,
              marginBottom: 10,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.goldDeep, marginBottom: 4 }}>
                ★ {growthMoment.name}
              </div>
              <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.5, marginBottom: 6 }}>
                {growthMoment.why}
              </div>
              <div style={{
                fontSize: 11,
                color: C.inkMute,
                fontStyle: 'italic',
                lineHeight: 1.5,
              }}>
                Coming soon: AI-suggested campaigns based on your client base. We will recognize who in your list is most likely to act and pre-draft a message.
              </div>
            </div>
          )}

          {status?.type === 'recurring' && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, color: C.ink, marginBottom: 8 }}>
                Blocked by recurring rule (every {status.source.weekly_days.map(d => dayLabels[d]).join(', ')}).
              </div>
              <button
                type="button"
                onClick={async () => {
                  await addRecurringException(status.source.id, dateStr);
                  setPopover(null);
                }}
                style={{
                  background: C.forest,
                  color: C.white,
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  width: '100%',
                }}>
                Unblock just this day
              </button>
            </div>
          )}

          {status?.type === 'one-off' && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, color: C.ink, marginBottom: 8 }}>
                Blocked off.
              </div>
              <button
                type="button"
                onClick={async () => {
                  await toggleOneOffBlock(dateStr);
                  setPopover(null);
                }}
                style={{
                  background: C.white,
                  color: C.forestDeep,
                  border: `1px solid ${C.forestDeep}`,
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  width: '100%',
                }}>
                Unblock this day
              </button>
            </div>
          )}

          {!status && growthMoment && (
            <button
              type="button"
              onClick={() => setPopover(null)}
              style={{
                background: C.creamSoft,
                color: C.ink,
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                width: '100%',
              }}>
              Got it
            </button>
          )}
        </div>
      </>
    );
  }

  // ─── Month navigation ──────────────────────────────────────────

  function navigateMonths(delta) {
    setAnchorMonth(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + delta);
      return d;
    });
  }

  // ─── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.inkMute, fontSize: 13 }}>
        Loading calendar...
      </div>
    );
  }

  // Build the list of months to display
  const monthsToRender = [];
  for (let i = 0; i < monthsToShow; i++) {
    const m = new Date(anchorMonth);
    m.setMonth(m.getMonth() + i);
    monthsToRender.push(m);
  }

  return (
    <div onMouseUp={handleDayMouseUp} onMouseLeave={handleDayMouseUp} style={{ userSelect: 'none' }}>
      {/* First-open coaching card (HK May 27 2026, C plan).
          Shows the first time a therapist opens the calendar so they
          know what they can do here. Dismissible. Persists across
          reloads via localStorage in the parent. */}
      {firstOpen && (
        <div style={{
          background: '#FAF3DC',
          border: `1px solid ${C.gold}`,
          borderRadius: 12,
          padding: '16px 18px',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>👋</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'Georgia, serif',
                fontSize: 15,
                fontWeight: 700,
                color: C.goldDeep,
                marginBottom: 8,
              }}>
                Welcome to your calendar. Here's what you can do:
              </div>
              <ul style={{
                margin: 0, padding: 0, listStyle: 'none',
                fontSize: 13, color: C.ink, lineHeight: 1.7,
              }}>
                <li><strong>Tap any day</strong> to block it (tap again to unblock).</li>
                <li><strong>Click and drag</strong> across multiple days to block a range.</li>
                <li><strong>Tap "+ Add rule"</strong> below to block every Saturday (or any weekday) going forward.</li>
                <li><strong>Tap a holiday pill</strong> to block a specific holiday like Thanksgiving.</li>
                <li><strong>Gold ★ days</strong> mark growth opportunities like Mother's Day. Tap to learn more.</li>
              </ul>
              <button
                type="button"
                onClick={onCoachingSeen}
                style={{
                  background: C.gold,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  marginTop: 12,
                }}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      <RecurringPills />
      <AddRecurringForm />
      <HolidayQuickPick />

      {/* Navigation + grid */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <button
          type="button"
          onClick={() => navigateMonths(-1)}
          style={{
            background: C.white,
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            color: C.forestDeep,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}>‹ Prev</button>
        <button
          type="button"
          onClick={() => {
            const d = new Date();
            d.setDate(1);
            d.setHours(0, 0, 0, 0);
            setAnchorMonth(d);
          }}
          style={{
            background: C.white,
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            color: C.forestDeep,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}>Today</button>
        <button
          type="button"
          onClick={() => navigateMonths(1)}
          style={{
            background: C.white,
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            color: C.forestDeep,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}>Next ›</button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : `repeat(${monthsToShow}, 1fr)`,
        gap: 14,
      }}>
        {monthsToRender.map((m, i) => (
          <MonthGrid key={i} monthDate={m} />
        ))}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 14,
        marginTop: 14,
        fontSize: 11,
        color: C.inkMute,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 3 }} /> Available
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, background: C.sage, borderRadius: 3 }} /> Blocked
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, background: C.sage, borderRadius: 3, position: 'relative' }}>
            <span style={{ position: 'absolute', bottom: 1, right: 1, width: 3, height: 3, borderRadius: '50%', background: C.forest }} />
          </span> Recurring rule
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, background: C.cream, border: `2px solid ${C.forest}`, borderRadius: 3 }} /> Today
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: C.gold }}>★</span> Growth moment
        </span>
      </div>

      <Popover />
    </div>
  );
}
