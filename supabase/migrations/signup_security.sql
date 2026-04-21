-- Log every signup attempt (successful or blocked) for security monitoring.
-- This table is populated by the signup-guard edge function.
CREATE TABLE IF NOT EXISTS signup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  full_name text,
  business_name text,
  ip text,
  user_agent text,
  country text,
  outcome text NOT NULL, -- 'allowed' | 'blocked' | 'flagged'
  block_reason text,
  flag_reasons text[], -- e.g. {'email_name_mismatch','all_caps_name'}
  risk_score int DEFAULT 0, -- 0-100
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip_time ON signup_attempts(ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_attempts_outcome ON signup_attempts(outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_attempts_created ON signup_attempts(created_at DESC);

-- This table is only accessed by the service role (edge functions).
-- No RLS policies = default deny for anon/authenticated users.
ALTER TABLE signup_attempts ENABLE ROW LEVEL SECURITY;

-- Add a small flag column to therapists so we can see suspicious accounts in the UI if needed later.
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS signup_risk_score int;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS signup_flag_reasons text[];
