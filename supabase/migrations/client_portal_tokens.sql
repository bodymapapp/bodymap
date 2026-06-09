-- Client portal (Phase 1) magic-link tokens (HK Jun 2026). Passwordless
-- "My visits" for clients. Clients never get a Supabase auth session
-- (that would expose the broad authenticated read policies on
-- clients/sessions/bookings), so identity is carried by an opaque,
-- expiring token held only here and read only by the client-portal edge
-- function via the service role. RLS on with no policy plus the revoke
-- means anon and authenticated get nothing.
create table if not exists public.client_portal_tokens (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz
);
create unique index if not exists uq_cpt_token on public.client_portal_tokens(token);
create index if not exists idx_cpt_email on public.client_portal_tokens(lower(email));
alter table public.client_portal_tokens enable row level security;
revoke all on public.client_portal_tokens from anon, authenticated;
