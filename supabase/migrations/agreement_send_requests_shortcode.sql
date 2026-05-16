-- supabase/migrations/agreement_send_requests_shortcode.sql
--
-- HK May 15 2026: 'also if we can shorten the link...it looks
-- unprofessional.'
--
-- Add a human-friendly short_code (7 chars from a 32-char alphabet)
-- so signing links can be shared as mybodymap.app/s/abc1234 instead
-- of mybodymap.app/agreement-sign/{32-hex-token}.
--
-- The full token remains the security primitive. The short_code is
-- a routing convenience. Both resolve to the same row.
--
-- Run this in Supabase SQL Editor.

ALTER TABLE agreement_send_requests
  ADD COLUMN IF NOT EXISTS short_code text;

-- Unique index on short_code. Allows nulls because old rows do not
-- have one yet; new rows must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agreement_send_requests_short
  ON agreement_send_requests(short_code)
  WHERE short_code IS NOT NULL;

COMMENT ON COLUMN agreement_send_requests.short_code IS
  'Short URL-friendly slug for /s/{code} routes. 7 chars from a 32-char alphabet, ~34 billion options, low collision risk at any realistic scale.';
