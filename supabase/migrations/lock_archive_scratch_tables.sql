-- Lock leftover archive/repair tables that were exposed without RLS, so
-- archived client/session/booking/waiver data is no longer readable by
-- the public key (HK Jun 8 2026). No policies are added, so only the
-- service role can reach them; the app does not read these by name.
alter table public._archive_jacquie_clients enable row level security;
alter table public._archive_jacquie_bookings enable row level security;
alter table public._archive_jacquie_sessions enable row level security;
alter table public._archive_jacquie_services enable row level security;
alter table public._archive_jacquie_session_payments enable row level security;
alter table public._archive_jacquie_waiver_signatures enable row level security;
alter table public._archive_jacquie_notification_log enable row level security;
alter table public._session_client_repair_20260603 enable row level security;

-- The clinical guard is a trigger function and never needs to be a
-- callable API RPC.
revoke execute on function public.guard_client_clinical_cols() from anon, authenticated;
