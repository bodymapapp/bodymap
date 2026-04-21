-- ============================================================
-- Notification preferences: per-therapist toggles for how
-- clients and the therapist themselves get notified. Plus
-- explicit per-client SMS consent (TCPA compliance).
-- ============================================================

-- JSONB column on therapists for all notification toggles.
-- Using JSONB so we can add new notification types later
-- without schema migrations.
ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb DEFAULT '{
    "client": {
      "booking_confirmation": {"email": true, "sms": false},
      "reminder_24h":         {"email": true, "sms": false},
      "post_session":         {"email": true, "sms": false},
      "rebooking_nudge":      {"email": false, "sms": false}
    },
    "therapist": {
      "new_booking":    {"email": true, "app_alert": true, "sms": false},
      "intake_filled":  {"email": true, "app_alert": true, "sms": false},
      "gift_purchased": {"email": true, "app_alert": true, "sms": false},
      "daily_pulse":    {"email": true}
    }
  }'::jsonb;

-- Seed defaults for existing therapists that have null
UPDATE therapists
SET notification_prefs = '{
  "client": {
    "booking_confirmation": {"email": true, "sms": false},
    "reminder_24h":         {"email": true, "sms": false},
    "post_session":         {"email": true, "sms": false},
    "rebooking_nudge":      {"email": false, "sms": false}
  },
  "therapist": {
    "new_booking":    {"email": true, "app_alert": true, "sms": false},
    "intake_filled":  {"email": true, "app_alert": true, "sms": false},
    "gift_purchased": {"email": true, "app_alert": true, "sms": false},
    "daily_pulse":    {"email": true}
  }
}'::jsonb
WHERE notification_prefs IS NULL;

-- Explicit per-client SMS consent (TCPA compliance).
-- We only send SMS to clients who opted in at intake or booking.
-- Never flip this server-side — only the client can set it by
-- checking the box themselves.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS sms_opted_in boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_opted_in_at timestamptz;

-- Also store consent on bookings (captured at booking time for walk-up clients
-- who aren't in clients table yet)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS sms_opted_in boolean DEFAULT false;

-- Notification log — audit trail of every send. Lets us answer
-- "did Sarah get her reminder?" and debug failed sends.
CREATE TABLE IF NOT EXISTS notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  notification_type text NOT NULL,   -- e.g. 'reminder_24h', 'booking_confirmation'
  audience text NOT NULL,            -- 'client' or 'therapist'
  channel text NOT NULL,             -- 'email' or 'sms' or 'app_alert'
  recipient text,                    -- email address or phone number
  status text NOT NULL,              -- 'sent', 'failed', 'skipped_consent', 'skipped_prefs'
  provider_id text,                  -- resend email id, twilio sid, etc.
  error_message text,
  sent_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_therapist ON notification_log(therapist_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_booking ON notification_log(booking_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_session ON notification_log(session_id);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_log_therapist_read" ON notification_log;
CREATE POLICY "notif_log_therapist_read" ON notification_log
  FOR SELECT USING (therapist_id = auth.uid());
-- service role writes only, no anon/authenticated insert policy
