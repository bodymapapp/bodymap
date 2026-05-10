-- ─────────────────────────────────────────────────────────────────
-- Per-service availability (Lindsey #4, May 10 2026)
-- ─────────────────────────────────────────────────────────────────
--
-- Adds an optional service_id to the availability table so a single
-- service can override the therapist's master weekly schedule.
--
-- DESIGN
--
-- Existing behavior is preserved by default:
--   availability rows with service_id = NULL apply to ALL services
--   (the therapist's master schedule). This is the current behavior;
--   no migration of existing rows needed.
--
-- New behavior unlocked:
--   When a service has at least one availability row with its
--   service_id set, that service's bookable times come from those
--   rows instead of the master schedule. Falls back to master if
--   the service has zero service-specific rows.
--
-- Therapist UX (in commits to follow):
--   In Settings -> Services list, each service gets a small
--   'Custom hours' link. Clicking it opens a per-service mini
--   availability editor (same 7-day grid as master). When the
--   therapist saves, those rows are written with service_id set.
--   When they clear all rows, the service falls back to master.
--
-- WHY service_id NULL = master, NOT a separate 'is_master' flag:
--   The dual-meaning is intuitive ('this row applies to no specific
--   service, so it applies to all') and a NULL FK is cheap. A
--   separate flag would just duplicate the same information.
--
-- IDEMPOTENT
--
-- ADD COLUMN IF NOT EXISTS. Safe to re-run.

ALTER TABLE availability
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_availability_service_id
  ON availability(service_id) WHERE service_id IS NOT NULL;

-- Sanity check
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'availability'
  AND column_name IN ('service_id', 'therapist_id', 'day_of_week')
ORDER BY column_name;
