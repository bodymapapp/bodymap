-- ─────────────────────────────────────────────────────────────────
-- Add client_id to bookings + backfill from email match
-- May 9, 2026
-- HK direction: schema drift between code (expects client_id) and
-- production DB (does not have client_id). Code paths affected:
--   - ScheduleDashboard.js cancellation card-on-file lookup
--   - ImportClients.js appointment import (insert tries client_id)
--   - Future Item 37 cancel/reschedule flow
--   - Square / Stripe edge functions referencing bookings.client_id
-- ─────────────────────────────────────────────────────────────────
--
-- WHAT THIS MIGRATION DOES
--
-- 1. Adds client_id UUID column to bookings (nullable; some legacy
--    bookings genuinely have no client we can link to).
-- 2. Backfills client_id by matching booking.client_email (lowercased
--    + trimmed) against clients.email (lowercased + trimmed) within
--    the same therapist_id. Multi-match (same email, multiple client
--    rows) takes any match, intentionally non-deterministic since
--    that should not happen in well-formed data anyway.
-- 3. Adds an index on bookings(client_id) for cancel/reschedule
--    flows that look up "all bookings for this client".
-- 4. Does NOT add a NOT NULL or FOREIGN KEY constraint. Reasons:
--      - Some legacy bookings genuinely have no email
--      - We want imports of new bookings to not fail just because
--        the client row was not auto-created yet
--      - FK constraint can be added later once we are confident all
--        rows backfilled correctly
--
-- IDEMPOTENCE
--
-- Safe to re-run. ADD COLUMN uses IF NOT EXISTS. Backfill UPDATE
-- only writes where client_id IS NULL, so re-running does not
-- clobber any client_ids that were set by application code in
-- between runs.

-- Step 1: Add the column
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS client_id UUID;

-- Step 2: Index for client-scoped queries
CREATE INDEX IF NOT EXISTS idx_bookings_client_id
  ON bookings(client_id) WHERE client_id IS NOT NULL;

-- Step 3: Backfill from email match
-- Joins bookings to clients within the same therapist, by lowercased
-- trimmed email. Only updates rows where client_id is currently
-- NULL (idempotent on re-run).
UPDATE bookings b
SET client_id = c.id
FROM clients c
WHERE b.client_id IS NULL
  AND b.therapist_id = c.therapist_id
  AND b.client_email IS NOT NULL
  AND c.email IS NOT NULL
  AND lower(trim(b.client_email)) = lower(trim(c.email));

-- Sanity check: how many bookings got a client_id, how many remain NULL
SELECT
  COUNT(*)                                    AS total_bookings,
  COUNT(client_id)                            AS bookings_with_client_id,
  COUNT(*) FILTER (WHERE client_id IS NULL)   AS bookings_without_client_id,
  COUNT(*) FILTER (WHERE client_email IS NULL) AS bookings_without_email
FROM bookings;
