-- supabase/migrations/cancellation_phase2_schema.sql
--
-- Cancellation Phase 2: card on file + auto-charge schema.
-- Adds columns to clients and bookings, creates cancellation_charges
-- audit table.
--
-- Idempotent. Safe to re-run. Uses ADD COLUMN IF NOT EXISTS and
-- DO blocks for constraints so partial earlier work does not block.
--
-- This migration only adds storage. It does NOT change any
-- application behavior. The next deploy of BookingPage and the
-- save-card-on-booking edge function are what actually USE these
-- columns. Card capture only kicks in when a therapist's policy
-- has card_required_first_timers or card_required_regulars on.

-- ----------------------------------------------------------------------
-- clients: card on file
-- ----------------------------------------------------------------------

ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_method_id text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS card_last4 text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS card_brand text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS card_saved_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS card_mandate_text text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS card_mandate_agreed_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS card_mandate_ip_hash text;

-- ----------------------------------------------------------------------
-- bookings: cancellation charge tracking + card snapshot
-- ----------------------------------------------------------------------

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_charge_amount integer;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_charge_status text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_charge_reason text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_charge_payment_intent_id text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_charge_fired_at timestamptz;
-- Snapshot of payment method at booking time. Even if client changes their
-- card on file later, we charge what they agreed to at booking time.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS card_on_file_payment_method_id text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS card_on_file_customer_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'bookings_cancellation_charge_status_check'
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_cancellation_charge_status_check
      CHECK (cancellation_charge_status IS NULL
             OR cancellation_charge_status IN ('pending','succeeded','failed','refunded'));
  END IF;
END$$;

-- ----------------------------------------------------------------------
-- cancellation_charges: audit table, one row per charge attempt
-- ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cancellation_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  therapist_id uuid NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,

  -- Charge sizing
  amount_cents integer NOT NULL,
  policy_percent integer,
  session_price_cents integer,

  -- What triggered the charge
  trigger_event text NOT NULL CHECK (trigger_event IN ('cancel','reschedule','no_show')),
  reason_code text,
  hours_before_appointment numeric(8,2),

  -- Stripe state
  payment_intent_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','succeeded','failed','refunded')),
  error_message text,

  -- Timestamps
  fired_at timestamptz NOT NULL DEFAULT NOW(),
  succeeded_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  refund_amount_cents integer,
  refunded_by uuid,

  -- Snapshot of policy at trigger time, for audit
  policy_snapshot jsonb
);

CREATE INDEX IF NOT EXISTS cancellation_charges_booking_idx
  ON cancellation_charges(booking_id);
CREATE INDEX IF NOT EXISTS cancellation_charges_therapist_idx
  ON cancellation_charges(therapist_id);
CREATE INDEX IF NOT EXISTS cancellation_charges_status_idx
  ON cancellation_charges(status);

-- ----------------------------------------------------------------------
-- RLS: therapists see only their own audit rows
-- ----------------------------------------------------------------------

ALTER TABLE cancellation_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cancellation_charges_therapist_select" ON cancellation_charges;
CREATE POLICY "cancellation_charges_therapist_select"
  ON cancellation_charges
  FOR SELECT
  USING (therapist_id = auth.uid());

-- All writes go through edge functions with the service role key.
-- No public write policy is created intentionally.
