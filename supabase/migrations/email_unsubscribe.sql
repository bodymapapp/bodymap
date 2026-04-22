-- ============================================================
-- Email unsubscribe support (CAN-SPAM compliance).
-- Master opt-out flag for ALL marketing email from BodyMap.
-- Transactional emails (welcome, booking confirmations, password
-- resets) are exempt from this flag per CAN-SPAM.
-- ============================================================

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS email_unsubscribed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_unsubscribe_reason text;

CREATE INDEX IF NOT EXISTS idx_therapists_email_unsubscribed
  ON therapists(email_unsubscribed) WHERE email_unsubscribed = true;
