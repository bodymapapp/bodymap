// src/lib/focusDistribution.js
//
// Helpers for the focus distribution feature (Lindsey #4 follow-up
// May 10 2026). Map body zones into three anatomical bands (top,
// middle, bottom), and auto-derive percentages from a set of
// selected zones.
//
// The body zones use ids like 'f-head', 'b-l-knee', etc. We map
// each to one of three bands based on where the body part actually
// sits in space. This is anatomy, not arbitrary - top is above the
// rib cage, middle is rib cage to hip, bottom is hip downward.

// Zones grouped by vertical band. Both 'f-' and 'b-' variants
// included where they exist. Used for both front-side and back-
// side zone classification.
const ZONE_BAND = {
  // Top: head, neck, shoulders, upper back, upper arms, chest
  'f-head': 'top', 'b-head': 'top',
  'f-neck': 'top', 'b-neck': 'top',
  'f-l-shldr': 'top', 'f-r-shldr': 'top',
  'b-l-shldr': 'top', 'b-r-shldr': 'top',
  'b-upper-bk': 'top',
  'f-l-chest': 'top', 'f-r-chest': 'top',
  'f-l-arm-u': 'top', 'f-r-arm-u': 'top',
  'b-l-arm-u': 'top', 'b-r-arm-u': 'top',
  'f-l-forearm': 'top', 'f-r-forearm': 'top',
  'b-l-forearm': 'top', 'b-r-forearm': 'top',
  'f-l-hand': 'top', 'f-r-hand': 'top',
  'b-l-hand': 'top', 'b-r-hand': 'top',

  // Middle: abdomen, mid back, lower back, hips, glutes
  'f-abdomen': 'middle',
  'b-mid-bk': 'middle',
  'b-lower-bk': 'middle',
  'f-l-hip': 'middle', 'f-r-hip': 'middle',
  'b-l-glute': 'middle', 'b-r-glute': 'middle',

  // Bottom: thighs, hamstrings, knees, calves, feet
  'f-l-thigh': 'bottom', 'f-r-thigh': 'bottom',
  'b-l-hamstr': 'bottom', 'b-r-hamstr': 'bottom',
  'f-l-knee': 'bottom', 'f-r-knee': 'bottom',
  'b-l-knee': 'bottom', 'b-r-knee': 'bottom',
  'f-l-calf': 'bottom', 'f-r-calf': 'bottom',
  'b-l-calf': 'bottom', 'b-r-calf': 'bottom',
  'f-l-foot': 'bottom', 'f-r-foot': 'bottom',
  'b-l-foot': 'bottom', 'b-r-foot': 'bottom',
};

// Returns 'top' | 'middle' | 'bottom' | null.
export function bandFor(zoneId) {
  return ZONE_BAND[zoneId] || null;
}

// Returns whether a zone is on the front side.
export function isFront(zoneId) {
  return typeof zoneId === 'string' && zoneId.startsWith('f-');
}

// Default distribution when the client has not touched any zone yet
// or has not selected any focus zones. Picked to feel reasonable
// for a general massage: back gets slightly more than front, middle
// (where most adults carry tension) dominates over top/bottom.
//
// These defaults are also what shows on initial render before any
// auto-computation kicks in.
export const DEFAULT_DISTRIBUTION = Object.freeze({
  front_pct: 40,
  // back_pct implicit: 60
  top_pct: 20,
  middle_pct: 60,
  bottom_pct: 20,
});

// Auto-derive a distribution from a list of selected focus zones.
// We weight focus zones at 1.0 and ignore avoid zones (those are
// areas the therapist should NOT spend time on; they should not
// inform proportions). If there are no focus zones at all, return
// the default distribution.
//
// Result keys: front_pct, top_pct, middle_pct, bottom_pct (all
// integers summing to 100 within their group).
//
// Examples:
//   [] -> default 40/60, 20/60/20
//   ['f-l-shldr', 'f-neck'] -> 100% front, 100% top, 0% middle, 0% bottom
//   ['b-mid-bk', 'b-l-glute', 'f-l-thigh'] -> 33% front 67% back, 0/67/33
export function computeDistributionFromZones(focusZones) {
  if (!Array.isArray(focusZones) || focusZones.length === 0) {
    return { ...DEFAULT_DISTRIBUTION };
  }
  let frontCount = 0;
  let backCount = 0;
  const bandCounts = { top: 0, middle: 0, bottom: 0 };
  for (const z of focusZones) {
    if (isFront(z)) frontCount++;
    else backCount++;
    const band = bandFor(z);
    if (band) bandCounts[band]++;
  }
  const total = frontCount + backCount;
  // Round to nearest 5 so the sliders snap cleanly (step=5).
  const roundTo5 = n => Math.round(n / 5) * 5;
  let front_pct = total === 0 ? DEFAULT_DISTRIBUTION.front_pct : roundTo5((frontCount / total) * 100);
  // Clamp to 0..100. Step rounding can push 97 to 100 or 3 to 5; we
  // accept that since users can override with sliders anyway.
  front_pct = Math.max(0, Math.min(100, front_pct));

  const bandTotal = bandCounts.top + bandCounts.middle + bandCounts.bottom;
  let top_pct, middle_pct, bottom_pct;
  if (bandTotal === 0) {
    top_pct = DEFAULT_DISTRIBUTION.top_pct;
    middle_pct = DEFAULT_DISTRIBUTION.middle_pct;
    bottom_pct = DEFAULT_DISTRIBUTION.bottom_pct;
  } else {
    top_pct = roundTo5((bandCounts.top / bandTotal) * 100);
    middle_pct = roundTo5((bandCounts.middle / bandTotal) * 100);
    bottom_pct = roundTo5((bandCounts.bottom / bandTotal) * 100);
    // Fix sum-to-100 drift from rounding. Add or subtract the
    // delta from middle since it is the biggest bucket and the
    // change will be least noticeable there.
    const drift = 100 - (top_pct + middle_pct + bottom_pct);
    middle_pct = Math.max(0, Math.min(100, middle_pct + drift));
  }

  return { front_pct, top_pct, middle_pct, bottom_pct };
}

// Adjust three sliders so they sum to 100. When the user moves
// one slider to a new value, the other two need to rebalance to
// keep the sum at 100. Strategy: distribute the delta proportionally
// across the other two based on their current weight.
//
//   prev:    { top: 30, middle: 50, bottom: 20 }
//   changed: 'top' to 50 (delta = +20)
//   result:  top stays at 50, middle and bottom share the -20:
//            middle was 50/(50+20)=71% of the rest -> takes -14
//            bottom was 20/(50+20)=29% of the rest -> takes -6
//            middle = 36, bottom = 14. Sum = 100.
//
// If the other two are both 0, split evenly between them.
// If the new value is >= 100, set the other two to 0.
// All outputs are rounded to nearest integer; drift is absorbed by
// the larger of the two un-changed sliders.
export function rebalanceTriple(prev, changedKey, newValue) {
  const keys = ['top_pct', 'middle_pct', 'bottom_pct'];
  if (!keys.includes(changedKey)) return prev;
  const clampedNew = Math.max(0, Math.min(100, Math.round(newValue)));
  if (clampedNew >= 100) {
    return keys.reduce((acc, k) => ({ ...acc, [k]: k === changedKey ? 100 : 0 }), {});
  }
  const otherKeys = keys.filter(k => k !== changedKey);
  const otherSum = otherKeys.reduce((s, k) => s + (prev[k] || 0), 0);
  const remaining = 100 - clampedNew;
  let result;
  if (otherSum === 0) {
    const half = Math.round(remaining / 2);
    result = {
      [changedKey]: clampedNew,
      [otherKeys[0]]: half,
      [otherKeys[1]]: remaining - half,
    };
  } else {
    const a = Math.round(((prev[otherKeys[0]] || 0) / otherSum) * remaining);
    const b = remaining - a;
    result = {
      [changedKey]: clampedNew,
      [otherKeys[0]]: a,
      [otherKeys[1]]: b,
    };
  }
  return result;
}
