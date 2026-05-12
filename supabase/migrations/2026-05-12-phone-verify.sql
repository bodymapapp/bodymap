-- supabase/migrations/2026-05-12-phone-verify.sql
--
-- Phone verification at signup. Adds:
--   phone_verified_at  timestamptz null   set when Twilio Verify check succeeds
--
-- The existing 'phone' column is kept nullable so existing therapists
-- are not blocked. New signups will fill it on the signup form (now
-- required client-side) and verify before hitting the dashboard.
--
-- Per HK direction May 12 2026: hard gate for new signups (block
-- dashboard until phone_verified_at is set), soft banner for existing
-- therapists who pre-date this change.

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_therapists_phone_verified
  ON therapists(phone_verified_at)
  WHERE phone_verified_at IS NULL;

COMMENT ON COLUMN therapists.phone_verified_at IS
  'Set when the therapist confirms their phone via SMS code at signup. NULL means unverified. Existing therapists pre-dating phone verification are NULL and see a soft banner; new signups are hard-gated until set.';
