// src/lib/notificationSpec.js
//
// The truth source for the Notification Compliance Dashboard at
// /founder/notifications. Mirrors the IDs and channel expectations
// in docs/NOTIFICATION_MAP.md.
//
// HK May 17 2026 ~5:50am: 'Industrialize the test, not the tester.
// Have all the possibilities in first column and all the
// communication mechanisms in subsequent columns.'
//
// CHANNEL ABBREVIATIONS used in the matrix:
//   T-Bell    Therapist in-app notification (bell drawer)
//   T-Email   Therapist email (Resend)
//   T-SMS     Therapist SMS (Twilio, via the therapist's BYO account)
//   C-Email   Client email (Resend)
//   C-SMS     Client SMS (Twilio, via the therapist's BYO account)
//
// The notification_type column in notification_log must match the
// `eventType` field below. If a function fires an event with a
// type not in this spec, the dashboard won't render it. Add new
// touchpoints here as we ship them, and to NOTIFICATION_MAP.md.

export const CHANNEL_LABELS = {
  app_alert: 'Bell',
  email: 'Email',
  sms: 'SMS',
  push: 'Push',
};

// Client push is tabled until the client portal exists.
//
// HK May 17 2026 ~7am, after architectural debate: 'If client does
// not have a dedicated PWA with their own login, chances are that
// they dont have anything opened or installed or PWA, so there can
// not be any push to clients until we have a client side login.'
//
// The push infrastructure shipped in Phase 11.4 (table, hook, edge
// function, fan-out) is dormant but reusable. When client login is
// built (BLOCK_PLAN Macro #2: Optional client portal), flipping
// this back to 'live' and re-adding push to the C-series specs
// turns it back on with no other code changes needed.
//
// Until then, the dashboard renders C-Push cells as dimmed
// 'queued' badges so the dependency is visible in the matrix.
export const CLIENT_PUSH_STATUS = 'queued';

// Every touchpoint that should fire across the platform.
// Sorted by the C-series, T-series, E-series convention from
// docs/NOTIFICATION_MAP.md.
export const NOTIFICATION_SPEC = [
  // ─── C-series: client journey ──────────────────────────────────
  {
    id: 'C1',
    eventType: 'booking_confirmation',
    title: 'New client welcome + booking confirmation',
    when: 'Right after first booking (count = 1)',
    audience: 'client',
    channels: ['email', 'sms'],
    smsRationale: 'SMS-first per Journey playbook. The booking-confirmation flow currently sends client email only; client SMS is a known gap.',
    series: 'C',
  },
  {
    id: 'C2',
    eventType: 'booking_confirmation',
    title: 'Booking confirmation (returning client)',
    when: 'Every booking after first',
    audience: 'client',
    channels: ['email', 'sms'],
    smsRationale: 'Same as C1 but no intake invite.',
    series: 'C',
  },
  {
    id: 'C3',
    eventType: 'intake_reminder',
    title: 'Intake reminder',
    when: '+24h after booking if intake pending AND session ≥48h away',
    audience: 'client',
    channels: ['sms', 'email'],
    smsRationale: 'Action-required, no substance. SMS gets read, email is backup.',
    series: 'C',
  },
  {
    id: 'C4',
    eventType: 'reminder_48h',
    title: 'Early reminder',
    when: '48 hours before session',
    audience: 'client',
    channels: ['sms', 'email'],
    smsRationale: 'Time-sensitive. SMS primary, email backup with calendar invite.',
    series: 'C',
  },
  {
    id: 'C5',
    eventType: 'reminder_2h',
    title: 'Same-day text (first-timers only)',
    when: '2 hours before session for clients with <10 sessions',
    audience: 'client',
    channels: ['sms'],
    smsRationale: 'SMS only by design. Suppressed for 10+-session regulars (becomes patronizing).',
    series: 'C',
  },
  {
    id: 'C6',
    eventType: 'post_session',
    title: 'Post-session warmth',
    when: '+24 hours after session',
    audience: 'client',
    channels: ['email', 'sms'],
    smsRationale: 'Real message with substance. Email primary, SMS optional.',
    series: 'C',
  },
  {
    id: 'C7',
    eventType: 'client_cancelled_within_policy',
    title: 'Free-cancel confirmation',
    when: 'Client cancels within policy window',
    audience: 'client',
    channels: ['email', 'sms'],
    smsRationale: 'Receipt-shaped, brief.',
    series: 'C',
  },
  {
    id: 'C8',
    eventType: 'client_cancelled_late',
    title: 'Itemized late-cancel',
    when: 'Client cancels inside policy, fee charged',
    audience: 'client',
    channels: ['email', 'sms'],
    smsRationale: 'Has substance (fee breakdown). Email primary, SMS notice that email arrived.',
    series: 'C',
  },
  {
    id: 'C9',
    eventType: 'no_show_notice_no_fee',
    title: 'Polite no-show notice (no fee)',
    when: 'Therapist marks no-show, no card on file or no fee path',
    audience: 'client',
    channels: ['sms', 'email'],
    smsRationale: 'SMS-first. The "we missed you" warm tap-to-rebook. SHIPPED Phase 11.1.',
    series: 'C',
  },
  {
    id: 'C10',
    eventType: 'no_show_charged',
    title: 'Polite no-show notice (charged)',
    when: 'Therapist marks no-show, fee auto-charged to card',
    audience: 'client',
    channels: ['email', 'sms'],
    smsRationale: 'Has substance (receipt). Email primary, SMS notice.',
    series: 'C',
  },
  {
    id: 'C11',
    eventType: 'no_show_payment_request',
    title: 'Polite payment request (no-show, no card)',
    when: 'Therapist marks no-show, no card on file',
    audience: 'client',
    channels: ['sms', 'email'],
    smsRationale: 'The single biggest revenue lever. SMS first with payment link, email backup.',
    series: 'C',
  },
  {
    id: 'C12',
    eventType: 'therapist_cancelled',
    title: 'Therapist-cancel apology + rebook',
    when: 'Therapist cancels a confirmed booking',
    audience: 'client',
    channels: ['sms', 'email'],
    smsRationale: 'High-risk lapse moment. SMS first with rebook link.',
    series: 'C',
  },
  {
    id: 'C13',
    eventType: 'reschedule_confirmation',
    title: 'Reschedule confirmation',
    when: 'Either side reschedules',
    audience: 'client',
    channels: ['email', 'sms'],
    smsRationale: 'Time-sensitive new time. SMS first, email with calendar.',
    series: 'C',
  },
  {
    id: 'C14',
    eventType: 'lapse_nudge',
    title: '"Your Tuesday is open"',
    when: 'Client lapses ~5 weeks (toggle, opt-in)',
    audience: 'client',
    channels: ['sms'],
    smsRationale: 'SMS only per Journey playbook. Lapsed clients are not reading marketing email.',
    series: 'C',
  },
  {
    id: 'C15',
    eventType: 'lapse_final_nudge',
    title: '"Whenever you\'re ready"',
    when: '120 days, last touch',
    audience: 'client',
    channels: ['sms', 'email'],
    smsRationale: 'Last chance. Both channels.',
    series: 'C',
  },

  // ─── T-series: therapist journey ───────────────────────────────
  {
    id: 'T1',
    eventType: 'new_booking',
    title: 'New booking from a client',
    when: 'Client books a session',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email', 'sms'],
    series: 'T',
  },
  {
    id: 'T2',
    eventType: 'new_client_signup',
    title: 'New client signed up',
    when: 'First-ever booking from a new email',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email', 'sms'],
    series: 'T',
  },
  {
    id: 'T3',
    eventType: 'intake_filled',
    title: 'Intake submitted',
    when: 'Client completes intake form',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email'],
    series: 'T',
  },
  {
    id: 'T4',
    eventType: 'payment_received',
    title: 'Payment received',
    when: 'Any deposit, prepayment, or post-session charge succeeds',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email'],
    series: 'T',
  },
  {
    id: 'T5',
    eventType: 'booking_cancelled',
    title: 'Booking cancelled (client side)',
    when: 'Client cancels via booking page or therapist cancels for them',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email', 'sms'],
    series: 'T',
  },
  {
    id: 'T6',
    eventType: 'booking_rescheduled',
    title: 'Booking rescheduled',
    when: 'Either side reschedules',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email'],
    series: 'T',
  },
  {
    id: 'T7',
    eventType: 'no_show_recorded',
    title: 'No-show recorded',
    when: 'Therapist marks a booking as no-show',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email', 'sms'],
    series: 'T',
  },
  {
    id: 'T8',
    eventType: 'agreement_signed',
    title: 'Practice agreement signed',
    when: 'Client signs the waiver',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email'],
    series: 'T',
  },
  {
    id: 'T9',
    eventType: 'gift_purchased',
    title: 'Gift certificate purchased',
    when: 'Someone buys a gift card on the booking page',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email'],
    series: 'T',
  },
  {
    id: 'T10',
    eventType: 'lapse_signal',
    title: 'Regular client going quiet',
    when: 'A regular has not booked in their usual cadence',
    audience: 'therapist',
    channels: ['app_alert', 'push'],
    series: 'T',
  },
  {
    id: 'T11',
    eventType: 'daily_pulse',
    title: 'Daily evening digest',
    when: 'Once a day, 7pm therapist local',
    audience: 'therapist',
    channels: ['email'],
    series: 'T',
  },
  {
    id: 'T12',
    eventType: 'cancellation_fee_charged',
    title: 'Cancellation fee charged',
    when: 'Late-cancel or no-show triggers a card charge',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email'],
    series: 'T',
  },
  {
    id: 'T13',
    eventType: 'system_failure',
    title: 'System failure notification',
    when: 'A notification or critical edge function fails repeatedly',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email'],
    series: 'T',
  },
  {
    id: 'T14',
    eventType: 'refund_issued',
    title: 'Refund issued',
    when: 'A session payment was refunded (Stripe or offline)',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email'],
    series: 'T',
  },
  {
    id: 'C16',
    eventType: 'refund_issued',
    title: 'Refund issued (client receipt)',
    when: 'A payment they made was refunded',
    audience: 'client',
    channels: ['email', 'sms'],
    series: 'C',
  },
];

// All distinct channels across the spec, in display order for the table
// header. Bell-only events leave SMS and Email empty; SMS-only events
// leave Bell and Email empty; etc.
export const ALL_CHANNELS_BY_AUDIENCE = {
  therapist: [
    { channel: 'app_alert', label: 'Bell', short: 'T-Bell' },
    { channel: 'push',      label: 'Push', short: 'T-Push' },
    { channel: 'email',     label: 'Email', short: 'T-Email' },
    { channel: 'sms',       label: 'SMS', short: 'T-SMS' },
  ],
  client: [
    { channel: 'email',     label: 'Email', short: 'C-Email' },
    { channel: 'sms',       label: 'SMS', short: 'C-SMS' },
    { channel: 'push',      label: 'Push', short: 'C-Push' },
  ],
};

// Helper: compute a cell's color given the latest log row + confirm state.
// Returns { color, label, tooltip }.
//
// Color rules:
//   red       no log row at all (never fired)
//   orange    log row exists with status failed/skipped (engine fired, downstream rejected)
//   yellow    log row with status='sent' but confirmed_at null
//   green     log row with status='sent' AND confirmed_at set
//   purple    confirmed_at set but no successful log row (mismatch)
//
// The cell is colored on the LATEST log row only. Older rows are
// ignored for color but visible in the side-panel detail.
export function cellState({ latestLog, anyConfirmed }) {
  if (!latestLog && !anyConfirmed) {
    return { color: 'red', label: 'Never fired', tooltip: 'No notification_log row found for this audience+channel+type.' };
  }
  if (!latestLog && anyConfirmed) {
    return { color: 'purple', label: 'Confirmed but no log', tooltip: 'You confirmed receipt, but no notification_log row exists. Suspicious; investigate.' };
  }
  const status = latestLog.status;
  if (status === 'failed') {
    return { color: 'orange', label: 'Failed', tooltip: `Engine fired but downstream returned failed. Last error: ${latestLog.error_message || 'unknown'}` };
  }
  if (status === 'skipped') {
    return { color: 'orange', label: 'Skipped', tooltip: `Engine intentionally skipped. Reason: ${latestLog.error_message || 'pref_off or no_recipient'}` };
  }
  if (status === 'sent' && !latestLog.confirmed_at) {
    return { color: 'yellow', label: 'Sent, awaiting confirm', tooltip: `Sent at ${latestLog.sent_at}. Tick the checkbox once you confirm receipt on the actual channel.` };
  }
  if (status === 'sent' && latestLog.confirmed_at) {
    return { color: 'green', label: 'Verified', tooltip: `Confirmed received at ${latestLog.confirmed_at}.` };
  }
  return { color: 'red', label: 'Unknown', tooltip: `Unexpected state. status=${status}` };
}
