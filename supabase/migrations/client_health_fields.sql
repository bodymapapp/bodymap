-- Health and safety fields on clients (HK Jun 8 2026). Editable in the
-- About card, and the document reader fills blanks from a read intake
-- form. Free text, all optional. No RLS change: clients already has a
-- therapist_id = auth.uid() policy covering these columns.
alter table public.clients add column if not exists allergies text;
alter table public.clients add column if not exists health_conditions text;
alter table public.clients add column if not exists medications text;
alter table public.clients add column if not exists areas_to_avoid text;
alter table public.clients add column if not exists emergency_contact text;
