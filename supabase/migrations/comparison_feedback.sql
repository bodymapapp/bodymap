-- ============================================================
-- comparison_feedback — community-driven accuracy improvement.
--
-- Anyone visiting /comparison can flag inaccuracies, suggest new
-- features, or propose new platforms via a small feedback modal.
-- Their submission lands here for HK to review weekly.
--
-- Public can INSERT (anon role). Only authenticated admin (HK) can
-- SELECT. No DELETE / UPDATE for anyone.
-- ============================================================

CREATE TABLE IF NOT EXISTS comparison_feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'inaccuracy' | 'suggest_feature' | 'suggest_platform' | 'general'
  feedback_type text NOT NULL DEFAULT 'general',
  -- Optional: which row / cell the feedback is about
  feature_label text,                    -- e.g. "SOAP notes"
  category_id   text,                    -- e.g. "1.1" or "6.1"
  platform_id   text,                    -- e.g. "mb", "vg"
  -- Optional: what they think the right answer is
  current_mark  text,                    -- e.g. "yes", "no", "addon"
  proposed_mark text,
  -- Required: the actual feedback content
  message       text NOT NULL,
  -- Optional: who they are
  email         text,
  name          text,
  -- Spam / abuse triage
  user_agent    text,
  ip_hash       text,
  created_at    timestamptz DEFAULT now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid REFERENCES therapists(id),
  resolution    text                      -- 'accepted' | 'rejected' | 'duplicate'
);

CREATE INDEX IF NOT EXISTS idx_comparison_feedback_unreviewed
  ON comparison_feedback(created_at DESC) WHERE reviewed_at IS NULL;

ALTER TABLE comparison_feedback ENABLE ROW LEVEL SECURITY;

-- Public can submit feedback (anon role).
DROP POLICY IF EXISTS "comparison_feedback_public_insert" ON comparison_feedback;
CREATE POLICY "comparison_feedback_public_insert" ON comparison_feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(message) BETWEEN 5 AND 2000
    AND feedback_type IN ('inaccuracy','suggest_feature','suggest_platform','general')
  );

-- Only the founder can read submissions.
DROP POLICY IF EXISTS "comparison_feedback_admin_select" ON comparison_feedback;
CREATE POLICY "comparison_feedback_admin_select" ON comparison_feedback
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM therapists WHERE email = 'hello@mybodymap.app'
    )
  );

COMMENT ON TABLE comparison_feedback IS
  'Public-submitted feedback on the /comparison page. Anyone can insert; only admin can read.';
