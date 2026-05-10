-- 2026-05-10-google-calendar-sync.sql
--
-- Lindsey #10: Google Calendar two-way sync.
--
-- Adds OAuth token storage to therapists, plus a new table for
-- external events synced FROM Google Calendar. External events
-- block MyBodyMap booking slots so clients cannot double-book a
-- therapist who has 'dentist 2 PM' or similar in their personal
-- calendar.
--
-- Polling model (v1):
--   Reverse sync via cron-triggered edge function every 15 min.
--   Each connected therapist's calendar fetched with sync token
--   for incremental updates. Lag is up to 15 min, communicated
--   to the therapist clearly in the connect UI.
--
-- Forward sync:
--   On booking create / update / cancel, edge function POSTs to
--   Google Calendar API to mirror the event in the therapist's
--   primary calendar. Stores the resulting Google event_id on
--   the booking row so updates and cancels can target the right
--   event.

-- =====================================================
-- 1. Add Google sync columns to therapists
-- =====================================================

alter table therapists
  add column if not exists google_calendar_connected boolean default false,
  add column if not exists google_access_token text,        -- expires after 1 hour
  add column if not exists google_refresh_token text,        -- long-lived
  add column if not exists google_token_expires_at timestamptz,
  add column if not exists google_calendar_id text default 'primary',
  add column if not exists google_email text,                -- which Google account is connected
  add column if not exists google_sync_token text,           -- incremental sync token from list API
  add column if not exists google_last_synced_at timestamptz,
  add column if not exists google_connected_at timestamptz;

-- =====================================================
-- 2. Add Google event_id to bookings
-- =====================================================
-- When forward sync creates a Google event for a booking, we
-- store the resulting event id here. On booking update we PATCH
-- that event. On cancel we DELETE it.

alter table bookings
  add column if not exists google_event_id text,
  add column if not exists google_synced_at timestamptz;

-- =====================================================
-- 3. External Google events that block MyBodyMap slots
-- =====================================================
-- Synced FROM Google. Each row is a non-MyBodyMap event from
-- the therapist's calendar (lunch, dentist, kid pickup, etc).
-- The slot generator on the booking page subtracts these from
-- availability so clients cannot book over them.
--
-- We store enough to answer two questions:
--   1. Block which time range? (start_at, end_at)
--   2. What is this event called? (summary — only shown to the
--      therapist on her own dashboard, never to clients)
--
-- google_event_id is unique per calendar so we can dedupe on
-- repeated syncs.

create table if not exists external_calendar_events (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references therapists(id) on delete cascade,
  source text not null default 'google',  -- future-proof for outlook etc
  external_event_id text not null,         -- Google's event id
  summary text,                            -- event title, "Dentist", "Lunch with Mom"
  start_at timestamptz not null,
  end_at timestamptz not null,
  is_all_day boolean default false,
  status text default 'confirmed',         -- 'confirmed', 'cancelled' (cancelled rows kept for sync token continuity)
  last_synced_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (therapist_id, source, external_event_id)
);

-- Lookup index for slot generator: 'find external events for
-- this therapist between these times.'
create index if not exists external_events_therapist_time
  on external_calendar_events (therapist_id, start_at, end_at)
  where status = 'confirmed';

-- =====================================================
-- 4. RLS policies
-- =====================================================

alter table external_calendar_events enable row level security;

-- Therapist can read their own external events (they see them on
-- their dashboard with summary).
drop policy if exists "Therapist reads own external events" on external_calendar_events;
create policy "Therapist reads own external events"
  on external_calendar_events for select
  using (therapist_id = auth.uid());

-- Therapist can delete their own external events (manual cleanup
-- if a stale event lingers). Service role can do anything.
drop policy if exists "Therapist deletes own external events" on external_calendar_events;
create policy "Therapist deletes own external events"
  on external_calendar_events for delete
  using (therapist_id = auth.uid());

-- Insert and update happen via service role from edge functions.
-- No client-side INSERT/UPDATE policies needed.

-- =====================================================
-- 5. Booking page slot blocker: anonymous clients need to know
-- when slots are blocked WITHOUT seeing event titles.
-- =====================================================
-- The slot generator on BookingPage runs as anon (no auth). It
-- needs to query 'is this time range blocked by an external
-- event for this therapist?' but must NOT see event summaries.
--
-- Solution: a security definer function that returns ONLY the
-- start_at and end_at for confirmed events, no summary, no
-- external_event_id. Anon can call it. Therapist's own dashboard
-- queries the table directly via the SELECT policy above and
-- sees full details.

create or replace function public.get_blocked_ranges(
  p_therapist_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (start_at timestamptz, end_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select e.start_at, e.end_at
  from external_calendar_events e
  where e.therapist_id = p_therapist_id
    and e.status = 'confirmed'
    and e.end_at > p_from
    and e.start_at < p_to;
$$;

grant execute on function public.get_blocked_ranges(uuid, timestamptz, timestamptz) to anon, authenticated;

-- =====================================================
-- 6. Sanity log
-- =====================================================

do $$
begin
  raise notice 'Google Calendar sync migration applied. New therapist columns: google_calendar_connected, google_access_token, google_refresh_token, google_token_expires_at, google_calendar_id, google_email, google_sync_token, google_last_synced_at, google_connected_at. New bookings columns: google_event_id, google_synced_at. New table: external_calendar_events.';
end $$;
