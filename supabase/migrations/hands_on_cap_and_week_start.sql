-- Hands-on hours cap + week start preference
-- HK May 27 2026: Jacquie asked for a daily hands-on minutes cap
-- (MassageBook has it, we did not). She wants to limit booked
-- massage time per day independent of working hours. Once cap is
-- hit, the booking page stops offering slots for that day, but
-- the therapist can still override from her own side.
--
-- Also adds week_starts_on preference: 0 = Sunday (default per HK
-- May 27), 1 = Monday. Therapist can flip in Schedule tab.

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS max_hands_on_minutes_per_day INTEGER DEFAULT NULL;

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS week_starts_on INTEGER DEFAULT 0;

COMMENT ON COLUMN therapists.max_hands_on_minutes_per_day IS
  'Maximum minutes of hands-on session time bookable per day via the public booking page. NULL = no cap. Therapist can still book past the cap from her own dashboard.';

COMMENT ON COLUMN therapists.week_starts_on IS
  '0 = Sunday (default), 1 = Monday. Affects calendar grid layout in Schedule and Settings tabs.';
