-- supabase/migrations/stripe_account_type.sql
--
-- HK May 15-16 2026: adding Standard Connect alongside Express.
-- Existing therapists keep their Express accounts untouched.
-- New therapists default to Standard (OAuth into their existing
-- Stripe account, no new account created). Express becomes a
-- fallback for therapists who genuinely do not have a Stripe
-- account yet.
--
-- Schema-wise we need to know which connect mode each therapist
-- is on so the Settings UI can render the right disconnect / manage
-- link, and so future code paths can branch when Stripe diverges
-- (e.g. webhooks, fee structures).

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS stripe_account_type text DEFAULT 'express';

COMMENT ON COLUMN therapists.stripe_account_type IS
  'express | standard. express = MyBodyMap created the Stripe account via Account Links. standard = therapist linked their existing Stripe account via OAuth. Both account types use the same Stripe-Account header pattern downstream; the type matters only for the connection / management flow.';

-- Backfill existing rows. Any therapist with a stripe_account_id
-- today went through the Express path, so mark them accordingly.
UPDATE therapists
SET stripe_account_type = 'express'
WHERE stripe_account_id IS NOT NULL
  AND stripe_account_type IS NULL;
