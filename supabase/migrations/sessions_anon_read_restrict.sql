-- Stage 2 of the read lockdown (HK approved Jun 8 2026). The sessions
-- table had broad public read policies left from the document links.
-- Rather than break those flows, we restrict the anonymous role at the
-- column level: anon may read the body map, pressure, comfort prefs, and
-- the client-facing public note, but NOT the therapist's private notes,
-- medical note, medical conditions, intake answers, AI insights, client
-- feedback, or the therapist's own body-map overlay. The client recap is
-- served by the recap-view function (note parsed server-side) and the
-- therapist briefs by the brief-view function (service role), so neither
-- needs anon access to the blocked columns. authenticated (therapist) and
-- service roles keep full access.
do $$
declare cols text;
begin
  revoke select on public.sessions from anon;
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema='public' and table_name='sessions'
    and column_name not in (
      'therapist_notes','med_note','medical_conditions','custom_intake_answers',
      'ai_insights','client_notes','client_feedback',
      'front_focus_therapist','back_focus_therapist','front_avoid_therapist','back_avoid_therapist'
    );
  execute format('grant select (%s) on public.sessions to anon', cols);
end $$;
