// src/lib/insights/deepInsights.js
//
// Care-framed growth insights for the Schedule view (HK May 22 2026
// Tier 4 of A-J expansion). Replaces the previous shallow strategy
// suggestions (cluster slots, offer 90-min sessions) with deeper
// data-grounded prompts.
//
// Design principles (per HK direction):
//   - No money emphasis. The 70yo persona thinks relationally,
//     not transactionally. Frame insights as care + growth, not
//     dollars + revenue.
//   - Industry-grounded. Each insight cites a pattern from massage
//     therapy practice management research, not a vibes-based tip.
//   - Conditional. Each insight returns null unless the data
//     actually warrants it. We never show 'consider X' when X has
//     no signal.
//   - Specific. Insights name the client(s) and the days. 'Linda
//     and James haven't been by in 30+ days' beats 'some clients
//     are lapsing.'
//
// Each computeXxx function takes (appointments, clientsById, today)
// and returns either null or an Insight:
//   {
//     id, icon, title, why, action, wired,
//     clients?: [{ id, name, daysSinceLast?, ... }],
//   }
//
// The card surface calls all 7 and renders whichever ones return
// non-null. Cap at 4 shown so the UI doesn't drown the therapist.

const MS_PER_DAY = 86400000;
const dayDiff = (a, b) => Math.round((a - b) / MS_PER_DAY);

// Helper: bucket appointments by clientId and sort each list by date.
function byClient(apps) {
  const m = new Map();
  for (const a of apps) {
    if (!a.clientId || a.preview || a.external) continue;
    if (!m.has(a.clientId)) m.set(a.clientId, { id: a.clientId, name: a.client, dates: [] });
    m.get(a.clientId).dates.push(a.date.getTime());
  }
  for (const v of m.values()) v.dates.sort((x, y) => x - y);
  return m;
}

// Insight A: First-session check-in window.
// Catches clients whose first session was 7-21 days ago and who
// haven't booked a second. Industry: first-to-second conversion
// is the make-or-break retention metric. Window 7-21 days is when
// a soft check-in feels caring, not pushy.
export function computeFirstSessionCheckIn(appointments, today) {
  if (!appointments?.length) return null;
  const map = byClient(appointments);
  const candidates = [];
  for (const c of map.values()) {
    // Only one session ever, between 7 and 21 days ago
    if (c.dates.length !== 1) continue;
    const days = dayDiff(today, new Date(c.dates[0]));
    if (days < 7 || days > 21) continue;
    candidates.push({ id: c.id, name: c.name, daysSinceFirst: days });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.daysSinceFirst - a.daysSinceFirst);
  const top = candidates.slice(0, 3);
  const lead = top[0];
  return {
    id: 'first_session_checkin',
    icon: '🌱',
    title: candidates.length === 1
      ? `Check in with ${lead.name.split(' ')[0]}`
      : `Check in with ${candidates.length} new clients`,
    why: `${lead.name.split(' ')[0]}'s first session was ${lead.daysSinceFirst} days ago. A warm note now often makes a second visit feel less like a question and more like coming home.`,
    action: 'first_session_checkin',
    actionPayload: { clients: top },
    wired: true,
    clients: top,
  };
}

// Insight B: Cadence drift.
// Catches regulars (4+ visits) whose typical rhythm has slipped.
// "Mary's pattern is every 4 weeks. She's at 6." Personalizes the
// existing lapsed-regulars concept with each client's own cadence,
// not a generic 30-day threshold.
export function computeCadenceDrift(appointments, today) {
  if (!appointments?.length) return null;
  const map = byClient(appointments);
  const candidates = [];
  for (const c of map.values()) {
    if (c.dates.length < 4) continue;
    // Compute average gap between consecutive visits, in days
    const gaps = [];
    for (let i = 1; i < c.dates.length; i++) {
      gaps.push((c.dates[i] - c.dates[i-1]) / MS_PER_DAY);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (avgGap < 7 || avgGap > 90) continue; // skip irregular patterns
    const lastVisit = new Date(c.dates[c.dates.length - 1]);
    const daysSince = dayDiff(today, lastVisit);
    // Fire when client is at 1.5x their normal cadence
    if (daysSince < avgGap * 1.5) continue;
    if (daysSince > avgGap * 4) continue; // truly gone, separate insight (D)
    candidates.push({
      id: c.id, name: c.name,
      avgGap: Math.round(avgGap),
      daysSinceLast: daysSince,
    });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.daysSinceLast / b.avgGap) - (a.daysSinceLast / a.avgGap));
  const top = candidates.slice(0, 3);
  const lead = top[0];
  return {
    id: 'cadence_drift',
    icon: '↻',
    title: candidates.length === 1
      ? `${lead.name.split(' ')[0]}'s rhythm has slipped`
      : `${candidates.length} regulars off their rhythm`,
    why: `${lead.name.split(' ')[0]} usually comes every ${lead.avgGap} days. It has been ${lead.daysSinceLast}. A brief note often lands well at this window.`,
    action: 'cadence_drift',
    actionPayload: { clients: top },
    wired: true,
    clients: top,
  };
}

// Insight C: Open time today, care-framed.
// Reframes 'X hours open today' away from money. For the 70yo
// persona, 4 open hours is space to welcome 4 returning clients,
// not $480 of unrealized revenue.
export function computeOpenTimeCare(openHoursToday) {
  if (!openHoursToday || openHoursToday < 1) return null;
  const wholeHours = Math.floor(openHoursToday);
  // Most sessions in massage are 60 min, so hours-open ≈ client capacity
  const capacity = wholeHours;
  if (capacity === 0) return null;
  return {
    id: 'open_time_care',
    icon: '🍃',
    title: `Room for ${capacity} ${capacity === 1 ? 'client' : 'clients'} today`,
    why: `About the time it takes to welcome ${capacity} ${capacity === 1 ? 'familiar face' : 'familiar faces'} back to your table. Worth reaching out to anyone you have been thinking about.`,
    action: null,
    wired: false,
  };
}

// Insight D: Top clients have gone quiet.
// Top-by-frequency clients (heaviest 20%) who haven't booked in
// 30+ days. The 80/20 risk most solo therapists never see because
// they're busy with the bookings on their calendar, not the ones
// missing from it.
export function computeTopClientsQuiet(appointments, today) {
  if (!appointments?.length) return null;
  const map = byClient(appointments);
  const clients = [...map.values()];
  if (clients.length < 5) return null;
  // Top 20% by visit count (min 3 visits to qualify)
  const sorted = clients.sort((a, b) => b.dates.length - a.dates.length);
  const cutoff = Math.max(3, Math.ceil(clients.length * 0.2));
  const topClients = sorted.slice(0, cutoff).filter(c => c.dates.length >= 3);
  if (topClients.length === 0) return null;
  const quiet = topClients
    .map(c => ({
      id: c.id,
      name: c.name,
      daysSinceLast: dayDiff(today, new Date(c.dates[c.dates.length - 1])),
      visitCount: c.dates.length,
    }))
    .filter(c => c.daysSinceLast >= 30 && c.daysSinceLast < 120)
    .sort((a, b) => b.daysSinceLast - a.daysSinceLast);
  if (quiet.length === 0) return null;
  const top = quiet.slice(0, 3);
  const lead = top[0];
  return {
    id: 'top_clients_quiet',
    icon: '✨',
    title: quiet.length === 1
      ? `${lead.name.split(' ')[0]} has been away`
      : `${quiet.length} of your most-frequent clients are quiet`,
    why: `${lead.name.split(' ')[0]} has come ${lead.visitCount} times but has not been by in ${lead.daysSinceLast} days. The clients who come most often are also the ones whose absence usually means something.`,
    action: 'top_clients_quiet',
    actionPayload: { clients: top },
    wired: true,
    clients: top,
  };
}

// Insight E: Day-of-week imbalance.
// One day is regularly full, another is regularly empty. Suggest
// offering regulars who book the busy day a slot on the quiet day.
// Last 60 days of data.
export function computeDayOfWeekImbalance(appointments, today) {
  if (!appointments?.length) return null;
  const cutoff = new Date(today.getTime() - 60 * MS_PER_DAY);
  const recent = appointments.filter(a => a.date >= cutoff && !a.preview && !a.external);
  if (recent.length < 20) return null; // need enough data
  const byDay = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
  recent.forEach(a => { byDay[a.date.getDay()] += 1; });
  const max = Math.max(...byDay);
  const min = Math.min(...byDay);
  if (max === 0 || max < min * 2.5) return null;
  const DAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
  const busiestIdx = byDay.indexOf(max);
  const quietestIdx = byDay.indexOf(min);
  if (busiestIdx === quietestIdx) return null;
  return {
    id: 'day_of_week_imbalance',
    icon: '◐',
    title: `${DAY_NAMES[busiestIdx]} fill, ${DAY_NAMES[quietestIdx]} stay open`,
    why: `Over the past 60 days, ${max} sessions landed on ${DAY_NAMES[busiestIdx]} and ${min} on ${DAY_NAMES[quietestIdx]}. Some of your ${DAY_NAMES[busiestIdx].toLowerCase().slice(0, -1)} regulars might enjoy a quieter morning instead.`,
    action: null,
    wired: false,
  };
}

// Insight F: Membership candidates.
// Non-member clients with 3+ sessions in the past 60 days. Their
// rhythm fits a membership pattern. Frame as 'membership might suit
// their rhythm' not 'increase your recurring revenue.'
export function computeMembershipCandidates(appointments, memberClientIds, today) {
  if (!appointments?.length) return null;
  const cutoff = new Date(today.getTime() - 60 * MS_PER_DAY);
  const recent = appointments.filter(a => a.date >= cutoff && !a.preview && !a.external);
  const map = byClient(recent);
  const memberSet = new Set(memberClientIds || []);
  const candidates = [];
  for (const c of map.values()) {
    if (memberSet.has(c.id)) continue;
    if (c.dates.length < 3) continue;
    candidates.push({ id: c.id, name: c.name, recentCount: c.dates.length });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.recentCount - a.recentCount);
  const top = candidates.slice(0, 4);
  const lead = top[0];
  return {
    id: 'membership_candidates',
    icon: '🌿',
    title: candidates.length === 1
      ? `Membership might suit ${lead.name.split(' ')[0]}`
      : `${candidates.length} clients in a steady rhythm`,
    why: `${lead.name.split(' ')[0]} has come ${lead.recentCount} times in the past 60 days. A membership could make their care more predictable for both of you.`,
    action: 'membership_candidates',
    actionPayload: { clients: top },
    wired: false, // navigate to memberships page TBD
    clients: top,
  };
}

// Insight G: Cancellation flag.
// Last-minute cancellations (within 24h) in the past 30 days.
// Care-framed: 'sessions that did not happen' not 'revenue lost'.
// Requires booking.status === 'cancelled' AND a cancelled_at
// timestamp within 24h of start_time.
export function computeCancellationFlag(appointments, today) {
  if (!appointments?.length) return null;
  const cutoff = new Date(today.getTime() - 30 * MS_PER_DAY);
  // Note: appointments array on the rail does not include cancelled
  // by default. This function assumes 'cancelled' bookings are
  // passed in via a separate prop; if not present, returns null.
  const cancelled = appointments.filter(a =>
    a.status === 'cancelled' &&
    a.date >= cutoff &&
    a.cancelledLeadHours != null &&
    a.cancelledLeadHours < 24
  );
  if (cancelled.length < 3) return null;
  return {
    id: 'cancellation_flag',
    icon: '⚬',
    title: `${cancelled.length} sessions did not happen recently`,
    why: `${cancelled.length} sessions were cancelled within their 24-hour window in the past 30 days. Worth a quiet look at whether something is changing for those clients.`,
    action: null,
    wired: false,
  };
}

// Driver: compute all 7, return the non-null ones, capped at 4.
// Ordering is by signal strength so the most actionable lands at
// the top of the surface.
export function computeAllInsights({ appointments, today, openHoursToday, memberClientIds }) {
  const t = today || new Date();
  const results = [];
  const insights = [
    computeFirstSessionCheckIn(appointments, t),     // A
    computeCadenceDrift(appointments, t),            // B
    computeTopClientsQuiet(appointments, t),         // D
    computeMembershipCandidates(appointments, memberClientIds, t), // F
    computeDayOfWeekImbalance(appointments, t),      // E
    computeOpenTimeCare(openHoursToday),             // C
    computeCancellationFlag(appointments, t),        // G
  ];
  for (const insight of insights) {
    if (insight) results.push(insight);
  }
  return results.slice(0, 4);
}
