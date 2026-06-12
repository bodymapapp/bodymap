// src/lib/sessionIntelligence.js
//
// Reusable intelligence layer for the three-dot document system.
// Pre-session report, post-session therapist record, and post-session
// client summary all consume these helpers so the patterns stay
// consistent across documents.
//
// Design principle: surface only DECISION-RELEVANT facts. Avoid
// noise. A pattern only earns space if it could change what a
// therapist does in the next 90 minutes.

// ---------- Aftercare presets ----------
//
// Standard items most massage therapists recommend after most
// sessions. The therapist toggles which apply for this client.
// IDs are stable and used as keys in the SOAP json's aftercare
// array. Labels are what the client sees on their summary.

export const AFTERCARE_PRESETS = [
  { id: 'hydrate', label: 'Drink plenty of water today' },
  { id: 'rest', label: 'Take it easy for the rest of the day' },
  { id: 'no-strenuous', label: 'Avoid strenuous exercise for 24 hours' },
  { id: 'epsom-bath', label: 'A warm Epsom salt bath can help' },
  { id: 'gentle-stretch', label: 'Do some gentle stretching tonight' },
  { id: 'ice', label: 'Apply ice if you feel any soreness' },
  { id: 'heat', label: 'Apply heat to help muscles relax' },
  { id: 'no-alcohol', label: 'Avoid alcohol for 24 hours' },
];

export function getAftercareItems(soap) {
  if (!soap || !Array.isArray(soap.aftercare)) return [];
  return soap.aftercare
    .map(id => AFTERCARE_PRESETS.find(p => p.id === id))
    .filter(Boolean);
}

// ---------- SOAP parsing ----------

export function parseSoap(raw) {
  if (!raw) return { __soap: true, S: '', O: '', A: '', P: '', noteToClient: '', aftercare: [], aftercareCustom: '', legacy: '' };
  try {
    const p = JSON.parse(raw);
    if (p && p.__soap) {
      return {
        __soap: true,
        S: p.S || '',
        O: p.O || '',
        A: p.A || '',
        P: p.P || '',
        noteToClient: p.noteToClient || '',
        aftercare: Array.isArray(p.aftercare) ? p.aftercare : [],
        aftercareCustom: p.aftercareCustom || '',
        legacy: p.legacy || '',
      };
    }
  } catch (e) { /* fall through */ }
  return { __soap: true, S: '', O: '', A: '', P: '', noteToClient: '', aftercare: [], aftercareCustom: '', legacy: raw };
}

export function hasSoapContent(soap) {
  if (!soap) return false;
  return !!(soap.S || soap.O || soap.A || soap.P || soap.noteToClient || soap.legacy || (Array.isArray(soap.aftercare) && soap.aftercare.length > 0) || soap.aftercareCustom);
}

// ---------- Session history helpers ----------

// Sessions older than the current one, newest first. Excludes the
// current session itself even if it appears in history.
export function getPriorSessions(history, currentSessionId) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(s => s.id !== currentSessionId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// The most recent COMPLETED session before the current one. Used to
// surface the last plan and to diff what changed.
export function getLastCompletedSession(history, currentSessionId) {
  const prior = getPriorSessions(history, currentSessionId);
  return prior.find(s => s.completed) || prior[0] || null;
}

// ---------- Cadence ----------

export function deriveCadence(history, currentSessionId) {
  const prior = getPriorSessions(history, currentSessionId);
  if (prior.length === 0) {
    return { visitNumber: 1, isFirstVisit: true, lastVisitDate: null, daysSinceLast: null, avgDays: null, isOverdue: false };
  }
  const visitNumber = prior.length + 1;
  const lastVisit = prior[0];
  const lastVisitDate = new Date(lastVisit.created_at);
  const daysSinceLast = Math.floor((Date.now() - lastVisitDate.getTime()) / 86400000);

  let avgDays = null;
  if (prior.length >= 2) {
    let totalGap = 0;
    for (let i = 0; i < prior.length - 1; i++) {
      totalGap += (new Date(prior[i].created_at) - new Date(prior[i + 1].created_at)) / 86400000;
    }
    avgDays = Math.round(totalGap / (prior.length - 1));
  }

  // Overdue if more than 1.5x the average cadence has elapsed.
  const isOverdue = avgDays && daysSinceLast > avgDays * 1.5;

  return { visitNumber, isFirstVisit: false, lastVisitDate, daysSinceLast, avgDays, isOverdue };
}

// ---------- What changed since last session ----------

// Returns array of { kind, text } change items. Suppressed entirely
// if there is no prior session or nothing changed.
export function deriveChanges(currentSession, lastSession) {
  if (!lastSession) return [];
  const changes = [];

  // Pressure
  if (currentSession.pressure && lastSession.pressure && currentSession.pressure !== lastSession.pressure) {
    const dir = currentSession.pressure > lastSession.pressure ? 'up' : 'down';
    changes.push({
      kind: 'pressure',
      text: `Pressure ${dir}: ${lastSession.pressure}/5 last visit, ${currentSession.pressure}/5 today.`,
    });
  }

  // Goal shift
  if (currentSession.goal && lastSession.goal && currentSession.goal !== lastSession.goal) {
    changes.push({
      kind: 'goal',
      text: `Goal changed: "${lastSession.goal}" last visit, "${currentSession.goal}" today.`,
    });
  }

  // New focus zones
  const lastFocus = new Set([...(lastSession.front_focus || []), ...(lastSession.back_focus || [])]);
  const thisFocus = [...(currentSession.front_focus || []), ...(currentSession.back_focus || [])];
  const newFocus = thisFocus.filter(z => !lastFocus.has(z));
  if (newFocus.length > 0) {
    changes.push({
      kind: 'focus-new',
      text: `New focus zone${newFocus.length > 1 ? 's' : ''}: ${newFocus.map(zoneLabel).join(', ')}.`,
    });
  }

  // New avoid zones
  const lastAvoid = new Set([...(lastSession.front_avoid || []), ...(lastSession.back_avoid || [])]);
  const thisAvoid = [...(currentSession.front_avoid || []), ...(currentSession.back_avoid || [])];
  const newAvoid = thisAvoid.filter(z => !lastAvoid.has(z));
  if (newAvoid.length > 0) {
    changes.push({
      kind: 'avoid-new',
      text: `New avoid zone${newAvoid.length > 1 ? 's' : ''}: ${newAvoid.map(zoneLabel).join(', ')}.`,
    });
  }

  // New med flag
  const wasFlagged = lastSession.med_flag && !['none', 'no', ''].includes(lastSession.med_flag);
  const isFlagged = currentSession.med_flag && !['none', 'no', ''].includes(currentSession.med_flag);
  if (isFlagged && !wasFlagged) {
    changes.push({
      kind: 'med-new',
      text: `New medical flag reported today.`,
    });
  }

  // New medical conditions
  const lastConds = new Set(lastSession.medical_conditions || []);
  const thisConds = currentSession.medical_conditions || [];
  const newConds = thisConds.filter(c => !lastConds.has(c));
  if (newConds.length > 0) {
    changes.push({
      kind: 'condition-new',
      text: `New condition${newConds.length > 1 ? 's' : ''} reported: ${newConds.join(', ')}.`,
    });
  }

  return changes;
}

// ---------- Pattern intelligence ----------

// Returns array of { kind, severity, text } where severity is
// 'high' for things that should drive behavior change, 'medium'
// for reinforcement, 'low' for trivia. The page can filter by
// severity if space is tight.
//
// A pattern only earns a slot if it tells the therapist something
// they would not have known from today's intake alone.
export function derivePatterns(history, currentSessionId) {
  const prior = getPriorSessions(history, currentSessionId);
  if (prior.length < 2) return [];
  const n = prior.length;
  const patterns = [];

  // Consistent preferences (only worth showing when 100% consistent
  // across 3 or more visits, otherwise it's noise).
  const consistencyFields = [
    { key: 'pressure', label: 'Pressure', formatter: v => `${v}/5` },
    { key: 'goal', label: 'Goal' },
    { key: 'music', label: 'Music' },
    { key: 'lighting', label: 'Lighting' },
    { key: 'conversation', label: 'Conversation' },
    { key: 'table_temp', label: 'Table temp' },
    { key: 'room_temp', label: 'Room temp' },
    { key: 'draping', label: 'Draping' },
  ];

  if (n >= 3) {
    consistencyFields.forEach(f => {
      const values = prior.map(s => s[f.key]).filter(v => v !== null && v !== undefined && v !== '');
      if (values.length >= 3) {
        const first = values[0];
        const allSame = values.every(v => v === first);
        if (allSame) {
          const display = f.formatter ? f.formatter(first) : first;
          patterns.push({
            kind: 'consistent-pref',
            severity: 'medium',
            text: `Always ${f.label.toLowerCase()}: ${display}.`,
          });
        }
      }
    });
  }

  // Recurring focus zones (zone appearing in 3+ of last 5 visits).
  const recent = prior.slice(0, 5);
  const focusCounts = {};
  recent.forEach(s => {
    const all = [...(s.front_focus || []), ...(s.back_focus || [])];
    new Set(all).forEach(z => { focusCounts[z] = (focusCounts[z] || 0) + 1; });
  });
  Object.entries(focusCounts)
    .filter(([, count]) => count >= 3)
    .sort(([, a], [, b]) => b - a)
    .forEach(([zone, count]) => {
      patterns.push({
        kind: 'recurring-focus',
        severity: 'high',
        text: `${zoneLabel(zone)} requested in ${count} of last ${recent.length} visits.`,
      });
    });

  // Pressure trend (climbing or dropping by 2+ over recent visits).
  const pressures = recent.map(s => s.pressure).filter(p => p);
  if (pressures.length >= 3) {
    const first = pressures[pressures.length - 1];
    const latest = pressures[0];
    const delta = latest - first;
    if (Math.abs(delta) >= 2) {
      const dir = delta > 0 ? 'climbed' : 'dropped';
      patterns.push({
        kind: 'pressure-trend',
        severity: 'high',
        text: `Pressure has ${dir} from ${first}/5 to ${latest}/5 over ${pressures.length} visits.`,
      });
    }
  }

  // Recurring medical mentions (med_note or conditions seen in 2+ visits).
  const conditionCounts = {};
  recent.forEach(s => {
    (s.medical_conditions || []).forEach(c => {
      conditionCounts[c] = (conditionCounts[c] || 0) + 1;
    });
  });
  Object.entries(conditionCounts)
    .filter(([, count]) => count >= 2)
    .forEach(([cond, count]) => {
      patterns.push({
        kind: 'recurring-condition',
        severity: 'high',
        text: `Reported "${cond}" in ${count} of last ${recent.length} visits.`,
      });
    });

  return patterns;
}

// ---------- Last session's plan ----------

export function getLastPlan(history, currentSessionId) {
  const last = getLastCompletedSession(history, currentSessionId);
  if (!last) return null;
  const soap = parseSoap(last.therapist_notes || '');
  if (!soap.P && !soap.A) return null;
  return {
    sessionId: last.id,
    date: new Date(last.created_at),
    plan: soap.P,
    assessment: soap.A,
  };
}

// ---------- Standing flags ----------

// Pulls red-flag info from the current session intake. Returns
// null if there's nothing to flag.
export function getStandingFlags(session) {
  if (!session) return null;
  const flag = session.med_flag;
  const isFlagged = flag && !['none', 'no', ''].includes(flag);
  const medNote = session.med_note;
  const conditions = session.medical_conditions || [];
  const custom = session.custom_intake_answers || {};

  // Surface custom answers that look like allergies, medications,
  // surgeries, pregnancy. We match on the answer KEY (whatever the
  // therapist named the field) using common words.
  const interestingKeys = Object.keys(custom).filter(k => {
    const lower = k.toLowerCase();
    return /allerg|medic|drug|surger|pregn|condition/.test(lower);
  });
  const customFlags = interestingKeys
    .map(k => ({ key: k, value: custom[k] }))
    .filter(item => {
      const v = item.value;
      if (v === null || v === undefined || v === '') return false;
      if (typeof v === 'string' && /^(no|none|n\/a)$/i.test(v.trim())) return false;
      return true;
    });

  if (!isFlagged && conditions.length === 0 && customFlags.length === 0) return null;

  return {
    severity: flag || (conditions.length > 0 || customFlags.length > 0 ? 'minor' : null),
    medNote,
    conditions,
    customFlags,
  };
}

// ---------- Body zone heatmap aggregation ----------

// Absolute shade intensity for one zone: its share of the client's
// total sessions, floored at 0.3 so even a single hit stays visible
// and capped at 1.0. Absolute means the same share reads as the same
// darkness on every client, so a heavier client looks visibly hotter
// than a lighter one rather than every client maxing out their own
// busiest zone. This is the one source of truth for every heatmap
// surface (profile patterns, schedule dashboard, printable recap).
export function zoneOpacity(count, total) {
  const n = Math.max(1, total || 0);
  return parseFloat(Math.min(0.3 + (count / n) * 0.7, 1.0).toFixed(2));
}

export function aggregateHeatmap(history, currentSessionId, limit = 5) {
  const prior = getPriorSessions(history, currentSessionId).slice(0, limit);
  const n = prior.length;
  if (n === 0) return { frontFocus: {}, frontAvoid: {}, backFocus: {}, backAvoid: {}, count: 0 };
  const ff = {}, fa = {}, bf = {}, ba = {};
  prior.forEach(s => {
    (s.front_focus || []).forEach(a => { ff[a] = (ff[a] || 0) + 1; });
    (s.front_avoid || []).forEach(a => { fa[a] = (fa[a] || 0) + 1; });
    (s.back_focus || []).forEach(a => { bf[a] = (bf[a] || 0) + 1; });
    (s.back_avoid || []).forEach(a => { ba[a] = (ba[a] || 0) + 1; });
  });
  const toEntry = c => ({ count: c, total: n, opacity: zoneOpacity(c, n) });
  return {
    frontFocus: Object.fromEntries(Object.entries(ff).map(([k, v]) => [k, toEntry(v)])),
    frontAvoid: Object.fromEntries(Object.entries(fa).map(([k, v]) => [k, toEntry(v)])),
    backFocus: Object.fromEntries(Object.entries(bf).map(([k, v]) => [k, toEntry(v)])),
    backAvoid: Object.fromEntries(Object.entries(ba).map(([k, v]) => [k, toEntry(v)])),
    count: n,
  };
}

// ---------- Zone labels ----------

export const ZONE_LABELS = {
  'f-head': 'Head', 'f-neck': 'Neck', 'f-l-shldr': 'L Shoulder', 'f-r-shldr': 'R Shoulder',
  'f-l-chest': 'L Chest', 'f-r-chest': 'R Chest', 'f-abdomen': 'Abdomen',
  'f-l-arm-u': 'L Upper Arm', 'f-r-arm-u': 'R Upper Arm', 'f-l-forearm': 'L Forearm',
  'f-r-forearm': 'R Forearm', 'f-l-hand': 'L Hand', 'f-r-hand': 'R Hand',
  'f-l-hip': 'L Hip', 'f-r-hip': 'R Hip', 'f-l-thigh': 'L Thigh', 'f-r-thigh': 'R Thigh',
  'f-l-knee': 'L Knee', 'f-r-knee': 'R Knee', 'f-l-calf': 'L Calf', 'f-r-calf': 'R Calf',
  'f-l-foot': 'L Foot', 'f-r-foot': 'R Foot',
  'b-head': 'Back of Head', 'b-neck': 'Back of Neck',
  'b-l-shldr': 'L Shoulder Blade', 'b-r-shldr': 'R Shoulder Blade',
  'b-upper-bk': 'Upper Back', 'b-mid-bk': 'Mid Back', 'b-lower-bk': 'Lower Back',
  'b-l-arm-u': 'L Upper Arm', 'b-r-arm-u': 'R Upper Arm',
  'b-l-forearm': 'L Forearm', 'b-r-forearm': 'R Forearm',
  'b-l-hand': 'L Hand', 'b-r-hand': 'R Hand',
  'b-l-glute': 'L Glute', 'b-r-glute': 'R Glute',
  'b-l-hamstr': 'L Hamstring', 'b-r-hamstr': 'R Hamstring',
  'b-l-knee': 'L Knee', 'b-r-knee': 'R Knee',
  'b-l-calf': 'L Calf', 'b-r-calf': 'R Calf',
  'b-l-foot': 'L Foot', 'b-r-foot': 'R Foot',
};

export function zoneLabel(k) { return ZONE_LABELS[k] || k; }

export const ZONE_COORDS = {
  'f-head': [85, 28], 'f-neck': [85, 52], 'f-l-shldr': [58, 72], 'f-r-shldr': [112, 72],
  'f-l-chest': [68, 95], 'f-r-chest': [102, 95], 'f-abdomen': [85, 125],
  'f-l-arm-u': [45, 100], 'f-r-arm-u': [125, 100], 'f-l-forearm': [42, 130], 'f-r-forearm': [128, 130],
  'f-l-hand': [40, 155], 'f-r-hand': [130, 155], 'f-l-hip': [68, 155], 'f-r-hip': [102, 155],
  'f-l-thigh': [68, 185], 'f-r-thigh': [102, 185], 'f-l-knee': [68, 220], 'f-r-knee': [102, 220],
  'f-l-calf': [68, 248], 'f-r-calf': [102, 248], 'f-l-foot': [68, 285], 'f-r-foot': [102, 285],
  'b-head': [85, 28], 'b-neck': [85, 52], 'b-l-shldr': [58, 72], 'b-r-shldr': [112, 72],
  'b-upper-bk': [85, 88], 'b-mid-bk': [85, 112], 'b-lower-bk': [85, 136],
  'b-l-arm-u': [45, 100], 'b-r-arm-u': [125, 100], 'b-l-forearm': [42, 130], 'b-r-forearm': [128, 130],
  'b-l-hand': [40, 155], 'b-r-hand': [130, 155], 'b-l-glute': [68, 162], 'b-r-glute': [102, 162],
  'b-l-hamstr': [68, 192], 'b-r-hamstr': [102, 192], 'b-l-knee': [68, 220], 'b-r-knee': [102, 220],
  'b-l-calf': [68, 248], 'b-r-calf': [102, 248], 'b-l-foot': [68, 285], 'b-r-foot': [102, 285],
};
