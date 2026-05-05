-- Cancellation policy
--
-- Lets each therapist define what happens when clients cancel,
-- reschedule, or no-show. Stored as a structured object so the booking
-- page can render the policy in plain English and (in Phase 2) the
-- charge enforcement can read the rules to compute amounts.
--
-- Policy shape:
-- {
--   enabled: boolean,
--   card_required_first_timers: boolean,
--   card_required_regulars: boolean,
--   cancel_24h_plus_percent: 0,
--   cancel_2_to_24h_percent: 50,
--   cancel_under_2h_percent: 100,
--   reschedule_24h_plus_percent: 0,
--   reschedule_under_24h_percent: 25,
--   no_show_percent: 100,
--   custom_text: null  -- null = auto-generated from rules; string = override
-- }
--
-- NULL on the column = no policy set. The toggle column tracks whether
-- the therapist has activated the policy independently (so they can
-- save a draft without enabling it).

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS cancellation_policy_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_policy jsonb;
