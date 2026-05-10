-- ─────────────────────────────────────────────────────────────────
-- Efficient scheduling toggles on therapists table
-- May 10, 2026
-- Closes Lindsey #7: disallow gaps in the day
-- ─────────────────────────────────────────────────────────────────
--
-- Adds two columns to therapists:
--   scheduling_mode        TEXT default 'normal'
--                          values: 'normal' | 'efficient'
--   efficient_strictness   TEXT default 'soft'
--                          values: 'soft' | 'hard'
--
-- Both nullable / default sensible so existing therapists keep
-- their current behavior (slot generation unchanged for them).
-- BookingPage.js reads these on slot generation.
--
-- Safe to re-run; both ADD COLUMN clauses use IF NOT EXISTS.

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS scheduling_mode TEXT NOT NULL DEFAULT 'normal';

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS efficient_strictness TEXT NOT NULL DEFAULT 'soft';

-- Sanity check: confirm new columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'therapists'
  AND column_name IN ('scheduling_mode', 'efficient_strictness');
