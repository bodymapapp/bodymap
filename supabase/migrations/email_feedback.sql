-- ============================================================
-- Email feedback table for /founder/emails review page
-- ============================================================
-- Stores HK's (and admin team's) notes on each email template
-- so we have a review queue. Notes persist across sessions and
-- can be marked as addressed once Claude makes the requested
-- changes.

CREATE TABLE IF NOT EXISTS email_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id text NOT NULL,           -- 'drip_day2', 'outreach_checkin', etc.
  feedback text NOT NULL,
  status text NOT NULL DEFAULT 'open',  -- 'open' | 'addressed' | 'wontfix'
  created_by text,                  -- admin email
  created_at timestamptz NOT NULL DEFAULT now(),
  addressed_at timestamptz,
  addressed_note text
);

CREATE INDEX IF NOT EXISTS email_feedback_email_id_idx ON email_feedback(email_id);
CREATE INDEX IF NOT EXISTS email_feedback_status_idx ON email_feedback(status);

ALTER TABLE email_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_feedback_admin_all" ON email_feedback;
CREATE POLICY "email_feedback_admin_all" ON email_feedback
  FOR ALL
  USING (
    auth.jwt() ->> 'email' IN (
      'bodymap01@gmail.com',
      'bodymapdemo@gmail.com',
      'harshk.mba@gmail.com'
    )
  );
