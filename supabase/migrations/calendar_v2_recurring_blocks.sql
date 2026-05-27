-- Calendar v2 schema: recurring blocks + block type + growth moments
-- HK May 27 2026: Commit 2 of the calendar build. Adds the data
-- structures the new CalendarGrid component needs.
--
-- Three additions:
-- 1. blocked_days.block_type enum column (off | marketing_moment | event)
--    Block_type='off' is the existing meaning. Other values reserved for
--    fire #16 (growth moments) and future event tracking.
-- 2. recurring_blocks table for "every Saturday" / "every Sunday" rules
--    with optional override exceptions (a single date that breaks the rule).
-- 3. recurring_block_exceptions table: client-side and therapist-side
--    "unblock just this one" overrides.

-- block_type on existing blocked_days (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blocked_days') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'blocked_days' AND column_name = 'block_type'
    ) THEN
      ALTER TABLE blocked_days ADD COLUMN block_type TEXT DEFAULT 'off';
      COMMENT ON COLUMN blocked_days.block_type IS
        'off | marketing_moment | event. Default off = unavailable for booking. Other types do NOT block availability.';
    END IF;
  END IF;
END $$;

-- recurring_blocks table for weekly recurring patterns
CREATE TABLE IF NOT EXISTS recurring_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  weekly_days INTEGER[] NOT NULL, -- array of day_of_week (0=Sunday, 6=Saturday)
  start_time TIME, -- NULL = full day
  end_time TIME,   -- NULL = full day
  start_date DATE NOT NULL DEFAULT CURRENT_DATE, -- when the rule begins
  end_date DATE,   -- NULL = forever
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_blocks_therapist
  ON recurring_blocks(therapist_id);

COMMENT ON TABLE recurring_blocks IS
  'Weekly recurring availability blocks. weekly_days is array of day_of_week (0=Sun, 6=Sat). One row can cover multiple weekdays (e.g. weekly_days=ARRAY[0,6] for every Saturday AND Sunday). start_date/end_date define the active window.';

-- recurring_block_exceptions for single-date overrides
CREATE TABLE IF NOT EXISTS recurring_block_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  recurring_block_id UUID NOT NULL REFERENCES recurring_blocks(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(recurring_block_id, exception_date)
);

CREATE INDEX IF NOT EXISTS idx_recurring_block_exceptions_therapist
  ON recurring_block_exceptions(therapist_id);

COMMENT ON TABLE recurring_block_exceptions IS
  'Single-date overrides to a recurring block. Example: every Saturday blocked, except this specific Saturday June 15 where the therapist is working a special event. Removing the exception re-enables the block on that date.';
