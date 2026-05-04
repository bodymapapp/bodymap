// src/lib/cycleScheduling.js
//
// Pure helpers for cycle-aligned scheduling. Two callers:
//   1. Settings (CycleScheduling.jsx) — shows therapist what phase she's in
//      today and lets her customize phase day ranges
//   2. Public booking page (BookingPage.js) — filters service list by phase
//
// All math is timezone-tolerant: we compare dates by their YYYY-MM-DD
// portion in local time, never by UTC milliseconds, so a therapist on
// Mountain time who set her cycle_start_date to "2026-04-15" doesn't get
// shifted by 6 hours when the booking page renders for an East coast
// client.

const PHASES = ['menstrual', 'follicular', 'ovulatory', 'luteal'];

/**
 * Compute the proportional default phase day ranges for a given cycle
 * length. On a 28-day cycle the ranges are M:1-5, F:6-13, O:14-17, L:18-28.
 * For longer or shorter cycles we scale linearly so phases keep roughly
 * the same proportions.
 *
 * @param {number} cycleLength - length in days, e.g. 28
 * @returns {{ menstrual_end:number, follicular_end:number, ovulatory_end:number }}
 */
export function defaultPhaseRanges(cycleLength) {
  const len = Math.max(18, Math.min(60, parseInt(cycleLength, 10) || 28));
  return {
    menstrual_end:  Math.max(1, Math.round(len * 5  / 28)),
    follicular_end: Math.max(2, Math.round(len * 13 / 28)),
    ovulatory_end:  Math.max(3, Math.round(len * 17 / 28)),
    // luteal_end is implicitly cycle_length
  };
}

/**
 * Given a date and the therapist's cycle settings, return the current
 * phase + day-of-cycle. Caller is expected to already know the therapist
 * has cycle_scheduling_enabled == true and cycle_start_date is set.
 *
 * @param {Date|string} when - the target date (today, or a future booking date)
 * @param {string} startDateStr - therapist.cycle_start_date as 'YYYY-MM-DD'
 * @param {number} cycleLength - therapist.cycle_avg_length
 * @param {object|null} ranges - overrides or null (= use defaults)
 * @returns {{ phase: string, day: number, cycleNumber: number }}
 *          Throws if inputs are invalid.
 */
export function phaseFromDate(when, startDateStr, cycleLength, ranges) {
  if (!startDateStr) throw new Error('Cycle start date required');
  const len = Math.max(18, Math.min(60, parseInt(cycleLength, 10) || 28));

  // Both timestamps via local-noon to dodge DST/timezone drift.
  const target = (when instanceof Date) ? when : new Date(`${when}T12:00:00`);
  const start = new Date(`${startDateStr}T12:00:00`);
  const msPerDay = 86400000;
  const daysSince = Math.floor((target - start) / msPerDay);

  if (daysSince < 0) {
    // Booking is BEFORE the recorded cycle start. Walk backward by length
    // until we find which prior cycle they're in.
    const cyclesAgo = Math.ceil(-daysSince / len);
    const adjustedDay = ((daysSince % len) + len) % len + 1;
    return phaseFromDay(adjustedDay, len, ranges, -cyclesAgo);
  }

  const cycleNumber = Math.floor(daysSince / len); // 0 = current, 1 = next, ...
  const day = (daysSince % len) + 1; // 1-indexed
  return phaseFromDay(day, len, ranges, cycleNumber);
}

function phaseFromDay(day, cycleLength, ranges, cycleNumber) {
  const r = ranges || defaultPhaseRanges(cycleLength);
  let phase;
  if (day <= r.menstrual_end) phase = 'menstrual';
  else if (day <= r.follicular_end) phase = 'follicular';
  else if (day <= r.ovulatory_end) phase = 'ovulatory';
  else phase = 'luteal';
  return { phase, day, cycleNumber };
}

/**
 * Filter a service list down to only those available in the given phase.
 * A service is available if its `phases` column is null/empty (always
 * available, backward compatible) OR includes the current phase.
 *
 * @param {Array} services
 * @param {string} currentPhase - one of menstrual/follicular/ovulatory/luteal
 * @returns {Array} filtered services
 */
export function filterServicesByPhase(services, currentPhase) {
  if (!currentPhase) return services;
  return services.filter(svc => {
    if (!svc.phases || svc.phases.length === 0) return true; // always available
    return svc.phases.includes(currentPhase);
  });
}

/**
 * Convenience wrapper: given a therapist row + service list + target date,
 * return the services the client should see. If cycle scheduling is OFF
 * or misconfigured, returns the original list unchanged.
 */
export function applyCycleFilter(therapist, services, when = new Date()) {
  if (!therapist?.cycle_scheduling_enabled) return services;
  if (!therapist.cycle_start_date) return services;
  try {
    const { phase } = phaseFromDate(
      when,
      therapist.cycle_start_date,
      therapist.cycle_avg_length || 28,
      therapist.cycle_phase_overrides
    );
    return filterServicesByPhase(services, phase);
  } catch (err) {
    console.warn('Cycle filter skipped:', err.message);
    return services;
  }
}

export const CYCLE_PHASES = PHASES;
