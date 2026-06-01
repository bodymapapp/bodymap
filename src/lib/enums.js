// src/lib/enums.js
//
// HK May 31 2026: SINGLE SOURCE OF TRUTH for cross-layer enums.
//
// Why this file exists:
// Bugs caused by enum drift between layers (DB CHECK constraint,
// frontend dropdowns, edge function method-label switches, refund
// modal detection) have shipped to production multiple times:
//   - "trade" payment method not in constraint → check constraint error
//   - "no-show" vs "no_show" mismatch in different files
//   - Square method labels showing "Other" in receipts because the
//     edge function didn't know about square_card_on_file
//
// Pattern from here on: import these constants instead of typing
// string literals. Anything that writes to session_payments.payment_method,
// bookings.status, or session_payments.status MUST use these.
//
// Pairing CI check (see check-enum-drift.js): compares this file's
// values against the live DB constraints and fails CI if any drift.
// That stops a developer from adding a new offline method to the
// frontend without adding it to the DB constraint at the same time.

// ─── PAYMENT METHODS ───────────────────────────────────────────────
// Must match session_payments.payment_method CHECK constraint exactly.
// If you add a value here, you MUST also write a migration to add it
// to the constraint, or session_payments INSERTs will fail at runtime.
//
// Categories matter:
//   ONLINE_CARD: refundable via processor API (Stripe or Square)
//   OFFLINE:     manually recorded, refund just flips the row status
export const PAYMENT_METHODS = {
  // Stripe-processed card payments
  STRIPE_CARD_ON_FILE: 'stripe_card_on_file',
  STRIPE_CARD_NEW: 'stripe_card_new',
  STRIPE_PAYMENT_LINK: 'stripe_payment_link',
  // Square-processed card payments
  SQUARE_CARD_ON_FILE: 'square_card_on_file',
  SQUARE_CARD_NEW: 'square_card_new',
  SQUARE_PAYMENT_LINK: 'square_payment_link',
  // Offline / manually-recorded payments
  CASH: 'cash',
  VENMO: 'venmo',
  ZELLE: 'zelle',
  CASHAPP: 'cashapp',
  CHECK: 'check',
  TRADE: 'trade',
  PAID_ELSEWHERE: 'paid_elsewhere',
  COMPED: 'comped',
  OTHER: 'other',
};

// Subset arrays used by UIs that need to iterate.
export const STRIPE_PAYMENT_METHODS = [
  PAYMENT_METHODS.STRIPE_CARD_ON_FILE,
  PAYMENT_METHODS.STRIPE_CARD_NEW,
  PAYMENT_METHODS.STRIPE_PAYMENT_LINK,
];

export const SQUARE_PAYMENT_METHODS = [
  PAYMENT_METHODS.SQUARE_CARD_ON_FILE,
  PAYMENT_METHODS.SQUARE_CARD_NEW,
  PAYMENT_METHODS.SQUARE_PAYMENT_LINK,
];

export const ONLINE_CARD_PAYMENT_METHODS = [
  ...STRIPE_PAYMENT_METHODS,
  ...SQUARE_PAYMENT_METHODS,
];

// Offline methods rendered as choices in CheckoutModal's "Mark as paid"
// flow. Order matters: it determines the dropdown order. label is the
// user-facing string; value MUST be a PAYMENT_METHODS value.
export const OFFLINE_PAYMENT_METHODS_FOR_PICKER = [
  { value: PAYMENT_METHODS.CASH,           label: 'Cash' },
  { value: PAYMENT_METHODS.VENMO,          label: 'Venmo' },
  { value: PAYMENT_METHODS.ZELLE,          label: 'Zelle' },
  { value: PAYMENT_METHODS.CASHAPP,        label: 'Cash App' },
  { value: PAYMENT_METHODS.CHECK,          label: 'Check' },
  { value: PAYMENT_METHODS.TRADE,          label: 'Trade or barter' },
  { value: PAYMENT_METHODS.PAID_ELSEWHERE, label: 'Paid before switchover' },
  { value: PAYMENT_METHODS.COMPED,         label: 'Comped' },
  { value: PAYMENT_METHODS.OTHER,          label: 'Other' },
];

// Display label used in receipts and refund summaries. Edge functions
// import this so therapist + client emails always show the right name
// (was a recurring bug source: "Other" appearing for Square methods).
export const PAYMENT_METHOD_LABELS = {
  [PAYMENT_METHODS.STRIPE_CARD_ON_FILE]: 'Card on file',
  [PAYMENT_METHODS.STRIPE_CARD_NEW]: 'Card',
  [PAYMENT_METHODS.STRIPE_PAYMENT_LINK]: 'Stripe payment link',
  [PAYMENT_METHODS.SQUARE_CARD_ON_FILE]: 'Square card on file',
  [PAYMENT_METHODS.SQUARE_CARD_NEW]: 'Square card',
  [PAYMENT_METHODS.SQUARE_PAYMENT_LINK]: 'Square payment link',
  [PAYMENT_METHODS.CASH]: 'Cash',
  [PAYMENT_METHODS.VENMO]: 'Venmo',
  [PAYMENT_METHODS.ZELLE]: 'Zelle',
  [PAYMENT_METHODS.CASHAPP]: 'Cash App',
  [PAYMENT_METHODS.CHECK]: 'Check',
  [PAYMENT_METHODS.TRADE]: 'Trade or barter',
  [PAYMENT_METHODS.PAID_ELSEWHERE]: 'Paid before switchover',
  [PAYMENT_METHODS.COMPED]: 'Comped',
  [PAYMENT_METHODS.OTHER]: 'Other',
};

export function isOnlineCardMethod(method) {
  return ONLINE_CARD_PAYMENT_METHODS.includes(method);
}

export function isStripeMethod(method) {
  return STRIPE_PAYMENT_METHODS.includes(method);
}

export function isSquareMethod(method) {
  return SQUARE_PAYMENT_METHODS.includes(method);
}

// ─── PAYMENT STATUS ────────────────────────────────────────────────
// Must match session_payments.status CHECK constraint.
export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  REFUNDED: 'refunded',
  VOIDED: 'voided',
  FAILED: 'failed',
};

// ─── BOOKING STATUS ─────────────────────────────────────────────────
// Must match bookings.status CHECK constraint (if one exists; today
// the column is text with no constraint, but the app treats these as
// the legal set).
export const BOOKING_STATUSES = {
  PENDING_APPROVAL: 'pending-approval',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
  RESCHEDULED: 'rescheduled',
  PENDING_DEPOSIT: 'pending-deposit',
};
