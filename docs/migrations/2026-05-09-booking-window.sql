-- ─────────────────────────────────────────────────────────────────
-- Booking window columns on therapists table
-- May 9, 2026
-- Closes Lindsey #5: minimum advance notice + maximum advance window
-- ─────────────────────────────────────────────────────────────────
--
-- Adds two columns to therapists:
--   minimum_advance_hours  How close to "now" a client can book.
--                          0 = no minimum, default. Common: 24, 48.
--   maximum_advance_days   How far ahead a client can book.
--                          0 = no maximum, default. Common: 60, 90.
--
-- Both nullable / default 0 so existing therapists are unaffected.
-- BookingPage.js reads these on slot generation and on the date
-- picker minDate computation.
--
-- Safe to re-run; both ADD COLUMN clauses use IF NOT EXISTS.

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS minimum_advance_hours INTEGER NOT NULL DEFAULT 0;

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS maximum_advance_days INTEGER NOT NULL DEFAULT 0;

-- Sanity check: surface the new columns.
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'therapists'
  AND column_name IN ('minimum_advance_hours', 'maximum_advance_days');
