# Pending migrations for HK review

HK May 29 2026: two real production issues surfaced via Supabase MCP
audit. Migrations drafted here, NOT yet executed. HK reviews + runs.

---

## Finding 1: Six cron jobs never fired (PASTE_SERVICE_ROLE_JWT_HERE)

Six cron jobs have `PASTE_SERVICE_ROLE_JWT_HERE` as the auth bearer
instead of the real service-role JWT. They have NEVER successfully
invoked their edge functions in production. The `net.http_post` call
returns immediately with 401 Unauthorized from Supabase's API gateway.

Affected crons:
- `send-intake-reminder-hourly` (C3 - intake reminder 48h+ pre-session)
- `send-reminder-48h-hourly` (C4 - 48h pre-session reminder)
- `send-lapse-nudge-daily` (C14 - 45-day soft nudge)
- `send-lapse-final-nudge-daily` (C15 - 90-day final goodbye)
- `send-lapse-signal-daily` (T10 - therapist lapse heads-up)
- `send-renewal-due-daily` (membership renewal alerts)

Working crons that DO have the real JWT (for reference):
- daily-signups-digest, founder-digest-daily, google-calendar-sync,
  practice-pulse-daily, send-drip-daily, send-reminders-daily

The fix: unschedule + re-schedule each broken cron with the same
schedule but the real JWT (already used in working crons). JWT
shown is a service_role JWT for project rmnqfrljoknmellbnpiy that
expires in 2087 (already in your other working crons, not new).

SQL to run is in the chat message that surfaced this finding. Apply
in one transaction; pg_cron `unschedule` followed by `schedule`
replaces the job atomically.

After running, watch `cron.job_run_details` for the next hourly
execution to confirm.

---

## Finding 2: 32 duplicate-client groups (41 rows to remove)

`clients` table has duplicates: 32 distinct (therapist_id, lower(email))
pairs with 2+ rows, totaling 73 client records of which 41 are
duplicates that should be merged into the primary.

Worst offenders:
- Therapist `0949aee1-c0a9-446c-b708-274c819ea69a`: 17+ duplicates
  ALL created at exact same timestamp `2026-05-24 06:05:55.597553+00`.
  This is a bulk import that ran multiple times without dedup. Most
  duplicates are SAME-MILLISECOND inserts.
- Therapist `58799af0` (Candice): 4 duplicate clients.
  `sydneystoryask@gmail.com` has 7 rows, 6 within 0.5 seconds of each
  other - race condition in findOrCreateClient when the public booking
  page submitted multiple times rapidly.
- Therapist `2a2886c3` (Joy Demo): `bodymap01@gmail.com` 2 rows
  (documented), `bodymap0n@gmail.com` 3 rows (test data).

Root cause: no unique constraint on (therapist_id, lower(email)) in
the clients table. findOrCreateClient already handles the 23505
duplicate-key error correctly, but no constraint means no 23505 ever
fires. Two parallel inserts both succeed.

Sixteen FK tables reference clients.id:
agreement_send_requests, booking_series, bookings, cancellation_charges,
client_push_subscriptions, event_registrations,
member_subscription_renewals, member_subscriptions, notification_log,
outreach_quicksend_sends, package_purchases, reviews,
session_intelligence, session_payments, sessions, waiver_signatures.

A merge migration must repoint all 16 tables before deleting the
duplicate rows.

### Migration (DRAFT - HK to review before running)

```sql
-- HK May 29 2026: merge duplicate clients then add unique constraint.
-- For each duplicate group, keep the OLDEST row by created_at (most
-- history, most likely to have downstream FK references).

DO $$
DECLARE
  grp record;
  primary_id uuid;
  dup_ids uuid[];
BEGIN
  FOR grp IN
    SELECT
      therapist_id,
      lower(email) AS email_lc,
      array_agg(id ORDER BY created_at) AS ids
    FROM public.clients
    WHERE email IS NOT NULL AND email != ''
    GROUP BY therapist_id, lower(email)
    HAVING count(*) > 1
  LOOP
    primary_id := grp.ids[1];                                      -- oldest
    dup_ids   := grp.ids[2:array_length(grp.ids, 1)];              -- rest

    -- Repoint each FK table
    UPDATE public.bookings                       SET client_id = primary_id WHERE client_id = ANY(dup_ids);
    UPDATE public.sessions                       SET client_id = primary_id WHERE client_id = ANY(dup_ids);
    UPDATE public.session_payments               SET client_id = primary_id WHERE client_id = ANY(dup_ids);
    UPDATE public.cancellation_charges           SET client_id = primary_id WHERE client_id = ANY(dup_ids);
    UPDATE public.agreement_send_requests        SET client_id = primary_id WHERE client_id = ANY(dup_ids);
    UPDATE public.booking_series                 SET client_id = primary_id WHERE client_id = ANY(dup_ids);
    UPDATE public.client_push_subscriptions      SET client_id = primary_id WHERE client_id = ANY(dup_ids);
    UPDATE public.event_registrations            SET client_id = primary_id WHERE client_id = ANY(dup_ids);
    UPDATE public.member_subscriptions           SET client_id = primary_id WHERE client_id = ANY(dup_ids);
    UPDATE public.member_subscription_renewals   SET client_id = primary_id WHERE client_id = ANY(dup_ids);
    UPDATE public.notification_log               SET client_id = primary_id WHERE client_id = ANY(dup_ids);
    UPDATE public.outreach_quicksend_sends       SET client_id = primary_id WHERE client_id = ANY(dup_ids);
    UPDATE public.package_purchases              SET client_id = primary_id WHERE client_id = ANY(dup_ids);
    UPDATE public.reviews                        SET client_id = primary_id WHERE client_id = ANY(dup_ids);
    UPDATE public.session_intelligence           SET client_id = primary_id WHERE client_id = ANY(dup_ids);
    UPDATE public.waiver_signatures              SET client_id = primary_id WHERE client_id = ANY(dup_ids);

    -- Delete the duplicates
    DELETE FROM public.clients WHERE id = ANY(dup_ids);

    RAISE NOTICE 'Merged % duplicates for therapist=% email=%',
      array_length(dup_ids, 1), grp.therapist_id, grp.email_lc;
  END LOOP;
END
$$;

-- Add the unique constraint so this can never happen again
CREATE UNIQUE INDEX IF NOT EXISTS uniq_clients_therapist_email_lower
  ON public.clients (therapist_id, lower(email))
  WHERE email IS NOT NULL AND email != '';
```

### Before HK runs this

1. Take a snapshot or backup of the clients table.
2. Verify in a branch first via Supabase create_branch tool.
3. Optional sanity check: count rows in each FK table that reference
   any of the duplicate ids - confirms how many rows will be repointed.

After running, the findOrCreateClient race-condition handling (which
already catches 23505) will start firing correctly because the
constraint will exist.
