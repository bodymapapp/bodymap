-- supabase/migrations/2026_05_06_clients_square_card_on_file.sql
--
-- Adds Square card-on-file columns to the clients table, mirroring
-- the existing Stripe columns (stripe_customer_id, stripe_payment_method_id).
--
-- Used by:
--   - save-card-on-booking-token: stores square_customer_id + square_card_id
--     after Web Payments SDK tokenization
--   - charge-cancellation-fee: reads which processor's columns are
--     populated to decide which provider charges the saved card
--   - card_last4 + card_brand: rendered in the cancellation charge
--     modal so therapists see 'Visa ending 4242 via Square' before
--     confirming the charge
--
-- All columns nullable; a client may have neither processor's
-- card-on-file (no policy gate triggered), one (whichever processor
-- was used at booking time), or theoretically both (rare; older
-- bookings on different processors).

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS square_customer_id text,
  ADD COLUMN IF NOT EXISTS square_card_id text,
  ADD COLUMN IF NOT EXISTS card_last4 text,
  ADD COLUMN IF NOT EXISTS card_brand text;

-- Bookings parallel: stores which Square customer was used for
-- card-on-file at booking time, so cancellation charging can find
-- it via booking_id alone without a clients-table join.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS card_on_file_square_customer_id text;

