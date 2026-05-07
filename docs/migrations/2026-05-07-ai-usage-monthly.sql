-- Migration: ai_usage_monthly
-- Date: May 7, 2026
-- Purpose: Rate-limit Practice Assistant chat to 10 questions per
--          therapist per month while we are pre-revenue. Per HK
--          direction, revisit cap once Silver / Gold tiers are paying.

CREATE TABLE IF NOT EXISTS ai_usage_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  year_month text NOT NULL,           -- 'YYYY-MM' e.g. '2026-05'
  question_count integer NOT NULL DEFAULT 0,
  last_question_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, year_month)
);

CREATE INDEX IF NOT EXISTS ai_usage_monthly_therapist_month_idx
  ON ai_usage_monthly(therapist_id, year_month);

ALTER TABLE ai_usage_monthly ENABLE ROW LEVEL SECURITY;

-- Therapists can read their own usage rows
CREATE POLICY "therapist_read_own_ai_usage"
  ON ai_usage_monthly
  FOR SELECT
  USING (
    therapist_id IN (
      SELECT id FROM therapists WHERE auth_user_id = auth.uid()
    )
  );

-- Edge function uses service role key, bypasses RLS for inserts/updates
-- so no INSERT/UPDATE policy needed for users.

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_ai_usage_monthly
  BEFORE UPDATE ON ai_usage_monthly
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();
