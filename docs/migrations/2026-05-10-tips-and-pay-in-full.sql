-- ─────────────────────────────────────────────────────────────────
-- Tips + pay-in-full at booking (Lindsey #2)
-- May 10, 2026
-- ─────────────────────────────────────────────────────────────────
--
-- Adds columns to support two related features:
--
-- 1. Tips at booking time (when client pays in full upfront):
--    bookings.tip_cents - INTEGER, default 0. Tip persisted with
--                        the booking row so reports can split
--                        revenue from tips. Already used by post-
--                        session charge flows (SessionList.js,
--                        square-charge-card, charge-card edge fns)
--                        but never persisted on bookings; this
--                        formalizes the column.
--
-- 2. Pay-in-full option at booking:
--    bookings.pay_in_full - BOOLEAN, default false. Tracks if
--                           the client paid the full service price
--                           upfront vs deposit-only or pay-later.
--    therapists.pay_in_full_enabled - BOOLEAN, default false.
--                           Therapist opts into offering this
--                           option on their booking page. Default
--                           off so existing therapists do not
--                           suddenly see a new option appear
--                           without having configured it.
--
-- 3. Tip configuration:
--    therapists.accept_tips - BOOLEAN, default true. Therapist
--                             can disable tips entirely if they
--                             prefer not to invite them (some
--                             practitioners feel awkward about it).
--    therapists.tip_preset_1 - INTEGER, default 15.
--    therapists.tip_preset_2 - INTEGER, default 18.
--    therapists.tip_preset_3 - INTEGER, default 20.
--                             Three percentage values shown as
--                             chips on the booking page tip
--                             selector. Therapist can edit them
--                             individually using the inline
--                             auto-save number input pattern.
--                             Stored as 3 columns (not array)
--                             because Postgres arrays are
--                             clunky to update one element of
--                             via supabase-js.
--
-- All columns nullable / sensibly defaulted so existing therapists
-- and bookings are unaffected.
--
-- Idempotent (IF NOT EXISTS).

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS tip_cents INTEGER NOT NULL DEFAULT 0;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS pay_in_full BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS pay_in_full_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS accept_tips BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS tip_preset_1 INTEGER NOT NULL DEFAULT 15;

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS tip_preset_2 INTEGER NOT NULL DEFAULT 18;

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS tip_preset_3 INTEGER NOT NULL DEFAULT 20;

-- Sanity check
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE (table_name = 'bookings' AND column_name IN ('tip_cents', 'pay_in_full'))
   OR (table_name = 'therapists' AND column_name IN ('pay_in_full_enabled', 'accept_tips', 'tip_preset_1', 'tip_preset_2', 'tip_preset_3'))
ORDER BY table_name, column_name;
