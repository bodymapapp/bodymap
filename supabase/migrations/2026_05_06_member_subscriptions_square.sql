-- supabase/migrations/2026_05_06_member_subscriptions_square.sql
--
-- Adds Square-side columns to member_subscriptions, matching the
-- existing Stripe columns (stripe_subscription_id, stripe_customer_id).
-- Plus a 'processor' column to record which provider this subscription
-- runs on, so dashboard queries can group/filter cleanly.
--
-- Schema after migration:
--   processor                  text                 -- 'stripe' | 'square'
--   stripe_subscription_id     text   (existing)
--   stripe_customer_id         text   (existing)
--   square_subscription_id     text                 -- Square Subscription resource id (or idempotency marker until recurring is wired)
--   square_customer_id         text                 -- Square Customer id
--   square_plan_variation_id   text                 -- Square Catalog plan variation reference

ALTER TABLE member_subscriptions
  ADD COLUMN IF NOT EXISTS processor text,
  ADD COLUMN IF NOT EXISTS square_subscription_id text,
  ADD COLUMN IF NOT EXISTS square_customer_id text,
  ADD COLUMN IF NOT EXISTS square_plan_variation_id text;

CREATE INDEX IF NOT EXISTS member_subscriptions_square_sub_idx
  ON member_subscriptions(square_subscription_id) WHERE square_subscription_id IS NOT NULL;
