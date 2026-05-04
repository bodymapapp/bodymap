-- Cycle-aligned scheduling
-- 
-- Allows female practitioners (especially LMTs in cycle-syncing community)
-- to map their service menu to four menstrual cycle phases:
--   Menstrual / Follicular / Ovulatory / Luteal
-- When enabled, the public booking page filters available services to only
-- those tagged for the therapist's current phase, so clients see fewer or
-- different services depending on the week — without ever seeing phase names
-- or any biographical info about the therapist.
--
-- Backward compatible: services.phases NULL means "available always" (= all
-- four phases). Existing services keep working without migration.

-- 1. Therapist-level cycle settings
ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS cycle_scheduling_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cycle_start_date date,
  ADD COLUMN IF NOT EXISTS cycle_avg_length integer DEFAULT 28,
  -- Optional override. NULL = use proportional defaults derived from
  -- cycle_avg_length (M:1-5, F:6-13, O:14-17, L:18-end on a 28-day cycle).
  -- Stored as { "menstrual_end": 5, "follicular_end": 13, "ovulatory_end": 17 }.
  ADD COLUMN IF NOT EXISTS cycle_phase_overrides jsonb;

-- 2. Per-service phase tags
-- NULL = always available (backward compatible). Otherwise a subset of
-- ['menstrual','follicular','ovulatory','luteal'].
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS phases text[];

-- 3. Sanity constraint on cycle length (most cycles are 21-45 days)
DO $$ BEGIN
  ALTER TABLE therapists
    ADD CONSTRAINT cycle_avg_length_sane
    CHECK (cycle_avg_length IS NULL OR (cycle_avg_length BETWEEN 18 AND 60));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
