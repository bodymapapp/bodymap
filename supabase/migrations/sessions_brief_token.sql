-- Per-session capability token for the therapist prep briefs
-- (pre, post, intake). Added Jun 8 2026 as part of Stage 2 of the read
-- lockdown. The brief links carry ?t=<brief_token>; the brief-view edge
-- function returns the full brief only to a valid token holder or the
-- logged-in owner. Existing rows are backfilled by the volatile default.
alter table public.sessions
  add column if not exists brief_token uuid not null default gen_random_uuid();
