-- ============================================================
-- outreach_sends — campaign send history.
--
-- Logged at the moment a therapist sends an outreach campaign.
-- One row per campaign (not per recipient), so a 60-recipient
-- send creates 1 row. Recipient list, success/skip/fail counts,
-- and the message body are captured for audit + re-send.
--
-- Used by:
--   - Outreach tab: "Recent campaigns" section at the bottom
--   - Future: schedule-send by duplicating a previous campaign
-- ============================================================

CREATE TABLE IF NOT EXISTS outreach_sends (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id    uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  channel         text NOT NULL CHECK (channel IN ('email','sms')),
  segment         text,                 -- 'lapsed','due','onetimer','frequent','all','custom'
  segment_label   text,                 -- human-readable, snapshot at send time
  subject         text,                 -- email only
  message         text NOT NULL,        -- raw body with {tokens} unresolved
  recipient_count int NOT NULL DEFAULT 0,
  success_count   int NOT NULL DEFAULT 0,
  skipped_count   int NOT NULL DEFAULT 0,
  failed_count    int NOT NULL DEFAULT 0,
  ai_starter_id   text,                 -- which AI starter category, if any
  test_mode       boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_sends_therapist
  ON outreach_sends(therapist_id, created_at DESC);

ALTER TABLE outreach_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outreach_sends_therapist_all" ON outreach_sends;
CREATE POLICY "outreach_sends_therapist_all" ON outreach_sends
  FOR ALL
  USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());

COMMENT ON TABLE outreach_sends IS
  'Campaign send history. One row per campaign, not per recipient.';
