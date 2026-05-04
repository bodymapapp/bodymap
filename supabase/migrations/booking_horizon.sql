-- Booking horizon
--
-- Therapist can limit how far in advance clients are allowed to book.
-- NULL = unlimited (default, backward compatible).
-- Use case: cycle-aligned therapists want to cap bookings to ~30 days
-- out so a cycle drift can't misalign far-future appointments.

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS booking_horizon_days integer;

DO $$ BEGIN
  ALTER TABLE therapists
    ADD CONSTRAINT booking_horizon_days_sane
    CHECK (booking_horizon_days IS NULL OR (booking_horizon_days BETWEEN 1 AND 365));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
