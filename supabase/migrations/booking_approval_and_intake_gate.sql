-- ============================================================
-- Booking approval + intake-before-booking gates.
--
-- Two new per-therapist toggles, both default OFF so existing
-- therapists are unaffected:
--
--   require_approval — when ON, NEW clients (no prior booking
--   matching email/phone/name) submit a request instead of a
--   confirmed booking. Status is 'pending-approval'. Therapist
--   approves or declines from the schedule. Returning clients
--   auto-confirm as today.
--
--   require_intake_before_booking — when ON, NEW clients must
--   complete the intake form (which already bundles the waiver)
--   before the booking page will accept their submission.
--   Returning clients (email match) bypass automatically.
--
-- bookings.status remains a free text column. New value
-- 'pending-approval' is added by application code and does not
-- need a schema constraint change.
-- ============================================================

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS require_approval boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_intake_before_booking boolean DEFAULT false;

-- Optional decline reason captured when the therapist declines a
-- pending request. Stored on the booking row itself so it shows
-- in the client's email and in the therapist's history.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS approval_action_at timestamptz;

-- Index so the "Pending requests" panel in ScheduleDashboard
-- loads instantly even for therapists with thousands of bookings.
CREATE INDEX IF NOT EXISTS idx_bookings_pending_approval
  ON bookings(therapist_id, booking_date)
  WHERE status = 'pending-approval';
