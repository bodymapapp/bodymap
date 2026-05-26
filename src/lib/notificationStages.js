// src/lib/notificationStages.js
//
// Maps each notification touchpoint to one of the 6 stages from the
// published Client Lifetime Journey playbook at /docs/CLIENT_LIFETIME_JOURNEY.html
//
// The 6 stages, in order, match the playbook headings exactly. The
// Settings UI groups touchpoints by these stages so the therapist sees
// the same mental model in Settings that they read in the playbook.
//
// HK May 26 2026: 'we wrote an article on this... Use that instead of
// generic stages.' This file enforces that mapping is authoritative.

export const JOURNEY_STAGES = [
  {
    key: 'first_contact',
    label: 'First contact',
    eyebrow: 'From booking page to first session confirmed',
    description: "Everything that happens between a client finding the therapist and their first session being confirmed. The platform's job: confirm, prepare, set expectations.",
    masterToggleKey: null,
    masterToggleLabel: null,
  },
  {
    key: 'first_session',
    label: 'First session',
    eyebrow: '48 hours before, during, and after the first session',
    description: 'The most important window in the client relationship. Reminders, warmth, and the post-session recap that turns a first-timer into a returner.',
    masterToggleKey: null,
    masterToggleLabel: null,
  },
  {
    key: 'becoming_regular',
    label: 'Becoming a regular',
    eyebrow: 'Sessions 2 through 5',
    description: 'The therapist is learning the client, the client is learning the therapist. Gentle return nudges, intake follow-ups, and continuity emails belong here.',
    masterToggleKey: 'intake_reminders_enabled_at',
    masterToggleLabel: 'Intake reminders',
    masterToggleNote: 'When ON, clients with pending intakes get a gentle nudge 24 hours after booking. Only applies to bookings made after you turn this on, never retroactive.',
  },
  {
    key: 'lifetime_client',
    label: 'Lifetime client',
    eyebrow: 'Sessions 5 onward, the relationship is real',
    description: 'The platform mostly steps back. Only the essential touchpoints stay on. The relationship carries the rest.',
    masterToggleKey: null,
    masterToggleLabel: null,
  },
  {
    key: 'off_ramps',
    label: 'Off-ramps',
    eyebrow: 'Cancellations, no-shows, refunds, payment events',
    description: 'These can happen at any point in the journey. The platform names what happened, attaches the policy, and keeps the door open. This is where most scheduling platforms fail badly.',
    masterToggleKey: null,
    masterToggleLabel: null,
  },
  {
    key: 'lapse_return',
    label: 'Lapse and return',
    eyebrow: 'Win-backs, final reach, graceful goodbye',
    description: 'A warm hello at 45 days, a respectful goodbye at 90. Never a guilt trip, never a spam blast. After 90 days we stop.',
    masterToggleKey: 'lapse_checkins_enabled_at',
    masterToggleLabel: 'Lapse check-ins',
    masterToggleNote: 'When ON, clients who have not booked in 45 days get a warm thinking-of-you nudge, with a final goodbye at 90 days. Only fires for lapses that start after you turn this on, never sweeps existing client history.',
  },
];

// The mapping. notification_type or eventType from notificationSpec.js
// maps to one of the stage keys above. Touchpoints not listed here
// default to 'off_ramps' (safer than misclassifying).
//
// Note: T14 renewal_due has its own master gate too, but it lives in
// the off_ramps stage because membership renewals are a payment event
// from the lifecycle perspective.

export const TOUCHPOINT_TO_STAGE = {
  // First contact: arrival -> confirmation -> intake invitation
  'C1': 'first_contact',  // new client welcome + booking confirmation
  'C2': 'first_contact',  // returning client booking confirmation
  'T1': 'first_contact',  // therapist alert for new booking
  'T2': 'first_contact',  // therapist alert for new client signup
  'T13': 'first_contact', // booking approval request to therapist
  'T3': 'first_contact',  // payment received notification to therapist

  // First session: 48h before through warmth after
  'C4': 'first_session',  // 48h early reminder
  'C5': 'first_session',  // 2h same-day reminder (SMS-only)
  'C6': 'first_session',  // post-session warmth

  // Becoming a regular: intake nudges, returning rhythm
  'C3': 'becoming_regular',  // intake reminder (gated)
  'T4': 'becoming_regular',  // intake submitted alert
  'C13': 'becoming_regular', // refund issued to client (when it happens during this phase)

  // Lifetime client: minimal touch, milestone signals
  'T6': 'lifetime_client',   // daily practice pulse / digest
  'T11': 'lifetime_client',  // weekly summary
  'T9': 'lifetime_client',   // new review received

  // Off-ramps: cancels, no-shows, refunds, payment events
  'C7':  'off_ramps',  // therapist-cancelled
  'C8':  'off_ramps',  // client-cancelled within policy
  'C9':  'off_ramps',  // client-cancelled late (with fee)
  'C10': 'off_ramps',  // reschedule confirmation
  'C11': 'off_ramps',  // no-show charged
  'C12': 'off_ramps',  // no-show payment request
  'C16': 'off_ramps',  // no-show no fee
  'T5':  'off_ramps',  // cancellation received (therapist alert)
  'T7':  'off_ramps',  // refund issued (therapist alert)
  'T12': 'off_ramps',  // no-show occurred (therapist alert)
  'T8':  'off_ramps',  // gift card purchased
  'T14': 'off_ramps',  // membership renewal due (gated separately)

  // Lapse + return
  'C14': 'lapse_return',  // first lapse nudge
  'C15': 'lapse_return',  // final lapse nudge
  'T10': 'lapse_return',  // therapist lapse signal
};

// Defaults for new therapists. Tier 1 + first-session essentials stay
// ON. Optional retention features stay OFF until therapist opts in via
// the master toggle.
//
// Shape mirrors what notification_prefs JSONB stores on the therapists
// table: { client: { <touchpoint_id>: { email: bool, sms: bool, push: bool } } }
//
// SMS and push default to false everywhere for Phase 2 (email only).

const DEFAULT_ON = { email: true, sms: false, push: false };
const DEFAULT_OFF = { email: false, sms: false, push: false };

export function defaultPrefsForTouchpoint(touchpointId) {
  // Off-by-default touchpoints require explicit therapist opt-in:
  //   - lapse_return touchpoints (master gated)
  //   - intake_reminder (master gated)
  //   - renewal_due (master gated)
  //   - lifetime_client touchpoints (some therapists want quiet mode)
  const stage = TOUCHPOINT_TO_STAGE[touchpointId];
  if (stage === 'lapse_return') return DEFAULT_OFF;
  if (stage === 'lifetime_client') return DEFAULT_OFF;
  if (touchpointId === 'C3' || touchpointId === 'T14') return DEFAULT_OFF;
  return DEFAULT_ON;
}

// Returns the stage object for a given touchpoint id.
export function stageForTouchpoint(touchpointId) {
  const key = TOUCHPOINT_TO_STAGE[touchpointId] || 'off_ramps';
  return JOURNEY_STAGES.find(s => s.key === key);
}

// Returns all touchpoint ids that belong to a stage.
export function touchpointsInStage(stageKey) {
  return Object.entries(TOUCHPOINT_TO_STAGE)
    .filter(([_, v]) => v === stageKey)
    .map(([k]) => k);
}
