-- supabase/migrations/data_exports.sql
--
-- HK May 19 2026: 'Download all my data' feature. Therapist taps a
-- button in Settings, edge function builds a ZIP of all her data
-- across ~13 tables, uploads to Supabase Storage, emails the
-- therapist a signed download link.
--
-- This table is the audit log: one row per export request. Tracks
-- status, file size, expiry, who triggered it. Useful for support
-- ('did Candice's export actually generate?') and for showing the
-- therapist her recent exports if she taps the button again.
--
-- Per HK direction: free for all therapists, no rate limit beyond
-- preventing double-submits while one is in progress.

CREATE TABLE IF NOT EXISTS data_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'ready', 'failed', 'expired')),
  storage_path TEXT,
  signed_url TEXT,
  file_size_bytes BIGINT,
  row_count INTEGER,
  expires_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_data_exports_therapist
  ON data_exports (therapist_id, created_at DESC);

-- Storage bucket for the actual ZIP files. Private (no public access).
-- Files only reachable via signed URL with 7-day expiry. The edge
-- function uses service-role key to upload; the email link is the
-- only way for the therapist to download.
INSERT INTO storage.buckets (id, name, public)
VALUES ('data-exports', 'data-exports', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: therapist can read their own data_exports rows (so the UI can
-- show 'your last export was X'). No insert/update from the client;
-- only the edge function (service role) writes.
ALTER TABLE data_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Therapists can read own data_exports" ON data_exports;
CREATE POLICY "Therapists can read own data_exports"
  ON data_exports FOR SELECT
  USING (therapist_id = auth.uid());
