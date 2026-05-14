// src/lib/bodyZones.js
//
// Shared body-zone, preference, and goal label maps. Used by the
// new therapist client profile (PatternsCard, PreferencesCard) and
// could replace the duplicated arrays in AddClientModal in a follow-
// up cleanup. Kept in /lib so multiple components can import without
// circular dependencies.

export const BODY_ZONES = [
  { id: 'neck', label: 'Neck', front: true, back: true },
  { id: 'shoulders', label: 'Shoulders', front: true, back: true },
  { id: 'upperBack', label: 'Upper back', front: false, back: true },
  { id: 'midBack', label: 'Mid back', front: false, back: true },
  { id: 'lowerBack', label: 'Lower back', front: false, back: true },
  { id: 'hips', label: 'Hips', front: true, back: true },
  { id: 'glutes', label: 'Glutes', front: false, back: true },
  { id: 'hamstrings', label: 'Hamstrings', front: false, back: true },
  { id: 'calves', label: 'Calves', front: false, back: true },
  { id: 'feet', label: 'Feet', front: true, back: true },
  { id: 'chest', label: 'Chest', front: true, back: false },
  { id: 'abdomen', label: 'Abdomen', front: true, back: false },
  { id: 'arms', label: 'Arms', front: true, back: true },
  { id: 'hands', label: 'Hands', front: true, back: false },
  { id: 'thighsFront', label: 'Thigh fronts', front: true, back: false },
  { id: 'head', label: 'Head / scalp', front: true, back: false },
];

const ZONE_LABEL_BY_ID = Object.fromEntries(BODY_ZONES.map(z => [z.id, z.label]));

// Tolerant lookup: accepts the canonical id, or the label, or a
// lowercased variant. Returns the canonical label if found, otherwise
// the original input as a fallback so display never breaks.
export function zoneLabel(idOrLabel) {
  if (!idOrLabel) return '';
  if (ZONE_LABEL_BY_ID[idOrLabel]) return ZONE_LABEL_BY_ID[idOrLabel];
  // Some sessions store labels instead of ids (legacy data).
  const lower = String(idOrLabel).toLowerCase().trim();
  const byLabel = BODY_ZONES.find(z => z.label.toLowerCase() === lower);
  if (byLabel) return byLabel.label;
  return String(idOrLabel);
}

export const PRESSURE_LABELS = ['Very light', 'Light', 'Medium', 'Firm', 'Deep'];

export function pressureLabel(level) {
  const n = parseInt(level, 10);
  if (isNaN(n) || n < 1 || n > 5) return '';
  return PRESSURE_LABELS[n - 1];
}

export const GOAL_OPTIONS = [
  { value: 'relax', label: 'Relaxation' },
  { value: 'pain_relief', label: 'Pain relief' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'performance', label: 'Performance / sports' },
  { value: 'prenatal', label: 'Prenatal comfort' },
];

const GOAL_LABEL_BY_VALUE = Object.fromEntries(GOAL_OPTIONS.map(g => [g.value, g.label]));

export function goalLabel(value) {
  return GOAL_LABEL_BY_VALUE[value] || (value ? String(value) : '');
}

// Display string for common single-choice preferences. The values
// stored in sessions are short tokens; this expands them to readable
// English. Falls back to the raw token capitalized if unknown.
const PREFERENCE_LABELS = {
  table_temp: { warm: 'Warm', cool: 'Cool', neutral: 'Neutral' },
  room_temp: { warm: 'Warm', cool: 'Cool', comfortable: 'Comfortable' },
  music: { soft: 'Soft', upbeat: 'Upbeat', none: 'No music', silent: 'Silent', client_choice: 'Their choice' },
  lighting: { dim: 'Dim', medium: 'Medium', bright: 'Bright', candle: 'Candle' },
  conversation: { quiet: 'Quiet', friendly: 'Friendly', minimal: 'Minimal', chatty: 'Open to chat' },
  draping: { standard: 'Standard', extra: 'Extra coverage', minimal: 'Minimal' },
  oil_pref: { none: 'None', light: 'Light', medium: 'Medium', cream: 'Cream', unscented: 'Unscented', scented_ok: 'Scented OK' },
};

export function preferenceLabel(field, value) {
  if (!value) return '';
  const map = PREFERENCE_LABELS[field];
  if (map && map[value]) return map[value];
  // Fallback: capitalize first letter so unknown values still read
  // human (e.g., 'extra_quiet' -> 'Extra quiet').
  const str = String(value).replace(/_/g, ' ');
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ────────────────────────────────────────────────────────────────
// Body-diagram zone mapping
// ────────────────────────────────────────────────────────────────
// The intake form's simple zone IDs ('neck', 'lowerBack', 'shoulders')
// don't have x/y coordinates. The reusable BodyDiagram in
// src/components/BodyDiagram.jsx expects detailed left/right zone IDs
// like 'f-l-shldr', 'b-lower-bk' that map to ZONE_COORDS.
//
// This map converts a simple zone to the list of BodyDiagram zones to
// light up. For symmetric zones (shoulders), we light BOTH left+right.
// For midline zones (lower back, neck), we light the single center
// zone. Used by PatternsCard so the body silhouette renders heat dots
// from aggregated session data even when the data was written with the
// simple ID scheme.

export const ZONE_TO_DIAGRAM = {
  neck:        ['f-neck', 'b-neck'],
  shoulders:   ['f-l-shldr', 'f-r-shldr', 'b-l-shldr', 'b-r-shldr'],
  upperBack:   ['b-upper-bk'],
  midBack:     ['b-mid-bk'],
  lowerBack:   ['b-lower-bk'],
  hips:        ['f-l-hip', 'f-r-hip'],
  glutes:      ['b-l-glute', 'b-r-glute'],
  hamstrings:  ['b-l-hamstr', 'b-r-hamstr'],
  calves:      ['b-l-calf', 'b-r-calf'],
  feet:        ['f-l-foot', 'f-r-foot', 'b-l-foot', 'b-r-foot'],
  chest:       ['f-l-chest', 'f-r-chest'],
  abdomen:     ['f-abdomen'],
  arms:        ['f-l-arm-u', 'f-r-arm-u', 'f-l-forearm', 'f-r-forearm'],
  hands:       ['f-l-hand', 'f-r-hand'],
  thighsFront: ['f-l-thigh', 'f-r-thigh'],
  head:        ['f-head', 'b-head'],
};

/**
 * Splits a list of simple zones into front vs back BodyDiagram IDs.
 * Returns { frontIds: [], backIds: [] } so the caller can render two
 * silhouettes side-by-side (front view + back view).
 *
 * @param zones - array of simple IDs ('neck', 'shoulders', ...)
 *                or BodyDiagram IDs ('f-l-shldr', 'b-lower-bk', ...)
 */
export function zonesToBodyDiagram(zones) {
  const frontIds = [];
  const backIds = [];
  for (const z of zones || []) {
    // Pass-through if it's already a BodyDiagram ID
    if (typeof z === 'string' && (z.startsWith('f-') || z.startsWith('b-'))) {
      if (z.startsWith('f-')) frontIds.push(z); else backIds.push(z);
      continue;
    }
    const mapped = ZONE_TO_DIAGRAM[z] || [];
    for (const m of mapped) {
      if (m.startsWith('f-')) frontIds.push(m);
      else backIds.push(m);
    }
  }
  return { frontIds, backIds };
}
