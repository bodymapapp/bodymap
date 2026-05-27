-- Calendar v2 schema: recurring blocks + block type + RLS
-- HK May 27 2026: Commit 2 of the calendar build. Updated to include
-- RLS from the start so new tables do not trigger Supabase's
-- 'rls_disabled_in_public' security warning.

-- Step 1: block_type on existing blocked_days
ALTER TABLE blocked_days ADD COLUMN IF NOT EXISTS block_type TEXT DEFAULT 'off';
COMMENT ON COLUMN blocked_days.block_type IS
  'off | marketing_moment | event. Default off = unavailable for booking. Other types do NOT block availability.';

-- Step 2: recurring_blocks table
CREATE TABLE IF NOT EXISTS recurring_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  weekly_days INTEGER[] NOT NULL,
  start_time TIME,
  end_time TIME,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recurring_blocks_therapist ON recurring_blocks(therapist_id);
COMMENT ON TABLE recurring_blocks IS
  'Weekly recurring availability blocks. weekly_days is array of day_of_week (0=Sun, 6=Sat). One row can cover multiple weekdays.';

-- Step 3: RLS on recurring_blocks
ALTER TABLE recurring_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recurring_blocks_therapist_all" ON recurring_blocks;
CREATE POLICY "recurring_blocks_therapist_all" ON recurring_blocks
  FOR ALL TO authenticated
  USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());
DROP POLICY IF EXISTS "recurring_blocks_public_read" ON recurring_blocks;
CREATE POLICY "recurring_blocks_public_read" ON recurring_blocks
  FOR SELECT TO anon
  USING (true);

-- Step 4: recurring_block_exceptions table
CREATE TABLE IF NOT EXISTS recurring_block_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  recurring_block_id UUID NOT NULL REFERENCES recurring_blocks(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(recurring_block_id, exception_date)
);
CREATE INDEX IF NOT EXISTS idx_recurring_block_exceptions_therapist ON recurring_block_exceptions(therapist_id);
COMMENT ON TABLE recurring_block_exceptions IS
  'Single-date overrides to a recurring block. Removing the exception re-enables the block on that date.';

-- Step 5: RLS on recurring_block_exceptions
ALTER TABLE recurring_block_exceptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recurring_block_exceptions_therapist_all" ON recurring_block_exceptions;
CREATE POLICY "recurring_block_exceptions_therapist_all" ON recurring_block_exceptions
  FOR ALL TO authenticated
  USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());
DROP POLICY IF EXISTS "recurring_block_exceptions_public_read" ON recurring_block_exceptions;
CREATE POLICY "recurring_block_exceptions_public_read" ON recurring_block_exceptions
  FOR SELECT TO anon
  USING (true);
