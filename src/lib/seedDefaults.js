// src/lib/seedDefaults.js
//
// Smart defaults for new therapist signups (Tier A0).
//
// Why this exists:
// The marketing copy across Home, WhyBodyMap, Comparison, and Pricing
// promises "Up and running in 2 minutes." That promise depends on a
// new therapist landing in their dashboard with a working booking
// page, not a blank canvas. This module backs that claim by auto-
// populating the minimum a therapist needs to take a real booking.
//
// What gets seeded on a brand-new therapist row:
//   - 3 services (Swedish 60min $85, Deep Tissue 90min $130, Prenatal 60min $90)
//   - 6 availability rows (Mon-Fri 9-5, Sat 9-2; Sunday left closed)
//   - 5 add-ons (Hot Stones, Aromatherapy, Hot Towels, Cupping, Extended Time)
//   - 5 memberships (Wellness Monthly through Quarterly Saver)
//   - 5 packages (3-Session Starter through New Client Trio)
//
// What is NOT seeded:
//   - Events (time-bound; auto-creating future-dated workshops is wrong)
//   - Waivers (legal docs; therapist should review before activating)
//   - Photos / branding (per-therapist personal choices)
//
// Idempotency:
// Each insert step checks whether rows already exist for that
// therapist_id and skips if so. This makes the seeder safe to call
// from multiple signup paths (regular email signup in AuthContext,
// Google paid flow in AuthContext, Google free flow in Onboarding)
// without worrying about double-seeding.
//
// Failure tolerance:
// Each step is wrapped in try/catch. A failure logs and continues.
// We never block signup on a seed step failing — degrading to "blank
// canvas with welcome email already sent" is better than "signup
// throws an error and the therapist sees a generic failure screen."

import { supabase } from './supabase';

// Median pricing for solo LMTs based on industry research. The therapist
// can edit, delete, or replace any of these inside the dashboard.
const SEED_SERVICES = [
  { name: 'Swedish Massage', duration: 60, price: 85, is_couples: false },
  { name: 'Deep Tissue Massage', duration: 90, price: 130, is_couples: false },
  { name: 'Prenatal Massage', duration: 60, price: 90, is_couples: false },
];

// Mon-Fri 9-5, Sat 9-2, Sunday closed. day_of_week: 0=Sunday, 1=Monday, ... 6=Saturday.
// Matches the convention used in src/pages/Dashboard.js around line 156.
const SEED_AVAILABILITY = [
  { day_of_week: 1, start_time: '09:00', end_time: '17:00', active: true }, // Mon
  { day_of_week: 2, start_time: '09:00', end_time: '17:00', active: true }, // Tue
  { day_of_week: 3, start_time: '09:00', end_time: '17:00', active: true }, // Wed
  { day_of_week: 4, start_time: '09:00', end_time: '17:00', active: true }, // Thu
  { day_of_week: 5, start_time: '09:00', end_time: '17:00', active: true }, // Fri
  { day_of_week: 6, start_time: '09:00', end_time: '14:00', active: true }, // Sat
];

// These five mirror SEED_ADDONS in src/pages/Dashboard.js exactly.
const SEED_ADDONS = [
  { name: 'Hot Stones', price: 15, extra_minutes: 0 },
  { name: 'Aromatherapy', price: 10, extra_minutes: 0 },
  { name: 'Hot Towels', price: 8, extra_minutes: 0 },
  { name: 'Cupping Therapy', price: 25, extra_minutes: 15 },
  { name: 'Extended Time +30 min', price: 45, extra_minutes: 30 },
];

// These five mirror SEED_PRESETS in src/components/MembershipsCard.jsx exactly.
const SEED_MEMBERSHIPS = [
  { name: 'Wellness Monthly', monthly_price: 79, monthly_session_credits: 1, max_carryover_credits: 1, addon_discount_percent: 10, description: 'One 60-min session a month, 10% off add-ons' },
  { name: 'Wellness Premium', monthly_price: 149, monthly_session_credits: 2, max_carryover_credits: 1, addon_discount_percent: 15, description: 'Two sessions a month, 15% off add-ons' },
  { name: 'Wellness Plus', monthly_price: 219, monthly_session_credits: 3, max_carryover_credits: 1, addon_discount_percent: 20, description: 'Three sessions a month, 20% off add-ons' },
  { name: 'Couples Monthly', monthly_price: 159, monthly_session_credits: 1, max_carryover_credits: 1, addon_discount_percent: 10, description: 'One couples session a month' },
  { name: 'Quarterly Saver', monthly_price: 65, monthly_session_credits: 1, max_carryover_credits: 3, addon_discount_percent: 5, description: 'One session per month, carry over up to 3' },
];

// These five mirror SEED_PRESETS in src/components/PackagesCard.jsx exactly.
const SEED_PACKAGES = [
  { name: '3-Session Starter', session_count: 3, price: 270, description: 'Save $15 on 3 sessions, expires in 90 days', expires_in_days: 90 },
  { name: '5-Session Bundle', session_count: 5, price: 425, description: 'Save $50 on 5 sessions, our most popular', expires_in_days: 180 },
  { name: '10-Session Pack', session_count: 10, price: 800, description: 'Save $150 on 10 sessions', expires_in_days: 365 },
  { name: 'Couples 3-Pack', session_count: 3, price: 540, description: 'For couples, save $30 on 3 sessions', expires_in_days: 180 },
  { name: 'New Client Trio', session_count: 3, price: 240, description: 'First-time client special, $80 each', expires_in_days: 60 },
];

// Idempotent helper. Returns true if table already has any row for this
// therapist; we use it to skip seeding tables that already have data.
async function tableHasRows(table, therapistId) {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('therapist_id', therapistId)
      .limit(1);
    if (error) return false;
    return (count || 0) > 0;
  } catch {
    return false;
  }
}

// Insert a batch of rows into a table for a given therapist. Logs and
// swallows errors so a single table failure doesn't break the whole seed.
async function seedTable(table, therapistId, rows, label) {
  try {
    const has = await tableHasRows(table, therapistId);
    if (has) {
      console.info(`[seedDefaults] ${label}: skipped (rows already exist)`);
      return { skipped: true };
    }
    const payload = rows.map((r) => ({ ...r, therapist_id: therapistId }));
    const { error } = await supabase.from(table).insert(payload);
    if (error) {
      console.warn(`[seedDefaults] ${label}: insert failed`, error.message);
      return { error: error.message };
    }
    console.info(`[seedDefaults] ${label}: seeded ${rows.length} rows`);
    return { inserted: rows.length };
  } catch (e) {
    console.warn(`[seedDefaults] ${label}: exception`, e?.message || e);
    return { error: String(e) };
  }
}

/**
 * Seed all default catalog data for a brand-new therapist.
 * Safe to call multiple times: each step checks for existing rows
 * and skips if anything is already there. Never throws.
 *
 * @param {string} therapistId - the therapist's UUID
 * @returns {Promise<object>} - per-table status object for logging/debug
 */
export async function seedNewTherapistDefaults(therapistId) {
  if (!therapistId) {
    console.warn('[seedDefaults] called without therapistId, skipping');
    return null;
  }

  // Run all seeds in parallel for speed. None depend on each other.
  // Results are surfaced together for logging.
  const [services, availability, addons, memberships, packages] = await Promise.all([
    seedTable('services', therapistId, SEED_SERVICES.map((s) => ({ ...s, active: true })), 'services'),
    seedTable('availability', therapistId, SEED_AVAILABILITY, 'availability'),
    seedTable('service_addons', therapistId, SEED_ADDONS.map((a) => ({ ...a, active: true })), 'service_addons'),
    seedTable('memberships', therapistId, SEED_MEMBERSHIPS.map((m) => ({ ...m, active: true })), 'memberships'),
    seedTable('packages', therapistId, SEED_PACKAGES.map((p) => ({ ...p, active: true })), 'packages'),
  ]);

  return { services, availability, addons, memberships, packages };
}
