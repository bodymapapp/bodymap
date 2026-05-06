-- Add refund tracking columns to package_purchases.
-- May 2026 · supports the Refund button in PurchasesPanel.
--
-- Design:
--   - status='refunded' is a new terminal state alongside the existing
--     'active' / 'expired' / 'cancelled' / 'completed'
--   - refund_id stores the provider's refund reference (Stripe refund id
--     or Square refund id) so a re-click is idempotent
--   - refunded_at is the timestamp the refund was issued
--   - refund_amount_cents is what was actually refunded (may be partial,
--     though our UI only does full refunds today)
--   - refunded_by is the auth user id of the therapist who clicked the
--     button, for audit
--
-- Memberships use a separate concept (cancel subscription, do not refund
-- past charges) — they keep their existing 'cancelled' status flow.

ALTER TABLE package_purchases
  ADD COLUMN IF NOT EXISTS refund_id text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount_cents integer,
  ADD COLUMN IF NOT EXISTS refunded_by uuid;

CREATE INDEX IF NOT EXISTS package_purchases_refund_idx
  ON package_purchases(refund_id) WHERE refund_id IS NOT NULL;
