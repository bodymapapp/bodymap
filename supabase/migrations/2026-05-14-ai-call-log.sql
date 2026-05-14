-- supabase/migrations/2026-05-14-ai-call-log.sql
--
-- HK May 14 2026: Founder page needs a live $ counter for AI cost.
-- Per request: 'I need to know how much the website is costing me in
-- terms of AI cost.' Tracks every AI call made by the platform
-- (bodymap-ai, founder-chat, future soap-extract, etc.). Stores
-- tokens + cost per call so we can roll up by day/month/model/caller.
--
-- Not tracked here:
-- - Anthropic's calls during HK's dev work in Claude.ai chat (that
--   is HK's personal API/subscription cost, separate)
-- - Any AI not invoked from inside our platform code

CREATE TABLE IF NOT EXISTS ai_call_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Which edge function or code path made the call
  caller          text NOT NULL,

  -- What the call was for. Free-text tag for grouping in the UI.
  -- Examples: 'practice_q', 'outreach_draft', 'soap_extract',
  -- 'founder_chat', 'session_intelligence'.
  purpose         text,

  -- Anthropic model id, e.g. 'claude-haiku-4-5-20251001'
  model           text NOT NULL,

  -- Token counts as returned by Anthropic in the response usage block
  input_tokens    integer NOT NULL DEFAULT 0,
  output_tokens   integer NOT NULL DEFAULT 0,

  -- Cost in USD computed at call time from the model's published rate.
  -- Stored as numeric (not generated) so historical calls keep their
  -- original cost even if we update the rate table later.
  input_cost_usd  numeric(12, 6) NOT NULL DEFAULT 0,
  output_cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  total_cost_usd  numeric(12, 6) GENERATED ALWAYS AS (input_cost_usd + output_cost_usd) STORED,

  -- Therapist id when the call was on behalf of a specific therapist.
  -- Null for founder-chat (HK) or any platform-level calls.
  therapist_id    uuid REFERENCES therapists(id) ON DELETE SET NULL,

  -- Did the upstream API call succeed? Failed calls still cost
  -- nothing on Anthropic's side, but we track them so we can see
  -- error rates.
  success         boolean NOT NULL DEFAULT true,
  error_message   text
);

-- Indexes for the rollup queries the founder dashboard will run
CREATE INDEX IF NOT EXISTS idx_ai_call_log_created_at ON ai_call_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_call_log_caller ON ai_call_log(caller, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_call_log_therapist ON ai_call_log(therapist_id, created_at DESC) WHERE therapist_id IS NOT NULL;

-- RLS: only founders / service role can read. Therapists must never
-- see this table directly; they get their own usage counts via
-- ai_usage_monthly already.
ALTER TABLE ai_call_log ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service key)
DROP POLICY IF EXISTS ai_call_log_service_all ON ai_call_log;
CREATE POLICY ai_call_log_service_all ON ai_call_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Founder dashboard reads via service role through the founder routes,
-- so no separate founder-read policy needed at the row level.

-- Rollup view used by the founder dashboard widget for the counter.
-- Refresh-on-read; this table will not grow large enough for materialized
-- views to be necessary in the near term.
CREATE OR REPLACE VIEW ai_cost_rollup AS
SELECT
  -- Bucket the time periods the dashboard will care about
  date_trunc('day', created_at) AS bucket_day,
  date_trunc('month', created_at) AS bucket_month,
  caller,
  purpose,
  model,
  count(*) AS call_count,
  count(*) FILTER (WHERE success) AS success_count,
  sum(input_tokens) AS total_input_tokens,
  sum(output_tokens) AS total_output_tokens,
  sum(total_cost_usd) AS total_cost_usd
FROM ai_call_log
GROUP BY 1, 2, 3, 4, 5;
