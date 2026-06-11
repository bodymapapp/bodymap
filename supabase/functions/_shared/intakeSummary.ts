// supabase/functions/_shared/intakeSummary.ts
//
// One place that turns a session row into the human summary used by
// BOTH the therapist notice (notify-intake-filled) and the client
// confirmation (send-intake-confirmation). Fix the summary once, both
// emails improve, same as clientEmail.ts does for the frame.
//
// Faithful by construction: the label maps, preference wording, and
// the front/top/middle/bottom distribution formula are ported verbatim
// from the app (src/lib/bodyZones.js + src/lib/focusDistribution.js),
// so the email matches the dashboard. The map image is the live
// render-body-map PNG, which draws only what the client entered.
//
// All HTML here is email-safe: tables and inline styles only, no
// flexbox or gap (Gmail strips those).

export function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Region id -> [friendly base label, isPaired]. Paired limbs pluralize
// when both sides are picked (Shoulders), midline parts never do (Chest).
const REGION: Record<string, [string, boolean]> = {
  'f-head': ['Head', false], 'b-head': ['Head', false],
  'f-neck': ['Neck', false], 'b-neck': ['Neck', false],
  'f-l-shldr': ['Shoulder', true], 'f-r-shldr': ['Shoulder', true],
  'b-l-shldr': ['Shoulder', true], 'b-r-shldr': ['Shoulder', true],
  'f-l-chest': ['Chest', false], 'f-r-chest': ['Chest', false],
  'f-abdomen': ['Abdomen', false],
  'b-upper-bk': ['Upper back', false], 'b-mid-bk': ['Mid back', false], 'b-lower-bk': ['Lower back', false],
  'f-l-arm-u': ['Upper arm', true], 'f-r-arm-u': ['Upper arm', true],
  'b-l-arm-u': ['Upper arm', true], 'b-r-arm-u': ['Upper arm', true],
  'f-l-forearm': ['Forearm', true], 'f-r-forearm': ['Forearm', true],
  'b-l-forearm': ['Forearm', true], 'b-r-forearm': ['Forearm', true],
  'f-l-hand': ['Hand', true], 'f-r-hand': ['Hand', true],
  'b-l-hand': ['Hand', true], 'b-r-hand': ['Hand', true],
  'f-l-hip': ['Hip', true], 'f-r-hip': ['Hip', true],
  'b-l-glute': ['Glute', true], 'b-r-glute': ['Glute', true],
  'f-l-thigh': ['Thigh', true], 'f-r-thigh': ['Thigh', true],
  'b-l-hamstr': ['Hamstring', true], 'b-r-hamstr': ['Hamstring', true],
  'f-l-knee': ['Knee', true], 'f-r-knee': ['Knee', true],
  'b-l-knee': ['Knee', true], 'b-r-knee': ['Knee', true],
  'f-l-calf': ['Calf', true], 'f-r-calf': ['Calf', true],
  'b-l-calf': ['Calf', true], 'b-r-calf': ['Calf', true],
  'f-l-foot': ['Foot', true], 'f-r-foot': ['Foot', true],
  'b-l-foot': ['Foot', true], 'b-r-foot': ['Foot', true],
};

function friendlyZones(ids: string[]): string[] {
  const counts: Record<string, number> = {};
  const order: string[] = [];
  for (const id of ids || []) {
    const entry = REGION[id];
    if (!entry) continue;
    const label = entry[0];
    if (!(label in counts)) { counts[label] = 0; order.push(label); }
    counts[label]++;
  }
  return order.map((label) => {
    const paired = Object.values(REGION).some(([l, p]) => l === label && p);
    if (paired && counts[label] >= 2) {
      return label.endsWith('s') ? label : label + 's';
    }
    return label;
  });
}

const PRESSURE_LABELS = ['Very light', 'Light', 'Medium', 'Firm', 'Deep'];
function pressureLabel(level: any): string {
  const n = parseInt(level, 10);
  if (isNaN(n) || n < 1 || n > 5) return '';
  return PRESSURE_LABELS[n - 1];
}

const GOAL_LABEL: Record<string, string> = {
  relax: 'relaxation', pain_relief: 'pain relief', recovery: 'recovery',
  performance: 'sports and performance', prenatal: 'prenatal comfort',
};
function goalLabel(v: any): string {
  if (!v) return '';
  return GOAL_LABEL[v] || String(v).replace(/_/g, ' ');
}

const PREFERENCE_LABELS: Record<string, Record<string, string>> = {
  table_temp: { warm: 'warm table', cool: 'cool table', neutral: 'neutral table' },
  room_temp: { warm: 'warm room', cool: 'cool room', comfortable: 'comfortable room' },
  music: { soft: 'soft music', upbeat: 'upbeat music', none: 'no music', silent: 'silence', client_choice: 'their choice of music' },
  lighting: { dim: 'dim lighting', medium: 'medium lighting', bright: 'bright lighting', candle: 'candlelight' },
  conversation: { quiet: 'quiet', friendly: 'friendly chat', minimal: 'minimal talk', chatty: 'open to chat' },
  draping: { standard: 'standard draping', extra: 'extra coverage', minimal: 'minimal draping' },
  oil_pref: { none: 'no oil', light: 'light oil', medium: 'medium oil', cream: 'cream', unscented: 'unscented oil', scented_ok: 'scented oil OK' },
};
function prefText(field: string, value: any): string {
  if (!value || value === 'none' && field !== 'oil_pref' && field !== 'music') return field === 'oil_pref' || field === 'music' ? (PREFERENCE_LABELS[field]?.[value] || '') : '';
  const map = PREFERENCE_LABELS[field];
  if (map && map[value]) return map[value];
  if (!value) return '';
  const str = String(value).replace(/_/g, ' ');
  return str;
}

// Ported verbatim from src/lib/focusDistribution.js so the email
// matches the app. Used only as a fallback when the stored pcts are
// missing (older sessions); new intakes already carry the values.
const ZONE_BAND: Record<string, string> = {
  'f-head': 'top', 'b-head': 'top', 'f-neck': 'top', 'b-neck': 'top',
  'f-l-shldr': 'top', 'f-r-shldr': 'top', 'b-l-shldr': 'top', 'b-r-shldr': 'top',
  'b-upper-bk': 'top', 'f-l-chest': 'top', 'f-r-chest': 'top',
  'f-l-arm-u': 'top', 'f-r-arm-u': 'top', 'b-l-arm-u': 'top', 'b-r-arm-u': 'top',
  'f-l-forearm': 'top', 'f-r-forearm': 'top', 'b-l-forearm': 'top', 'b-r-forearm': 'top',
  'f-l-hand': 'top', 'f-r-hand': 'top', 'b-l-hand': 'top', 'b-r-hand': 'top',
  'f-abdomen': 'middle', 'b-mid-bk': 'middle', 'b-lower-bk': 'middle',
  'f-l-hip': 'middle', 'f-r-hip': 'middle', 'b-l-glute': 'middle', 'b-r-glute': 'middle',
  'f-l-thigh': 'bottom', 'f-r-thigh': 'bottom', 'b-l-hamstr': 'bottom', 'b-r-hamstr': 'bottom',
  'f-l-knee': 'bottom', 'f-r-knee': 'bottom', 'b-l-knee': 'bottom', 'b-r-knee': 'bottom',
  'f-l-calf': 'bottom', 'f-r-calf': 'bottom', 'b-l-calf': 'bottom', 'b-r-calf': 'bottom',
  'f-l-foot': 'bottom', 'f-r-foot': 'bottom', 'b-l-foot': 'bottom', 'b-r-foot': 'bottom',
};
function computeDistribution(focusZones: string[]) {
  if (!Array.isArray(focusZones) || focusZones.length === 0) return null;
  let front = 0, back = 0;
  const band = { top: 0, middle: 0, bottom: 0 } as Record<string, number>;
  for (const z of focusZones) {
    if (typeof z === 'string' && z.startsWith('f-')) front++; else back++;
    const bnd = ZONE_BAND[z]; if (bnd) band[bnd]++;
  }
  const total = front + back;
  const r5 = (n: number) => Math.round(n / 5) * 5;
  const front_pct = Math.max(0, Math.min(100, r5((front / total) * 100)));
  const bt = band.top + band.middle + band.bottom;
  let top_pct = 20, middle_pct = 60, bottom_pct = 20;
  if (bt > 0) {
    top_pct = r5((band.top / bt) * 100);
    middle_pct = r5((band.middle / bt) * 100);
    bottom_pct = r5((band.bottom / bt) * 100);
    const drift = 100 - (top_pct + middle_pct + bottom_pct);
    middle_pct = Math.max(0, Math.min(100, middle_pct + drift));
  }
  return { front_pct, top_pct, middle_pct, bottom_pct };
}

export interface IntakeSummary {
  focus: string[];
  avoid: string[];
  pressure: string;
  goal: string;
  conditions: string[];
  note: string;
  prefs: string[];
  dist: { front: number; back: number; top: number; middle: number; bottom: number } | null;
  sessionId: string;
}

export function buildIntakeSummary(session: any): IntakeSummary {
  const frontFocus = Array.isArray(session?.front_focus) ? session.front_focus : [];
  const backFocus = Array.isArray(session?.back_focus) ? session.back_focus : [];
  const frontAvoid = Array.isArray(session?.front_avoid) ? session.front_avoid : [];
  const backAvoid = Array.isArray(session?.back_avoid) ? session.back_avoid : [];
  const allFocus = [...frontFocus, ...backFocus];

  let dist: IntakeSummary['dist'] = null;
  if (typeof session?.front_pct === 'number') {
    dist = {
      front: session.front_pct,
      back: 100 - session.front_pct,
      top: session.top_pct ?? 0,
      middle: session.middle_pct ?? 0,
      bottom: session.bottom_pct ?? 0,
    };
  } else {
    const c = computeDistribution(allFocus);
    if (c) dist = { front: c.front_pct, back: 100 - c.front_pct, top: c.top_pct, middle: c.middle_pct, bottom: c.bottom_pct };
  }

  const conditions: string[] = [];
  if (Array.isArray(session?.medical_conditions)) {
    for (const m of session.medical_conditions) if (m) conditions.push(String(m));
  }
  if (session?.med_flag && session.med_flag !== 'none') conditions.push(String(session.med_flag).replace(/_/g, ' '));
  if (session?.med_note) conditions.push(String(session.med_note));

  const prefs: string[] = [];
  for (const f of ['room_temp', 'table_temp', 'music', 'lighting', 'conversation', 'draping', 'oil_pref']) {
    const t = prefText(f, session?.[f]);
    if (t) prefs.push(t);
  }

  return {
    focus: friendlyZones(allFocus),
    avoid: friendlyZones([...frontAvoid, ...backAvoid]),
    pressure: pressureLabel(session?.pressure),
    goal: goalLabel(session?.goal),
    conditions,
    note: session?.client_notes || session?.public_notes || '',
    prefs,
    dist,
    sessionId: session?.id || '',
  };
}

// ── Email-safe HTML fragments ─────────────────────────────────────

const C = {
  text: '#1A2E22', muted: '#6B7280', label: '#8A8A80',
  sageBg: '#EAF3DE', sage: '#3D8C55', coralBg: '#F6E3DF', coral: '#B84A42',
  border: '#ECE7DC', line: '#F1EEE6', panel: '#FAFAF7',
  barTop: '#4B8A6A', barMid: '#2A5741', barBot: '#1F4030', barFront: '#2A5741', barBack: '#CDE0D3',
};

function summaryRow(accent: string, label: string, value: string, first: boolean): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:${first ? 'none' : '1px solid ' + C.line};"><tr>
    <td width="6" style="padding:10px 0;"><div style="width:6px;height:6px;border-radius:50%;background:${accent};"></div></td>
    <td style="padding:10px 0 10px 10px;">
      <div style="font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${C.label};">${esc(label)}</div>
      <div style="font-size:14px;color:${C.text};line-height:1.4;">${esc(value)}</div>
    </td></tr></table>`;
}

export function summaryRowsHtml(s: IntakeSummary): string {
  let out = '';
  if (s.focus.length) out += summaryRow(C.sage, 'Focus areas', s.focus.join(', '), true);
  const pg = [s.pressure ? `${s.pressure} pressure` : '', s.goal ? `for ${s.goal}` : ''].filter(Boolean).join(', ');
  if (pg) out += summaryRow(C.sage, 'Pressure and goal', pg.charAt(0).toUpperCase() + pg.slice(1), out === '');
  const noteBits = [...(s.avoid.length ? [`Avoid the ${s.avoid.join(', ').toLowerCase()}`] : []), ...s.conditions];
  if (noteBits.length) out += summaryRow(C.coral, 'Please note', noteBits.join('. '), out === '');
  return out;
}

function bar(segments: Array<[number, string]>): string {
  const cells = segments.filter(([pct]) => pct > 0).map(([pct, color]) =>
    `<td width="${pct}%" style="background:${color};font-size:0;line-height:8px;height:8px;">&nbsp;</td>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:5px;overflow:hidden;"><tr>${cells}</tr></table>`;
}

export function mapBlockHtml(s: IntakeSummary, baseUrl: string): string {
  const img = `${baseUrl}/functions/v1/render-body-map?s=${encodeURIComponent(s.sessionId)}`;
  let bars = '';
  if (s.dist) {
    bars = `
      <div style="margin-top:14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:11px;color:${C.muted};text-align:left;padding-bottom:3px;">Front ${s.dist.front}%</td>
          <td style="font-size:11px;color:${C.muted};text-align:right;padding-bottom:3px;">Back ${s.dist.back}%</td>
        </tr></table>
        ${bar([[s.dist.front, C.barFront], [s.dist.back, C.barBack]])}
      </div>
      <div style="margin-top:10px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:11px;color:${C.muted};text-align:left;padding-bottom:3px;">Top ${s.dist.top}%</td>
          <td style="font-size:11px;color:${C.muted};text-align:center;padding-bottom:3px;">Mid ${s.dist.middle}%</td>
          <td style="font-size:11px;color:${C.muted};text-align:right;padding-bottom:3px;">Bottom ${s.dist.bottom}%</td>
        </tr></table>
        ${bar([[s.dist.top, C.barTop], [s.dist.middle, C.barMid], [s.dist.bottom, C.barBot]])}
      </div>`;
  }
  return `
    <div style="background:${C.panel};border:1px solid ${C.line};border-radius:12px;padding:16px;margin:14px 0;">
      <img src="${img}" alt="Body map showing the focus areas, front and back" width="300" style="display:block;width:100%;max-width:300px;height:auto;margin:0 auto;border:0;outline:none;text-decoration:none;" />
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:300px;margin:2px auto 0;"><tr>
        <td style="font-family:Georgia,serif;font-size:12px;color:${C.muted};text-align:left;">Front</td>
        <td style="font-family:Georgia,serif;font-size:12px;color:${C.muted};text-align:right;">Back</td>
      </tr></table>
      <div style="text-align:center;margin-top:8px;font-size:11px;color:${C.muted};">
        <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${C.sage};vertical-align:middle;"></span>
        <span style="vertical-align:middle;margin:0 12px 0 5px;">Focus</span>
        <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${C.coral};vertical-align:middle;"></span>
        <span style="vertical-align:middle;margin-left:5px;">Avoid</span>
      </div>
      ${bars}
    </div>`;
}

export function detailsLineHtml(s: IntakeSummary): string {
  const bits: string[] = [];
  if (s.prefs.length) bits.push(s.prefs.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.');
  if (s.note) bits.push(`Note: "${esc(s.note)}"`);
  if (!bits.length) return '';
  return `<div style="font-size:12.5px;color:#4B5563;line-height:1.55;margin:6px 0 0;">${bits.join(' ')}</div>`;
}
