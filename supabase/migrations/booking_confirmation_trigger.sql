-- ============================================================
-- Database trigger that fires send-booking-confirmation edge
-- function whenever a booking is inserted with a sendable status.
--
-- WHY: The frontend fireBookingConfirmation() helper was unreliable.
-- For Lindsey Thomas, all three of her bookings landed in the DB but
-- the edge function was never invoked from her browser. Root cause
-- could not be pinned (RLS rules out, deploy was fine, function was
-- fine — it was something between her browser and the function URL).
-- Rather than keep chasing it, we move the trigger out of the browser
-- and into the database. Every INSERT on bookings now fires the
-- function via pg_net, regardless of what the frontend does.
--
-- The frontend's fireBookingConfirmation call still runs as a
-- fallback, but if both fire, the edge function is idempotent — it
-- writes to notification_log so we can see duplicate sends and
-- decide whether to dedupe later.
-- ============================================================

-- pg_net is Supabase's HTTP client extension for triggers.
-- It creates the schema `net` with `net.http_post`.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper: read the service role key from Vault. Supabase stores it
-- there by default. Fallback to a no-op if the key is unavailable
-- (better to silently skip than to block the booking insert).
CREATE OR REPLACE FUNCTION public.fire_booking_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault
AS $$
DECLARE
  v_service_role_key text;
  v_url text := 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/send-booking-confirmation';
  v_request_id bigint;
BEGIN
  -- Only fire for statuses that warrant a confirmation email.
  -- pending-deposit waits until deposit-success path fires the
  -- function explicitly with the post-deposit booking_id.
  IF NEW.status NOT IN ('confirmed', 'pending-approval') THEN
    RETURN NEW;
  END IF;

  -- Pull service role key from vault. If unavailable, just return —
  -- never block a booking insert because we could not fire an email.
  BEGIN
    SELECT decrypted_secret INTO v_service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_role_key := NULL;
  END;

  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    RAISE WARNING 'fire_booking_confirmation: no service_role_key in vault, skipping';
    RETURN NEW;
  END IF;

  -- Fire the edge function async. pg_net.http_post returns a request
  -- id immediately; the actual HTTP call happens in the background.
  -- We do not wait for or check the response — the function logs
  -- everything to notification_log itself.
  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object(
      'booking_id', NEW.id,
      'source', 'db_trigger'
    )
  ) INTO v_request_id;

  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger so reruns of this migration are clean.
DROP TRIGGER IF EXISTS bookings_fire_confirmation ON public.bookings;

CREATE TRIGGER bookings_fire_confirmation
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.fire_booking_confirmation();

-- Diagnostic: query this to verify the trigger exists.
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'bookings_fire_confirmation';
