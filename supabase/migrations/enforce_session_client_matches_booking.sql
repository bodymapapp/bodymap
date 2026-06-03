-- Wrong-client session guard (Jun 3 2026).
--
-- A session is the record of exactly one booking, so its client must
-- always equal that booking's client. Several create paths were stamping
-- client_id from sticky UI state, which filed one client's intake under
-- another (Jacquie saw Vicki Steadman's intake open under Julie Edwards).
-- The bad rows were repaired; this trigger stops it recurring in any
-- path by forcing a session's client to its booking's client on every
-- write. Sessions with no booking (rare walk-in drafts) are left alone.
--
-- Idempotent: CREATE OR REPLACE plus DROP TRIGGER IF EXISTS.

create or replace function public.enforce_session_client_matches_booking()
returns trigger
language plpgsql
as $$
declare
  v_booking_client uuid;
begin
  if new.booking_id is not null then
    select client_id into v_booking_client
    from public.bookings
    where id = new.booking_id;
    if v_booking_client is not null then
      new.client_id := v_booking_client;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sessions_enforce_client_matches_booking on public.sessions;
create trigger sessions_enforce_client_matches_booking
  before insert or update of client_id, booking_id on public.sessions
  for each row execute function public.enforce_session_client_matches_booking();
