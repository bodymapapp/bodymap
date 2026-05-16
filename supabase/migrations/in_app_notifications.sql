-- ============================================================
-- in_app_notifications: the bell-icon drawer surface for the
-- therapist top nav. Separate from notification_log (which is
-- an audit trail) because:
--   1. We need an unread/read state per row that the therapist
--      controls (notification_log status is sent/failed/skipped,
--      that's about the SEND attempt, not the READ state).
--   2. The drawer wants a clean shape with title, body, icon,
--      link, payload. notification_log has channel-specific
--      noise (provider_id, recipient, error_message) that does
--      not belong on a UI surface.
--   3. The drawer is therapist-facing and writeable by the
--      therapist (to mark read). notification_log is service-
--      role write only.
--
-- HK May 16 2026: "When I got paid, I should have received an
-- email on my therapist account but I did not. There should
-- be also some type of notification for these items on my
-- platform for certain important things like when a new
-- client signs up, a deposit or anything to do with a client
-- or money."
-- ============================================================

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  event_type text NOT NULL,           -- 'payment_received', 'new_client_signup', etc.
  title text NOT NULL,                -- one-line headline
  body text,                          -- optional sub-line
  icon text,                          -- emoji or short symbol
  link_url text,                      -- internal route to deep-link to
  payload jsonb,                      -- structured event data (amounts, client_id, booking_id)
  read_at timestamptz,                -- NULL = unread
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_in_app_notif_therapist_unread
  ON in_app_notifications(therapist_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_in_app_notif_therapist_recent
  ON in_app_notifications(therapist_id, created_at DESC);

ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "in_app_notif_self_read" ON in_app_notifications;
CREATE POLICY "in_app_notif_self_read" ON in_app_notifications
  FOR SELECT USING (therapist_id = auth.uid());

DROP POLICY IF EXISTS "in_app_notif_self_update" ON in_app_notifications;
CREATE POLICY "in_app_notif_self_update" ON in_app_notifications
  FOR UPDATE USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());

-- INSERT only via service-role from edge functions (no policy here, so anon/authenticated are denied).

-- ============================================================
-- Extend notification_prefs defaults to cover the new events.
-- Existing JSONB rows that already have a 'therapist' object
-- are merged with the new keys; rows that are NULL get the
-- full default. New events default to email+app_alert ON,
-- sms OFF (TCPA-safe).
-- ============================================================

-- For NULL rows: seed full default with the new types included.
UPDATE therapists
SET notification_prefs = '{
  "client": {
    "booking_confirmation": {"email": true, "sms": false},
    "reminder_24h":         {"email": true, "sms": false},
    "post_session":         {"email": true, "sms": false},
    "rebooking_nudge":      {"email": false, "sms": false}
  },
  "therapist": {
    "new_booking":           {"email": true, "app_alert": true, "sms": false},
    "intake_filled":         {"email": true, "app_alert": true, "sms": false},
    "gift_purchased":        {"email": true, "app_alert": true, "sms": false},
    "daily_pulse":           {"email": true},
    "payment_received":      {"email": true, "app_alert": true, "sms": false},
    "new_client_signup":     {"email": true, "app_alert": true, "sms": false},
    "booking_cancelled":     {"email": true, "app_alert": true, "sms": false},
    "no_show_recorded":      {"email": true, "app_alert": true, "sms": false}
  }
}'::jsonb
WHERE notification_prefs IS NULL;

-- For existing rows: merge the new event types into the therapist
-- object without disturbing whatever the therapist already chose
-- for their existing prefs.
UPDATE therapists
SET notification_prefs = jsonb_set(
  notification_prefs,
  '{therapist}',
  COALESCE(notification_prefs->'therapist', '{}'::jsonb) || '{
    "payment_received":      {"email": true, "app_alert": true, "sms": false},
    "new_client_signup":     {"email": true, "app_alert": true, "sms": false},
    "booking_cancelled":     {"email": true, "app_alert": true, "sms": false},
    "no_show_recorded":      {"email": true, "app_alert": true, "sms": false}
  }'::jsonb,
  true
)
WHERE notification_prefs IS NOT NULL
  AND NOT (notification_prefs->'therapist' ? 'payment_received');
