-- supabase/migrations/notification_log_delivery_status.sql
--
-- HK May 18 2026: Macro #13 from BLOCK_PLAN.md. The notification_log
-- status column reflects only the immediate result of attempting to
-- send (sent / failed / skipped). For Twilio SMS, status='sent' is
-- a lie: Twilio accepted the API call, but the carrier may drop the
-- message silently. The Notification Compliance Dashboard's matrix
-- shows green cells for messages that never arrived.
--
-- These columns let twilio-status-callback record the actual delivery
-- outcome when Twilio POSTs back to our webhook (typically within
-- 30 seconds of the original send for delivered/undelivered events).
--
-- Read path: dashboard queries should COALESCE(delivery_status, status)
-- to render the most accurate state available. When delivery_status is
-- present, it's the truth. When it's null, we haven't heard back yet
-- (or this isn't an SMS row, since Resend and OneSignal have their own
-- delivery semantics).
--
-- Twilio MessageStatus values we expect:
--   queued        accepted by Twilio, not yet sent
--   sending       in transit
--   sent          handed to carrier (legacy meaning; we already track this)
--   delivered     confirmed delivered to handset
--   undelivered   carrier dropped (most common A2P-block result)
--   failed        permanent failure (bad number, etc.)
--   read          read receipt (rare in US, mostly iMessage shortcodes)
-- We store the raw value from Twilio so future analysis can distinguish.

ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivery_status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_error_code text;

-- delivery_error_code holds Twilio's ErrorCode field on undelivered
-- or failed events (e.g. 30007 = carrier filtered, 30008 = unknown
-- error, 30032 = toll-free message blocked). Lets the dashboard
-- show the specific cause when carriers reject.

CREATE INDEX IF NOT EXISTS notification_log_provider_id_idx
  ON notification_log(provider_id)
  WHERE provider_id IS NOT NULL;

-- The provider_id index is critical: twilio-status-callback looks up
-- the notification_log row by Twilio's MessageSid (which we stored as
-- provider_id when the message was originally sent). Without this
-- index, every callback does a sequential scan on notification_log.
