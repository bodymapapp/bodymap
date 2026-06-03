-- Universal double-booking guard (Jun 3 2026).
--
-- A solo therapist can only be in one place at one time, so two active
-- bookings must never overlap. The app has several booking-write paths
-- (manual single, reschedule, recurring series, bulk scheduler, public
-- online booking, request approval). Rather than rely on each path to
-- check, this trigger enforces the rule at the database layer so NO path
-- can ever create an overlap.
--
-- Scope and exemptions (deliberate):
--   . Imports are exempt (imported = true OR import_batch_id is not null).
--     Bulk historical imports may legitimately contain messy overlaps and
--     must never fail to load.
--   . Past-dated bookings are exempt (booking_date < current_date - 1).
--     Only today-and-future scheduling is protected. This also leaves the
--     large body of historical overlapping data alone.
--   . Non-occupying statuses do not block and are not blocked:
--     cancelled, rescheduled, no_show, pending-approval (a request is not
--     yet on the books, so it neither holds a slot nor gets rejected; it
--     is checked when it is approved and becomes confirmed).
--   . Status-only edits (mark complete, cancel) on an already-occupying
--     booking are not re-checked, so existing overlaps can still be
--     resolved (for example rescheduling one of two clashing bookings).
--
-- Idempotent: CREATE OR REPLACE plus DROP TRIGGER IF EXISTS.

create or replace function public.prevent_double_booking()
returns trigger
language plpgsql
as $$
declare
  v_conflict record;
  v_check boolean;
  v_non_occupying text[] := array['cancelled','rescheduled','no_show','pending-approval'];
begin
  -- Imports and historical rows bypass entirely.
  if coalesce(new.imported, false)
     or new.import_batch_id is not null
     or new.booking_date is null
     or new.booking_date < (current_date - 1) then
    return new;
  end if;

  -- A non-occupying booking neither holds a slot nor is rejected.
  if new.status = any(v_non_occupying) then
    return new;
  end if;

  if new.start_time is null or new.end_time is null then
    return new;
  end if;

  -- Only check when this write actually places or moves the booking, or
  -- when it transitions from non-occupying (a request) to occupying.
  if tg_op = 'INSERT' then
    v_check := true;
  else
    v_check := (new.start_time   is distinct from old.start_time)
            or (new.end_time     is distinct from old.end_time)
            or (new.booking_date is distinct from old.booking_date)
            or (old.status = any(v_non_occupying));
  end if;

  if not v_check then
    return new;
  end if;

  select b.id, b.client_name, b.start_time
    into v_conflict
  from public.bookings b
  where b.therapist_id = new.therapist_id
    and b.booking_date = new.booking_date
    and b.id <> new.id
    and not (b.status = any(v_non_occupying))
    and new.start_time < b.end_time
    and new.end_time   > b.start_time
  order by b.start_time
  limit 1;

  if found then
    raise exception 'BOOKING_OVERLAP: % is already booked at % on %',
      coalesce(v_conflict.client_name, 'another client'),
      to_char(v_conflict.start_time, 'HH12:MI AM'),
      new.booking_date
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_prevent_double_booking on public.bookings;
create trigger bookings_prevent_double_booking
  before insert or update on public.bookings
  for each row execute function public.prevent_double_booking();
