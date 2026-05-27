-- supabase/migrations/2026-05-27-booking-history.sql
--
-- HK May 27 2026: audit trail for booking edits. Therapist can now
-- change service type, duration, location, addons, and partner
-- details on an existing booking. Every change writes one row here.
--
-- RLS: therapist_id = auth.uid() directly (the therapist row id IS
-- the auth user id, no separate user_id column on the therapists
-- table). Same pattern used by gift_certificates, session_payments,
-- agreement_send_requests, data_exports, and marketing_infrastructure.
--
-- change_type values: 'service', 'duration', 'location', 'addons',
-- 'partner', 'multiple' (when >1 category changed in one save).

CREATE TABLE IF NOT EXISTS booking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_type TEXT NOT NULL,
  before_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  after_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  changed_by_user_id UUID
);

CREATE INDEX IF NOT EXISTS idx_booking_history_booking
  ON booking_history (booking_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_history_therapist
  ON booking_history (therapist_id, changed_at DESC);

ALTER TABLE booking_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Therapists read own booking history" ON booking_history;
CREATE POLICY "Therapists read own booking history"
  ON booking_history FOR SELECT
  USING (therapist_id = auth.uid());

DROP POLICY IF EXISTS "Therapists insert own booking history" ON booking_history;
CREATE POLICY "Therapists insert own booking history"
  ON booking_history FOR INSERT
  WITH CHECK (therapist_id = auth.uid());

-- No UPDATE or DELETE policies. This is an audit log; rows are
-- immutable once written.

COMMENT ON TABLE booking_history IS
  'Audit log: one row per booking edit. Immutable: no UPDATE or DELETE policy.';
