-- supabase/migrations/show_preview_data.sql
--
-- HK May 18 2026: Candice reported "How do I get it off preview mode?"
-- after seeing the sample client "Emma Reyes" on her calendar. The
-- ScheduleDashboard mixes sample appointments in whenever upcoming
-- real bookings are < 3, which is confusing for therapists who have
-- just a few real bookings sitting alongside fake ones.
--
-- Fix: a per-therapist toggle that controls whether sample data shows
-- on the schedule. Default ON so brand-new accounts still get the
-- populated demo (good for onboarding and marketing screenshots).
-- Therapist can turn it off the moment they're ready, via a 'Hide
-- previews' link on the Schedule page itself.
--
-- We keep the existing < 3 threshold behavior for backward compat:
-- when show_preview_data is true, samples appear if upcoming real
-- bookings < 3 (today's behavior). When false, samples never appear
-- regardless of how empty the calendar is.

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS show_preview_data boolean DEFAULT true;
