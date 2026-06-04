-- supabase/migrations/availability_overrides.sql
--
-- HK Jun 4 2026: date-specific availability overrides. Driven by
-- Allison Kogen, whose working hours change week to week.
--
-- Model (locked with HK before build):
--   Recurring weekly hours live in `availability` (one row per
--   day_of_week, optional per-service rows, single block or time_blocks).
--   An override sets CUSTOM HOURS or a DAY OFF for one exact date and
--   WINS over the recurring row for that date. An override can also
--   OPEN a normally-closed day. Overrides are master-level: they apply
--   to every service the therapist offers.
--
--   Entry points (UI ships in later phases, all just write rows here):
--     1. Schedule view: a "Hours today" bar opens a sheet for that date
--     2. Settings: a collapsed editor listing weekly hours + overrides
--     3. Fast helpers: multi-select dates then set once, copy a week ahead
--
-- Backward compatible: with zero override rows, availability behaves
-- exactly as before. The booking page also tolerates this table not yet
-- existing (graceful empty), same as recurring_blocks.

CREATE TABLE IF NOT EXISTS availability_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  -- The exact calendar date this override applies to (therapist local).
  override_date DATE NOT NULL,
  -- TRUE = closed all day (a day off). When TRUE the time columns are
  -- ignored and no slots are offered for the date.
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  -- Single open block for the date, local time. Used when time_blocks is
  -- null or empty. NULL when is_closed.
  start_time TIME,
  end_time TIME,
  -- Optional multiple blocks (split shift, e.g. morning plus evening),
  -- mirroring the recurring availability shape. When present and
  -- non-empty it wins over start_time / end_time. Array of objects like
  -- [{"start":"09:00","end":"12:00"},{"start":"15:00","end":"19:00"}].
  time_blocks JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One override per date per therapist. The editors upsert on this.
  UNIQUE (therapist_id, override_date)
);

CREATE INDEX IF NOT EXISTS availability_overrides_therapist_date_idx
  ON availability_overrides(therapist_id, override_date);

-- RLS: same model as availability / therapist_locations. The therapist
-- owns their overrides; the public booking page can read them so an
-- anonymous client computes correct slots for a date.
-- therapists.id IS the auth.uid() in this schema (no separate
-- auth_user_id column).
ALTER TABLE availability_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "availability_overrides_select_own" ON availability_overrides;
CREATE POLICY "availability_overrides_select_own"
  ON availability_overrides FOR SELECT
  USING (therapist_id = auth.uid());

DROP POLICY IF EXISTS "availability_overrides_insert_own" ON availability_overrides;
CREATE POLICY "availability_overrides_insert_own"
  ON availability_overrides FOR INSERT
  WITH CHECK (therapist_id = auth.uid());

DROP POLICY IF EXISTS "availability_overrides_update_own" ON availability_overrides;
CREATE POLICY "availability_overrides_update_own"
  ON availability_overrides FOR UPDATE
  USING (therapist_id = auth.uid());

DROP POLICY IF EXISTS "availability_overrides_delete_own" ON availability_overrides;
CREATE POLICY "availability_overrides_delete_own"
  ON availability_overrides FOR DELETE
  USING (therapist_id = auth.uid());

-- Public read for the booking page (anon clients computing slots). Same
-- model as availability and services being publicly readable.
DROP POLICY IF EXISTS "availability_overrides_public_read" ON availability_overrides;
CREATE POLICY "availability_overrides_public_read"
  ON availability_overrides FOR SELECT
  TO anon
  USING (TRUE);
