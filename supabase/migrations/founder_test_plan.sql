-- supabase/migrations/founder_test_plan.sql
--
-- HK Jun 4 2026: a durable test plan on the Founder page. The list of
-- items lives in code (the version-controlled record); this table only
-- stores the done state per item, per founder, so checking things off
-- survives reloads and follows HK across devices.
--
-- Scoped to the signed-in user's auth id (the founder logs in as their
-- own account). No anon access. No FK to therapists so it works even if
-- the founder account is not itself a therapist row.

CREATE TABLE IF NOT EXISTS founder_test_plan (
  user_id UUID NOT NULL,
  item_key TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_key)
);

ALTER TABLE founder_test_plan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "founder_test_plan_select_own" ON founder_test_plan;
CREATE POLICY "founder_test_plan_select_own"
  ON founder_test_plan FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "founder_test_plan_insert_own" ON founder_test_plan;
CREATE POLICY "founder_test_plan_insert_own"
  ON founder_test_plan FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "founder_test_plan_update_own" ON founder_test_plan;
CREATE POLICY "founder_test_plan_update_own"
  ON founder_test_plan FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "founder_test_plan_delete_own" ON founder_test_plan;
CREATE POLICY "founder_test_plan_delete_own"
  ON founder_test_plan FOR DELETE
  USING (user_id = auth.uid());
