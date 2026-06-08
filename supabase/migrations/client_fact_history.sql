-- Dated, append-only history for the client's standing clinical facts
-- (allergies, conditions, medications, areas to avoid, emergency contact).
-- The clients column stays as the current value; this is the record
-- behind it so we can show a timeline and summarize change over time.
-- HK approved Jun 8 2026. effective_on = the date the fact is true as of
-- (form's printed date for documents, today for a manual edit).
create table if not exists public.client_fact_history (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  field text not null,
  value text,
  previous_value text,
  source text not null default 'edit',
  source_document_id uuid references public.client_documents(id) on delete set null,
  effective_on date not null default current_date,
  recorded_at timestamptz not null default now(),
  created_by uuid
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname='client_fact_history_field_chk') then
    alter table public.client_fact_history add constraint client_fact_history_field_chk
      check (field in ('allergies','health_conditions','medications','areas_to_avoid','emergency_contact'));
  end if;
  if not exists (select 1 from pg_constraint where conname='client_fact_history_source_chk') then
    alter table public.client_fact_history add constraint client_fact_history_source_chk
      check (source in ('edit','document','intake','import'));
  end if;
end $$;

create index if not exists client_fact_history_client_field_idx on public.client_fact_history (client_id, field, effective_on desc);
create index if not exists client_fact_history_client_recorded_idx on public.client_fact_history (client_id, recorded_at desc);

alter table public.client_fact_history enable row level security;
drop policy if exists client_fact_history_all on public.client_fact_history;
create policy client_fact_history_all on public.client_fact_history for all to authenticated
  using (therapist_id = auth.uid()) with check (therapist_id = auth.uid());
