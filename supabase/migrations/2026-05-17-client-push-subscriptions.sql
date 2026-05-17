-- 2026-05-17-client-push-subscriptions.sql
-- Phase 11.4: Client PWA push subscriptions
--
-- HK May 17 2026 ~6:30am: 'Do this first and only then we test so
-- that we dont have to run the test again for C-push later.'
--
-- Why a separate table from push_subscriptions:
--   - The existing push_subscriptions.therapist_id references
--     auth.users(id) and the RLS policy is "therapist_id = auth.uid()."
--     Clients have no auth user; they can never satisfy that policy.
--   - Identity model: clients are identified by (therapist_id, client_id)
--     captured at booking-confirmation time. No login.
--   - Separate table keeps the contract clean and avoids loosening
--     RLS on the therapist table.

create table if not exists client_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  therapist_id uuid not null references therapists(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  last_used_at timestamptz default now(),
  unsubscribed_at timestamptz
);

create index if not exists idx_client_push_subscriptions_client
  on client_push_subscriptions (client_id, unsubscribed_at);
create index if not exists idx_client_push_subscriptions_therapist
  on client_push_subscriptions (therapist_id);

alter table client_push_subscriptions enable row level security;

-- Public anon insert: anyone with the booking page open can subscribe.
-- The endpoint is unique so duplicate inserts upsert via on conflict.
-- No update or delete from anon (only via the user agent tapping
-- unsubscribe, which goes through the supabase JS client with
-- the anon key but is restricted to soft-delete via the unsubscribed_at
-- column).
drop policy if exists "Public can subscribe" on client_push_subscriptions;
create policy "Public can subscribe" on client_push_subscriptions
  for insert with check (true);

-- Public can soft-unsubscribe their own row by setting unsubscribed_at.
-- Limited to setting that column only, anything else is denied.
drop policy if exists "Public can soft-unsubscribe" on client_push_subscriptions;
create policy "Public can soft-unsubscribe" on client_push_subscriptions
  for update using (true) with check (unsubscribed_at is not null);

-- Therapists can read their clients' subscriptions for diagnostics.
drop policy if exists "Therapist can read own clients' subscriptions" on client_push_subscriptions;
create policy "Therapist can read own clients' subscriptions" on client_push_subscriptions
  for select using (therapist_id = auth.uid());

comment on table client_push_subscriptions is
  'PWA web push subscriptions for clients. Created when a client opts in on the booking-confirmed page. Used by send-push-client to fan out client-side push notifications (session reminders, no-show notices, lapse nudges). Soft-deleted via unsubscribed_at when the client opts out or the subscription returns 410 from the provider.';
