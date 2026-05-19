-- supabase/migrations/services_sort_order.sql
--
-- HK May 19 2026: add sort_order to services so therapists can
-- arrange them in their own order rather than being stuck with
-- duration or price ordering.
--
-- Customer ask, Candice Peek via DM: 'I'd like to group together
-- all of my prenatal massage services and postnatal massage
-- services, but when I input the services they are arranged by
-- the amount of time instead of the order I added them into the
-- system.'
--
-- Solution: integer sort_order column. Lower numbers appear first.
-- Default is 9999 for existing rows so they sort alphabetically by
-- name as a fallback. New rows inserted by the app should set this
-- to (max + 10) so it appends to the end.
--
-- Backfill: existing services get sort_order set to a multiple of
-- 10 based on their created_at ascending, per-therapist. That gives
-- the therapist a sensible default that matches the order she
-- originally added them. Steps of 10 leave room to insert between
-- without renumbering.

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 9999;

-- Backfill: per-therapist, order by created_at ascending, assign
-- 10, 20, 30, ...
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY therapist_id ORDER BY created_at ASC) AS rn
  FROM services
)
UPDATE services s
SET sort_order = ranked.rn * 10
FROM ranked
WHERE s.id = ranked.id
  AND s.sort_order = 9999;

-- Helpful index for the common query pattern: services for a given
-- therapist sorted by sort_order
CREATE INDEX IF NOT EXISTS idx_services_therapist_sort
  ON services (therapist_id, sort_order);
