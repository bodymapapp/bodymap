-- Custom QR codes
--
-- Lets therapists save labeled URL + QR pairs they reuse often
-- (their website, Instagram, Yelp review link, a Google form, etc.)
-- so they do not have to retype the URL each time they want to print.
-- Triggered by Ashley Scalzulli email asking to "save the custom link
-- QR codes so I do not have to keep remaking the same link over and
-- over." Phase 1 just persisted the typed URL.

CREATE TABLE IF NOT EXISTS custom_qr_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  therapist_id uuid REFERENCES therapists(id) ON DELETE CASCADE NOT NULL,
  label text NOT NULL,
  url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_qr_codes_therapist
  ON custom_qr_codes(therapist_id);

ALTER TABLE custom_qr_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Therapists read own QR codes" ON custom_qr_codes;
CREATE POLICY "Therapists read own QR codes"
  ON custom_qr_codes FOR SELECT TO authenticated
  USING (therapist_id = auth.uid());

DROP POLICY IF EXISTS "Therapists insert own QR codes" ON custom_qr_codes;
CREATE POLICY "Therapists insert own QR codes"
  ON custom_qr_codes FOR INSERT TO authenticated
  WITH CHECK (therapist_id = auth.uid());

DROP POLICY IF EXISTS "Therapists update own QR codes" ON custom_qr_codes;
CREATE POLICY "Therapists update own QR codes"
  ON custom_qr_codes FOR UPDATE TO authenticated
  USING (therapist_id = auth.uid());

DROP POLICY IF EXISTS "Therapists delete own QR codes" ON custom_qr_codes;
CREATE POLICY "Therapists delete own QR codes"
  ON custom_qr_codes FOR DELETE TO authenticated
  USING (therapist_id = auth.uid());
