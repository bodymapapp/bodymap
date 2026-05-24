-- HK May 24 2026: extend session_payments to support package purchases.
--
-- Background:
--   Phase 19 added member_subscription_id to session_payments so the
--   modal could record payments against memberships, with an XOR
--   constraint: exactly one of booking_id or member_subscription_id
--   must be set per row.
--
--   Now we're unifying the checkout for packages too. The same
--   CheckoutModal that handles a session charge or a membership
--   renewal will also handle "client buys a 10-pack now." That
--   requires session_payments to know which package_purchase a
--   payment belongs to.
--
-- Changes:
--   1. Add package_purchase_id column referencing package_purchases.
--   2. Replace the booking/subscription XOR with a three-way
--      constraint: exactly one of booking_id, member_subscription_id,
--      or package_purchase_id must be set per row.
--   3. Index for quick "what payments link to this package?" lookup.
--
-- After this migration, the unified CheckoutModal can write payment
-- rows for all three charge contexts: sessions, memberships, packages.

-- Step 1: add the column
ALTER TABLE session_payments
  ADD COLUMN IF NOT EXISTS package_purchase_id UUID
    REFERENCES package_purchases(id) ON DELETE SET NULL;

-- Step 2: replace the XOR constraint with a three-way exactly-one rule
ALTER TABLE session_payments
  DROP CONSTRAINT IF EXISTS session_payments_booking_xor_subscription;

ALTER TABLE session_payments
  DROP CONSTRAINT IF EXISTS session_payments_charge_context_exactly_one;

ALTER TABLE session_payments
  ADD CONSTRAINT session_payments_charge_context_exactly_one
    CHECK (
      (CASE WHEN booking_id IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN member_subscription_id IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN package_purchase_id IS NOT NULL THEN 1 ELSE 0 END)
      = 1
    );

-- Step 3: index for package payment lookup
CREATE INDEX IF NOT EXISTS idx_session_payments_package
  ON session_payments (package_purchase_id)
  WHERE package_purchase_id IS NOT NULL;
