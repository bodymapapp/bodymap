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
  // HK May 29 2026: replaced the per-tap "Book anyway?" confirm with a
  // visible toggle. HK feedback: "I don't quickly see a toggle to
  // schedule on day off." For our 70yo persona discoverability beats
  // efficiency; the toggle states the option upfront instead of making
  // her tap a struck-through cell to find it. When ON, off-days lose
  // the strikethrough and become tappable like regular days. When OFF
  // (default), off-days are clearly marked unavailable.
  const [includeOffDays, setIncludeOffDays] = useState(false);

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
    if (mo === 0) { setMo(11); setYr(y => y - 1); }
    else setMo(m => m - 1);
  }
  function nextMonth() {
    if (mo === 11) { setMo(0); setYr(y => y + 1); }
    else setMo(m => m + 1);
  }

  // Build the cell list for the current month
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const startWeekday = new Date(yr, mo, 1).getDay(); // 0 = Sun ... 6 = Sat
  const cells = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      {/* HK May 29 2026: visible 'Include my off days' toggle for
          therapist-facing surfaces. Discoverable upfront for our 70yo
          persona instead of hidden behind a per-tap confirm. Defaults
          OFF so accidentally tapping an off-day still does nothing
          (struck-through cell remains disabled). Flipping ON makes
          off-days tappable like regular days while keeping a subtle
          visual cue (light beige fill) that they're outside normal
          working hours. Client-facing surfaces don't see this toggle
          because allowOverrideOffDay defaults false. */}
      {allowOverrideOffDay && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px',
          marginBottom: 12,
          background: includeOffDays ? '#EEF3EE' : '#FAFAF7',
          border: `1.5px solid ${includeOffDays ? C.sage : C.light}`,
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.4, paddingRight: 12 }}>
            <strong style={{ color: includeOffDays ? C.forest : C.dark }}>
              Include my off days
            </strong>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
              {includeOffDays
                ? 'You can now tap any day, including days you normally do not work.'
                : 'Off days are disabled. Flip this on to book one anyway.'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={includeOffDays}
            onClick={() => setIncludeOffDays(v => !v)}
            style={{
              flexShrink: 0,
              width: 48, height: 28,
              borderRadius: 14,
              border: 'none',
              background: includeOffDays ? C.sage : '#D1D5DB',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.18s',
              fontFamily: 'inherit',
            }}>
            <span style={{
              position: 'absolute',
              top: 3, left: includeOffDays ? 23 : 3,
              width: 22, height: 22,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              transition: 'left 0.18s',
            }} />
          </button>
        </div>
      )}

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
          const bookingCount = bookingsByDate ? (bookingsByDate.get ? bookingsByDate.get(ds) : 0) || 0 : 0;
          const seriesIdx = seriesIndexFor ? seriesIndexFor(ds) : null;

          // Determine if cell is interactive.
          // Past, hard blocks (full-day, beyond horizon, before minimum) are always disabled.
          // Off-days are disabled unless allowOverrideOffDay=true AND the
          // visible 'Include my off days' toggle is ON.
          const hardDisabled = isPast || isFullDayBlock || beyondHorizon || beforeMinimum;
          const offDayUnlocked = dowExcluded && allowOverrideOffDay && includeOffDays;
          const softDisabled = dowExcluded && !offDayUnlocked;
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
            textColor = offDayUnlocked ? C.dark : C.offdayText;
            // Strikethrough only when off-day is locked (toggle OFF).
            // When toggle is ON, we keep the beige fill (subtle reminder
            // 'this is not your normal working day') but the number
            // reads cleanly so it doesn't feel disabled.
            textDecoration = offDayUnlocked ? 'none' : 'line-through';
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

          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(ds)}
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

      {/* "Service is offered on X only" helper (client-facing context) */}
      {isPartialSchedule && service && (
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
