-- client_documents: consent / intake / other documents attached to a client.
-- Private and therapist-only. Files live in the private 'client-documents'
-- storage bucket under {therapist_id}/{client_id}/{document_id}.{ext} and are
-- viewed via short-lived signed URLs. Soft-delete via deleted_at so a legal
-- record is never lost to a stray tap. Idempotent so it is safe to re-run.

create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null default 'Document',
  category text not null default 'consent',
  file_path text not null,
  file_name text,
  mime_type text,
  size_bytes bigint,
  page_count integer,
  captured_via text not null default 'upload',
  created_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname='client_documents_category_chk') then
    alter table public.client_documents add constraint client_documents_category_chk
      check (category in ('consent','intake','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname='client_documents_captured_via_chk') then
    alter table public.client_documents add constraint client_documents_captured_via_chk
      check (captured_via in ('upload','camera'));
  end if;
end $$;

create index if not exists client_documents_client_idx
  on public.client_documents (client_id) where deleted_at is null;
create index if not exists client_documents_therapist_idx
  on public.client_documents (therapist_id);

alter table public.client_documents enable row level security;

drop policy if exists client_documents_therapist_all on public.client_documents;
create policy client_documents_therapist_all on public.client_documents
  for all to authenticated
  using (therapist_id = auth.uid())
  with check (therapist_id = auth.uid());

-- Private bucket (never public). 25 MB cap. PDFs and common image types.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-documents','client-documents', false, 26214400,
        array['application/pdf','image/jpeg','image/png','image/heic','image/heif','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Object policies: the first path segment must be the owner's auth uid,
-- which is the therapist_id. Authenticated only. No anon access.
drop policy if exists client_documents_obj_insert on storage.objects;
create policy client_documents_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id='client-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists client_documents_obj_select on storage.objects;
create policy client_documents_obj_select on storage.objects for select to authenticated
  using (bucket_id='client-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists client_documents_obj_update on storage.objects;
create policy client_documents_obj_update on storage.objects for update to authenticated
  using (bucket_id='client-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id='client-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists client_documents_obj_delete on storage.objects;
create policy client_documents_obj_delete on storage.objects for delete to authenticated
  using (bucket_id='client-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Phase 2: on-demand document reading. The reader (read-document edge
-- function) writes a plain summary, key facts, and a text transcription
-- back onto the document row. This is where read content lives when there
-- is no matching client field, so nothing is lost.
alter table public.client_documents add column if not exists extract_status text not null default 'none';
alter table public.client_documents add column if not exists extracted_summary text;
alter table public.client_documents add column if not exists extracted_fields jsonb;
alter table public.client_documents add column if not exists extracted_text text;
alter table public.client_documents add column if not exists extracted_at timestamptz;
alter table public.client_documents add column if not exists extract_error text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='client_documents_extract_status_chk') then
    alter table public.client_documents add constraint client_documents_extract_status_chk
      check (extract_status in ('none','processing','done','failed'));
  end if;
end $$;

-- Phase 3: the reader also returns normalized profile-field guesses,
-- stored here so the viewer can offer a one-tap "fill blanks" apply.
alter table public.client_documents add column if not exists extracted_client_fields jsonb;

-- The reader also extracts the date printed on the document, used as the
-- effective date when applying facts to the client history.
alter table public.client_documents add column if not exists document_date date;
