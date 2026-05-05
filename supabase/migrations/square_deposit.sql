-- supabase/migrations/square_deposit.sql
--
-- Square deposit tracking on bookings. Square's Payment Link flow
-- creates an order; we store the order id on the booking so the
-- redirect / webhook can match it back.
--
-- Idempotent. Safe to re-run.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS square_deposit_order_id text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS square_deposit_link_id text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS square_deposit_paid_at timestamptz;
