-- supabase/migrations/stripe_account_ready_at.sql
--
-- HK May 15 2026: code in stripe-connect/index.ts and StripeDebug.jsx
-- writes to therapists.stripe_account_ready_at but the column was
-- never created. The writes were failing silently because Supabase
-- treats unknown columns in update as no-ops on some configs.
-- Adding it now.
--
-- This column stamps the timestamp at which Stripe confirmed all
-- three of charges_enabled / payouts_enabled / details_submitted
-- were true. Useful for audit ('when did this therapist actually
-- get fully connected') and for filtering recently-connected
-- therapists in the founder dashboard.
--
-- Run this in Supabase SQL Editor.

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS stripe_account_ready_at timestamptz;

COMMENT ON COLUMN therapists.stripe_account_ready_at IS
  'Timestamp when Stripe Express account passed all three readiness checks (charges_enabled, payouts_enabled, details_submitted). Stamped by stripe-connect edge function confirm_connected action.';
