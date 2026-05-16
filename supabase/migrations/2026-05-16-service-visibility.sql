-- 2026-05-16-service-visibility.sql
-- Phase 8.1: Private services
--
-- HK Candice request (May 16 2026): some services should be
-- bookable only by the therapist on behalf of specific clients,
-- not visible on the public booking page. Two driving use cases:
--
--   1. Legacy services with grandfathered gift card holders
--      (e.g., a 90-min that's been retired but some clients
--      still have gift cards to spend on it).
--   2. Friends-and-family discount tier that should never appear
--      on the public menu.
--
-- Design: add a `visibility` column with two values, defaulting
-- to 'public'. This keeps `active` doing what it does today
-- (the on/off master switch), and layers visibility on top.
--
--   active=true, visibility='public'   → public booking page + therapist
--   active=true, visibility='private'  → therapist book-on-behalf only
--   active=false (any visibility)      → nowhere
--
-- All existing rows default to 'public', so this is purely
-- additive. No backfill needed.

alter table services
  add column if not exists visibility text not null default 'public';

alter table services
  drop constraint if exists services_visibility_check;
alter table services
  add constraint services_visibility_check
  check (visibility in ('public', 'private'));

comment on column services.visibility is
  'public = appears on the public booking page and to the therapist. private = appears only in the therapist''s book-on-behalf flow. New rows default to public for backward compatibility.';
