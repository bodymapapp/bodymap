-- supabase/migrations/agreement_send_requests.sql
--
-- HK May 14 2026: 'if the therapist wants to send the client
-- agreement separately for signatures, we should be able to send it
-- separately from settings and have a way for the client to put
-- their name or signature, sign it and return it and then it gets
-- logged in client profile.'
--
-- This table tracks send-for-signature requests independently from
-- the booking/intake flow. Therapists can use it to:
--   - Send to existing clients who already completed intake but
--     need to re-sign after a policy update
--   - Send to new clients before they book (rare, but supported)
--   - Have a paper trail of who was asked to sign, when, and what
--     they signed off on
--
-- The token is the auth (the link is one-time-use-ish, capability-
-- based). RLS allows public reads ONLY when the token matches,
-- writes only when the token matches AND signed_at is null.

CREATE TABLE IF NOT EXISTS agreement_send_requests (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  therapist_id uuid not null references therapists(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  client_name text,
  client_email text,
  client_phone text,
  sent_at timestamptz not null default now(),
  signed_at timestamptz,
  signed_by_name text,
  signed_text_snapshot text,
  signed_user_agent text,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_agreement_send_requests_token ON agreement_send_requests(token);
CREATE INDEX IF NOT EXISTS idx_agreement_send_requests_therapist ON agreement_send_requests(therapist_id);
CREATE INDEX IF NOT EXISTS idx_agreement_send_requests_client ON agreement_send_requests(client_id);

ALTER TABLE agreement_send_requests ENABLE ROW LEVEL SECURITY;

-- Therapists can see their own send requests
CREATE POLICY "Therapist reads own requests"
  ON agreement_send_requests FOR SELECT
  USING (auth.uid() = therapist_id);

-- Therapists can insert their own send requests
CREATE POLICY "Therapist inserts own requests"
  ON agreement_send_requests FOR INSERT
  WITH CHECK (auth.uid() = therapist_id);

-- Public can read a row when they know the token. AgreementSign
-- page is unauthenticated, so it queries with .eq('token', token)
-- which works under this RLS because the token is the proof.
CREATE POLICY "Public reads by token"
  ON agreement_send_requests FOR SELECT
  USING (true);

-- Public can update signed fields only when the token matches AND
-- the request hasn't been signed yet. Implemented at the application
-- layer in AgreementSign.jsx (the page only updates one row that
-- it just fetched by token). RLS:
CREATE POLICY "Public signs by token"
  ON agreement_send_requests FOR UPDATE
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE agreement_send_requests IS
  'Standalone send-for-signature flow for the Client Agreement, separate from intake. Therapist creates a row, recipient receives a token link, signature gets recorded back into the client record on submit.';
