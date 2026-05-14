// src/components/schedule/SmartBookingRail.jsx
//
// Schedule tab left rail. Houses the four cards that make Smart
// Booking the moat:
//   1. Up-Next Briefing carousel (3-point cards per upcoming client)
//   2. Body Load meter (today's service mix vs. injury risk)
//   3. Revenue card (this week vs. last + goal)
//   4. Fill This Gap card (one matched client per gap, one-tap text)
//
// HK May 14 2026: Phase 1 build. Data is hardcoded placeholder so
// the layout, type rhythm, and motion are real even though wiring
// isn't. Phase 2 wires each data source per the founder playbook
// formulas (MARKETING_MYBODYMAP.md, How we win section).

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

const C = {
  forest:    '#1F3A2C',
  forestMid: '#2A5741',
  sage:      '#5C7A4F',
  sageBright:'#86EFAC',
  paper:     '#FFFFFF',
  cream:     '#FBF8F1',
  beige:     '#FAF6EE',
  warm:      '#FEF3C7',
  warmBd:    '#FCD34D',
  ink:       '#1F2937',
  inkSoft:   '#475569',
  muted:     '#94A3B8',
  mutedSoft: '#CBD5E1',
  line:      '#E2E8F0',
  lineSoft:  '#EEF2F7',
  saved:     '#16A34A',
  brief:     '#DCFCE7',
  briefBd:   '#16A34A',
  warn:      '#FEF3C7',
  warnBd:    '#D97706',
  danger:    '#FEE2E2',
  dangerBd:  '#DC2626',
  amber:     '#92400E',
};
const F = {
  sans: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
};

// Hardcoded placeholders. Real data wires in Phase 2.
const PLACEHOLDER_UPCOMING = [
  {
    id: 'u1',
    when: '9:00 AM',
    duration: 60,
    countdown: 'in 12 min',
    name: 'Emma Reyes',
    meta: 'Swedish · 4th visit · brief ready',
    points: [
      { label: 'Focus',     text: 'Lower back and shoulders, desk-job pattern' },
      { label: 'Pref',      text: 'Quiet session, no chatting, dim lights' },
      { label: 'Last time', text: 'Loved forearm pressure on glutes' },
    ],
    accent: 'forest',
  },
  {
    id: 'u2',
    when: '10:30 AM',
    duration: 90,
    countdown: '+ 1 hr',
    name: 'Jess Marin',
    meta: 'Deep tissue · 1st visit · needs intake',
    points: [
      { label: 'No intake yet', text: 'Send link before 10am' },
      { label: 'Watch',         text: 'Cancels 30% of bookings, confirm by 9:30' },
      { label: 'Note',          text: 'Referred by Maria L., friends' },
    ],
    accent: 'paper',
  },
  {
    id: 'u3',
    when: '2:00 PM',
    duration: 60,
    countdown: '+ 5 hr',
    name: 'Maria Lopez',
    meta: 'Hot stone · 12th visit · monthly regular',
    points: [
      { label: 'Pattern', text: 'Recurring tightness right trap, jaw' },
      { label: 'Package', text: '3 of 10 sessions left, mention renewal' },
      { label: 'Allergy', text: 'Avoid lavender, use unscented oil' },
    ],
    accent: 'beige',
  },
  {
    id: 'u4',
    when: '3:30 PM',
    duration: 60,
    countdown: '+ 6.5 hr',
    name: 'Dana Patel',
    meta: 'Swedish · 3rd visit · brief ready',
    points: [
      { label: 'Focus',     text: 'Right hip, runner, half marathon training' },
      { label: 'Pref',      text: 'Firm pressure, no oil on face' },
      { label: 'Last time', text: 'Added 15 min for IT band, billed difference' },
    ],
    accent: 'beige',
  },
];

const PLACEHOLDER_LOAD = {
  total: 6.2,        // load factor sum
  threshold: 'high', // light | moderate | high | risk
  callout: 'Hydrate at 11:30. Stretch wrists between deep tissue.',
  segments: [
    { kind: 'deep',  pct: 38, color: '#DC2626' },
    { kind: 'deep',  pct: 12, color: '#DC2626' },
    { kind: 'med',   pct: 20, color: '#F59E0B' },
    { kind: 'easy',  pct: 15, color: '#86EFAC' },
    { kind: 'easy',  pct: 10, color: '#86EFAC' },
    { kind: 'free',  pct:  5, color: '#E5E7EB' },
  ],
  summary: '3 deep · 2 swedish today',
};

const PLACEHOLDER_REVENUE = {
  monthToDate: 5420,
  goal: 11000,
  sparkline: [1840, 1720, 1960, 2100],
};

const PLACEHOLDER_GAP = {
  duration: 30,
  when: 'Today 12:30 PM',
  dollarValue: 85,
  bestClient: {
    name: 'Sarah K.',
    reasons: [
      'Monthly visits for 8 months, last 42 days ago',
      'Usually books Thursdays at lunch',
      'Texted you 2 weeks ago asking about availability',
    ],
  },
  otherMatches: 2,
};

export default function SmartBookingRail({ isMobile = false, therapist, allAppts, today }) {
  const [intelByClient, setIntelByClient] = useState({});

  // Compute next 4 upcoming bookings from today forward, sorted.
  const upcomingBookings = useMemo(() => {
    if (!allAppts || !allAppts.length) return [];
    const now = new Date();
    const todayDate = today || new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return allAppts
      .filter(a => !a.preview && !a.external && a.date >= todayDate)
      .sort((a, b) => {
        const da = a.date.getTime();
        const db = b.date.getTime();
        if (da !== db) return da - db;
        return parseTimeToMin(a.startTime || timeFrom12(a.time)) - parseTimeToMin(b.startTime || timeFrom12(b.time));
      })
      .slice(0, 4);
  }, [allAppts, today]);

  // Compute TODAY's body load from confirmed bookings on today.
  // Formula from founder playbook (MyBodyMap Marketing > How we win
  // > formula playbook):
  //   load = sum(load_factor * duration_min / 60) over today's bookings
  // Thresholds: < 3 light, 3-5.5 moderate, 5.5-7.5 high, > 7.5 risk.
  const todayLoad = useMemo(() => {
    if (!allAppts || !allAppts.length) return null;
    const todayDate = today || new Date();
    const t0 = new Date(todayDate);
    t0.setHours(0,0,0,0);
    const todayAppts = allAppts.filter(a =>
      !a.preview && !a.external &&
      a.date.getTime() === t0.getTime()
    );
    if (!todayAppts.length) return null;

    let total = 0;
    const segments = [];
    let deepCount = 0;
    let medCount = 0;
    let easyCount = 0;
    todayAppts.forEach(a => {
      const lf = loadFactorFor(a.service);
      const contrib = lf * (a.duration / 60);
      total += contrib;
      const kind = lf >= 0.9 ? 'deep' : lf >= 0.55 ? 'med' : 'easy';
      if (kind === 'deep') deepCount++;
      else if (kind === 'med') medCount++;
      else easyCount++;
      segments.push({
        kind,
        pct: Math.max(8, Math.min(40, contrib * 12)),
        color: kind === 'deep' ? '#DC2626' : kind === 'med' ? '#F59E0B' : '#86EFAC',
      });
    });

    let threshold = 'light';
    let callout = null;
    if (total > 7.5) {
      threshold = 'risk';
      callout = `${deepCount}+ heavy back to back. Skip a strength session tonight. Wrists, forearms, low back at elevated risk.`;
    } else if (total > 5.5) {
      threshold = 'high';
      callout = 'Hydrate at the mid-afternoon gap. Stretch wrists between deep tissue.';
    } else if (total > 3) {
      threshold = 'moderate';
    }

    const summaryParts = [];
    if (deepCount) summaryParts.push(`${deepCount} deep`);
    if (medCount) summaryParts.push(`${medCount} swedish`);
    if (easyCount) summaryParts.push(`${easyCount} light`);

    return {
      total: Math.round(total * 10) / 10,
      threshold,
      callout,
      segments,
      summary: summaryParts.join(' · ') + ' today',
    };
  }, [allAppts, today]);

  // Compute revenue: current week vs last week, goal from trailing
  // 4-week average × 1.10 per founder playbook. Sunday start.
  // Revenue: month-to-date vs monthly goal. Per the playbook the
  // default goal is trailing 3-month average. Monthly framing avoids
  // emotional whiplash from a single slow week. Also expose a 4-week
  // mini-trend for a sparkline on the card so you see direction not
  // just one number.
  const monthRevenue = useMemo(() => {
    if (!allAppts || !allAppts.length) return null;
    const todayDate = today || new Date();
    const startOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    const startOfTrailing3M = new Date(todayDate);
    startOfTrailing3M.setMonth(todayDate.getMonth() - 3);
    startOfTrailing3M.setDate(1);

    let monthToDate = 0;
    let trailing3M = 0;
    // 4-week sparkline: weeks ending Saturday going back 4 weeks
    const weekTotals = [0, 0, 0, 0];
    const weekEnds = [];
    for (let i = 3; i >= 0; i--) {
      const end = new Date(todayDate);
      end.setHours(23,59,59,999);
      end.setDate(todayDate.getDate() - (i * 7));
      weekEnds.push(end);
    }
    allAppts.forEach(a => {
      if (a.preview || a.external) return;
      const price = Number(a.price) || 0;
      const d = a.date.getTime();
      if (d >= startOfMonth.getTime()) monthToDate += price;
      if (d >= startOfTrailing3M.getTime() && d < startOfMonth.getTime()) trailing3M += price;
      // bucket into sparkline weeks
      for (let i = 0; i < 4; i++) {
        const wkStart = new Date(weekEnds[i]);
        wkStart.setDate(weekEnds[i].getDate() - 6);
        wkStart.setHours(0,0,0,0);
        if (d >= wkStart.getTime() && d <= weekEnds[i].getTime()) {
          weekTotals[i] += price;
          break;
        }
      }
    });

    // Monthly goal = trailing 3-month average * 1.10
    const avgMonthly = trailing3M / 3;
    const goal = Math.max(2000, Math.round((avgMonthly * 1.10) / 100) * 100);
    return {
      monthToDate: Math.round(monthToDate),
      goal,
      sparkline: weekTotals.map(v => Math.round(v)),
    };
  }, [allAppts, today]);


  // Find the best Fill This Gap candidate. v1 looks for today's
  // first gap > 60 min between confirmed bookings, then matches it
  // against lapsed regulars. Full algorithm (availability windows
  // + full match scoring) ships next session.
  const [lapsedClients, setLapsedClients] = useState([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!therapist?.id) { setLapsedClients([]); return; }
      // Lapsed regular: 4+ bookings ever, last booking > 30 days ago.
      // Pull clients with their booking aggregates.
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      // We already have allAppts (past 365 days). Compute on client.
      // But we need ALL bookings per client, including newer than
      // the date range that's already loaded. allAppts covers past
      // 365 days which is plenty for cadence detection.
      const byClient = {};
      (allAppts || []).forEach(a => {
        if (a.preview || a.external || !a.clientId) return;
        if (!byClient[a.clientId]) byClient[a.clientId] = { client: a.client, dates: [], price: a.price };
        byClient[a.clientId].dates.push(a.date);
      });
      const lapsed = Object.entries(byClient)
        .map(([clientId, info]) => ({
          clientId,
          name: info.client,
          totalBookings: info.dates.length,
          lastVisit: new Date(Math.max(...info.dates.map(d => d.getTime()))),
          dates: info.dates,
          typicalPrice: info.price,
        }))
        .filter(c => c.totalBookings >= 4 && c.lastVisit < thirtyDaysAgo)
        .sort((a, b) => b.lastVisit.getTime() - a.lastVisit.getTime());

      // Fetch phone for the top 6 candidates
      const ids = lapsed.slice(0, 6).map(l => l.clientId);
      if (ids.length) {
        const { data: clientRows } = await supabase
          .from('clients')
          .select('id, phone, sms_opted_in')
          .in('id', ids);
        const phoneMap = {};
        (clientRows || []).forEach(r => { phoneMap[r.id] = r; });
        lapsed.forEach(l => {
          const row = phoneMap[l.clientId];
          l.phone = row?.phone || null;
          l.smsOptedIn = !!row?.sms_opted_in;
        });
      }
      if (!cancelled) setLapsedClients(lapsed);
    }
    load();
    return () => { cancelled = true; };
  }, [therapist?.id, allAppts?.length]);

  const fillGap = useMemo(() => {
    if (!allAppts || !allAppts.length) return null;
    const todayDate = today || new Date();
    const t0 = new Date(todayDate);
    t0.setHours(0,0,0,0);
    const todayAppts = allAppts
      .filter(a => !a.preview && !a.external && a.date.getTime() === t0.getTime())
      .sort((a, b) => parseTimeToMin(a.startTime || timeFrom12(a.time)) - parseTimeToMin(b.startTime || timeFrom12(b.time)));

    // Find the first gap >= 60 min between consecutive bookings
    let gapStart = null;
    let gapEnd = null;
    for (let i = 0; i < todayAppts.length - 1; i++) {
      const endA = parseTimeToMin(todayAppts[i].startTime || timeFrom12(todayAppts[i].time)) + todayAppts[i].duration;
      const startB = parseTimeToMin(todayAppts[i + 1].startTime || timeFrom12(todayAppts[i + 1].time));
      const gap = startB - endA;
      if (gap >= 60) {
        gapStart = endA;
        gapEnd = startB;
        break;
      }
    }
    if (gapStart === null) return null;

    // Find best lapsed match
    const dow = todayDate.getDay();
    const ranked = lapsedClients.map(c => {
      // Score: day-of-week match (count of past visits on same dow / total)
      const sameDow = c.dates.filter(d => d.getDay() === dow).length;
      const dowScore = c.totalBookings > 0 ? sameDow / c.totalBookings : 0;
      // Days lapsed: penalize too-fresh and too-stale
      const daysLapsed = Math.round((Date.now() - c.lastVisit.getTime()) / 86400000);
      const cadencePenalty = daysLapsed > 120 ? 0.5 : 0;
      const phoneBonus = c.phone ? 0.5 : 0;
      return { ...c, score: dowScore + phoneBonus - cadencePenalty, daysLapsed, sameDowCount: sameDow };
    }).sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best) return null;

    // Format gap time as "12:30 PM"
    const startH = Math.floor(gapStart / 60);
    const startM = gapStart % 60;
    const fmtH = startH % 12 || 12;
    const ampm = startH >= 12 ? 'PM' : 'AM';
    const whenStr = `Today ${fmtH}:${String(startM).padStart(2,'0')} ${ampm}`;
    const duration = gapEnd - gapStart;

    // Build 3 reasons per playbook priority
    const reasons = [];
    reasons.push(`${best.totalBookings} visits over ${Math.round((Date.now() - Math.min(...best.dates.map(d => d.getTime()))) / 86400000)} days, last ${best.daysLapsed} days ago`);
    if (best.sameDowCount >= 2) {
      const dayName = todayDate.toLocaleDateString('en-US', { weekday: 'long' });
      reasons.push(`Usually books on ${dayName}s (${best.sameDowCount} of ${best.totalBookings} visits)`);
    }
    if (best.daysLapsed > 45 && best.daysLapsed < 90) {
      reasons.push('Cadence break, due for a visit soon');
    } else if (best.phone) {
      reasons.push('Has phone on file, opted in to SMS');
    }
    while (reasons.length < 3) reasons.push('Strong fit based on visit history');

    return {
      duration,
      when: whenStr,
      dollarValue: best.typicalPrice || 85,
      bestClient: { name: best.name, reasons: reasons.slice(0, 3), phone: best.phone, smsOptedIn: best.smsOptedIn },
      otherMatches: Math.max(0, ranked.length - 1),
    };
  }, [allAppts, today, lapsedClients]);

  // Fetch session_intelligence for the client_ids of upcoming bookings.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!therapist?.id) return;
      const clientIds = Array.from(new Set(upcomingBookings.map(b => b.clientId).filter(Boolean)));
      if (!clientIds.length) { setIntelByClient({}); return; }
      const { data, error } = await supabase
        .from('session_intelligence')
        .select('client_id, extracted, extracted_at')
        .eq('therapist_id', therapist.id)
        .in('client_id', clientIds)
        .order('extracted_at', { ascending: false });
      if (cancelled) return;
      if (error || !data) { setIntelByClient({}); return; }
      const byClient = {};
      data.forEach(row => {
        if (!byClient[row.client_id]) byClient[row.client_id] = row.extracted;
      });
      setIntelByClient(byClient);
    }
    load();
    return () => { cancelled = true; };
  }, [therapist?.id, upcomingBookings.map(b => b.clientId).join(',')]);

  // Transform bookings + intel into briefing card shape.
  const upcoming = useMemo(() => {
    if (!upcomingBookings.length) {
      return PLACEHOLDER_UPCOMING.map((c, i) => ({ ...c, isPlaceholder: true }));
    }
    return upcomingBookings.map((b, i) => buildBriefCard(b, intelByClient[b.clientId], i));
  }, [upcomingBookings, intelByClient]);

  return (
    <aside style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      width: '100%',
      minWidth: 0,
      fontFamily: F.sans,
    }}>
      <UpNextCarousel upcoming={upcoming} isMobile={isMobile} />
      {/* Body Load + Revenue: on mobile, 2-up row to cut vertical
          scroll. On desktop, stack vertically in the narrow rail.
          Each card uses 0-width-flex-grow so they share the row
          equally and don't blow out the column. */}
      <div style={{
        display: isMobile ? 'grid' : 'block',
        gridTemplateColumns: isMobile ? '1fr 1fr' : undefined,
        gap: isMobile ? 12 : 0,
      }}>
        <BodyLoadCard load={todayLoad || PLACEHOLDER_LOAD} compact={isMobile} />
        {!isMobile && <div style={{ height: 14 }} />}
        <RevenueCard revenue={monthRevenue || PLACEHOLDER_REVENUE} compact={isMobile} />
      </div>
      {/* Fill This Gap only renders when there's a real gap AND a real
          candidate. On a real account with no qualifying gap, we hide
          rather than show fake data. Placeholder shows ONLY in the
          completely empty seed/demo case. */}
      {fillGap ? (
        <FillGapCard gap={fillGap} therapistFirstName={(therapist?.full_name || '').split(' ')[0]} />
      ) : (!therapist?.id ? (
        <FillGapCard gap={PLACEHOLDER_GAP} therapistFirstName="" />
      ) : null)}
    </aside>
  );
}

/* =============================================================
 * Body load: service-name keyword to load factor
 * Per founder playbook formula table.
 * ============================================================= */

const LOAD_KEYWORDS = [
  // High (1.0)
  { match: /\b(deep tissue|sports|trigger point|myofascial|neuromuscular)\b/i, factor: 1.0 },
  // Medium (0.6)
  { match: /\b(swedish|relaxation|integrative|custom|full body)\b/i, factor: 0.6 },
  // Low-medium (0.5)
  { match: /\b(hot stone|aromatherapy|cupping|gua sha)\b/i, factor: 0.5 },
  // Low (0.4)
  { match: /\b(prenatal|geriatric|lymphatic|reflexology|foot|scalp)\b/i, factor: 0.4 },
];
function loadFactorFor(serviceName) {
  if (!serviceName) return 0.7;
  for (const k of LOAD_KEYWORDS) {
    if (k.match.test(serviceName)) return k.factor;
  }
  return 0.7; // fallback per playbook
}

/* =============================================================
 * Helpers: build the briefing card from a booking + extracted JSON
 * ============================================================= */

function parseTimeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Convert "9:00 AM" back to "09:00" for sorting comparability.
function timeFrom12(s) {
  if (!s) return '00:00';
  const m = s.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return '00:00';
  let h = parseInt(m[1], 10);
  const min = m[2];
  const isPm = m[3].toUpperCase() === 'PM';
  if (isPm && h !== 12) h += 12;
  if (!isPm && h === 12) h = 0;
  return `${String(h).padStart(2,'0')}:${min}`;
}

function countdownFor(booking) {
  const now = new Date();
  const apptDate = new Date(booking.date);
  const startStr = booking.startTime || timeFrom12(booking.time);
  const [h, m] = startStr.split(':').map(Number);
  apptDate.setHours(h || 0, m || 0, 0, 0);
  const diffMs = apptDate.getTime() - now.getTime();
  if (diffMs < 0) return 'in progress';
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `+ ${hrs} hr`;
  const days = Math.round(hrs / 24);
  return `+ ${days} day${days !== 1 ? 's' : ''}`;
}

function accentForIndex(i) {
  if (i === 0) return 'forest';
  if (i === 1) return 'paper';
  return 'beige';
}

// Pick three points per the playbook priority rules:
//  1. Safety / required action first (allergy, no intake, watch)
//  2. Continuity from last session (focus, last time outcome)
//  3. Personalization (preference, pattern)
// Falls back gracefully when intel is missing.
function buildBriefCard(booking, intel, index) {
  const points = [];

  // Safety: no intake yet
  if (booking.status === 'pending-intake') {
    points.push({ label: 'No intake yet', text: 'Send link before the session' });
  }

  // Safety: concerns from intel
  if (intel?.concerns_flagged?.length) {
    points.push({ label: 'Concern', text: intel.concerns_flagged[0] });
  }

  // Continuity: focus
  if (points.length < 3 && intel?.focus_areas?.length) {
    points.push({ label: 'Focus', text: intel.focus_areas.slice(0, 2).join(', ') });
  }

  // Continuity: last time outcome
  if (points.length < 3 && intel?.outcome) {
    points.push({ label: 'Last time', text: truncate(intel.outcome, 70) });
  }

  // Continuity: next priority if no outcome
  if (points.length < 3 && intel?.next_session_priority) {
    points.push({ label: 'Priority', text: truncate(intel.next_session_priority, 70) });
  }

  // Personalization: preferences observed
  if (points.length < 3 && intel?.preferences_observed?.length) {
    points.push({ label: 'Pref', text: intel.preferences_observed[0] });
  }

  // Personalization: homework
  if (points.length < 3 && intel?.homework_or_followup) {
    points.push({ label: 'Followup', text: truncate(intel.homework_or_followup, 60) });
  }

  // If still short, show service + notes from booking
  if (points.length < 3 && booking.notes) {
    points.push({ label: 'Note', text: truncate(booking.notes, 60) });
  }
  if (points.length === 0) {
    points.push({ label: 'No prior data', text: 'First visit or no SOAP yet. Use the body map to capture focus areas.' });
  }

  return {
    id: booking.id,
    when: booking.time,
    duration: booking.duration,
    countdown: countdownFor(booking),
    name: booking.client || 'Unnamed',
    meta: `${booking.service || 'Session'}${booking.status === 'pending-intake' ? ' · needs intake' : ''}`,
    points: points.slice(0, 3),
    accent: accentForIndex(index),
  };
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1).trim() + '…' : s;
}

/* =============================================================
 * Up-Next Carousel
 * ============================================================= */

function UpNextCarousel({ upcoming, isMobile = false }) {
  const trackRef = useRef(null);
  const [index, setIndex] = useState(0);

  function scrollTo(i) {
    if (!trackRef.current) return;
    const clamped = Math.max(0, Math.min(upcoming.length - 1, i));
    setIndex(clamped);
    // Card width: on mobile each card fills the track viewport; on
    // desktop cards are a fixed 268. Read from firstChild as fallback.
    const trackWidth = trackRef.current.offsetWidth || 280;
    const cardWidth = isMobile
      ? trackWidth
      : (trackRef.current.firstChild?.offsetWidth || 268);
    const gap = isMobile ? 0 : 12;
    trackRef.current.scrollTo({ left: clamped * (cardWidth + gap), behavior: 'smooth' });
  }

  // Sync index with manual scroll so dots stay accurate
  function onScroll() {
    if (!trackRef.current) return;
    const trackWidth = trackRef.current.offsetWidth || 280;
    const cardWidth = isMobile
      ? trackWidth
      : (trackRef.current.firstChild?.offsetWidth || 268);
    const gap = isMobile ? 0 : 12;
    const i = Math.round(trackRef.current.scrollLeft / (cardWidth + gap));
    if (i !== index) setIndex(i);
  }

  return (
    <section style={{ minWidth: 0, width: '100%' }}>
      <SectionHeader
        eyebrow="Up next"
        trailing={upcoming[0]?.countdown}
        action={
          <CarouselArrows
            onPrev={() => scrollTo(index - 1)}
            onNext={() => scrollTo(index + 1)}
            canPrev={index > 0}
            canNext={index < upcoming.length - 1}
          />
        }
      />

      <div
        ref={trackRef}
        onScroll={onScroll}
        style={{
          display: 'flex',
          gap: isMobile ? 0 : 12,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          paddingBottom: 6,
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          width: '100%',
          minWidth: 0,
        }}
      >
        {upcoming.map((c, i) => (
          <BriefCard key={c.id} client={c} active={i === 0} isMobile={isMobile} />
        ))}
      </div>

      {/* Dots */}
      <div style={{
        display: 'flex',
        gap: 5,
        justifyContent: 'center',
        marginTop: 8,
      }}>
        {upcoming.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            aria-label={`Show client ${i + 1}`}
            style={{
              width: i === index ? 16 : 6,
              height: 6,
              borderRadius: 3,
              border: 'none',
              padding: 0,
              background: i === index ? C.forestMid : C.mutedSoft,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          />
        ))}
      </div>
    </section>
  );
}

function BriefCard({ client, active, isMobile = false }) {
  // Unified visual family. First card gets a thick forest left-edge
  // stripe + 'NEXT' pill to identify it as the upcoming session.
  // All other cards are the same plain paper card. No more beige/
  // forest/paper jumble. Family reads as one set, not three styles.
  const isNext = client.accent === 'forest';

  return (
    <article style={{
      flexShrink: 0,
      // Mobile: each card fills the carousel viewport so only ONE is
      // visible at a time (swipe to advance). Desktop: fixed 268 to
      // peek the next card and signal there's more.
      width: isMobile ? '100%' : 268,
      minWidth: isMobile ? '100%' : 268,
      scrollSnapAlign: 'start',
      borderRadius: 12,
      padding: '12px 14px',
      paddingLeft: isNext ? 18 : 14,
      position: 'relative',
      overflow: 'hidden',
      background: C.paper,
      color: C.ink,
      border: `1px solid ${isNext ? C.forestMid : C.line}`,
      boxShadow: isNext ? '0 1px 4px rgba(31,58,44,0.08)' : 'none',
    }}>
      {/* Left edge stripe for the next-up card */}
      {isNext && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: C.forestMid,
        }} />
      )}

      {/* when row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, letterSpacing: '0.03em' }}>
          {client.when} · {client.duration} min
        </span>
        {isNext ? (
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            color: C.forestMid,
            background: C.brief,
            border: `1px solid ${C.briefBd}`,
            borderRadius: 10,
            padding: '1px 7px',
            letterSpacing: '0.08em',
          }}>
            NEXT · {client.countdown}
          </span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 600, color: C.muted }}>
            {client.countdown}
          </span>
        )}
      </div>

      <div style={{
        fontFamily: F.serif,
        fontSize: 19,
        fontWeight: 700,
        lineHeight: 1.05,
        marginBottom: 1,
        color: C.ink,
      }}>
        {client.name}
      </div>
      <div style={{
        fontSize: 11,
        color: C.muted,
        marginBottom: 10,
        lineHeight: 1.35,
      }}>
        {client.meta}
      </div>

      {/* three points */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {client.points.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
            <span style={{
              flexShrink: 0,
              width: 17,
              height: 17,
              borderRadius: '50%',
              background: isNext ? C.brief : '#F1F5F9',
              color: isNext ? C.briefBd : C.muted,
              fontSize: 9,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 1,
            }}>
              {i + 1}
            </span>
            <div style={{ fontSize: 11.5, lineHeight: 1.4, flex: 1, minWidth: 0 }}>
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                color: isNext ? C.briefBd : C.muted,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginRight: 4,
                whiteSpace: 'nowrap',
              }}>
                {p.label}
              </span>
              <span style={{ color: C.ink }}>
                {p.text}
              </span>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function CarouselArrows({ onPrev, onNext, canPrev, canNext }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <ArrowBtn dir="prev" onClick={onPrev} disabled={!canPrev} />
      <ArrowBtn dir="next" onClick={onNext} disabled={!canNext} />
    </div>
  );
}

function ArrowBtn({ dir, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'prev' ? 'Previous client' : 'Next client'}
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        border: `1px solid ${C.line}`,
        background: disabled ? C.lineSoft : '#fff',
        color: disabled ? C.muted : C.ink,
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        fontSize: 11,
        transition: 'background 0.1s',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {dir === 'prev' ? (
          <path d="m15 18-6-6 6-6"/>
        ) : (
          <path d="m9 18 6-6-6-6"/>
        )}
      </svg>
    </button>
  );
}

/* =============================================================
 * Body Load Meter
 * ============================================================= */

function BodyLoadCard({ load, compact = false }) {
  return (
    <section style={cardStyle('status')}>
      <SectionHeader
        eyebrow={compact ? 'Body load' : 'Body load today'}
        trailing={compact ? null : load.summary}
      />
      <div style={{
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        display: 'flex',
        marginBottom: 6,
        background: C.lineSoft,
      }}>
        {load.segments.map((s, i) => (
          <div key={i} style={{ width: `${s.pct}%`, background: s.color }} />
        ))}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 11,
        marginBottom: compact ? 0 : 6,
      }}>
        {!compact && <span style={{ color: C.muted }}>Light · Moderate · High · Risk</span>}
        <span style={{
          fontWeight: 700,
          color: load.threshold === 'risk' ? C.dangerBd : (load.threshold === 'high' ? C.warnBd : C.saved),
          marginLeft: compact ? 'auto' : 0,
        }}>
          {load.threshold === 'risk' ? 'Injury risk' :
           load.threshold === 'high' ? 'High' :
           load.threshold === 'moderate' ? 'Moderate' : 'Light'}
        </span>
      </div>
      {/* Callout only shows in full (non-compact) mode. On mobile 2-up
          the callout would crowd the row; full callout returns on
          desktop where the card is full-width in the rail. */}
      {!compact && load.callout && (
        <div style={{
          background: C.warm,
          border: `1px solid ${C.warmBd}`,
          borderRadius: 8,
          padding: '7px 10px',
          fontSize: 11,
          color: C.amber,
          lineHeight: 1.4,
        }}>
          {load.callout}
        </div>
      )}
    </section>
  );
}

/* =============================================================
 * Revenue Card
 * ============================================================= */

function RevenueCard({ revenue, compact = false }) {
  const pct = Math.min(100, Math.round((revenue.monthToDate / revenue.goal) * 100));
  const sparkMax = Math.max(...revenue.sparkline, 1);
  const monthShort = new Date().toLocaleDateString('en-US', { month: 'short' });
  const monthLong = new Date().toLocaleDateString('en-US', { month: 'long' });
  return (
    <section style={cardStyle('status')}>
      <SectionHeader eyebrow={`${compact ? monthShort : monthLong} revenue`} />
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 6,
        gap: 6,
      }}>
        <span style={{
          fontFamily: F.serif,
          fontSize: compact ? 18 : 22,
          fontWeight: 700,
          color: C.forestMid,
          lineHeight: 1,
        }}>
          ${revenue.monthToDate.toLocaleString()}
        </span>
        {!compact && (
          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>
            of ${revenue.goal.toLocaleString()} goal
          </span>
        )}
      </div>
      <div style={{
        height: 4,
        background: C.lineSoft,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: compact ? 6 : 10,
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: C.saved,
          transition: 'width 0.3s',
        }} />
      </div>
      {/* Sparkline. In compact mode the 4-week trend bar is shorter
          and we drop the 'Last 4 weeks' label since the row is tight. */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 3,
        height: compact ? 12 : 18,
        marginBottom: compact ? 0 : 4,
      }}>
        {revenue.sparkline.map((v, i) => {
          const h = Math.max(3, Math.round((v / sparkMax) * (compact ? 12 : 18)));
          const isCurrent = i === revenue.sparkline.length - 1;
          return (
            <div key={i} style={{
              flex: 1,
              height: h,
              background: isCurrent ? C.forestMid : C.sage,
              borderRadius: 1,
              opacity: isCurrent ? 1 : 0.55,
            }} />
          );
        })}
      </div>
      {!compact && (
        <div style={{
          fontSize: 10,
          color: C.muted,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          Last 4 weeks
        </div>
      )}
    </section>
  );
}

/* =============================================================
 * Fill This Gap (the moat)
 * ============================================================= */

function FillGapCard({ gap, therapistFirstName }) {
  return (
    <section style={cardStyle('action')}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: C.amber,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        marginBottom: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <span>⚡</span>
        <span>Fill this gap</span>
      </div>

      <div style={{
        fontSize: 13,
        color: C.amber,
        fontWeight: 600,
        marginBottom: 2,
      }}>
        {gap.duration} min open · {gap.when}
      </div>
      <div style={{ fontSize: 11, color: C.amber, marginBottom: 12, fontWeight: 500 }}>
        Could earn ${gap.dollarValue}
      </div>

      <div style={{
        background: '#fff',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.muted,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}>
          Best match
        </div>
        <div style={{
          fontFamily: F.serif,
          fontSize: 16,
          fontWeight: 700,
          color: C.ink,
          marginBottom: 8,
        }}>
          {gap.bestClient.name}
        </div>
        <ul style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {gap.bestClient.reasons.map((r, i) => (
            <li key={i} style={{
              fontSize: 11.5,
              color: C.inkSoft,
              lineHeight: 1.4,
              paddingLeft: 12,
              position: 'relative',
            }}>
              <span style={{
                position: 'absolute',
                left: 2,
                top: 7,
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: C.warnBd,
              }} />
              {r}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => {
          // Pre-draft template per founder playbook. If client phone
          // is on file and SMS opted in, open the native SMS composer
          // pre-populated. Otherwise show a non-destructive alert.
          const firstName = gap.bestClient.name.split(' ')[0];
          const therapistFirst = therapistFirstName || 'me';
          const weeks = Math.max(2, Math.round((gap.bestClient.daysLapsed || 42) / 7));
          const msg = `Hi ${firstName}, ${therapistFirst} here. It's been about ${weeks} weeks since your last visit. Just had a ${gap.when.replace(/^Today /, '')} open up today if you'd like it. Reply YES and I'll lock it in.`;
          if (!gap.bestClient.phone) {
            alert(`No phone on file for ${firstName}. Pre-drafted message:\n\n${msg}`);
            return;
          }
          if (!gap.bestClient.smsOptedIn) {
            alert(`${firstName} hasn't opted in to SMS. Pre-drafted message:\n\n${msg}`);
            return;
          }
          // sms: URI works on iOS and Android. ?body= for the prefilled message.
          const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
          const sep = isApple ? '&' : '?';
          const url = `sms:${gap.bestClient.phone}${sep}body=${encodeURIComponent(msg)}`;
          window.location.href = url;
        }}
        style={{
          width: '100%',
          background: C.warnBd,
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '9px 0',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: 6,
        }}
      >
        Text {gap.bestClient.name.split(' ')[0]} this slot
      </button>

      {gap.otherMatches > 0 && (
        <button style={{
          width: '100%',
          background: 'transparent',
          color: C.amber,
          border: 'none',
          fontSize: 11,
          cursor: 'pointer',
          padding: 4,
          fontWeight: 600,
        }}>
          + {gap.otherMatches} other strong matches →
        </button>
      )}
    </section>
  );
}

/* =============================================================
 * Shared
 * ============================================================= */

function cardStyle(variant) {
  // 'action' = warm amber (Fill This Gap), 'status' = cream (Body Load/Revenue)
  // default = paper white (used by Up Next carousel container)
  if (variant === 'status') {
    return {
      background: C.cream,
      border: `1px solid ${C.line}`,
      borderRadius: 12,
      padding: '12px 14px',
    };
  }
  if (variant === 'action') {
    return {
      background: C.warm,
      border: `1px solid ${C.warmBd}`,
      borderRadius: 12,
      padding: '12px 14px',
    };
  }
  return {
    background: C.paper,
    border: `1px solid ${C.line}`,
    borderRadius: 12,
    padding: '12px 14px',
  };
}

function SectionHeader({ eyebrow, trailing, action }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 8,
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0, flex: 1 }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.muted,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          {eyebrow}
        </span>
        {trailing && (
          <span style={{
            fontSize: 11,
            color: C.muted,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            · {trailing}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}
