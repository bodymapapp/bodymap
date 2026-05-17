-- 2026-05-17-session-payments.sql
-- Phase 12.1: Session payments table
--
-- Candice request (May 17 2026): 'how do I check someone out/collect
-- payments... if client did not pay online... how would they pay
-- the therapist... this link is gone once the massage is booked'
-- followed by 'should there not be a clear indication on the above
-- view on charging the client when the client is leaving after
-- massage and then marking it paid?'
--
-- Real product gap: SessionList has a Charge button but it's hidden
-- in a non-default view and only works when the client saved a card
-- at booking. Today, a therapist has no way to:
--   1. Charge a card on file from the calendar slide-over (the
--      view they actually use)
--   2. Enter a new card now (client paid online but a different
--      card today, or a guest)
--   3. Send a one-time pay link for clients who didn't save a card
--   4. Record cash / Venmo / Zelle / other offline payments
--   5. See whether the session has been paid at all
--
-- This table is the foundation for all five flows. It deliberately
-- allows multiple payment rows per booking because:
--   - Initial charge + later tip = 2 rows
--   - Partial payment + remainder = 2 rows
--   - Refund = a separate negative-amount row
--   - Deposit at booking + balance at checkout = 2 rows
--
-- Tip is its own column for analytics. payment_method is the high-
-- level bucket. payment_method_detail is the human-readable
-- specifics (card last4, link URL, "client said Venmo @sarah-foo").

create table if not exists session_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  therapist_id uuid not null references therapists(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,

  amount_cents integer not null,
  tip_cents integer not null default 0,

  -- High-level payment bucket. Used for analytics, reporting,
  -- and choosing the right UI summary.
  payment_method text not null check (payment_method in (
    'stripe_card_on_file',   -- charge-card edge function, saved card
    'stripe_card_new',       -- entered inline via Stripe Elements
    'stripe_payment_link',   -- one-time link sent to client
    'cash',
    'venmo',
    'zelle',
    'cashapp',
    'check',
    'other'
  )),

  -- Free text. For stripe paths: card last4. For payment_link:
  -- the URL or 'Sent to client@email.com'. For offline: the optional
  -- note the therapist typed ('Venmo @sarah-foo' or 'tipped extra $5
  -- in cash on top of card').
  payment_method_detail text,

  -- Stripe references when applicable. Null for offline methods.
  stripe_payment_intent_id text,
  stripe_payment_link_id text,
  stripe_charge_id text,

  status text not null default 'succeeded' check (status in (
    'pending',    -- payment link sent, not yet paid
    'succeeded',  -- payment received and confirmed
    'refunded',   -- full refund issued
    'voided',     -- canceled before settlement
    'failed'      -- stripe declined
  )),

  -- When the money actually moved. For stripe: charge_succeeded
  -- timestamp. For offline: now() at time the therapist marked paid.
  -- For pending payment_link rows: null until webhook fires.
  paid_at timestamptz,

  -- Audit: which therapist user recorded this payment.
  created_by_therapist_id uuid references therapists(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_session_payments_booking
  on session_payments (booking_id);
create index if not exists idx_session_payments_therapist
  on session_payments (therapist_id, paid_at desc);
create index if not exists idx_session_payments_stripe_pi
  on session_payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
create index if not exists idx_session_payments_stripe_link
  on session_payments (stripe_payment_link_id)
  where stripe_payment_link_id is not null;

alter table session_payments enable row level security;

-- Therapists can read and manage their own payment records.
drop policy if exists "Therapist manages own session_payments" on session_payments;
create policy "Therapist manages own session_payments" on session_payments
  for all using (therapist_id = auth.uid())
  with check (therapist_id = auth.uid());

comment on table session_payments is
  'Phase 12: every payment event tied to a booking. Multiple rows per booking allowed for partial payments, tips added later, and refunds. The therapist Checkout and Mark as Paid flows on the calendar slide-over write here.';
