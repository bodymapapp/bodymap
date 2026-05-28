// src/components/MonthCalendar.jsx
//
// HK May 27 2026: shared monthly calendar date picker. Extracted from
// the Cal function that lived inside BookingPage so the bulk session
// scheduler (and, per BLOCK_PLAN, eventually every date picker on the
// platform) can use the same monthly grid instead of a horizontal
// scrolling chip strip, which HK flagged as a bad experience.
//
// Behaviour is identical to the original Cal:
//   - month grid, prev/next month arrows
//   - days the service is not offered on are struck through + faded
//   - past days, days before a lead-time minimum, and days beyond a
//     booking horizon are disabled
//   - blockedDates (fully booked / time off) are disabled
//   - the partial-schedule helper note explains greyed days
//
// Props:
//   availability  : array of { day_of_week, ... }
//   service       : the selected service (for the helper note only)
//   selected      : 'YYYY-MM-DD' currently picked, or ''
//   onSelect      : (isoDate) => void
//   blockedDates  : Set of 'YYYY-MM-DD' that are unavailable
//   maxDate/minDate: optional Date bounds

import React, { useState } from 'react';

const C = { forest: '#2A5741', sage: '#6B9E80', white: '#FFFFFF', dark: '#1A1A2E', gray: '#6B7280', light: '#E8E4DC' };

export default function MonthCalendar({ availability = [], service = null, selected, onSelect, blockedDates = new Set(), maxDate = null, minDate = null }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [yr, setYr] = useState(today.getFullYear());
  const [mo, setMo] = useState(today.getMonth());
  const avDows = availability.map(a => a.day_of_week);
  const days = new Date(yr, mo + 1, 0).getDate();
  const offset = (() => { const d = new Date(yr, mo, 1).getDay(); return d === 0 ? 6 : d - 1; })();
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayLabelsLong = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const offeredDows = [...new Set(avDows)].sort((a, b) => a - b);
  const isPartialSchedule = offeredDows.length > 0 && offeredDows.length < 7;
  const offeredLabel = (() => {
    if (offeredDows.length === 1) return dayLabelsLong[offeredDows[0]];
    if (offeredDows.length === 2) return `${dayLabelsLong[offeredDows[0]]} and ${dayLabelsLong[offeredDows[1]]}`;
    return offeredDows.map(d => dayLabels[d]).join(', ');
  })();
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={() => mo === 0 ? [setMo(11), setYr(y => y - 1)] : setMo(m => m - 1)} style={{ background: 'none', border: `1px solid ${C.light}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 15, color: C.dark, fontFamily: 'inherit' }}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 600, color: C.dark }}>{MONTHS[mo]} {yr}</span>
        <button onClick={() => mo === 11 ? [setMo(0), setYr(y => y + 1)] : setMo(m => m + 1)} style={{ background: 'none', border: `1px solid ${C.light}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 15, color: C.dark, fontFamily: 'inherit' }}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 6 }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.gray, padding: '4px 0' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dt = new Date(yr, mo, d); dt.setHours(0, 0, 0, 0);
          const ds = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const nowTime = new Date();
          const isToday2 = dt.toDateString() === today.toDateString();
          const pastLastSlot = isToday2 && nowTime.getHours() >= 17;
          const beyondHorizon = maxDate && dt > maxDate;
          const beforeMinimum = minDate && dt < minDate;
          const dowExcluded = !avDows.includes(dt.getDay());
          const disabled = dowExcluded || dt < today || pastLastSlot || blockedDates.has(ds) || beyondHorizon || beforeMinimum;
          const isSel = selected === ds, isToday = dt.toDateString() === today.toDateString();
          return <button key={i} disabled={disabled} onClick={() => onSelect(ds)}
            style={{
              padding: '9px 2px',
              borderRadius: 8,
              border: `1.5px solid ${isSel ? C.forest : isToday ? C.sage : 'transparent'}`,
              background: isSel ? C.forest : 'transparent',
              color: isSel ? C.white : disabled ? '#C7CACF' : isToday ? C.forest : C.dark,
              opacity: disabled ? 0.55 : 1,
              fontSize: 13,
              fontWeight: isSel || isToday ? 700 : 400,
              cursor: disabled ? 'not-allowed' : 'pointer',
              textDecoration: dowExcluded ? 'line-through' : 'none',
              transition: 'all 0.1s',
              fontFamily: 'inherit',
            }}>
            {d}
          </button>;
        })}
      </div>
      {isPartialSchedule && service && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: '#F0FDF4', border: '1px solid #C9DCC2', borderRadius: 8, fontSize: 11, color: '#2A5741', lineHeight: 1.5 }}>
          <strong>{service.name}</strong> is offered on {offeredLabel} only.
        </div>
      )}
    </div>
  );
}
