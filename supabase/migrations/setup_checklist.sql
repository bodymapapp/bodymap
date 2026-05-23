-- supabase/migrations/setup_checklist.sql
--
-- HK May 23 2026: Setup Checklist (BLOCK_PLAN item 1.9, Maria-persona
-- guided onboarding). Adds two state columns on therapists so the
-- 5-step setup checklist can show accurate progress without nagging.
--
-- The other 3 step states are auto-detected from existing data:
--   Step 2 services: SELECT count(*) FROM services WHERE therapist_id = ? AND price_cents > 0
--   Step 3 hours: business_hours JSON has any non-empty day
--   Step 5 policies+agreement: cancellation_policy_enabled / deposit_enabled /
--     practice_agreement_text changed-from-default (all on the therapists row)
--
-- The 2 columns this migration adds are for steps where there is no
-- data-shaped signal to read:
--
-- 1. skipped_import_at: timestamp when the therapist clicked
--    'I'm starting fresh' on Step 1. Without this, a brand-new
--    therapist who legitimately has no migration data would see Step 1
--    stuck on dash forever, because clients.count = 0 looks identical
--    to 'hasn't imported yet'. Stamping this column lets the auto-
--    detector treat them as complete.
--
-- 2. booking_page_previewed_at: timestamp when the therapist clicked
--    'Look at my booking page' on Step 4. This step is educational
--    rather than configuration-based, so we need an explicit ack that
--    the therapist actually opened the page once. Without this,
--    Step 4 would have no way to flip to complete.
--
-- Both columns are nullable timestamps. NULL means 'not yet done',
-- non-NULL means 'done at that moment'. No backfill needed: existing
-- therapists who have already completed setup will be detected as
-- complete via the other 3 auto-detected steps, and the checklist
-- panel auto-collapses to a single 'Setup complete' line for them.

ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS skipped_import_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booking_page_previewed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.therapists.skipped_import_at IS
  'When the therapist explicitly chose to start fresh without importing data. Set in SetupChecklist Step 1.';
COMMENT ON COLUMN public.therapists.booking_page_previewed_at IS
  'When the therapist clicked Preview on Step 4 of SetupChecklist to view their booking page.';
