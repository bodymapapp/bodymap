// supabase/functions/_shared/paymentMode.ts
//
// Edge function payment mode switch. Mirrors src/lib/paymentMode.js
// for the server-side. Reads PAYMENT_MODE env var and returns
// appropriate Stripe / Square credentials.
//
// USAGE
//   import { getStripeSecret, getSquareAppId, getSquareAccessToken,
//            getSquareApiBase, isTestMode } from '../_shared/paymentMode.ts';
//   const STRIPE_SECRET = getStripeSecret();
//   const SQUARE_TOKEN = getSquareAccessToken();
//
// SAFETY DESIGN
//   - Default is always live. If PAYMENT_MODE is unset or anything
//     other than 'test' (case-insensitive), live keys are returned.
//   - Production Supabase project does NOT have PAYMENT_MODE set.
//     Test/preview Supabase project HAS PAYMENT_MODE='test' AND
//     the parallel _TEST env vars populated.
//   - Live keys are never referenced by test code paths and vice
//     versa. There is no fallback from a missing test key to a
//     live key. If test key is missing we throw.

export function isTestMode(): boolean {
  return (Deno.env.get('PAYMENT_MODE') || 'live').toLowerCase() === 'test';
}

export function paymentModeLabel(): string {
  return isTestMode() ? 'TEST' : 'LIVE';
}

// Stripe secret key swap. Throws if the appropriate key is missing
// rather than silently falling back, so misconfigurations surface
// immediately at the first request rather than mid-flow.
export function getStripeSecret(): string {
  if (isTestMode()) {
    const key = Deno.env.get('STRIPE_TEST_SECRET_KEY');
    if (!key) throw new Error('PAYMENT_MODE=test but STRIPE_TEST_SECRET_KEY is not set');
    return key;
  }
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return key;
}

// Square OAuth app id. Sandbox apps start with 'sandbox-'; production
// apps start with 'sq0idp-'. Both follow the same OAuth flow but hit
// different API hosts. Various edge functions detect sandbox vs prod
// from the prefix (already in square-oauth/index.ts and
// square-oauth-callback/index.ts).
export function getSquareAppId(): string {
  if (isTestMode()) {
    const id = Deno.env.get('SQUARE_TEST_APP_ID');
    if (!id) throw new Error('PAYMENT_MODE=test but SQUARE_TEST_APP_ID is not set');
    return id;
  }
  const id = Deno.env.get('SQUARE_APP_ID');
  if (!id) throw new Error('SQUARE_APP_ID is not set');
  return id;
}

// Square access token swap. Used by edge functions that talk directly
// to the Square API (creating customers, charging cards, etc).
export function getSquareAccessToken(): string {
  if (isTestMode()) {
    const t = Deno.env.get('SQUARE_TEST_ACCESS_TOKEN');
    if (!t) throw new Error('PAYMENT_MODE=test but SQUARE_TEST_ACCESS_TOKEN is not set');
    return t;
  }
  const t = Deno.env.get('SQUARE_ACCESS_TOKEN');
  if (!t) throw new Error('SQUARE_ACCESS_TOKEN is not set');
  return t;
}

// Square API base URL. Sandbox uses connect.squareupsandbox.com,
// production uses connect.squareup.com. We derive this from test mode
// rather than from app id prefix detection (cleaner separation of
// concerns; the prefix check stays where it is for backward compat
// in the OAuth flow).
export function getSquareApiBase(): string {
  return isTestMode()
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';
}

// Optional default location id (some Square edge functions use this
// when therapist has not selected one yet). Same swap pattern.
export function getSquareDefaultLocationId(): string | null {
  if (isTestMode()) {
    return Deno.env.get('SQUARE_TEST_LOCATION_ID') || null;
  }
  return Deno.env.get('SQUARE_DEFAULT_LOCATION_ID') || null;
}
