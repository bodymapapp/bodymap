-- Tighten the public booking path so the anonymous role can never write
-- the client's clinical fields (HK approved Jun 8 2026). The public page
-- may still create and update booking and contact details; therapists
-- (authenticated) and server jobs (service_role) are unaffected. Using a
-- guard trigger rather than a column allow-list so a missed column can
-- never break booking.
create or replace function public.guard_client_clinical_cols()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'anon' then
    if tg_op = 'INSERT' then
      new.allergies := null;
      new.health_conditions := null;
      new.medications := null;
      new.areas_to_avoid := null;
      new.emergency_contact := null;
    elsif tg_op = 'UPDATE' then
      new.allergies := old.allergies;
      new.health_conditions := old.health_conditions;
      new.medications := old.medications;
      new.areas_to_avoid := old.areas_to_avoid;
      new.emergency_contact := old.emergency_contact;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists client_clinical_guard on public.clients;
create trigger client_clinical_guard
  before insert or update on public.clients
  for each row execute function public.guard_client_clinical_cols();
