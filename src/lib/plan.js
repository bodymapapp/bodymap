// src/lib/plan.js
//
// Single source of truth for the plan tier and price labels shown to a
// therapist. The header pill, the mobile menu, and the Settings
// membership section all read from here so they can never drift apart.
//
// Tier comes from therapists.plan ('free' | 'bronze' | 'silver' | 'gold',
// plus a legacy 'pro'; null on older rows). 'free' and 'bronze' are the
// same free tier and read as Bronze.
//
// Price reflects what the therapist actually pays. The founding cohort is
// on their tier for free (no Stripe subscription), so they read "Free".
// A therapist only reads a dollar price once they have a live, active
// paid subscription. This keeps founding Silver therapists from ever
// seeing a charge they were promised they would not pay.

export function planTier(therapist) {
  const plan = therapist?.plan;
  if (plan === 'silver') return 'Silver';
  if (plan === 'gold' || plan === 'pro') return 'Gold';
  return 'Bronze';
}

export function isPaying(therapist) {
  return Boolean(therapist?.stripe_subscription_id) && therapist?.subscription_status === 'active';
}

export function planPrice(therapist) {
  if (!isPaying(therapist)) return 'Free';
  const plan = therapist?.plan;
  if (plan === 'silver') return '$19/mo';
  if (plan === 'gold' || plan === 'pro') return '$49/mo';
  return 'Free';
}
