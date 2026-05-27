-- supabase/migrations/2026-05-27-booking-history.sql
--
-- HK May 27 2026: audit trail for booking edits. Therapist can now
-- change service type, duration, location, addons, and partner
-- details on an existing booking. Every change writes one row here
-- so we can show clients later "your booking was updated on X" and
-- reconcile billing later if needed.
--
-- One row per edit, NOT per field. A single edit that changes
-- service + duration in one save writes ONE row with both
-- before/after captured in the JSONB blobs.
--
-- change_type categorizes the dominant kind of change for fast
-- filtering. Values: 'service', 'duration', 'time', 'addons',
-- 'location', 'partner', 'multiple' (when >1 category changed).
--
-- RLS: therapists can read/insert their own. No DELETE (audit log).

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
  USING (therapist_id IN (
    SELECT id FROM therapists WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Therapists insert own booking history" ON booking_history;
CREATE POLICY "Therapists insert own booking history"
  ON booking_history FOR INSERT
  WITH CHECK (therapist_id IN (
    SELECT id FROM therapists WHERE user_id = auth.uid()
  ));

-- No UPDATE or DELETE policies. This is an audit log; rows are
-- immutable once written. If a row needs to be reverted, write a
-- new row that captures the revert as its own edit event.

COMMENT ON TABLE booking_history IS
  'Audit log: one row per booking edit. Stores before/after JSONB snapshots so therapist and client can later see what changed and when. Immutable: no UPDATE or DELETE policy.';
