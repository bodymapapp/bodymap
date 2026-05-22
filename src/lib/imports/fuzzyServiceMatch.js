// src/lib/imports/fuzzyServiceMatch.js
//
// Fuzzy service matching for imports (HK May 21 2026 evening,
// full version no shortcuts). When a CSV references a service
// name that doesn't exactly match an existing service, propose
// the closest match rather than silently auto-creating a
// duplicate.
//
// Example: CSV has "Restorative Relaxation Massage", existing
// services include "Relaxation Massage". Without fuzzy matching,
// we auto-create a duplicate service. With fuzzy matching, we
// surface the existing one as a suggestion the therapist can
// approve in one tap.
//
// API:
//   findSimilarServices(candidateName, existingServices, opts)
//     Returns: Array<{ id, name, score, reason }>
//     sorted by score desc. Score is 0..1.
//
//   normalizeServiceName(name)
//     Removes stop-words and noise, returns lowercase comparable form.
//     'Restorative Relaxation Massage 60 min' -> 'relaxation'
//
//   levenshteinSimilarity(a, b)
//     Returns 0..1, where 1.0 = identical. Used as the base score.
//
// THRESHOLD:
//   Default: 0.70 minimum similarity to surface as a candidate.
//   Anything below is treated as a genuinely new service.

// Stop words and noise terms that don't carry meaning for matching.
// Removing them lets 'Restorative Relaxation Massage' and 'Relaxation Massage'
// both reduce to 'relaxation', producing a perfect match.
const STOP_WORDS = new Set([
  // Quality/branding prefixes
  'restorative', 'deluxe', 'signature', 'premium', 'classic', 'standard',
  'special', 'custom', 'specialty', 'advanced', 'basic', 'introductory',
  'intro', 'starter', 'express', 'extended', 'mini',
  // Common service-category words that add noise
  'massage', 'therapy', 'therapeutic', 'session', 'treatment', 'service',
  // Duration markers (often appended to service names)
  'min', 'minute', 'minutes', 'mins', 'hr', 'hour', 'hours',
  // Articles and prepositions
  'the', 'a', 'an', 'of', 'with', 'and', 'or', 'for',
]);

// Numeric tokens (like duration "60") are stripped before comparison.
// Use this regex on each token.
const PURE_NUMBER = /^\d+$/;

export function normalizeServiceName(name) {
  if (!name) return '';
  // Lowercase, remove punctuation, split on whitespace
  const cleaned = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const tokens = cleaned.split(' ')
    .filter(t => !STOP_WORDS.has(t))
    .filter(t => !PURE_NUMBER.test(t));
  return tokens.join(' ');
}

// Standard Levenshtein distance (iterative two-row implementation).
function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,      // insertion
        prev[j] + 1,           // deletion
        prev[j - 1] + cost     // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

// Returns 0..1 similarity. 1.0 = identical, 0.0 = completely different.
export function levenshteinSimilarity(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

// Find services similar to a candidate name. Returns sorted matches.
export function findSimilarServices(candidateName, existingServices, opts = {}) {
  const threshold = opts.threshold ?? 0.70;
  const maxResults = opts.maxResults ?? 3;

  if (!candidateName || !existingServices?.length) return [];

  const normCandidate = normalizeServiceName(candidateName);
  if (!normCandidate) return [];

  const candidates = [];
  for (const svc of existingServices) {
    const normExisting = normalizeServiceName(svc.name);
    if (!normExisting) continue;

    // Skip identical (those would match exactly via the existing
    // resolveServiceId; fuzzy matching is for NEAR matches only)
    if (normExisting === normCandidate) continue;

    // Levenshtein on normalized forms
    const score = levenshteinSimilarity(normCandidate, normExisting);

    // Bonus: substring containment. "Deep Tissue" contains all of
    // "Deep Tissue Massage" after normalization. If one is a
    // substring of the other, boost the score by 0.1.
    let boost = 0;
    if (normCandidate.includes(normExisting) || normExisting.includes(normCandidate)) {
      boost = 0.1;
    }

    const finalScore = Math.min(1, score + boost);
    if (finalScore >= threshold) {
      // Reason describes WHY this matched, for the UI
      let reason;
      if (boost > 0) {
        reason = `One name is contained in the other after removing common words`;
      } else if (score >= 0.85) {
        reason = `Very similar after removing common words`;
      } else {
        reason = `Similar after removing common words`;
      }
      candidates.push({
        id: svc.id,
        name: svc.name,
        score: finalScore,
        reason,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, maxResults);
}

// Helper to detect, given a list of new service names from a CSV
// and a list of existing services, which new ones have a fuzzy
// match worth surfacing. Used during the import preview phase.
//
// Returns: Map<candidateName, Array<match>>
export function detectFuzzyMatches(newServiceNames, existingServices, opts) {
  const result = new Map();
  for (const name of newServiceNames) {
    const matches = findSimilarServices(name, existingServices, opts);
    if (matches.length > 0) {
      result.set(name, matches);
    }
  }
  return result;
}
