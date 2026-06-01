-- supabase/migrations/client_appointment_extra_fields.sql
--
-- HK Jun 1 2026 (Scope B): capture the fields competitor exports
-- (Vagaro, MassageBook, etc.) carry that we did not store. Two areas.
--
-- CLIENT record (5 fields):
--   birthday          date    for birthday outreach
--   gender            text    pill-backed: Female/Male/Non-binary/
--                             Prefer not to say/Other(text). Stored as
--                             the chosen label, or the free text when
--                             Other. Optional, sensitive, may be blank.
--   referral_source   text    pill-backed: Referred by someone/Found
--                             online/Social media/Returning client/
--                             Walk-in/Other(text).
--   customer_since    date    when they first became a client on the
--                             prior platform.
--   alt_phone         text    a secondary phone (digits-only, like phone).
--
-- APPOINTMENT (bookings) record (2 fields):
--   booked_by         text    pill-backed: Client booked it/You booked
--                             it/Other(text).
--   booking_method    text    pill-backed: Online/By phone/By text/
--                             In person/Other(text).
--
-- All nullable, no defaults, so existing rows are untouched and the
-- import fills them when present. Pills live in the client and
-- appointment screens; import maps known values and drops anything
-- else into the Other text so nothing is lost.

alter table public.clients
  add column if not exists birthday        date,
  add column if not exists gender          text,
  add column if not exists referral_source text,
  add column if not exists customer_since  date,
  add column if not exists alt_phone       text;

alter table public.bookings
  add column if not exists booked_by       text,
  add column if not exists booking_method  text;
