-- supabase/migrations/2026_05_06_memberships_square_plan_variation.sql
--
-- Adds square_plan_variation_id column to memberships. Mirrors
-- stripe_price_id: lets Square subscriptions reuse the same Catalog
-- plan variation across multiple client signups instead of creating
-- a new one each time.

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS square_plan_variation_id text;
