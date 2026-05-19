-- supabase/migrations/services_groups.sql
--
-- HK May 19 2026: opt-in therapist-defined service groups.
--
-- Customer ask, Candice Peek: 'I'd like to group together all of my
-- prenatal massage services and postnatal massage services.'
--
-- Per HK: 'Therapist can define the groups and not us. Only advanced
-- users will want this and they can do it. I dont want to anger
-- therapists who do not want groups and we try to push them in some
-- type of grouping.'
--
-- Design:
--   - service_group is a free-text column on services. Null means
--     the service has no group, displays under "All other services."
--   - Groups are derived from distinct values of service_group per
--     therapist. No separate groups table; groups are implicit.
--   - Therapist opts into the grouping UI via a column on therapists
--     (use_service_groups boolean default false).
--   - Group order is stored as a JSON array on therapists.
--     service_group_order = ['Prenatal', 'Postnatal', ...]. Groups
--     not in the array sort alphabetically after.

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS service_group TEXT;

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS use_service_groups BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS service_group_order JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_services_therapist_group
  ON services (therapist_id, service_group);
