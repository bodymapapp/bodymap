-- 2026-05-16-blocked-days-time-range.sql
-- Phase 9.1: Partial-day blocks
--
-- HK Candice request (May 16 2026 evening):
--   'Is there a way to block off sections of time in a day without
--    blocking the full day? Or to change the time I'm available
--    some days without changing business hours?'
--
-- Today: blocked_days(date) blocks the entire day. Therapist can
-- close Saturday, but can't say 'Saturday morning is fine, block
-- 1pm-3pm.'
--
-- Fix: add start_time and end_time columns. Semantics:
--   start_time IS NULL AND end_time IS NULL  → blocks the full day
--                                              (today's behavior,
--                                              backward compatible)
--   start_time IS NOT NULL AND end_time IS NOT NULL
--                                            → blocks only that
--                                              time range on that
--                                              date. Bookable slots
--                                              outside the range
--                                              remain open.
--
-- All existing rows are full-day blocks (NULL on both), so this
-- migration is additive and requires no backfill. New full-day
-- blocks continue to insert with NULL on both columns.
--
-- A check constraint enforces that either both times are NULL OR
-- both are set AND end > start. Prevents 'start at 2pm, no end'
-- garbage rows.

alter table blocked_days
  add column if not exists start_time time,
  add column if not exists end_time time;

alter table blocked_days
  drop constraint if exists blocked_days_time_range_check;
alter table blocked_days
  add constraint blocked_days_time_range_check
  check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and end_time > start_time)
  );

comment on column blocked_days.start_time is
  'Start of the blocked time range, local to the therapist. NULL means full-day block.';
comment on column blocked_days.end_time is
  'End of the blocked time range, local to the therapist. NULL means full-day block. Must be greater than start_time.';
