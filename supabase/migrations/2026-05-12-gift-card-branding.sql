-- supabase/migrations/2026-05-12-gift-card-branding.sql
--
-- Branded gift cards (asked for by Jiny Green May 7 2026).
--
-- Therapists pick a color theme and an optional personal message
-- that show up on every gift card they sell: the dashboard preview,
-- the printable version, and the email the recipient receives.
--
-- Image (business logo or personal photo) reuses the existing
-- therapists.photo_url column. No new storage bucket needed; the
-- bodymap-assets bucket already exists and the profile photo upload
-- flow in Dashboard.js writes there.
--
-- Theme is a string key, not a JSON of colors. Six preset palettes
-- defined in src/lib/giftCardThemes.js are the only valid values.
-- Default 'rose' matches the current hardcoded pink/cream design
-- so existing gift cards keep their look without a backfill.

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS gift_card_theme text DEFAULT 'rose',
  ADD COLUMN IF NOT EXISTS gift_card_message text;

COMMENT ON COLUMN therapists.gift_card_theme IS
  'Preset palette key. Valid values: rose, sage, forest, ocean, lavender, terracotta. Mapped to colors in src/lib/giftCardThemes.js.';
COMMENT ON COLUMN therapists.gift_card_message IS
  'Optional ~80-char personal note that appears on the gift card next to the therapist photo. Free-form text. May be null.';
