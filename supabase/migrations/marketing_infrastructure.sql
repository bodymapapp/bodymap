-- ============================================================
-- Marketing infrastructure: drip dedup, activation tracking,
-- referrals, testimonial capture.
-- ============================================================

-- Drip send log. One row per (therapist, drip_day) so we never double-send.
CREATE TABLE IF NOT EXISTS drip_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  drip_day int NOT NULL,
  resend_id text,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz DEFAULT now(),
  UNIQUE (therapist_id, drip_day)
);
CREATE INDEX IF NOT EXISTS idx_drip_sends_therapist ON drip_sends(therapist_id);
ALTER TABLE drip_sends ENABLE ROW LEVEL SECURITY;
-- service-role only — no user policies needed

-- Activation events: key funnel milestones per therapist so we can measure
-- real onboarding completion rather than guessing.
-- Events we track: imported_clients, added_service, set_availability,
--                  shared_booking_link, sent_first_intake, first_booking_received,
--                  first_client_returned, referral_made, testimonial_submitted.
CREATE TABLE IF NOT EXISTS activation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activation_events_therapist ON activation_events(therapist_id, event_name);
CREATE INDEX IF NOT EXISTS idx_activation_events_event ON activation_events(event_name, created_at DESC);
-- Therapists can write their own events (via authenticated client), read their own
ALTER TABLE activation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activation_events_therapist_all" ON activation_events;
CREATE POLICY "activation_events_therapist_all" ON activation_events
  FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());

-- Referrals table. When a therapist signs up with ?ref=<custom_url>, we record it.
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_custom_url text NOT NULL,  -- the ?ref=value from the URL
  referrer_therapist_id uuid REFERENCES therapists(id) ON DELETE SET NULL,
  referee_therapist_id uuid REFERENCES therapists(id) ON DELETE CASCADE,
  referee_email text,
  status text DEFAULT 'pending', -- pending, confirmed, rewarded
  reward_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_therapist_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_therapist_id);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
-- Therapists can read referrals where they are the referrer or referee
DROP POLICY IF EXISTS "referrals_self_read" ON referrals;
CREATE POLICY "referrals_self_read" ON referrals
  FOR SELECT USING (referrer_therapist_id = auth.uid() OR referee_therapist_id = auth.uid());

-- Testimonials: captured from day 30 email replies, processed manually or via reply webhook.
CREATE TABLE IF NOT EXISTS testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid REFERENCES therapists(id) ON DELETE SET NULL,
  therapist_name text, -- cached in case therapist_id goes null
  therapist_business text,
  quote text NOT NULL,
  approved_for_display boolean DEFAULT false,
  source text DEFAULT 'day30_reply', -- day30_reply, manual, interview
  created_at timestamptz DEFAULT now()
);
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
-- Only service role writes. Public (anon) can read APPROVED ones for landing page.
DROP POLICY IF EXISTS "testimonials_public_read_approved" ON testimonials;
CREATE POLICY "testimonials_public_read_approved" ON testimonials
  FOR SELECT USING (approved_for_display = true);
