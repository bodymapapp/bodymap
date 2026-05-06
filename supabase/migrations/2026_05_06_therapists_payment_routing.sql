-- supabase/migrations/2026_05_06_therapists_payment_routing.sql
--
-- Adds payment_routing jsonb to therapists. Captures the per-feature
-- choice of processor for therapists who have both Stripe and Square
-- connected. When unset (default), edge functions auto-pick (Stripe
-- wins ties for online operations per the capability matrix).
--
-- Shape:
--   {
--     deposits: 'stripe' | 'square' | 'auto',
--     card_on_file: 'stripe' | 'square' | 'auto',
--     packages: 'stripe' | 'square' | 'auto',
--     memberships: 'stripe',  // 'square' allowed after Chunk δ
--   }
--
-- All keys optional; missing keys mean 'auto'. Edge functions read
-- routing[feature] || 'auto' so old rows behave the same as new
-- rows with empty routing.

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS payment_routing jsonb DEFAULT '{}'::jsonb;
