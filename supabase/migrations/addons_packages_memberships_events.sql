-- supabase/migrations/addons_packages_memberships_events.sql
--
-- Combined schema migration for four features requested via Facebook
-- community feedback (April 2026):
--
--   1. SERVICE ADD-ONS (Leslie Luna)
--      Optional extras a client picks at booking, e.g. Hot Stones (+$15),
--      Aromatherapy (+$10), Extended Time (+$45). Same shape as Vagaro
--      and MassageBook offer. Add-ons can change price and minutes.
--
--   2. PACKAGES (Erica Pearre)
--      Multi-session bundles, e.g. "5-pack of 60-min Deep Tissue at $400"
--      ($80/session, 16% discount vs single $95). Client buys upfront,
--      redeems sessions over time. Therapist tracks remaining credits.
--
--   3. MEMBERSHIPS (Erica Pearre)
--      Recurring monthly subscriptions, e.g. "Monthly Member - $89/mo
--      includes 1 session/mo + 10% off add-ons + carry-over up to 2
--      unused sessions." Stripe handles the recurring billing; we track
--      the monthly credit allocation and member benefits.
--
--   4. CLASSES / EVENTS (Venus Yvette-Lmt)
--      Group sessions, e.g. "Stretch & Restore Workshop, Saturday 10am,
--      $35/person, 8 spots." Multi-attendee booking model distinct from
--      one-on-one sessions.
--
-- Idempotent: uses CREATE TABLE IF NOT EXISTS and ADD COLUMN IF NOT
-- EXISTS so this can be re-run safely. RLS policies follow the pattern
-- used elsewhere (therapist owns their rows; clients see their own).
-- Run this in the Supabase SQL Editor for project rmnqfrljoknmellbnpiy.

-- ─────────────────────────────────────────────────────────────────────
-- 1. SERVICE ADD-ONS
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(8,2) NOT NULL DEFAULT 0,
  -- Extra minutes added to the appointment slot when this add-on is chosen.
  -- 0 means it does not extend the appointment (e.g. Aromatherapy).
  extra_minutes INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_addons_therapist ON service_addons(therapist_id) WHERE active = TRUE;

-- Bookings store the chosen add-on IDs as a JSON array, plus total price
-- snapshot (so we have an immutable record of what the client agreed to
-- even if therapist later changes add-on prices).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS addon_ids JSONB DEFAULT '[]'::JSONB;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS addon_total_price NUMERIC(8,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS addon_extra_minutes INT DEFAULT 0;

ALTER TABLE service_addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Therapists manage own add-ons" ON service_addons;
CREATE POLICY "Therapists manage own add-ons" ON service_addons
  FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());
DROP POLICY IF EXISTS "Public can read active add-ons for booking" ON service_addons;
CREATE POLICY "Public can read active add-ons for booking" ON service_addons
  FOR SELECT USING (active = TRUE);

COMMENT ON TABLE service_addons IS 'Optional extras a client can pick at booking (e.g. Hot Stones, Aromatherapy). Modifies booking price and optionally duration.';

-- ─────────────────────────────────────────────────────────────────────
-- 2. PACKAGES (multi-session bundles)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  -- Number of sessions included in the package.
  session_count INT NOT NULL CHECK (session_count > 0),
  -- Total package price (one-time). Per-session implied price is total / count.
  price NUMERIC(8,2) NOT NULL,
  -- Optional: which service(s) the package can be redeemed against.
  -- NULL = any active service. JSON array of service UUIDs otherwise.
  applicable_service_ids JSONB DEFAULT NULL,
  -- Sessions expire this many days after purchase. NULL = never expire.
  expires_in_days INT DEFAULT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_packages_therapist ON packages(therapist_id) WHERE active = TRUE;

-- A client buys a package -> a row here. Tracks remaining sessions.
CREATE TABLE IF NOT EXISTS package_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_email TEXT NOT NULL,
  client_name TEXT,
  -- Snapshot of package config at purchase time (immutable record).
  sessions_purchased INT NOT NULL,
  sessions_remaining INT NOT NULL,
  price_paid NUMERIC(8,2) NOT NULL,
  -- Stripe payment intent ID for the upfront purchase.
  stripe_payment_id TEXT,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','exhausted','expired','refunded')),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_package_purchases_therapist ON package_purchases(therapist_id);
CREATE INDEX IF NOT EXISTS idx_package_purchases_client_email ON package_purchases(LOWER(client_email));
CREATE INDEX IF NOT EXISTS idx_package_purchases_status ON package_purchases(status) WHERE status = 'active';

-- Each redemption (a session that drew down a package credit).
CREATE TABLE IF NOT EXISTS package_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_purchase_id UUID NOT NULL REFERENCES package_purchases(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_package_redemptions_purchase ON package_redemptions(package_purchase_id);

-- Booking can be paid via package credit instead of cash. NULL means cash.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS package_purchase_id UUID REFERENCES package_purchases(id) ON DELETE SET NULL;

ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Therapists manage own packages" ON packages;
CREATE POLICY "Therapists manage own packages" ON packages
  FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());
DROP POLICY IF EXISTS "Public can read active packages" ON packages;
CREATE POLICY "Public can read active packages" ON packages
  FOR SELECT USING (active = TRUE);

ALTER TABLE package_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Therapists see own package purchases" ON package_purchases;
CREATE POLICY "Therapists see own package purchases" ON package_purchases
  FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());

ALTER TABLE package_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Therapists see own package redemptions" ON package_redemptions;
CREATE POLICY "Therapists see own package redemptions" ON package_redemptions
  FOR ALL USING (
    package_purchase_id IN (SELECT id FROM package_purchases WHERE therapist_id = auth.uid())
  );

COMMENT ON TABLE packages IS 'Multi-session bundles offered by a therapist (e.g. 5-pack at discount).';
COMMENT ON TABLE package_purchases IS 'A client''s purchased package, tracking remaining sessions.';
COMMENT ON TABLE package_redemptions IS 'Audit log of each session redeemed against a package purchase.';

-- ─────────────────────────────────────────────────────────────────────
-- 3. MEMBERSHIPS (recurring subscriptions)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  -- Recurring price (charged monthly via Stripe).
  monthly_price NUMERIC(8,2) NOT NULL,
  -- Sessions included per month (commonly 1 or 2).
  monthly_session_credits INT NOT NULL DEFAULT 1,
  -- Optional perks: percent off add-ons, percent off extra sessions.
  addon_discount_percent INT NOT NULL DEFAULT 0,
  extra_session_discount_percent INT NOT NULL DEFAULT 0,
  -- Unused credits roll over up to this cap. 0 = no roll-over.
  max_carryover_credits INT NOT NULL DEFAULT 0,
  -- Stripe Price ID for the recurring subscription.
  stripe_price_id TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_memberships_therapist ON memberships(therapist_id) WHERE active = TRUE;

-- A client subscribes -> a row here. One subscription per client per therapist
-- at a time; canceling sets status = 'canceled'.
CREATE TABLE IF NOT EXISTS member_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE RESTRICT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_email TEXT NOT NULL,
  client_name TEXT,
  -- Stripe subscription ID for cancel / portal access.
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','canceled','paused')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  -- Snapshot of membership config at signup (price/credits at the time).
  monthly_price NUMERIC(8,2) NOT NULL,
  monthly_session_credits INT NOT NULL,
  -- Running credit balance — incremented monthly by Stripe webhook,
  -- decremented on each booking that uses a member credit.
  current_credits INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  canceled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_member_subs_therapist ON member_subscriptions(therapist_id);
CREATE INDEX IF NOT EXISTS idx_member_subs_email ON member_subscriptions(LOWER(client_email));
CREATE INDEX IF NOT EXISTS idx_member_subs_status ON member_subscriptions(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_member_subs_stripe ON member_subscriptions(stripe_subscription_id);

-- Audit log of credit grants (monthly billing) and credit uses (bookings).
CREATE TABLE IF NOT EXISTS member_credit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_subscription_id UUID NOT NULL REFERENCES member_subscriptions(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  delta INT NOT NULL,  -- positive = credit granted, negative = credit used
  reason TEXT NOT NULL,  -- 'monthly_grant' | 'booking_redemption' | 'refund' | 'admin_adjustment'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_member_credits_sub ON member_credit_events(member_subscription_id);

-- Booking can be paid via member credit. NULL = not a member booking.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS member_subscription_id UUID REFERENCES member_subscriptions(id) ON DELETE SET NULL;

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Therapists manage own memberships" ON memberships;
CREATE POLICY "Therapists manage own memberships" ON memberships
  FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());
DROP POLICY IF EXISTS "Public can read active memberships" ON memberships;
CREATE POLICY "Public can read active memberships" ON memberships
  FOR SELECT USING (active = TRUE);

ALTER TABLE member_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Therapists see own member subscriptions" ON member_subscriptions;
CREATE POLICY "Therapists see own member subscriptions" ON member_subscriptions
  FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());

ALTER TABLE member_credit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Therapists see own member credit events" ON member_credit_events;
CREATE POLICY "Therapists see own member credit events" ON member_credit_events
  FOR ALL USING (
    member_subscription_id IN (SELECT id FROM member_subscriptions WHERE therapist_id = auth.uid())
  );

COMMENT ON TABLE memberships IS 'Recurring monthly subscription plans defined by a therapist.';
COMMENT ON TABLE member_subscriptions IS 'A client''s active membership, tracking credit balance.';
COMMENT ON TABLE member_credit_events IS 'Append-only log of credit grants and redemptions per subscription.';

-- ─────────────────────────────────────────────────────────────────────
-- 4. CLASSES / EVENTS (group sessions)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  -- When the event happens (single occurrence; recurring events would be
  -- modeled by creating multiple event rows or via a separate template
  -- table later).
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  -- Free-form location string (e.g. "Sugar Land studio, 123 Main St").
  location TEXT,
  -- Maximum attendees. 1 means it behaves like a private session.
  capacity INT NOT NULL CHECK (capacity > 0),
  -- Per-attendee price.
  price NUMERIC(8,2) NOT NULL DEFAULT 0,
  -- Whether to require deposit at registration (separate from therapist's
  -- normal deposit setting).
  deposit_required BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_amount NUMERIC(8,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('draft','scheduled','full','canceled','complete')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_therapist ON events(therapist_id);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at) WHERE status IN ('scheduled','full');

-- Each registration represents one attendee for an event. Capacity logic
-- compares COUNT of confirmed registrations to events.capacity.
CREATE TABLE IF NOT EXISTS event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  -- Number of seats this registration takes (e.g. attendee + plus-one = 2).
  seats INT NOT NULL DEFAULT 1 CHECK (seats > 0),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','canceled','waitlist','no_show','attended')),
  stripe_payment_id TEXT,
  amount_paid NUMERIC(8,2) NOT NULL DEFAULT 0,
  notes TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_regs_event ON event_registrations(event_id) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_event_regs_therapist ON event_registrations(therapist_id);
CREATE INDEX IF NOT EXISTS idx_event_regs_email ON event_registrations(LOWER(client_email));

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Therapists manage own events" ON events;
CREATE POLICY "Therapists manage own events" ON events
  FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());
DROP POLICY IF EXISTS "Public can read scheduled events" ON events;
CREATE POLICY "Public can read scheduled events" ON events
  FOR SELECT USING (status IN ('scheduled','full'));

ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Therapists see own event registrations" ON event_registrations;
CREATE POLICY "Therapists see own event registrations" ON event_registrations
  FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());

COMMENT ON TABLE events IS 'Group sessions (classes, workshops) with capacity > 1.';
COMMENT ON TABLE event_registrations IS 'A client signed up for a specific event.';

-- Done.
