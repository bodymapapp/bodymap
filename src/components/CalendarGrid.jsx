// src/components/CalendarGrid.jsx
//
// Visual calendar for blocking time off. Composed of:
//   - Recurring rules as pills above the grid
//   - Holiday quick-pick row of pills (dates inline)
//   - The grid (3 months desktop, 1 month mobile)
//   - Growth moments marked with a star, seed for fire #16
//   - Tap a day to block. Tap again to unblock.
//   - Block a date range via explicit modal button (drag dropped per
//     HK May 27 2026 because mobile drag is unreliable and confusing)
//
// Three-color palette: cream (available), sage (blocked), forest
// (today / active). Shades convey nuance.
//
// Mounted in Schedule tab. Self-contained. Single DB source of truth.
//
// Honors therapist.week_starts_on (0=Sunday default, 1=Monday).

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const C = {
  cream: '#FBF8F1',
  creamSoft: '#F5EFE2',
  creamDeep: '#EFE7D2',
  sage: '#C7DBC9',          // blocked, more saturated for clear contrast
  sageStrong: '#9DBEA1',     // recurring-block solid
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
  red: '#DC2626',
};

// US federal holidays + commonly observed religious dates, computed
// per year so the list stays correct year over year.
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
    { key: 'new-years',     name: "New Year's Day",  date: fmt(new Date(year, 0, 1)) },
    { key: 'mlk',           name: 'MLK Day',         date: fmt(nthWeekday(year, 0, 3, 1)) },
    { key: 'presidents',    name: "Presidents' Day", date: fmt(nthWeekday(year, 1, 3, 1)) },
    { key: 'memorial',      name: 'Memorial Day',    date: fmt(lastWeekday(year, 4, 1)) },
    { key: 'juneteenth',    name: 'Juneteenth',      date: fmt(new Date(year, 5, 19)) },
    { key: 'july-4',        name: 'Independence Day', date: fmt(new Date(year, 6, 4)) },
    { key: 'labor',         name: 'Labor Day',       date: fmt(nthWeekday(year, 8, 1, 1)) },
    { key: 'columbus',      name: 'Columbus Day',    date: fmt(nthWeekday(year, 9, 2, 1)) },
    { key: 'veterans',      name: 'Veterans Day',    date: fmt(new Date(year, 10, 11)) },
    { key: 'thanksgiving',  name: 'Thanksgiving',    date: fmt(nthWeekday(year, 10, 4, 4)) },
    { key: 'christmas',     name: 'Christmas Day',   date: fmt(new Date(year, 11, 25)) },
    { key: 'good-friday',   name: 'Good Friday',     date: fmt(goodFriday) },
    { key: 'easter',        name: 'Easter Sunday',   date: fmt(easterDate) },
    { key: 'christmas-eve', name: 'Christmas Eve',   date: fmt(new Date(year, 11, 24)) },
    { key: 'new-years-eve', name: "New Year's Eve",  date: fmt(new Date(year, 11, 31)) },
  ];
}

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
    { key: 'back-to-school', name: 'Back to school week',     date: fmt(new Date(year, 7, 19)),  audience: 'parents', why: 'First session of the school year for parents' },
    { key: 'halloween',      name: 'Halloween week',          date: fmt(new Date(year, 9, 31)),  audience: 'all', why: 'Promo opportunity' },
    { key: 'black-friday',   name: 'Black Friday',            date: fmt(nthWeekday(year, 10, 4, 4 + 1)), audience: 'all', why: 'Gift card promotion' },
    { key: 'holiday-gift',   name: 'Holiday gift season',     date: fmt(new Date(year, 11, 1)),  audience: 'all', why: 'Gift cards peak season' },
    { key: 'new-year-resolutions', name: 'New Year resolutions', date: fmt(new Date(year, 0, 8)), audience: 'all', why: 'Self-care goals are top of mind' },
  ];
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAY_LABELS_SUN = ['S','M','T','W','T','F','S'];
const WEEKDAY_LABELS_MON = ['M','T','W','T','F','S','S'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
function shortDateLabel(dateStr) {
  const d = parseLocalDate(dateStr);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
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

  async function blockDateRange() {
    if (!rangeStart || !rangeEnd) return;
    const lo = rangeStart < rangeEnd ? rangeStart : rangeEnd;
    const hi = rangeStart < rangeEnd ? rangeEnd : rangeStart;
    setPending(true);
    const datesToBlock = [];
    for (let d = parseLocalDate(lo); d <= parseLocalDate(hi); d.setDate(d.getDate() + 1)) {
      const dateStr = fmtLocalDate(d);
      if (!isDateBlocked(dateStr)) {
        datesToBlock.push(dateStr);
      }
    }
    if (datesToBlock.length > 0) {
      const { data } = await supabase.from('blocked_days')
        .insert(datesToBlock.map(date => ({ therapist_id: therapist.id, date, block_type: 'off' })))
        .select();
      if (data) setBlockedDays(prev => [...prev, ...data]);
    }
    setShowRangeModal(false);
    setRangeStart('');
    setRangeEnd('');
    setPending(false);
  }

  async function addRecurringRule(weeklyDays) {
    if (!weeklyDays || weeklyDays.length === 0) return;
    const { data } = await supabase
      .from('recurring_blocks')
      .insert({
        therapist_id: therapist.id,
        weekly_days: weeklyDays,
        start_date: fmtLocalDate(today),
      })
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

  function handleDayClick(dateStr, e) {
    if (pending) return;
    const d = parseLocalDate(dateStr);
    if (d < today) return;

    const status = isDateBlocked(dateStr);
    const growthMoment = growthMomentsByDate[dateStr];
    const holiday = holidaysByDate[dateStr];

    if (growthMoment || status?.type === 'recurring') {
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

    // Simple one-off toggle for everything else (including holidays
    // and one-off blocks). One tap = block. Tap again = unblock.
    toggleOneOffBlock(dateStr);
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

  // ─── Render: Help button + Coaching ──────────────────────────────

  const HelpRow = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{
        fontFamily: 'Georgia, serif',
        fontSize: 14,
        color: C.inkMute,
        fontStyle: 'italic',
      }}>
        Tap a day to block. Tap again to unblock.
      </div>
      <button
        type="button"
        onClick={() => setShowCoaching(v => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: showCoaching ? C.forest : C.white,
          color: showCoaching ? C.white : C.forestDeep,
          border: `1.5px solid ${C.forest}`,
          borderRadius: 999,
          padding: '6px 14px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
        ? {showCoaching ? 'Hide help' : 'Show help'}
      </button>
    </div>
  );

  const Coaching = showCoaching && (
    <div style={{
      background: C.goldSoft,
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
            What you can do here:
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 13.5, color: C.ink, lineHeight: 1.7 }}>
            <li><strong>Tap a day on the grid</strong> to block it. Tap again to unblock.</li>
            <li><strong>Block a date range</strong> with the button below for vacations.</li>
            <li><strong>Add a recurring rule</strong> to block every Saturday (or any weekday) going forward.</li>
            <li><strong>Tap a holiday pill</strong> to block a specific holiday.</li>
            <li><strong>Gold ★ days</strong> mark growth opportunities like Mother's Day. Tap to learn more.</li>
          </ul>
          <button
            type="button"
            onClick={() => {
              setShowCoaching(false);
              if (onCoachingSeen) onCoachingSeen();
            }}
            style={{
              background: C.gold,
              color: C.white,
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
  );

  // ─── Render: Action bar (Block a range + Add recurring) ──────────

  const ActionBar = (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 16,
      padding: '14px 16px',
      background: C.creamSoft,
      border: `1px solid ${C.line}`,
      borderRadius: 12,
    }}>
      <button
        type="button"
        onClick={() => setShowRangeModal(true)}
        style={{
          flex: '1 1 auto',
          minWidth: 160,
          background: C.forest,
          color: C.white,
          border: 'none',
          borderRadius: 10,
          padding: '12px 16px',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
        📅 Block a date range
      </button>
      <button
        type="button"
        onClick={() => setShowAddRecurring(v => !v)}
        style={{
          flex: '1 1 auto',
          minWidth: 160,
          background: showAddRecurring ? C.forest : C.white,
          color: showAddRecurring ? C.white : C.forestDeep,
          border: `1.5px solid ${C.forest}`,
          borderRadius: 10,
          padding: '12px 16px',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
        🔁 {showAddRecurring ? 'Cancel' : 'Add a recurring rule'}
      </button>
    </div>
  );

  // ─── Render: Add recurring form ──────────────────────────────────

  const AddRecurringForm = showAddRecurring && (
    <div style={{
      background: C.white,
      border: `1px dashed ${C.sageStrong}`,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 13, color: C.ink, fontWeight: 600, marginBottom: 4 }}>
        Block every:
      </div>
      <div style={{ fontSize: 12, color: C.inkMute, marginBottom: 12, lineHeight: 1.5 }}>
        Pick one or more weekdays. They will be blocked going forward, every week.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {DAY_LABELS.map((label, i) => {
          const isSelected = selectedDays.includes(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                setSelectedDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]);
              }}
              style={{
                background: isSelected ? C.forest : C.white,
                color: isSelected ? C.white : C.forestDeep,
                border: `1.5px solid ${isSelected ? C.forest : C.line}`,
                borderRadius: 999,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 700,
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
          padding: '10px 18px',
          fontSize: 13,
          fontWeight: 700,
          cursor: selectedDays.length === 0 ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}>
        Save recurring rule
      </button>
    </div>
  );

  // ─── Render: Recurring rule pills ────────────────────────────────

  const RecurringPills = recurringBlocks.length > 0 && (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.inkMute,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>Active recurring rules</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {recurringBlocks.map(rule => (
          <span key={rule.id} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: C.sage,
            border: `1px solid ${C.sageStrong}`,
            color: C.forestDeep,
            borderRadius: 999,
            padding: '6px 10px 6px 14px',
            fontSize: 13,
            fontWeight: 600,
          }}>
            Every {rule.weekly_days.map(d => DAY_LABELS[d]).join(', ')}
            <button
              type="button"
              onClick={() => removeRecurringRule(rule.id)}
              aria-label="Remove rule"
              style={{
                background: C.forestDeep,
                color: C.white,
                border: 'none',
                borderRadius: '50%',
                width: 22, height: 22,
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>×</button>
          </span>
        ))}
      </div>
    </div>
  );

  // ─── Render: Holiday pills (with dates) ──────────────────────────

  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 90);
  const upcomingHolidays = Object.values(holidaysByDate)
    .filter(h => {
      const d = parseLocalDate(h.date);
      return d >= today && d <= cutoff;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  const HolidayPills = upcomingHolidays.length > 0 && (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.inkMute,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>Upcoming holidays (tap to block)</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {upcomingHolidays.map(h => {
          const isBlocked = blockedDays.some(b => b.date === h.date && !b.start_time && !b.end_time);
          return (
            <button
              key={h.key}
              type="button"
              onClick={() => toggleOneOffBlock(h.date)}
              style={{
                background: isBlocked ? C.sage : C.white,
                color: isBlocked ? C.forestDeep : C.ink,
                border: `1.5px solid ${isBlocked ? C.sageStrong : C.line}`,
                borderRadius: 999,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
              {isBlocked ? '✓ ' : ''}{h.name} <span style={{ color: isBlocked ? C.forestDeep : C.inkMute, fontWeight: 500 }}>· {shortDateLabel(h.date)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ─── Render: Legend ──────────────────────────────────────────────

  const Legend = (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 16,
      padding: '12px 16px',
      marginBottom: 16,
      background: C.white,
      border: `1px solid ${C.line}`,
      borderRadius: 10,
      fontSize: 12,
      color: C.inkMute,
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 16, height: 16, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 4,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: C.ink, fontWeight: 600,
        }}>5</span> Available
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 16, height: 16, background: C.sage, border: `1px solid ${C.sageStrong}`, borderRadius: 4,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: C.forestDeep, fontWeight: 600,
        }}>5</span> Blocked
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 16, height: 16, background: C.cream, border: `2px solid ${C.forest}`, borderRadius: 4,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: C.forest, fontWeight: 700,
        }}>5</span> Today
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: C.gold, fontSize: 14 }}>★</span> Growth opportunity
      </span>
    </div>
  );

  // ─── Render: Month grid ──────────────────────────────────────────

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
        padding: 14,
        minWidth: 0,
      }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontWeight: 700,
          fontSize: 16,
          color: C.forest,
          marginBottom: 12,
          textAlign: 'center',
        }}>
          {MONTH_NAMES[month]} {year}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 6 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} style={{ aspectRatio: '1' }} />;

            const dateStr = fmtLocalDate(d);
            const isPast = d < today;
            const isToday = sameDate(d, today);
            const blockStatus = isDateBlocked(dateStr);
            const holiday = holidaysByDate[dateStr];
            const growthMoment = growthMomentsByDate[dateStr];
            const hasBookings = (bookingsByDate[dateStr] || 0) > 0;

            let bg = C.cream;
            let textColor = C.ink;
            let borderColor = 'transparent';
            let borderWidth = 1;
            if (isPast) {
              bg = C.creamSoft;
              textColor = C.inkDim;
            } else if (blockStatus) {
              bg = C.sage;
              textColor = C.forestDeep;
              borderColor = C.sageStrong;
            }
            if (isToday) {
              borderColor = C.forest;
              borderWidth = 2;
            }

            return (
              <button
                key={i}
                type="button"
                onClick={(e) => handleDayClick(dateStr, e)}
                disabled={isPast || pending}
                aria-label={`${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${blockStatus ? 'blocked' : 'available'}${holiday ? ', ' + holiday.name : ''}`}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  background: bg,
                  color: textColor,
                  border: `${borderWidth}px solid ${borderColor}`,
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: isToday ? 700 : (blockStatus ? 600 : 500),
                  fontFamily: 'inherit',
                  cursor: isPast ? 'not-allowed' : 'pointer',
                  opacity: isPast ? 0.55 : 1,
                  transition: 'background 0.12s, transform 0.08s',
                  WebkitTapHighlightColor: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  minHeight: 38,
                }}>
                {d.getDate()}
                {blockStatus?.type === 'recurring' && (
                  <span style={{
                    position: 'absolute',
                    bottom: 3, right: 3,
                    width: 6, height: 6,
                    borderRadius: '50%',
                    background: C.forest,
                  }} />
                )}
                {hasBookings && !blockStatus && (
                  <span style={{
                    position: 'absolute',
                    bottom: 3, right: 3,
                    width: 5, height: 5,
                    borderRadius: '50%',
                    background: C.forestSoft,
                  }} />
                )}
                {growthMoment && !isPast && (
                  <span style={{
                    position: 'absolute',
                    top: 2, right: 3,
                    fontSize: 11,
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

  // ─── Render: Popover ─────────────────────────────────────────────

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
          style={{ position: 'fixed', inset: 0, zIndex: 50 }}
        />
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
            fontSize: 12,
            fontWeight: 700,
            color: C.inkMute,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 8,
          }}>{dateLabel}</div>

          {holiday && (
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 10 }}>
              {holiday.name}
            </div>
          )}

          {growthMoment && (
            <div style={{
              background: C.goldSoft,
              border: `1px solid ${C.gold}`,
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.goldDeep, marginBottom: 4 }}>
                ★ {growthMoment.name}
              </div>
              <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.5, marginBottom: 8 }}>
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
                  background: C.forest,
                  color: C.white,
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  width: '100%',
                }}>
                Unblock just this day
              </button>
            </div>
          )}

          {!status?.type && (
            <button
              type="button"
              onClick={() => setPopover(null)}
              style={{
                background: C.creamSoft,
                color: C.ink,
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
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

  // ─── Render: Range modal ─────────────────────────────────────────

  function RangeModal() {
    if (!showRangeModal) return null;
    const todayStr = fmtLocalDate(today);
    return (
      <>
        <div
          onClick={() => setShowRangeModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(15, 23, 42, 0.4)',
          }}
        />
        <div style={{
          position: 'fixed',
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 101,
          background: C.white,
          borderRadius: 14,
          padding: 22,
          width: 'min(420px, 92vw)',
          boxShadow: '0 12px 40px rgba(15, 23, 42, 0.25)',
        }}>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: 18,
            fontWeight: 600,
            color: C.forestDeep,
            marginBottom: 6,
          }}>Block a date range</div>
          <div style={{ fontSize: 13, color: C.inkMute, marginBottom: 16, lineHeight: 1.5 }}>
            Use this for vacations or stretches of days off. Each day in the range will be blocked.
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.inkMute, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>From</label>
            <input
              type="date"
              value={rangeStart}
              min={todayStr}
              onChange={e => setRangeStart(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 14,
                border: `1.5px solid ${C.line}`,
                borderRadius: 8,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.inkMute, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>To</label>
            <input
              type="date"
              value={rangeEnd}
              min={rangeStart || todayStr}
              onChange={e => setRangeEnd(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 14,
                border: `1.5px solid ${C.line}`,
                borderRadius: 8,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => { setShowRangeModal(false); setRangeStart(''); setRangeEnd(''); }}
              style={{
                flex: 1,
                background: C.white,
                color: C.inkMute,
                border: `1.5px solid ${C.line}`,
                borderRadius: 10,
                padding: '11px 14px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}>Cancel</button>
            <button
              type="button"
              onClick={blockDateRange}
              disabled={!rangeStart || !rangeEnd || pending}
              style={{
                flex: 2,
                background: (!rangeStart || !rangeEnd || pending) ? C.line : C.forest,
                color: C.white,
                border: 'none',
                borderRadius: 10,
                padding: '11px 14px',
                fontSize: 14,
                fontWeight: 700,
                cursor: (!rangeStart || !rangeEnd || pending) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}>
              {pending ? 'Blocking...' : 'Block these days'}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ─── Render: Top-level ────────────────────────────────────────────

  return (
    <div>
      {HelpRow}
      {Coaching}
      {ActionBar}
      {AddRecurringForm}
      {RecurringPills}
      {HolidayPills}
      {Legend}

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
            border: `1.5px solid ${C.line}`,
            borderRadius: 999,
            padding: '8px 16px',
            fontSize: 13,
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
            border: `1.5px solid ${C.line}`,
            borderRadius: 999,
            padding: '8px 16px',
            fontSize: 13,
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
            border: `1.5px solid ${C.line}`,
            borderRadius: 999,
            padding: '8px 16px',
            fontSize: 13,
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

      <Popover />
      <RangeModal />
    </div>
  );
}
