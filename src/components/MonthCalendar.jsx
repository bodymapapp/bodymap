// src/components/MonthCalendar.jsx
//
// THE single date picker for the platform. See docs/CALENDAR_UX_SPEC.md
// for the contract. Do not fork. Do not build a second one. If you
// need a new behavior, add a prop here and update the spec.
//
// HK May 27 2026: extracted from BookingPage's inline Cal function so
// every date picker on the platform could share it.
// HK May 29 2026: enhanced to support the therapist BookingModal use
// case (multi-select for series, sage dots for existing bookings,
// off-day override). Replaced the briefly-shipped SelectableMonthView.
//
// PROPS
//
//   Required
//     selected           string | string[]   ISO date, or array of ISO dates in multi mode
//     onSelect           (iso) => void       single: replace; multi: toggle in/out
//
//   Context
//     availability       [{day_of_week:0..6,...}]  therapist working days
//     service            optional service obj for the "offered on X only" helper
//     blockedDates       Set<iso>            full-day blocks (PTO, closed)
//     partialBlockedDates Set<iso>           partial-day blocks (shows tag, still selectable)
//     bookingsByDate     Map<iso, number>    count of existing bookings per date
//     maxDate / minDate  Date                bounds
//
//   Mode
//     mode               'single' | 'multi'  default 'single'
//     seriesIndexFor     (iso) => number|null  shows 1,2,3... badge in multi mode
//     allowOverrideOffDay  boolean           default false; therapist:true, client:false
//
//   Initial view
//     initialYear / initialMonth  override starting view (defaults to today)

import React, { useState, useMemo } from 'react';

const C = {
  forest: '#2A5741',
  sage: '#6B9E80',
  sageBg: '#EEF3EE',
  white: '#FFFFFF',
  dark: '#1A1A2E',
  gray: '#6B7280',
  light: '#E8E4DC',
  cream: '#F5F0E8',
  amber: '#92400E',
  amberBg: '#FEF3C7',
  amberHash: 'repeating-linear-gradient(45deg, #FEF3C7, #FEF3C7 4px, #FDE68A 4px, #FDE68A 8px)',
  offdayFill: '#F8F4EC',
  offdayText: '#9CA3AF',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_LABELS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function isoFor(yr, mo, day) {
  return `${yr}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function MonthCalendar({
  // selection
  selected,
  onSelect,
  // context
  availability = [],
  service = null,
  blockedDates = new Set(),
  partialBlockedDates = new Set(),
  bookingsByDate = null,
  maxDate = null,
  minDate = null,
  // mode
  mode = 'single',
  seriesIndexFor = null,
  allowOverrideOffDay = false,
  // initial view
  initialYear = null,
  initialMonth = null,
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [yr, setYr] = useState(initialYear ?? today.getFullYear());
  const [mo, setMo] = useState(initialMonth ?? today.getMonth());
  const [overrideCandidate, setOverrideCandidate] = useState(null); // ISO of an off-day tapped, pending confirm

  // Memoize a Set of selected ISOs so cell lookups are O(1) whether
  // single or multi mode.
  const selectedSet = useMemo(() => {
    if (mode === 'multi' && Array.isArray(selected)) return new Set(selected);
    if (typeof selected === 'string' && selected) return new Set([selected]);
    return new Set();
  }, [mode, selected]);

  const avDows = availability.map(a => a.day_of_week);
  const offeredDows = [...new Set(avDows)].sort((a, b) => a - b);
  const isPartialSchedule = offeredDows.length > 0 && offeredDows.length < 7;
  const offeredLabel = (() => {
    if (offeredDows.length === 1) return DAY_LABELS_LONG[offeredDows[0]];
    if (offeredDows.length === 2) return `${DAY_LABELS_LONG[offeredDows[0]]} and ${DAY_LABELS_LONG[offeredDows[1]]}`;
    return offeredDows.map(d => DAY_LABELS_LONG[d].slice(0, 3)).join(', ');
  })();

  function prevMonth() {
    setOverrideCandidate(null);
    if (mo === 0) { setMo(11); setYr(y => y - 1); }
    else setMo(m => m - 1);
  }
  function nextMonth() {
    setOverrideCandidate(null);
    if (mo === 11) { setMo(0); setYr(y => y + 1); }
    else setMo(m => m + 1);
  }

  function handleTap(iso, dowExcluded) {
    if (dowExcluded && allowOverrideOffDay) {
      // Surface the inline confirm rather than selecting immediately.
      setOverrideCandidate(iso);
      return;
    }
    onSelect(iso);
  }

  function confirmOverride() {
    if (!overrideCandidate) return;
    onSelect(overrideCandidate);
    setOverrideCandidate(null);
  }

  // Build the cell list for the current month
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const startWeekday = new Date(yr, mo, 1).getDay(); // 0 = Sun ... 6 = Sat
  const cells = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Format the override-candidate banner date in plain English.
  const overrideLabel = (() => {
    if (!overrideCandidate) return '';
    const [y, m, d] = overrideCandidate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  })();

  return (
    <div>
      {/* Month nav: chevron-prev / "Month Year" / chevron-next */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button
          type="button"
          onClick={prevMonth}
          aria-label="Previous month"
          style={{
            background: 'none', border: `1px solid ${C.light}`,
            borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
            fontSize: 15, color: C.dark, fontFamily: 'inherit',
          }}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.dark, fontFamily: 'Georgia, serif' }}>
          {MONTHS[mo]} {yr}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          aria-label="Next month"
          style={{
            background: 'none', border: `1px solid ${C.light}`,
            borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
            fontSize: 15, color: C.dark, fontFamily: 'inherit',
          }}>›</button>
      </div>

      {/* Weekday header row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 6 }}>
        {DAY_LABELS.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.gray, padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} style={{ minHeight: 44 }} />;

          const dt = new Date(yr, mo, d);
          dt.setHours(0, 0, 0, 0);
          const ds = isoFor(yr, mo, d);
          const isToday = dt.toDateString() === today.toDateString();
          const isPast = dt < today;
          const beyondHorizon = maxDate && dt > maxDate;
          const beforeMinimum = minDate && dt < minDate;
          const dowExcluded = avDows.length > 0 && !avDows.includes(dt.getDay());
          const isFullDayBlock = blockedDates.has ? blockedDates.has(ds) : false;
          const isPartialBlock = partialBlockedDates.has ? partialBlockedDates.has(ds) : false;
          const isSelected = selectedSet.has(ds);
          const isOverrideCandidate = overrideCandidate === ds;
          const bookingCount = bookingsByDate ? (bookingsByDate.get ? bookingsByDate.get(ds) : 0) || 0 : 0;
          const seriesIdx = seriesIndexFor ? seriesIndexFor(ds) : null;

          // Determine if cell is interactive
          // Past, hard blocks (full-day, beyond horizon, before minimum) are always disabled.
          // Off-days are disabled UNLESS allowOverrideOffDay is true.
          const hardDisabled = isPast || isFullDayBlock || beyondHorizon || beforeMinimum;
          const softDisabled = dowExcluded && !allowOverrideOffDay;
          const disabled = hardDisabled || softDisabled;

          // Resolve visual style. Selection wins over everything else.
          let background = C.white;
          let textColor = C.dark;
          let borderColor = 'transparent';
          let opacity = 1;
          let textDecoration = 'none';

          if (isPast) {
            opacity = 0.4;
          } else if (isFullDayBlock) {
            background = C.amberHash;
            textColor = C.amber;
            opacity = 0.7;
          } else if (dowExcluded) {
            background = C.offdayFill;
            textColor = C.offdayText;
            textDecoration = 'line-through';
          } else if (bookingCount > 0) {
            background = '#F4F8F5';
          }

          if (isToday && !isSelected) {
            borderColor = C.sage;
          }

          if (isSelected) {
            background = C.forest;
            textColor = C.white;
            borderColor = C.forest;
            opacity = 1;
            textDecoration = 'none';
          }

          if (isOverrideCandidate && !isSelected) {
            borderColor = C.sage;
            background = C.sageBg;
          }

          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => handleTap(ds, dowExcluded)}
              aria-label={`${dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${dowExcluded ? ', off day' : ''}${isFullDayBlock ? ', blocked' : ''}${bookingCount > 0 ? `, ${bookingCount} booking${bookingCount === 1 ? '' : 's'}` : ''}`}
              style={{
                position: 'relative',
                minHeight: 44,
                padding: '6px 2px 4px',
                borderRadius: 8,
                border: `1.5px solid ${borderColor}`,
                background,
                color: textColor,
                opacity,
                fontSize: 13,
                fontWeight: isSelected || isToday ? 700 : 500,
                cursor: disabled ? 'not-allowed' : 'pointer',
                textDecoration,
                transition: 'all 0.1s',
                fontFamily: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <span>{d}</span>

              {/* Sage dots for existing bookings, up to 3, then +N */}
              {bookingCount > 0 && !isSelected && (
                <div style={{ display: 'flex', gap: 2, marginTop: 4, alignItems: 'center' }}>
                  {Array.from({ length: Math.min(bookingCount, 3) }).map((_, di) => (
                    <span key={di} style={{
                      width: 4, height: 4, borderRadius: '50%',
                      background: C.sage, display: 'inline-block',
                    }} />
                  ))}
                  {bookingCount > 3 && (
                    <span style={{ fontSize: 8, color: C.gray, lineHeight: 1, marginLeft: 1 }}>
                      +{bookingCount - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Partial-block tag */}
              {isPartialBlock && !isFullDayBlock && !isSelected && (
                <span style={{
                  position: 'absolute', bottom: 2, right: 3,
                  fontSize: 7, color: C.amber, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  blk
                </span>
              )}

              {/* Series-index badge top-right when selected as part of a multi series */}
              {seriesIdx != null && isSelected && (
                <span style={{
                  position: 'absolute', top: 2, right: 3,
                  background: C.white, color: C.forest,
                  fontSize: 9, fontWeight: 700,
                  borderRadius: 8, padding: '1px 5px', lineHeight: 1.2,
                }}>
                  {seriesIdx}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Off-day override confirm banner */}
      {overrideCandidate && (
        <div style={{
          marginTop: 12,
          padding: '12px 14px',
          background: C.sageBg,
          border: `1.5px solid ${C.sage}`,
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.5, marginBottom: 10 }}>
            <strong>{overrideLabel}</strong> is normally an off day. Book this date anyway?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setOverrideCandidate(null)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8,
                border: `1.5px solid ${C.light}`,
                background: C.white, color: C.gray,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
              Pick another day
            </button>
            <button
              type="button"
              onClick={confirmOverride}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8,
                border: 'none',
                background: C.sage, color: C.white,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
              Book anyway
            </button>
          </div>
        </div>
      )}

      {/* "Service is offered on X only" helper (client-facing context) */}
      {isPartialSchedule && service && !overrideCandidate && (
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          background: '#F0FDF4',
          border: '1px solid #C9DCC2',
          borderRadius: 8,
          fontSize: 11,
          color: '#2A5741',
          lineHeight: 1.5,
        }}>
          <strong>{service.name}</strong> is offered on {offeredLabel} only.
        </div>
      )}
    </div>
  );
}
