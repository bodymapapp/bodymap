-- ─────────────────────────────────────────────────────────────────
-- Outreach quick-send: templates + send tracking
-- May 9, 2026
-- HK direction: top of Outreach page gets preconfigured "blocks"
-- (5 of them), 2-click flow (tap block, modal opens with prefilled
-- email, edit-and-send). Therapist can edit, reset, or delete
-- starter templates and create custom ones.
-- ─────────────────────────────────────────────────────────────────
--
-- TWO TABLES
--
-- outreach_templates
--   Per-therapist editable templates. 5 starter templates are seeded
--   on first load (idempotent via is_starter + label uniqueness).
--   Therapist can edit, reset to default, or soft-delete via
--   deleted_at (so "restore starters" can un-delete).
--
-- outreach_sends
--   One row per (template, client) send event. Used for:
--   - Re-send protection: skip if any send for (template_id,
--     client_id) within last 14 days
--   - Reporting: how many sends per template lifetime
--   - Audit: who got what when
--
-- Both tables RLS-protected: therapist sees only their own rows.

CREATE TABLE IF NOT EXISTS outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  label TEXT NOT NULL,                     -- "Welcome new clients"
  subject TEXT NOT NULL,                   -- "Quick check-in from {{therapist_name}}"
  body TEXT NOT NULL,                      -- Email body with smart tokens
  audience_preset TEXT NOT NULL,           -- 'new_clients' | 'returning_recent' | 'lapsed' | 'all_active' | 'package_holders_idle' (or whichever audience #5 ends up as)
  is_starter BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE for the 5 seeded templates so we know which to "reset"
  starter_key TEXT,                        -- For starters: stable identifier ('welcome_new', 'miss_you', etc) so reset-to-default works even after rename
  display_order INTEGER NOT NULL DEFAULT 0, -- For arranging blocks on the page
  deleted_at TIMESTAMPTZ,                  -- Soft delete; lets us "restore starter templates"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_templates_therapist
  ON outreach_templates(therapist_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_outreach_templates_starter
  ON outreach_templates(therapist_id, starter_key) WHERE is_starter = TRUE;

ALTER TABLE outreach_templates ENABLE ROW LEVEL SECURITY;

-- Therapists can read, write, update, delete only their own templates
DROP POLICY IF EXISTS outreach_templates_select ON outreach_templates;
CREATE POLICY outreach_templates_select ON outreach_templates
  FOR SELECT USING (therapist_id = auth.uid());

DROP POLICY IF EXISTS outreach_templates_insert ON outreach_templates;
CREATE POLICY outreach_templates_insert ON outreach_templates
  FOR INSERT WITH CHECK (therapist_id = auth.uid());

DROP POLICY IF EXISTS outreach_templates_update ON outreach_templates;
CREATE POLICY outreach_templates_update ON outreach_templates
  FOR UPDATE USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());

DROP POLICY IF EXISTS outreach_templates_delete ON outreach_templates;
CREATE POLICY outreach_templates_delete ON outreach_templates
  FOR DELETE USING (therapist_id = auth.uid());


CREATE TABLE IF NOT EXISTS outreach_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES outreach_templates(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_email TEXT NOT NULL,
  resend_message_id TEXT,                  -- Returned by Resend API for tracking
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered BOOLEAN,                       -- Set later via Resend webhook (defer wiring; nullable for now)
  bounced BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_outreach_sends_dedupe
  ON outreach_sends(template_id, client_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_sends_therapist
  ON outreach_sends(therapist_id, sent_at DESC);

ALTER TABLE outreach_sends ENABLE ROW LEVEL SECURITY;

-- Therapist can read their own sends; INSERT happens via service-role
-- in the edge function (clients should never see send records)
DROP POLICY IF EXISTS outreach_sends_select ON outreach_sends;
CREATE POLICY outreach_sends_select ON outreach_sends
  FOR SELECT USING (therapist_id = auth.uid());

-- Sanity: confirm both tables exist and show their columns
SELECT 'outreach_templates' AS table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'outreach_templates'
UNION ALL
SELECT 'outreach_sends', column_name, data_type
FROM information_schema.columns
WHERE table_name = 'outreach_sends'
ORDER BY table_name, column_name;
