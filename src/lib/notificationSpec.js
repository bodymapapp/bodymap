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
    why: 'Confirms the booking arrived and sets expectations. The first thing a new client experiences from you, the moment trust begins.',
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
    why: 'A confirmation they can save in their calendar, even if they have booked dozens of times before. Quiet reassurance.',
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
    why: 'Helps you arrive prepared at your session, instead of using table time to gather information. A few minutes now means a more attuned session.',
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
    why: 'Gives your client time to look forward to the session, and a graceful way to move it if life has shifted.',
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
    why: 'A gentle nudge on the day for new clients who might be nervous or forgetful. Suppressed for regulars so it never feels patronizing.',
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
    why: 'Closes the loop with a warm follow-up the day after. This is what turns a first-timer into a returner and a returner into a regular.',
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
    why: 'Acknowledges the cancellation kindly so your client leaves with a positive feeling, even when something went wrong. Keeps the door open for next time.',
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
    why: 'A clear, kind acknowledgment of the cancellation and the fee. Explains the why behind the policy without lecturing your client.',
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
    why: 'A warm "we missed you" note that keeps the door open. No fee, no guilt, just a tap-to-rebook link when they are ready.',
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
    why: 'A receipt your client deserves with a warm note alongside. Acknowledges the human moment behind the missed session.',
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
    why: 'Gives your client a graceful way to take care of the fee on their own terms. Protects you from awkward follow-up conversations.',
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
    why: 'A sincere apology and an easy path back when life forces you to cancel. The single most trust-critical moment in the relationship.',
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
    why: 'Replaces a silent date change with a clear, friendly confirmation. Removes the "did the time actually change?" anxiety.',
    audience: 'client',
    channels: ['email', 'sms'],
    smsRationale: 'Time-sensitive new time. SMS first, email with calendar.',
    series: 'C',
  },
  {
    id: 'C14',
    eventType: 'lapse_nudge',
    title: 'Warm 45-day check-in',
    when: 'Client lapses ~5 weeks (toggle, opt-in)',
    why: 'A "thinking of you" note for clients who have drifted. No urgency, no discount, just a warm hello and an open door. Brings ~12% back.',
    audience: 'client',
    channels: ['sms'],
    smsRationale: 'SMS only per Journey playbook. Lapsed clients are not reading marketing email.',
    series: 'C',
  },
  {
    id: 'C15',
    eventType: 'lapse_final_nudge',
    title: 'Respectful final goodbye',
    when: '90 days lapsed, last touch ever',
    why: 'One last respectful "the door stays open" note at 90 days, then we stop forever. Some clients return after a year. The goodbye matters.',
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
    when: 'Client books a session (single booking, or one summary for a bulk package schedule)',
    why: 'So you know to expect them and can prep. Essential for solo practice. When a client schedules several package sessions at once, this fires ONCE as a summary listing all of them, not once per session.',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email', 'sms'],
    series: 'T',
  },
  {
    id: 'T2',
    eventType: 'new_client_signup',
    title: 'New client signed up',
    when: 'First-ever booking from a new email',
    why: 'Flags a brand-new relationship so you can personally welcome them if you like. The first session sets the tone for everything after.',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email', 'sms'],
    series: 'T',
  },
  {
    id: 'T3',
    eventType: 'intake_filled',
    title: 'Intake submitted',
    when: 'Client completes intake form',
    why: 'So you can read it before the session and prepare. Skipping this means rushing intake on the table.',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email'],
    series: 'T',
  },
  {
    id: 'T4',
    eventType: 'payment_received',
    title: 'Payment received',
    when: 'Any deposit, prepayment, package purchase, or post-session charge succeeds',
    why: 'Real-time visibility into your revenue. Helps you reconcile day-of without checking the dashboard. Fires for at-session charges (CheckoutModal), and for package purchases. The $0 package redemptions when those prepaid sessions are later booked do NOT fire this (no money moves).',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email'],
    series: 'T',
  },
  {
    id: 'T5',
    eventType: 'booking_cancelled',
    title: 'Booking cancelled (client side)',
    when: 'Client cancels via booking page or therapist cancels for them',
    why: 'So you know to free up the slot and can reach out personally if needed.',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email', 'sms'],
    series: 'T',
  },
  {
    id: 'T6',
    eventType: 'booking_rescheduled',
    title: 'Booking rescheduled',
    when: 'Either side reschedules',
    why: 'Confirms the change landed and updates your calendar awareness.',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email'],
    series: 'T',
  },
  {
    id: 'T7',
    eventType: 'no_show_recorded',
    title: 'No-show recorded',
    when: 'Therapist marks a booking as no-show',
    why: 'A clear summary of what happened with the fee. Tells you whether to follow up personally.',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email', 'sms'],
    series: 'T',
  },
  {
    id: 'T8',
    eventType: 'agreement_signed',
    title: 'Practice agreement signed',
    when: 'Client signs the waiver',
    why: 'Legal protection. Lets you start the session knowing the waiver is locked in.',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email'],
    series: 'T',
  },
  {
    id: 'T9',
    eventType: 'gift_purchased',
    title: 'Gift certificate purchased',
    when: 'Someone buys a gift card on the booking page',
    why: 'Revenue moment + a future-client signal. Often a loved one introducing someone new to your practice.',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email'],
    series: 'T',
  },
  {
    id: 'T10',
    eventType: 'lapse_signal',
    title: 'Regular client going quiet',
    when: 'A regular has not booked in their usual cadence',
    why: 'A flag to consider reaching out personally. We already sent them a warm nudge, but a note from you lands differently.',
    audience: 'therapist',
    channels: ['app_alert', 'push'],
    series: 'T',
  },
  {
    id: 'T11',
    eventType: 'daily_pulse',
    title: 'Daily evening digest',
    when: 'Once a day, 7pm therapist local',
    why: 'Quick end-of-day snapshot of who you saw, who is coming up, and what needs your attention. Built so you can close the laptop with confidence.',
    audience: 'therapist',
    channels: ['email'],
    series: 'T',
  },
  {
    id: 'T12',
    eventType: 'cancellation_fee_charged',
    title: 'Cancellation fee charged',
    when: 'Late-cancel or no-show triggers a card charge',
    why: 'Confirms your policy did its job and protects your hourly. Includes whether the charge succeeded or needs follow-up.',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email'],
    series: 'T',
  },
  {
    id: 'T13',
    eventType: 'system_failure',
    title: 'System failure notification',
    when: 'A notification or critical edge function fails repeatedly',
    why: 'Catches plumbing problems before they hurt a client. Rare but important when it fires.',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email'],
    series: 'T',
  },
  {
    id: 'T14',
    eventType: 'refund_issued',
    title: 'Refund issued',
    when: 'A session payment was refunded (Stripe or offline)',
    why: 'Keeps your books accurate and gives you a paper trail for the refund.',
    audience: 'therapist',
    channels: ['app_alert', 'push', 'email'],
    series: 'T',
  },
  {
    id: 'C16',
    eventType: 'refund_issued',
    title: 'Refund issued (client receipt)',
    when: 'A payment they made was refunded',
    why: 'A clear receipt of the refund so your client never wonders if it went through. Closes the loop kindly.',
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
