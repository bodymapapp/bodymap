// src/lib/founderAllowlist.js
//
// Single source of truth for who can reach the internal founder/admin
// surfaces (founder hub, retention dashboard, mass SMS, stocktake, funnel).
//
// IMPORTANT: these emails ship inside the client JavaScript bundle and can be
// read by anyone who views the page source. Keep them brand-neutral. Do NOT
// put a personal-name email here. The database also enforces access via RLS;
// this list drives the client-side route guards and UI gating.
//
// Founder/admin account: bodymapdemo@gmail.com (brand-neutral, canonical login).
// If you ever want a private break-glass admin, add a second neutral email you
// control here, not a name-based one.

export const FOUNDER_EMAILS = [
  'bodymapdemo@gmail.com',
];

// Admin pages check membership with ADMIN_EMAILS.has(lowercasedEmail).
export const ADMIN_EMAILS = new Set(FOUNDER_EMAILS.map((e) => e.toLowerCase()));
