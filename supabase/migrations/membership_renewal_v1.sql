-- supabase/migrations/membership_renewal_v1.sql
--
-- HK May 18 2026, Phase 19: standardized charge flow + membership
-- renewal reminders. Built so MyBodyMap holds the membership record
-- and reminds the therapist when payment is due, but the therapist
-- does the charging using their existing tooling. No "recurring
-- billing liability" on the platform.
--
-- Three changes:
--
-- 1. session_payments accepts membership renewals (not just bookings).
--    Make booking_id nullable, add member_subscription_id, add a
--    check that exactly one is set. One source of truth for every
--    payment event on the platform.
--
-- 2. member_subscriptions gets columns to track renewal state without
--    relying on Stripe. The therapist owns the cadence.
--
-- 3. member_subscription_renewals row per period to track charge/waive
--    history. Lets the reminder dashboard know what's due, what's
--    been handled, and what was waived (and by whom, when).

-- ---------- 1. session_payments accepts membership renewals ----------

ALTER TABLE session_payments
  ALTER COLUMN booking_id DROP NOT NULL;

ALTER TABLE session_payments
  ADD COLUMN IF NOT EXISTS member_subscription_id UUID
    REFERENCES member_subscriptions(id) ON DELETE SET NULL;

ALTER TABLE session_payments
  ADD COLUMN IF NOT EXISTS member_subscription_renewal_id UUID;
-- FK on this column added after the renewals table is created below.

-- Exactly one of booking_id or member_subscription_id must be set.
-- A payment is either for a session OR for a membership renewal,
-- never both, never neither.
ALTER TABLE session_payments
  DROP CONSTRAINT IF EXISTS session_payments_booking_xor_subscription;
ALTER TABLE session_payments
  ADD CONSTRAINT session_payments_booking_xor_subscription
    CHECK (
      (booking_id IS NOT NULL AND member_subscription_id IS NULL) OR
      (booking_id IS NULL AND member_subscription_id IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS idx_session_payments_subscription
  ON session_payments (member_subscription_id)
  WHERE member_subscription_id IS NOT NULL;

-- ---------- 2. member_subscriptions renewal-state columns ----------

ALTER TABLE member_subscriptions
  ADD COLUMN IF NOT EXISTS renewal_day_of_month INT
    CHECK (renewal_day_of_month BETWEEN 1 AND 31);
-- Day of month the membership renews. e.g. 18 = bills on the 18th.
-- For months without that day (Feb 30/31), the renewal lands on the
-- last day of that month.

ALTER TABLE member_subscriptions
  ADD COLUMN IF NOT EXISTS billing_cadence TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cadence IN ('monthly', 'quarterly', 'annual'));

ALTER TABLE member_subscriptions
  ADD COLUMN IF NOT EXISTS notes TEXT;
-- Optional free-text the therapist can use for legacy pricing
-- agreements, special arrangements, etc.

-- ---------- 3. member_subscription_renewals ----------
--
-- One row per renewal period (e.g. "Sarah's June 2026 charge").
-- Created in advance by a daily cron a few days before the renewal
-- date. Therapist actions (charge, mark-paid, waive) update this row.

CREATE TABLE IF NOT EXISTS member_subscription_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_subscription_id UUID NOT NULL
    REFERENCES member_subscriptions(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- The period this renewal covers.
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  -- The day on which the charge is due (typically period_start, but
  -- the cron pre-creates the row a few days early so the therapist
  -- sees it coming).
  due_on DATE NOT NULL,

  -- Amount the therapist agreed to charge this period (snapshot of
  -- monthly_price at time of cron creation, so a mid-period price
  -- change doesn't surprise either side).
  amount_due_cents INT NOT NULL,

  -- Status of this renewal.
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',   -- waiting for therapist action
      'paid',      -- session_payments row linked, money received
      'waived',    -- therapist waived this period (free month, refund, etc)
      'skipped'    -- subscription cancelled before this period
    )),

  -- When the therapist took action.
  resolved_at TIMESTAMPTZ,
  resolved_by_therapist_id UUID REFERENCES therapists(id) ON DELETE SET NULL,
  waive_reason TEXT,
  -- Linked session_payment when status='paid'. NULL otherwise.
  session_payment_id UUID REFERENCES session_payments(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Now wire the FK back from session_payments to renewals.
ALTER TABLE session_payments
  DROP CONSTRAINT IF EXISTS session_payments_renewal_fk;
ALTER TABLE session_payments
  ADD CONSTRAINT session_payments_renewal_fk
    FOREIGN KEY (member_subscription_renewal_id)
    REFERENCES member_subscription_renewals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_renewals_subscription
  ON member_subscription_renewals (member_subscription_id);
CREATE INDEX IF NOT EXISTS idx_renewals_therapist_pending
  ON member_subscription_renewals (therapist_id, due_on)
  WHERE status = 'pending';

ALTER TABLE member_subscription_renewals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "renewals_owner_all" ON member_subscription_renewals;
CREATE POLICY "renewals_owner_all" ON member_subscription_renewals
  FOR ALL
  USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());

COMMENT ON TABLE member_subscription_renewals IS
  'Phase 19: one row per renewal period per subscription. Therapist resolves each row by charging, marking paid offline, or waiving. The reminder banner on the billing dashboard reads pending rows. Cron creates upcoming rows daily.';
