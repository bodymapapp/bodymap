-- supabase/migrations/2026-05-14-session-intelligence.sql
--
-- HK May 14 2026: Up-Next briefing card on the Schedule tab needs
-- structured points pulled from unstructured SOAP notes. AI extracts
-- once per SOAP save and caches here, so the briefing card reads
-- the cached JSON with no AI cost at view time.
--
-- Approach: Option C (cached AI) from the founder playbook,
-- MyBodyMap Marketing > How we win > SOAP intelligence section.
--
-- The cached JSON shape (filled by Claude Haiku via extract-session-
-- intelligence edge function):
--   {
--     "focus_areas": ["lower back", "right shoulder"],
--     "preferences_observed": ["quiet session, dim lights"],
--     "outcome": "Loved forearm pressure on glutes...",
--     "concerns_flagged": [],
--     "homework_or_followup": null,
--     "next_session_priority": "continue glute work, add hip flexor"
--   }
--
-- The briefing card picks 3 points from these fields per the
-- priority rules in the playbook (safety -> continuity -> personalization).

CREATE TABLE IF NOT EXISTS session_intelligence (
  session_id        uuid PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  therapist_id      uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  client_id         uuid REFERENCES clients(id) ON DELETE CASCADE,

  -- Extracted JSON. Schema documented in the migration header.
  -- Null when extraction has not run yet or failed.
  extracted         jsonb,

  -- Free-text summary if needed for debugging or fallback display.
  -- The structured fields above are the source of truth.
  summary_text      text,

  -- Which model produced this extraction. Lets us re-run with a
  -- newer model later if quality is questionable.
  model             text,

  -- Token counts and cost copied here for per-session attribution
  -- (in addition to the ai_call_log row).
  input_tokens      integer DEFAULT 0,
  output_tokens     integer DEFAULT 0,
  cost_usd          numeric(12, 6) DEFAULT 0,

  -- Hash of the source therapist_notes content. If the therapist
  -- edits the SOAP, hash changes, we re-extract. If hash is the
  -- same, skip extraction (saves cost on re-saves with no change).
  source_hash       text,

  extracted_at      timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Indexes for the briefing card lookups
CREATE INDEX IF NOT EXISTS idx_session_intel_therapist
  ON session_intelligence(therapist_id, extracted_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_intel_client
  ON session_intelligence(client_id, extracted_at DESC)
  WHERE client_id IS NOT NULL;

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION update_session_intelligence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_session_intel_updated_at ON session_intelligence;
CREATE TRIGGER trg_session_intel_updated_at
  BEFORE UPDATE ON session_intelligence
  FOR EACH ROW EXECUTE FUNCTION update_session_intelligence_updated_at();

-- RLS: therapists can read their own rows. Service role does writes.
ALTER TABLE session_intelligence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_intel_therapist_read ON session_intelligence;
CREATE POLICY session_intel_therapist_read ON session_intelligence
  FOR SELECT
  USING (auth.uid() = therapist_id);

DROP POLICY IF EXISTS session_intel_service_all ON session_intelligence;
CREATE POLICY session_intel_service_all ON session_intelligence
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
