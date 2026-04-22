-- ============================================================
-- Email history tracking: store what was actually sent.
-- Before this, notification_log only recorded notification_type (template
-- key) and sent_at. That's enough to dedupe but not enough to show HK
-- "which words did I send to this therapist 3 days ago?"
-- ============================================================

ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS body_snippet text; -- first 200 chars, for dashboard scan

-- Index to make per-therapist history queries fast as log grows.
CREATE INDEX IF NOT EXISTS idx_notification_log_therapist_sent
  ON notification_log(therapist_id, sent_at DESC);
