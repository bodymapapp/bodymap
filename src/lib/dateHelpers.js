// src/lib/dateHelpers.js
//
// Date-only string helpers. PG `date` columns return values like
// '2026-06-01' is a calendar dates, not timestamps, not tied to any
// timezone. The JavaScript Date constructor is famously hostile to
// these. Two common patterns and what they do:
//
//   new Date('2026-06-01')              // UTC midnight. In Central
//                                       // (UTC-5), this is May 31 7pm
//                                       // local. Day shifts back one.
//
//   new Date('2026-06-01T00:00:00Z')   // Same as above. Explicit UTC.
//                                       // Same bug for non-UTC users.
//
//   new Date('2026-06-01T00:00:00')    // Midnight LOCAL time. Correct
//                                       // calendar day, but rounding
//                                       // at midnight can still slip
//                                       // by a day under DST changes.
//
//   new Date('2026-06-01T12:00:00')    // Noon local time. Same calendar
//                                       // day everywhere. Safest.
//
// HK May 23 2026 (Jacquie incident): every booking_date in the app
// was rendering one day earlier than stored for therapists west of
// UTC because ProfileHeader.jsx and several other call sites used
// the UTC midnight pattern.

/**
 * Parse a date-only ISO string (YYYY-MM-DD) into a Date at noon local time.
 * Safe for weekday / month / day rendering. Do NOT use for timestamps.
 *
 * @param {string} iso - 'YYYY-MM-DD' or longer ISO string
 * @returns {Date|null}
 */
export function parseDateOnly(iso) {
  if (!iso || typeof iso !== 'string') return null;
  // Trim time component if present, then add noon local.
  const dateOnly = iso.slice(0, 10);
  const d = new Date(dateOnly + 'T12:00:00');
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a date-only ISO string as a weekday + month + day for display.
 *   '2026-06-01' -> 'Monday, Jun 1'
 *
 * @param {string} iso
 * @param {object} [opts] - extends Intl.DateTimeFormat options
 * @returns {string}
 */
export function formatDateOnlyHuman(iso, opts = {}) {
  const d = parseDateOnly(iso);
  if (!d) return '';
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...opts,
  });
}

/**
 * Compute the number of full days between today and a date-only ISO string,
 * using local-time semantics so day boundaries are honest.
 *
 * Returns positive if the iso date is in the past, negative if in the future.
 *
 * @param {string} iso
 * @returns {number|null}
 */
export function daysSinceDateOnly(iso) {
  const d = parseDateOnly(iso);
  if (!d) return null;
  const now = new Date();
  now.setHours(12, 0, 0, 0); // normalize to noon today
  const diffMs = now.getTime() - d.getTime();
  return Math.floor(diffMs / 86400000);
}

/**
 * Today as YYYY-MM-DD in local time. Use this when comparing against
 * a date-only string from the DB, never `new Date().toISOString().slice(0,10)`
 * which gives UTC date and is off by one for users west of UTC after their
 * local 7pm (or so).
 *
 * @returns {string}
 */
export function todayLocalIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Tomorrow as YYYY-MM-DD in local time. Same caveat as todayLocalIso.
 *
 * @returns {string}
 */
export function tomorrowLocalIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
