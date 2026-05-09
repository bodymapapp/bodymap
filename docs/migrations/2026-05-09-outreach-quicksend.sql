-- ─────────────────────────────────────────────────────────────────
-- Outreach quick-send: templates + send tracking
-- May 9, 2026 (revised May 9 evening for safe re-run)
-- HK direction: top of Outreach page gets preconfigured "blocks"
-- (5 of them), 2-click flow (tap block, modal opens with prefilled
-- email, edit-and-send). Therapist can edit, reset, or delete
-- starter templates and create custom ones.
-- ─────────────────────────────────────────────────────────────────
--
-- SAFE FROM ANY STARTING STATE
--
-- This migration drops both tables first if they exist, then
-- recreates them clean. Safe because:
--   - The feature has never been live in production
--   - No therapist has ever written to either table
--   - No emails have ever been sent through this path
--
-- Once the feature is live with real data, future schema changes
-- will use ALTER TABLE migrations instead of DROP-and-recreate.
-- This file is the one-time clean-slate setup.
--
-- TWO TABLES
--
-- outreach_templates
--   Per-therapist editable templates. 5 starter templates are seeded
--   on first load (idempotent via is_starter + starter_key check
--   in the frontend ensureStartersSeeded function, not here).
--
-- outreach_sends
--   One row per (template, client) send event. Used for re-send
--   protection (skip if same template went to same client within
--   14 days), reporting, and audit.
--
-- Both tables RLS-protected: therapist sees only their own rows.

DROP TABLE IF EXISTS outreach_sends CASCADE;
DROP TABLE IF EXISTS outreach_templates CASCADE;

CREATE TABLE outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  label TEXT NOT NULL,                     -- "Welcome new clients"
  subject TEXT NOT NULL,                   -- "Quick check-in from {{therapist_name}}"
  body TEXT NOT NULL,                      -- Email body with smart tokens
  audience_preset TEXT NOT NULL,           -- 'new_clients' | 'returning_recent' | 'lapsed' | 'all_active' | 'package_holders_idle'
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


CREATE TABLE outreach_sends (
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

CREATE INDEX idx_outreach_sends_dedupe
  ON outreach_sends(template_id, client_id, sent_at DESC);
CREATE INDEX idx_outreach_sends_therapist
  ON outreach_sends(therapist_id, sent_at DESC);

ALTER TABLE outreach_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY outreach_sends_select ON outreach_sends
  FOR SELECT USING (therapist_id = auth.uid());

-- Sanity check: confirm both tables exist with their columns
SELECT 'outreach_templates' AS table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'outreach_templates'
UNION ALL
SELECT 'outreach_sends', column_name, data_type
FROM information_schema.columns
WHERE table_name = 'outreach_sends'
ORDER BY table_name, column_name;
