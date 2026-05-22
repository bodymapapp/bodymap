-- ============================================================
-- Migration: import_batch_id_columns
-- Add import_batch_id UUID to clients, bookings, and
-- member_subscriptions so an entire import can be undone via a
-- single batch identifier.
-- ============================================================
-- HK May 22 2026 item D of A-J: 'After import, the therapist
-- should be able to undo the last import if they realize it had
-- the wrong CSV.'
--
-- How it works:
--   1. Every import generates a fresh UUID (the batch id).
--   2. Each clients/bookings/member_subscriptions row created by
--      that import gets the batch id stamped on it.
--   3. The import success screen shows an 'Undo this import' link
--      active for ~10 minutes (window controlled in the UI, not
--      enforced by the DB).
--   4. Tapping Undo deletes all rows with that batch id.
--
-- Why nullable: existing rows from pre-D imports do not have a
-- batch id and will not be touched by an undo. New imports stamp
-- the column; manual additions (Add Client modal, etc.) leave it
-- null, which is correct because those rows should never be
-- bulk-undone.
--
-- Index on batch id lets the undo delete in one query without a
-- table scan, important for large imports.
-- ============================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS import_batch_id UUID;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS import_batch_id UUID;

ALTER TABLE member_subscriptions
  ADD COLUMN IF NOT EXISTS import_batch_id UUID;

-- Partial indexes (only index rows that HAVE a batch id; the vast
-- majority of rows in production were not imported and don't need
-- to bloat the index).
CREATE INDEX IF NOT EXISTS clients_import_batch_id_idx
  ON clients (import_batch_id)
  WHERE import_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_import_batch_id_idx
  ON bookings (import_batch_id)
  WHERE import_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS member_subscriptions_import_batch_id_idx
  ON member_subscriptions (import_batch_id)
  WHERE import_batch_id IS NOT NULL;
