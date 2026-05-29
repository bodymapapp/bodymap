// src/components/SelectableMonthView.jsx
//
// HK May 29 2026: a date picker shaped like the therapist's calendar.
// Used inside BookingModal (and any other date input that benefits
// from showing busy/blocked context) as a replacement for the stock
// <input type="date">. Same visual language as the Schedule monthly
// view: colors, blocked-time shading, booking chips, plus selection
// state and an optional series-index pill on each selected cell.
//
// Props:
//   therapist        - therapist row (used for therapist_id lookups)
//   mode             - 'single' or 'series'
//   selectedDates    - string[] of ISO yyyy-mm-dd dates currently selected
//   onSelectDate     - (iso) => void   called on tap of a free or already-selected cell
//   seriesIndexFor   - optional (iso) => number | null, returns the
//                      "1 of 6" position for that date in the current series
//   monthsToShow     - default 3, how many months to render scrolling vertically

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const C = {
  cream: '#FAF6EE',
  white: '#fff',
  forest: '#2A5741',
  sage: '#6B9E80',
  sageBg: '#EEF3EE',
  ink: '#1F2937',
  inkSoft: '#6B7280',
  inkMute: '#9CA3AF',
  line: '#E5E7EB',
  amber: '#92400E',
  amberBg: '#FFFBEB',
  amberHash: 'repeating-linear-gradient(45deg, #FEF3C7, #FEF3C7 4px, #FDE68A 4px, #FDE68A 8px)',
  rose: '#DC2626',
  todayRing: '#2A5741',
};

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthLabel(d) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function weekdayLabel(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

export default function SelectableMonthView({
  therapist,
  mode = 'single',
  selectedDates = [],
  onSelectDate,
  seriesIndexFor,
  monthsToShow = 3,
}) {
  const [bookings, setBookings] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const monthStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(1);
    return d;
  }, [today]);

  const lastIso = useMemo(() => {
    const d = new Date(monthStart);
    d.setMonth(d.getMonth() + monthsToShow);
    return isoDate(d);
  }, [monthStart, monthsToShow]);

  // Pull bookings + blocked_days for the visible window. Cheap query,
  // therapist_id-filtered. Refetched once on mount (the modal lifetime
  // is short, no need for live subscriptions here).
  useEffect(() => {
    if (!therapist?.id) return;
    let alive = true;
    (async () => {
      const startIso = isoDate(monthStart);
      const [{ data: bData }, { data: blData }] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, booking_date, start_time, services(name), client_name, status')
          .eq('therapist_id', therapist.id)
          .gte('booking_date', startIso)
          .lte('booking_date', lastIso)
          .neq('status', 'cancelled')
          .order('start_time', { ascending: true }),
        supabase
          .from('blocked_days')
          .select('date, start_time, end_time, note')
          .eq('therapist_id', therapist.id)
          .gte('date', startIso)
          .lte('date', lastIso),
      ]);
      if (!alive) return;
      setBookings(bData || []);
      setBlocked(blData || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [therapist?.id, monthStart, lastIso]);

  const byDate = useMemo(() => {
    const m = new Map();
    for (const b of bookings) {
      if (!b.booking_date) continue;
      if (!m.has(b.booking_date)) m.set(b.booking_date, []);
      m.get(b.booking_date).push(b);
    }
    return m;
  }, [bookings]);

  const blockedByDate = useMemo(() => {
    const m = new Map();
    for (const b of blocked) {
      if (!b.date) continue;
      if (!m.has(b.date)) m.set(b.date, []);
      m.get(b.date).push(b);
    }
    return m;
  }, [blocked]);

  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates]);

  function buildMonth(offset) {
    const monthFirst = new Date(monthStart);
    monthFirst.setMonth(monthFirst.getMonth() + offset);
    const daysInMonth = new Date(monthFirst.getFullYear(), monthFirst.getMonth() + 1, 0).getDate();

    // Calendar grid: 7-column. Pad the first week with empty cells.
    const startWeekday = monthFirst.getDay(); // 0=Sun
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(monthFirst.getFullYear(), monthFirst.getMonth(), day);
      cells.push(d);
    }
    return { label: monthLabel(monthFirst), cells };
  }

  const months = useMemo(
    () => Array.from({ length: monthsToShow }, (_, i) => buildMonth(i)),
    [monthsToShow, monthStart] // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!therapist?.id) {
    return <div style={{ padding: 16, color: C.inkSoft, fontSize: 13 }}>No therapist context.</div>;
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Weekday header (sticky-ish) */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 2, padding: '0 2px 6px',
        fontSize: 10, fontWeight: 700, color: C.inkSoft,
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(w => (
          <div key={w} style={{ textAlign: 'center' }}>{w}</div>
        ))}
      </div>

      {loading && (
        <div style={{ padding: 16, color: C.inkMute, fontSize: 13, textAlign: 'center' }}>
          Loading your calendar...
        </div>
      )}

      {!loading && months.map((m, mi) => (
        <div key={mi} style={{ marginBottom: 16 }}>
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700,
            color: C.forest, margin: '8px 2px 6px',
          }}>
            {m.label}
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 4,
          }}>
            {m.cells.map((d, ci) => {
              if (!d) return <div key={`e${ci}`} />;
              const iso = isoDate(d);
              const isPast = d < today;
              const isToday = +d === +today;
              const dayBookings = byDate.get(iso) || [];
              const dayBlocks = blockedByDate.get(iso) || [];
              const isFullDayBlock = dayBlocks.some(b => !b.start_time);
              const isPartialBlock = dayBlocks.some(b => b.start_time);
              const isSelected = selectedSet.has(iso);
              const seriesIdx = seriesIndexFor ? seriesIndexFor(iso) : null;

              const baseBg = isPast ? '#F9FAFB'
                : isFullDayBlock ? C.amberHash
                : dayBookings.length > 0 ? '#F0F9F4'
                : C.white;
              const ringStyle = isSelected
                ? { boxShadow: `inset 0 0 0 2.5px ${C.sage}`, background: C.sageBg }
                : isToday
                ? { boxShadow: `inset 0 0 0 2px ${C.todayRing}` }
                : {};
              const interactable = !isPast;

              return (
                <button
                  key={iso}
                  onClick={() => interactable && onSelectDate && onSelectDate(iso)}
                  disabled={!interactable}
                  style={{
                    position: 'relative',
                    aspectRatio: '1 / 1.1',
                    background: baseBg,
                    border: `1px solid ${C.line}`,
                    borderRadius: 8,
                    padding: 4,
                    cursor: interactable ? 'pointer' : 'not-allowed',
                    opacity: isPast ? 0.4 : 1,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    fontFamily: 'inherit',
                    WebkitTapHighlightColor: 'transparent',
                    ...ringStyle,
                  }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: isToday || isSelected ? 700 : 600,
                    color: isSelected ? C.forest : isToday ? C.forest : C.ink,
                    lineHeight: 1,
                  }}>
                    {d.getDate()}
                  </div>

                  {/* Mini chips: at most 3 booking dots, then "+N" */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 4, minHeight: 6 }}>
                    {dayBookings.slice(0, 3).map((b, bi) => (
                      <span key={bi} style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: C.sage, display: 'inline-block',
                      }} />
                    ))}
                    {dayBookings.length > 3 && (
                      <span style={{ fontSize: 8, color: C.inkSoft, lineHeight: 1 }}>+{dayBookings.length - 3}</span>
                    )}
                  </div>

                  {isPartialBlock && !isFullDayBlock && (
                    <div style={{
                      position: 'absolute', bottom: 3, right: 3,
                      fontSize: 8, color: C.amber, fontWeight: 700,
                    }}>
                      blocked
                    </div>
                  )}
                  {isFullDayBlock && (
                    <div style={{
                      position: 'absolute', bottom: 3, left: 3, right: 3,
                      fontSize: 8, color: C.amber, fontWeight: 700, textAlign: 'center',
                    }}>
                      off
                    </div>
                  )}

                  {seriesIdx != null && (
                    <div style={{
                      position: 'absolute', top: 3, right: 3,
                      background: C.forest, color: '#fff',
                      fontSize: 9, fontWeight: 700,
                      borderRadius: 8, padding: '1px 5px', lineHeight: 1.2,
                    }}>
                      {seriesIdx}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!loading && mode === 'series' && (
        <div style={{
          fontSize: 11, color: C.inkSoft, padding: '4px 4px 10px', lineHeight: 1.55,
        }}>
          Tap any free cell to add a date. Tap a sage cell to drop it.
        </div>
      )}
    </div>
  );
}
