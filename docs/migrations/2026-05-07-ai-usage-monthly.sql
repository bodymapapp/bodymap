-- ============================================================================
-- Migration: ai_usage_monthly (CONSOLIDATED, May 7, 2026)
-- Purpose:   Rate-limit Practice Assistant to 10 questions per therapist per
--            month. Pre-revenue beta. Revisit cap once Silver / Gold paid.
--
-- HOW TO RUN:
--   Copy this ENTIRE file. Paste into Supabase SQL Editor. Click Run.
--   Safe to run multiple times (CREATE IF NOT EXISTS, DROP IF EXISTS).
--
-- WHAT IT DOES:
--   1. Creates the ai_usage_monthly table if it does not exist
--   2. Creates index on (therapist_id, year_month)
--   3. Enables RLS
--   4. Creates the read policy with the CORRECT join (therapists.id = auth.uid())
--      Earlier draft used auth_user_id which does not exist in the schema.
--   5. Creates the updated_at trigger
-- ============================================================================

-- 1. TABLE
CREATE TABLE IF NOT EXISTS ai_usage_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  year_month text NOT NULL,
  question_count integer NOT NULL DEFAULT 0,
  last_question_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, year_month)
);

-- 2. INDEX
CREATE INDEX IF NOT EXISTS ai_usage_monthly_therapist_month_idx
  ON ai_usage_monthly(therapist_id, year_month);

-- 3. ENABLE RLS
ALTER TABLE ai_usage_monthly ENABLE ROW LEVEL SECURITY;

-- 4. POLICY (drop any old version first, then create with correct join)
DROP POLICY IF EXISTS "therapist_read_own_ai_usage" ON ai_usage_monthly;

CREATE POLICY "therapist_read_own_ai_usage"
  ON ai_usage_monthly
  FOR SELECT
  USING (therapist_id = auth.uid());

-- 5. UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_ai_usage_monthly ON ai_usage_monthly;

CREATE TRIGGER set_updated_at_ai_usage_monthly
  BEFORE UPDATE ON ai_usage_monthly
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================================
-- DONE. After running:
--   - The Practice Assistant rate-limit counter should appear immediately
--     when you open the chat
--   - The edge function returns 429 when a therapist hits 10/month
-- ============================================================================
