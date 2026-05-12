-- supabase/migrations/2026-05-12-ai-drafts.sql
--
-- Track AI draft generation usage per therapist per month. Separate
-- from ai_usage_monthly (Practice Assistant questions) so drafting
-- doesn't eat into the question budget.
--
-- Per HK direction May 12 2026: 30 drafts per therapist per month
-- during pre-revenue beta. Revisit when paying tiers are active.

CREATE TABLE IF NOT EXISTS ai_drafts_monthly (
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  year_month text NOT NULL,  -- format: '2026-05'
  draft_count integer NOT NULL DEFAULT 0,
  last_draft_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (therapist_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_ai_drafts_monthly_therapist
  ON ai_drafts_monthly(therapist_id);

-- Auto-update updated_at on write
CREATE OR REPLACE FUNCTION update_ai_drafts_monthly_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_drafts_monthly_updated_at ON ai_drafts_monthly;
CREATE TRIGGER trg_ai_drafts_monthly_updated_at
  BEFORE UPDATE ON ai_drafts_monthly
  FOR EACH ROW EXECUTE FUNCTION update_ai_drafts_monthly_updated_at();

-- RLS: only the therapist owning the row can read/write their own usage.
-- The edge function uses the service role so it bypasses RLS, which is fine.
ALTER TABLE ai_drafts_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Therapists read own draft usage" ON ai_drafts_monthly;
CREATE POLICY "Therapists read own draft usage"
  ON ai_drafts_monthly FOR SELECT
  USING (therapist_id = auth.uid());

DROP POLICY IF EXISTS "Service role writes draft usage" ON ai_drafts_monthly;
CREATE POLICY "Service role writes draft usage"
  ON ai_drafts_monthly FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
