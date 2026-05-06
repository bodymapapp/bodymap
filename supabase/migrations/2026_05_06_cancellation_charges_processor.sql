-- supabase/migrations/2026_05_06_cancellation_charges_processor.sql
--
-- Adds processor + idempotency_key columns to cancellation_charges.
-- Now that cancellation fees can be charged via Stripe OR Square (per
-- the Square parity rollout), we record which processor handled each
-- charge for audit + future reconciliation.
--
-- The idempotency_key column stores 'cancel-{booking_id}' so a retry
-- always uses the same key and providers (both Stripe and Square)
-- honor it server-side.

ALTER TABLE cancellation_charges
  ADD COLUMN IF NOT EXISTS processor text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE INDEX IF NOT EXISTS cancellation_charges_idempotency_idx
  ON cancellation_charges(idempotency_key) WHERE idempotency_key IS NOT NULL;
