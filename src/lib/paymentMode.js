// src/lib/paymentMode.js
//
// Payment mode switch: lets the booking page and dashboard run against
// Stripe test mode and Square sandbox without touching production keys.
//
// HOW IT WORKS
//   - Production environment (mybodymap.app): REACT_APP_PAYMENT_MODE is
//     unset OR set to 'live'. Live Stripe and Square keys are used.
//   - Vercel preview environments: REACT_APP_PAYMENT_MODE='test'.
//     Test/sandbox keys are used.
//
// SAFETY DESIGN
//   - Default is always live. If the env var is missing, we go live.
//     This means a forgotten env var never silently puts production
//     into test mode.
//   - Test keys live in DIFFERENT env vars from live keys. Live keys
//     are NEVER referenced by test code paths and vice versa.
//   - When test mode is active, a visible banner appears in the UI so
//     you can confirm at a glance which environment you are using.
//
// FRONTEND vs EDGE FUNCTIONS
//   This file handles the FRONTEND swap (Stripe publishable key only;
//   Square's frontend gets applicationId/locationId from server-side
//   edge functions, not from env directly).
//
//   Edge functions handle their own swap by reading PAYMENT_MODE and
//   choosing between STRIPE_SECRET_KEY / STRIPE_TEST_SECRET_KEY,
//   SQUARE_APP_ID / SQUARE_TEST_APP_ID, etc. See
//   supabase/functions/_shared/paymentMode.ts.

export function isTestMode() {
  return (process.env.REACT_APP_PAYMENT_MODE || 'live').toLowerCase() === 'test';
}

export function paymentModeLabel() {
  return isTestMode() ? 'TEST MODE' : 'LIVE';
}

export function getStripePublishableKey() {
  if (isTestMode()) {
    return process.env.REACT_APP_STRIPE_TEST_PUBLISHABLE_KEY;
  }
  return process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
}
