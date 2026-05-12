-- supabase/migrations/2026-05-12-gift-card-per-card-overrides.sql
--
-- Per-card customization for gift certificates.
--
-- HK feedback after first branded-gift-cards ship: 'The branding gets
-- saved on all gift cards but not the individual gift card. I should
-- be able to upload any one image per card. It has only one design.'
--
-- This migration enables:
--   - Picking a different design template per card (Birthday vs
--     Sympathy vs Holiday etc)
--   - Overriding the color theme on a single card
--   - Uploading a card-specific image (replaces the therapist's
--     default photo for THIS gift only)
--   - Writing a card-specific brand message
--
-- All four columns are nullable. NULL means 'use the therapist's
-- default'. So the therapist's row remains the brand baseline; each
-- gift card can override any of the four independently.
--
-- design_template valid values (defined in src/lib/giftCardDesigns.js):
--   just-because (default, signature botanical)
--   birthday
--   anniversary
--   thank-you
--   sympathy
--   holiday

ALTER TABLE gift_certificates
  ADD COLUMN IF NOT EXISTS design_template text DEFAULT 'just-because',
  ADD COLUMN IF NOT EXISTS theme text,
  ADD COLUMN IF NOT EXISTS card_image_url text,
  ADD COLUMN IF NOT EXISTS card_brand_message text;

COMMENT ON COLUMN gift_certificates.design_template IS
  'Layout choice for this card. Valid: just-because, birthday, anniversary, thank-you, sympathy, holiday. Defaults to just-because so old rows render correctly.';
COMMENT ON COLUMN gift_certificates.theme IS
  'Per-card color theme override. NULL means fall back to therapists.gift_card_theme.';
COMMENT ON COLUMN gift_certificates.card_image_url IS
  'Per-card image override. NULL means fall back to therapists.photo_url. Stored in bodymap-assets bucket.';
COMMENT ON COLUMN gift_certificates.card_brand_message IS
  'Per-card brand message override. NULL means fall back to therapists.gift_card_message.';

-- Backfill: existing rows get design_template = 'just-because' from
-- the DEFAULT clause above on row create. For rows that already exist
-- before this migration applied, the DEFAULT does not retroactively
-- populate, so we set them explicitly here.
UPDATE gift_certificates
   SET design_template = 'just-because'
 WHERE design_template IS NULL;
