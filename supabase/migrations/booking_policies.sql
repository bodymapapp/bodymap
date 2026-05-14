-- supabase/migrations/booking_policies.sql
--
-- Booking policies: a free-text block the therapist writes to set
-- expectations for new clients before they confirm a booking.
-- Different concept from the cancellation policy (which is about
-- charging fees on late cancels). Booking policies cover practice
-- rules clients should know up front: late arrivals, intake forms,
-- illness, draping, scope of practice, kids, anything.
--
-- Triggered by Ashley Scalzulli's May 2026 email: 'I'd love to be
-- able to add policies that the client has to read before booking!'

-- 1. Free-text column on therapists. Markdown-light formatting
-- supported on render (line breaks, **bold**) but stored as plain
-- text so it's editable in a single textarea.
ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS booking_policies text,
  ADD COLUMN IF NOT EXISTS booking_policies_enabled boolean DEFAULT false;

-- 2. Audit trail on bookings. Same pattern the cancellation policy
-- gate uses: snapshot the EXACT policy text the client agreed to,
-- plus the timestamp. The text snapshot protects the therapist if
-- the policy is later edited.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_policies_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS booking_policies_text_snapshot text;

COMMENT ON COLUMN therapists.booking_policies IS
  'Free-text practice policies shown on booking page before client confirms. Separate from cancellation_policy_text. Ashley Scalzulli ask, May 2026.';
COMMENT ON COLUMN therapists.booking_policies_enabled IS
  'When true, booking page renders a gate requiring client to check agreement before booking proceeds. Off by default so existing therapists are not interrupted.';
