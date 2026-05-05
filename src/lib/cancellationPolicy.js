// src/lib/cancellationPolicy.js
//
// Helpers for the cancellation policy feature.
//
// The policy answers "what happens if a client changes plans?" in
// plain English. Therapists configure rules in Settings. Clients see
// the policy text on the booking page. (Phase 2 wires Stripe card
// capture + auto-charge based on these rules.)
//
// Default policy is industry-reasonable (24h grace + 50% within 24h
// + 100% same-day for cancels) so most therapists never need to edit.
// All percentages are 0-100. All thresholds are in hours.

export const DEFAULT_POLICY = {
  enabled: false,
  card_required_first_timers: false,
  card_required_regulars: false,
  cancel_24h_plus_percent: 0,
  cancel_2_to_24h_percent: 50,
  cancel_under_2h_percent: 100,
  reschedule_24h_plus_percent: 0,
  reschedule_under_24h_percent: 25,
  no_show_percent: 100,
  custom_text: null,
};

// Get effective policy for a therapist.
// Returns DEFAULT_POLICY if none saved.
export function effectivePolicy(therapist) {
  const saved = therapist?.cancellation_policy;
  const enabled = !!therapist?.cancellation_policy_enabled;
  if (!saved || typeof saved !== 'object') {
    return { ...DEFAULT_POLICY, enabled };
  }
  return { ...DEFAULT_POLICY, ...saved, enabled };
}

// Build the plain-English policy text shown to clients on the booking
// page. Therapists can override by setting custom_text. Generated text
// is intentionally simple and reads like hotel/airline policies.
export function generatePolicyText(policy) {
  if (policy.custom_text && policy.custom_text.trim().length > 0) {
    return policy.custom_text;
  }

  const lines = [];
  lines.push('Cancellation policy');
  lines.push('');

  // Cancel rules
  const c1 = policy.cancel_24h_plus_percent;
  const c2 = policy.cancel_2_to_24h_percent;
  const c3 = policy.cancel_under_2h_percent;
  if (c1 > 0 || c2 > 0 || c3 > 0) {
    lines.push('If you cancel:');
    if (c1 === 0) {
      lines.push(`  • More than 24 hours ahead: no charge`);
    } else {
      lines.push(`  • More than 24 hours ahead: ${c1}% of session`);
    }
    if (c2 > 0) lines.push(`  • Within 24 hours of the appointment: ${c2}% of session`);
    if (c3 > 0) lines.push(`  • Within 2 hours of the appointment: ${c3}% of session`);
    lines.push('');
  }

  // Reschedule rules
  const r1 = policy.reschedule_24h_plus_percent;
  const r2 = policy.reschedule_under_24h_percent;
  if (r1 > 0 || r2 > 0) {
    lines.push('If you reschedule:');
    if (r1 === 0) {
      lines.push(`  • More than 24 hours ahead: no charge`);
    } else {
      lines.push(`  • More than 24 hours ahead: ${r1}% of session`);
    }
    if (r2 > 0) lines.push(`  • Within 24 hours of the appointment: ${r2}% of session`);
    lines.push('');
  }

  // No-show rule
  const ns = policy.no_show_percent;
  if (ns > 0) {
    lines.push(`If you do not show up: ${ns}% of session.`);
    lines.push('');
  }

  // Card on file note
  if (policy.card_required_first_timers || policy.card_required_regulars) {
    lines.push('A card on file is required at booking. It is only charged if the policy above triggers.');
  }

  return lines.join('\n').trim();
}

// One-line summary for the Settings preview area.
export function policySummary(policy) {
  if (!policy.enabled) return 'No cancellation policy set';
  const parts = [];
  if (policy.cancel_under_2h_percent > 0) parts.push(`Same-day cancel: ${policy.cancel_under_2h_percent}%`);
  if (policy.no_show_percent > 0) parts.push(`No-show: ${policy.no_show_percent}%`);
  if (parts.length === 0) return 'Policy on, no charges configured';
  return parts.join(' · ');
}
