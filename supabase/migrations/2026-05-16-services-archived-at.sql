-- 2026-05-16-services-archived-at.sql
-- Phase 8.4: Fix the "removed services keep coming back" bug
--
-- HK Candice report (May 16 2026): 'I've removed services, but
-- every time I get on, they're there again. I have them turned
-- off so they don't show up to clients, but it's a long list
-- for even me to scroll through.'
--
-- Root cause: the existing deleteService() in Dashboard.js calls
-- supabase.from('services').delete().eq('id', id) without
-- checking the error. Many services have foreign key references
-- (bookings, package_purchases, gift_cards, addons, etc.), which
-- block hard deletion. The DELETE silently fails server-side,
-- but the local React state still updates to remove the row, so
-- it APPEARS to be deleted. On next page load the row comes back
-- because it was never actually deleted.
--
-- Fix: add archived_at column for soft-delete fallback. When a
-- hard delete fails because of FK constraints, we set archived_at
-- to now() and filter it out from all queries. The booking
-- history stays intact (the row still exists for FK purposes),
-- but the service vanishes from every list the therapist or
-- client sees.

alter table services
  add column if not exists archived_at timestamptz;

-- Index for the common query pattern: list services for a
-- therapist where archived_at is null. Partial index keeps the
-- size small since most services are not archived.
create index if not exists idx_services_therapist_active
  on services (therapist_id)
  where archived_at is null;

comment on column services.archived_at is
  'Soft-delete timestamp. Set to now() when the therapist removes a service but FK constraints (existing bookings, etc.) prevent hard deletion. Queries should filter archived_at IS NULL to hide archived services from all lists.';
