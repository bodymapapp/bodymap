-- ============================================================
-- Admin flag: founder's manual classification of a therapist row.
-- Overrides the heuristic is_dummy check in FounderDashboard.
-- Values: 'normal' (default), 'suspicious', 'mine' (founder's own test account).
-- Only admin emails can update this via the founder dashboard UI.
-- ============================================================

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS admin_flag text DEFAULT 'normal';

-- Constrain to known values so a typo can't break dashboard filtering.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'therapists_admin_flag_check'
  ) THEN
    ALTER TABLE therapists
      ADD CONSTRAINT therapists_admin_flag_check
      CHECK (admin_flag IN ('normal', 'suspicious', 'mine'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_therapists_admin_flag ON therapists(admin_flag) WHERE admin_flag != 'normal';
