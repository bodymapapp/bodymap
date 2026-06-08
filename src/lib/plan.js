// src/lib/plan.js
//
// Single source of truth for the plan tier and price labels shown to a
// therapist. The header pill, the mobile menu, and the Settings
// membership section all read from here so they can never drift apart.
// The stored value lives on therapists.plan ('free' | 'bronze' | 'silver'
// | 'gold', or null for older rows). 'free' and 'bronze' are the same
// free tier and both read as Bronze.

export function planTier(plan) {
  if (plan === 'silver') return 'Silver';
  if (plan === 'gold') return 'Gold';
  return 'Bronze';
}

export function planPrice(plan) {
  if (plan === 'silver') return '$19/mo';
  if (plan === 'gold') return '$49/mo';
  return 'Free';
}
