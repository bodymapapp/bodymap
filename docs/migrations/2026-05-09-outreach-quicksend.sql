-- ─────────────────────────────────────────────────────────────────
-- Outreach quick-send: templates + send tracking
-- May 9, 2026 (revised again to avoid collision with existing
-- outreach_sends table)
-- HK direction: top of Outreach page gets preconfigured "blocks"
-- (5 of them), 2-click flow (tap block, modal opens with prefilled
-- email, edit-and-send). Therapist can edit, reset, or delete
-- starter templates and create custom ones.
-- ─────────────────────────────────────────────────────────────────
--
-- IMPORTANT: COLLISION AVOIDED
--
-- An existing outreach_sends table is already in production, used
-- by src/components/Outreach.js to log every campaign send via the
-- existing advanced campaign builder. That table has a different
-- schema (channel, segment, recipient_count, success_count, etc).
-- The original v1 of this migration used the same name and would
-- have DROPPED the existing table, erasing real campaign history.
--
-- Diagnostic May 9 evening (HK pasted information_schema query
-- result) caught this near-miss. Fix: this migration now creates
-- a distinct outreach_quicksend_sends table. Existing outreach_sends
-- table is left completely untouched.
--
-- TWO TABLES CREATED HERE
--
-- outreach_templates
--   Per-therapist editable templates. 5 starter templates are
--   seeded on first load by the frontend (idempotent via
--   ensureStartersSeeded function).
--
-- outreach_quicksend_sends
--   One row per (template, client) send event from the quick-send
--   flow. Used for re-send protection (skip if same template went
--   to same client within 14 days), reporting, and audit. Distinct
--   from outreach_sends which tracks campaign-level batches from
--   the advanced builder.
--
-- Both tables RLS-protected: therapist sees only their own rows.

DROP TABLE IF EXISTS outreach_quicksend_sends CASCADE;
DROP TABLE IF EXISTS outreach_templates CASCADE;

CREATE TABLE outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  audience_preset TEXT NOT NULL,
  is_starter BOOLEAN NOT NULL DEFAULT FALSE,
  starter_key TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outreach_templates_therapist
  ON outreach_templates(therapist_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_outreach_templates_starter
  ON outreach_templates(therapist_id, starter_key) WHERE is_starter = TRUE;

ALTER TABLE outreach_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY outreach_templates_select ON outreach_templates
  FOR SELECT USING (therapist_id = auth.uid());

CREATE POLICY outreach_templates_insert ON outreach_templates
  FOR INSERT WITH CHECK (therapist_id = auth.uid());

CREATE POLICY outreach_templates_update ON outreach_templates
  FOR UPDATE USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());

CREATE POLICY outreach_templates_delete ON outreach_templates
  FOR DELETE USING (therapist_id = auth.uid());


CREATE TABLE outreach_quicksend_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES outreach_templates(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_email TEXT NOT NULL,
  resend_message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered BOOLEAN,
  bounced BOOLEAN
);

CREATE INDEX idx_outreach_quicksend_sends_dedupe
  ON outreach_quicksend_sends(template_id, client_id, sent_at DESC);
CREATE INDEX idx_outreach_quicksend_sends_therapist
  ON outreach_quicksend_sends(therapist_id, sent_at DESC);

ALTER TABLE outreach_quicksend_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY outreach_quicksend_sends_select ON outreach_quicksend_sends
  FOR SELECT USING (therapist_id = auth.uid());

-- Sanity check: confirm both new tables exist and the existing
-- outreach_sends still has its original schema
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('outreach_templates', 'outreach_quicksend_sends', 'outreach_sends')
ORDER BY table_name, ordinal_position;
