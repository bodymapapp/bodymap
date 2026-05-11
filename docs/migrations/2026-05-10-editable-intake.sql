-- 2026-05-10-editable-intake.sql
--
-- Lindsey #11: Bidirectional intake editing.
-- Plus focus distribution (Q4) bundled in same commit.
--
-- WHAT THIS ADDS
--
-- 1. Therapist-side intake edits, with audit trail. Therapist can
--    update any intake field on a session after the client filled
--    it out. Each edit logs to intake_edits with before/after.
-- 2. Per-zone provenance: separate columns for client-marked
--    zones and therapist-added zones so we can render C/T badges
--    on the body map.
-- 3. Focus distribution percentages: front_pct, top_pct,
--    middle_pct, bottom_pct. back_pct is derived (100 - front).
--    All nullable: clients may skip distribution entirely.

-- =====================================================
-- 1. Therapist-side per-zone provenance columns
-- =====================================================
-- Existing columns front_focus, back_focus, front_avoid, back_avoid
-- continue to hold what the CLIENT selected. New columns hold
-- additions the THERAPIST made during or after the session. Merge
-- on read; render with badges to differentiate.
--
-- We never modify the original client columns from the therapist
-- side. If the therapist 'removes' a client zone, we set a flag in
-- intake_edits instead. (UI v1 will just disable removing client
-- zones; therapist can add only.) Future iteration can add a
-- 'removed_by_therapist' array to support strikethrough.

alter table sessions
  add column if not exists front_focus_therapist text[] default '{}',
  add column if not exists back_focus_therapist text[] default '{}',
  add column if not exists front_avoid_therapist text[] default '{}',
  add column if not exists back_avoid_therapist text[] default '{}';

-- =====================================================
-- 2. Focus distribution percentages
-- =====================================================
-- front_pct: 0-100, percentage of session time on front of body.
--            back is implicit (100 - front_pct).
-- top_pct, middle_pct, bottom_pct: 0-100, must sum to 100.
--            Top = neck/shoulders/upper back/arms.
--            Middle = mid back/abs/hips/glutes.
--            Bottom = legs/feet.
--
-- All nullable. NULL means client/therapist skipped this and the
-- session_brief code can fall back to auto-derived from zone counts.

alter table sessions
  add column if not exists front_pct smallint,
  add column if not exists top_pct smallint,
  add column if not exists middle_pct smallint,
  add column if not exists bottom_pct smallint;

-- Sanity constraints. Allow nulls (skipped) but if set must be 0-100.
do $$
begin
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'sessions_front_pct_range') then
    alter table sessions add constraint sessions_front_pct_range  check (front_pct  is null or (front_pct  between 0 and 100));
  end if;
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'sessions_top_pct_range') then
    alter table sessions add constraint sessions_top_pct_range    check (top_pct    is null or (top_pct    between 0 and 100));
  end if;
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'sessions_middle_pct_range') then
    alter table sessions add constraint sessions_middle_pct_range check (middle_pct is null or (middle_pct between 0 and 100));
  end if;
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'sessions_bottom_pct_range') then
    alter table sessions add constraint sessions_bottom_pct_range check (bottom_pct is null or (bottom_pct between 0 and 100));
  end if;
end $$;

-- =====================================================
-- 3. Audit trail for therapist edits to intake
-- =====================================================
-- Every edit a therapist makes to a session's intake fields is
-- logged here. We store the field name, the BEFORE value, and the
-- AFTER value as text (JSON-stringified for arrays/objects). This
-- way: (1) we can show a history of edits to the therapist, (2)
-- we have a paper trail in case of a dispute, (3) we can future-
-- proof for an 'undo' feature.
--
-- editor_id is the therapist who made the edit (= therapist_id).
-- We don't currently have multi-therapist accounts but the column
-- is here for future-proofing.

create table if not exists intake_edits (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  therapist_id uuid not null references therapists(id) on delete cascade,
  editor_id uuid references therapists(id),  -- who edited; for now always = therapist_id
  field_name text not null,                   -- e.g. 'pressure', 'front_focus_therapist', 'top_pct'
  value_before text,                          -- JSON-stringified
  value_after  text,                          -- JSON-stringified
  created_at timestamptz default now()
);

create index if not exists intake_edits_session
  on intake_edits (session_id, created_at desc);
create index if not exists intake_edits_therapist
  on intake_edits (therapist_id, created_at desc);

-- RLS so therapists only see their own edits.
alter table intake_edits enable row level security;

drop policy if exists "Therapist reads own intake edits" on intake_edits;
create policy "Therapist reads own intake edits"
  on intake_edits for select
  using (therapist_id = auth.uid());

drop policy if exists "Therapist writes own intake edits" on intake_edits;
create policy "Therapist writes own intake edits"
  on intake_edits for insert
  with check (therapist_id = auth.uid());

-- =====================================================
-- 4. Sanity log
-- =====================================================

do $$
begin
  raise notice 'Editable intake migration applied. New session columns: front_focus_therapist, back_focus_therapist, front_avoid_therapist, back_avoid_therapist, front_pct, top_pct, middle_pct, bottom_pct. New table: intake_edits.';
end $$;
