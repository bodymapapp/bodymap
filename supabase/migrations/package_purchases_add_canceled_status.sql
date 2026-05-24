-- HK May 24 2026: add 'canceled' to package_purchases status check.
-- Original constraint allowed only 'active', 'exhausted', 'expired',
-- 'refunded'. When PackageSection added a Cancel button (Phase 1) the
-- code wrote 'cancelled' which violated the check. 'refunded' is
-- semantically wrong when no refund was issued.
--
-- This migration: drop the old constraint, add a new one that
-- includes 'canceled' as a valid value. Matches the spelling used
-- elsewhere in the codebase (member_subscriptions uses 'canceled',
-- events table uses 'canceled').

ALTER TABLE package_purchases
  DROP CONSTRAINT IF EXISTS package_purchases_status_check;

ALTER TABLE package_purchases
  ADD CONSTRAINT package_purchases_status_check
  CHECK (status IN ('active', 'exhausted', 'expired', 'refunded', 'canceled'));
