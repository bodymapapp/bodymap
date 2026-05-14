// src/data/sampleClients.js
//
// Sample clients shown on a new therapist's empty Clients tab.
// Clicking a sample card routes to the real /dashboard/clients/:id
// route. Dashboard checks isSampleId(clientId) and uses these
// builders instead of hitting Supabase, so the sample profile,
// sessions, and four-document-journey render exactly the same way
// real clients do.
//
// Design principle (per HK direction): the sample experience must
// be identical to the real one. Same hero, same StatusStrip, same
// SOAP section, same Patterns silhouette, same Timeline, same
// Edit / Merge / Archive buttons, same clickable four-document
// journey. The therapist gets a complete preview of capability
// before they have a client of their own.
//
// All five sample clients share Sarah Chen's body-map narrative
// (right shoulder + lower back + jaw clenching, pressure climbing
// 2 to 4 over five visits). What differs per sample is just the
// surface identity: name, initials, avatar color, and the state
// pill (active vs new vs lapsed). The point is to demonstrate
// capability, not to author five distinct case studies.

import { DEMO_SESSIONS } from './demoSarahChen';

const SAMPLE_PREFIX = 'sample-';
const SAMPLE_SESSION_PREFIX = 'sample-session-';

// The five cards rendered on the empty Clients tab. Keep in sync
// with the array literal in ClientList.js.
const SAMPLES = {
  s1: {
    id: 'sample-s1',
    full_name: 'Sarah Mitchell',
    initials: 'SM',
    color: '#2A5741',
    focus: 'Neck, Upper Back',
    state: 'returning',
    daysAgo: 2,
  },
  s2: {
    id: 'sample-s2',
    full_name: 'Jennifer Kim',
    initials: 'JK',
    color: '#6B9E80',
    focus: 'Lower Back, Hip',
    state: 'returning',
    daysAgo: 5,
  },
  s3: {
    id: 'sample-s3',
    full_name: 'Maria Lopez',
    initials: 'ML',
    color: '#C9A84C',
    focus: 'Shoulders',
    state: 'vip',
    daysAgo: 7,
  },
  s4: {
    id: 'sample-s4',
    full_name: 'Rachel Torres',
    initials: 'RT',
    color: '#9CA3AF',
    focus: 'Full Body',
    state: 'new',
    daysAgo: null,
  },
  s5: {
    id: 'sample-s5',
    full_name: 'Dana Park',
    initials: 'DP',
    color: '#DC2626',
    focus: 'Neck, Shoulders',
    state: 'lapsed',
    daysAgo: 68,
  },
};

export function isSampleId(id) {
  return typeof id === 'string' && id.startsWith(SAMPLE_PREFIX);
}

export function isSampleSessionId(id) {
  return typeof id === 'string' && id.startsWith(SAMPLE_SESSION_PREFIX);
}

/**
 * Returns the sample client row for a given /dashboard/clients/:id
 * URL parameter. Shape matches the columns the rest of the app
 * reads off a real clients row (id, name, email, phone, created_at,
 * do_not_rebook, notes). The therapist_id is set to a placeholder
 * since sample clients don't belong to any therapist.
 */
export function getSampleClient(clientId) {
  const key = clientId.replace(SAMPLE_PREFIX, '');
  const s = SAMPLES[key];
  if (!s) return null;
  return {
    id: s.id,
    name: s.full_name,
    email: 'sample@mybodymap.app',
    phone: '(512) 555-0' + key.slice(1).padStart(3, '0'),
    notes: '',
    do_not_rebook: false,
    therapist_id: null,
    created_at: shiftDate(s.daysAgo != null ? -120 : -3),
    __sample: true,
    __sampleKey: key,
    __initials: s.initials,
    __color: s.color,
    __focus: s.focus,
    __state: s.state,
    __daysAgo: s.daysAgo,
  };
}

/**
 * Builds the sample-session list for a given sample client. New
 * client (Rachel Torres) gets only 1 partial session; others get
 * all 5 sessions based on Sarah Chen's narrative.
 *
 * Each returned row's id is rewritten as sample-session-<key>-<n>
 * so the session-detail route can resolve it back to demo data.
 */
export function getSampleSessions(clientId) {
  const key = clientId.replace(SAMPLE_PREFIX, '');
  const s = SAMPLES[key];
  if (!s) return [];

  // Rachel Torres is the 'New' sample: 1 session, intake only,
  // no SOAP. This lets the new therapist see what a brand-new
  // client looks like in the same UI.
  const sessionCount = s.state === 'new' ? 1 : 5;

  return DEMO_SESSIONS.slice(0, sessionCount).map((d, i) => ({
    ...d,
    id: `${SAMPLE_SESSION_PREFIX}${key}-${i + 1}`,
    client_id: s.id,
    therapist_id: null,
    __sample: true,
  }));
}

/**
 * Resolve a sample session id back to its row. Called by the
 * session-detail route loader.
 */
export function getSampleSession(sessionId) {
  if (!isSampleSessionId(sessionId)) return null;
  const stripped = sessionId.replace(SAMPLE_SESSION_PREFIX, '');
  const lastDash = stripped.lastIndexOf('-');
  if (lastDash < 0) return null;
  const key = stripped.slice(0, lastDash);
  const n = parseInt(stripped.slice(lastDash + 1), 10);
  if (!key || !Number.isFinite(n) || n < 1 || n > 5) return null;
  const sessions = getSampleSessions(`${SAMPLE_PREFIX}${key}`);
  return sessions[n - 1] || null;
}

/**
 * Stat aggregates + patterns + medical flags + preferences for the
 * sample profile, matching the shape that getClientProfile returns.
 */
export function buildSampleProfile(clientId) {
  const client = getSampleClient(clientId);
  if (!client) return null;
  const sessions = getSampleSessions(clientId);

  const bookings = sessions.map((sess, i) => ({
    id: `sample-bk-${client.__sampleKey}-${i + 1}`,
    client_id: client.id,
    booking_date: sess.created_at.slice(0, 10),
    start_time: '10:00:00',
    end_time: '11:00:00',
    status: 'completed',
    service: { name: 'Therapeutic Massage 60', price: 140, duration: 60 },
  }));

  const countZones = (field) => {
    const counts = new Map();
    for (const sess of sessions) {
      const arr = Array.isArray(sess[field]) ? sess[field] : [];
      for (const z of arr) counts.set(z, (counts.get(z) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  };

  const topFrontZones = countZones('front_focus');
  const topBackZones = countZones('back_focus');
  const topAvoidZones = [...countZones('front_avoid'), ...countZones('back_avoid')]
    .sort((a, b) => b.count - a.count).slice(0, 3);

  const latest = sessions.find(s => s.completed) || sessions[0] || null;

  const medicalFlags = [];
  const seen = new Set();
  for (const sess of sessions) {
    const conds = Array.isArray(sess.medical_conditions) ? sess.medical_conditions : [];
    for (const c of conds) {
      if (c && !seen.has(c)) {
        seen.add(c);
        medicalFlags.push({ type: 'condition', text: c });
      }
    }
  }

  const lastVisitDate = bookings[0]?.booking_date || null;
  const daysSinceVisit = lastVisitDate
    ? Math.floor((Date.now() - new Date(lastVisitDate + 'T00:00:00Z').getTime()) / 86400000)
    : null;

  return {
    client,
    bookings,
    sessions,
    packagePurchases: [],
    memberSubscriptions: [],
    giftCertificates: [],
    stats: {
      lifetimeSessions: bookings.length,
      lifetimeCompletedSessions: bookings.length,
      lifetimeEarnings: bookings.length * 140,
      lastVisitDate,
      daysSinceVisit,
      nextBooking: null,
      pendingIntake: null,
    },
    patterns: { topFrontZones, topBackZones, topAvoidZones },
    preferences: latest ? {
      pressure: latest.pressure,
      goal: latest.goal,
      table_temp: latest.table_temp,
      room_temp: latest.room_temp,
      music: latest.music,
      lighting: latest.lighting,
      conversation: latest.conversation,
      draping: latest.draping,
      oil_pref: latest.oil_pref,
    } : null,
    medicalFlags,
    __sample: true,
  };
}

function shiftDate(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString();
}

export { SAMPLE_PREFIX, SAMPLE_SESSION_PREFIX };
