-- supabase/migrations/buffer_time.sql
--
-- HK May 18 2026: per BLOCK_PLAN.md Ribbon 1 'Buffer time between
-- sessions'. The therapist sets X minutes of buffer that gets blocked
-- from the available slots after every booking, so they always have
-- prep/cleanup time between back-to-back clients.
--
-- The public BookingPage already reads therapist.buffer_enabled and
-- therapist.buffer_minutes to apply the buffer when generating
-- available slots (see src/pages/BookingPage.js line 1249). What was
-- missing:
--   (1) the columns themselves on the therapists table
--   (2) Settings UI for the therapist to toggle and pick minutes
--   (3) the same buffer applied in BookingModal (therapist-side
--       create flow), so the therapist doesn't accidentally
--       schedule themselves a back-to-back with no buffer
--
-- This migration only adds the columns. The Settings UI and
-- BookingModal patch ship in the same commit.
--
-- Default: buffer_enabled false (OFF by default, per HK memory),
-- buffer_minutes 15 (the most common industry default, matches
-- Acuity and Vagaro pre-fills).

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS buffer_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS buffer_minutes integer DEFAULT 15;
