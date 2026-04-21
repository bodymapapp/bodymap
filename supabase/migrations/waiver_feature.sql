-- ============================================================
-- Waiver feature: legally enforceable e-signature on intake submit.
-- ============================================================

-- Therapist's current active waiver text (one row per therapist).
-- Waivers are EDITABLE by therapist at any time, but past signatures
-- preserve a full snapshot of the text at the moment of signing.
ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS waiver_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS waiver_text text;

-- Waiver signatures. Immutable — never update or delete after insert.
-- Each signature stores a full snapshot of the text agreed to, so if
-- the therapist later edits the waiver, the old signature is still
-- pinned to what was actually presented that day.
CREATE TABLE IF NOT EXISTS waiver_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  typed_name text NOT NULL,         -- name client typed on intake
  client_email text,
  waiver_text_snapshot text NOT NULL, -- full waiver content at moment of signing
  ip_address text,
  user_agent text,
  pdf_url text,                     -- Supabase Storage public URL to PDF
  signed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waiver_signatures_therapist ON waiver_signatures(therapist_id, signed_at DESC);
CREATE INDEX IF NOT EXISTS idx_waiver_signatures_client ON waiver_signatures(client_id);
CREATE INDEX IF NOT EXISTS idx_waiver_signatures_session ON waiver_signatures(session_id);

ALTER TABLE waiver_signatures ENABLE ROW LEVEL SECURITY;

-- Therapists can read their own signatures (needed for dashboard "Waiver signed" display)
DROP POLICY IF EXISTS "waiver_sigs_therapist_read" ON waiver_signatures;
CREATE POLICY "waiver_sigs_therapist_read" ON waiver_signatures
  FOR SELECT USING (therapist_id = auth.uid());

-- Public (anon) can INSERT their own signature during booking
-- but only if therapist_id corresponds to a real therapist with a custom_url
DROP POLICY IF EXISTS "waiver_sigs_public_insert" ON waiver_signatures;
CREATE POLICY "waiver_sigs_public_insert" ON waiver_signatures
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM therapists WHERE id = therapist_id AND custom_url IS NOT NULL)
  );

-- NO update or delete policies — signatures are immutable.
-- Service role can still write (for edge function PDF attach).

-- Seed existing therapists with the default waiver so they're ready
-- immediately (toggle is ON by default, so let's not ship blanks).
UPDATE therapists
SET waiver_text = COALESCE(waiver_text,
'I understand that massage therapy is provided for stress reduction, relaxation, relief from muscular tension, and improvement of circulation and energy flow. Massage therapy is not a substitute for medical care or diagnosis. If I have any medical conditions, I will inform my therapist before the session begins.

I have completed the intake to the best of my knowledge. I will inform my therapist of any changes to my health, medications, or pregnancy status before future sessions.

I understand I can request changes to pressure, technique, or positioning at any time during my session. I can end the session at any point for any reason.

I release my massage therapist and their business from liability for any injury or adverse reaction that may occur during or after the session, except in cases of gross negligence.

I have read, understood, and voluntarily agree to the above.')
WHERE waiver_text IS NULL;
