-- ============================================================
-- comparison_row_votes — per-row "verify" votes from visitors.
--
-- Therapists who use any of the 7 platforms can click "Looks right"
-- on each feature row to confirm our marks. Counts roll up to a
-- "verified by N therapists" badge per row + a top-of-page progress
-- score.
--
-- Voter identity: anonymous voter_id stored in browser localStorage.
-- Not authenticated. Prevents duplicate votes per (voter_id, feature)
-- via unique constraint, but a determined user could clear storage.
-- That's acceptable for a low-stakes accuracy check.
-- ============================================================

CREATE TABLE IF NOT EXISTS comparison_row_votes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_label text NOT NULL,            -- e.g. "Online booking page"
  category_id   text,                     -- e.g. "1.1"
  voter_id      text NOT NULL,            -- localStorage uuid
  vote_type     text NOT NULL DEFAULT 'verify' CHECK (vote_type IN ('verify','dispute')),
  email         text,                     -- optional for follow-up
  created_at    timestamptz DEFAULT now(),
  UNIQUE (feature_label, voter_id, vote_type)
);

CREATE INDEX IF NOT EXISTS idx_comparison_votes_feature
  ON comparison_row_votes(feature_label);

ALTER TABLE comparison_row_votes ENABLE ROW LEVEL SECURITY;

-- Public can vote.
DROP POLICY IF EXISTS "comparison_row_votes_public_insert" ON comparison_row_votes;
CREATE POLICY "comparison_row_votes_public_insert" ON comparison_row_votes
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(voter_id) BETWEEN 16 AND 64
    AND char_length(feature_label) BETWEEN 2 AND 200
  );

-- Public can read aggregated counts (we'll do the aggregation client-side
-- for now; could become a view later if traffic grows).
DROP POLICY IF EXISTS "comparison_row_votes_public_select" ON comparison_row_votes;
CREATE POLICY "comparison_row_votes_public_select" ON comparison_row_votes
  FOR SELECT TO anon, authenticated
  USING (true);

COMMENT ON TABLE comparison_row_votes IS
  'Per-row verify/dispute votes on /comparison. Public insert + select; one vote per voter_id per (feature, vote_type).';
