-- ashley-square-check.sql
--
-- Run in Supabase SQL editor. Replace REPLACE_WITH_ASHLEY_EMAIL with
-- Ashley's actual login email before running.
--
-- Returns one row showing exactly where in the Square OAuth flow she
-- stopped. Interpretation guide below.

SELECT
  id,
  email,
  business_name,
  full_name,

  -- Square connection state (the four columns the app actually reads)
  square_access_token IS NOT NULL  AS has_access_token,
  square_merchant_id  IS NOT NULL  AS has_merchant_id,
  square_location_id  IS NOT NULL  AS has_location_id,
  square_connected,

  -- Useful comparison: did she connect Stripe instead?
  stripe_account_id IS NOT NULL AS has_stripe,

  -- When the row was last updated (helps tell if she TRIED recently)
  updated_at

FROM therapists
WHERE LOWER(email) = LOWER('REPLACE_WITH_ASHLEY_EMAIL')
LIMIT 1;

-- ─────────────────────────────────────────────────────────────────
-- How to read the result:
--
-- has_access_token = false
--   She never finished OAuth. The redirect from Square to our
--   callback URL never landed, or it errored before saving the
--   token. Action: have her try Settings, Payments, Connect Square
--   again. If still fails, send her console errors from devtools.
--
-- has_access_token = true, has_merchant_id = false
--   OAuth started, token saved, but our callback didn't fetch the
--   merchant ID. Bug in the callback edge function. Action: I'll
--   need to inspect square-oauth-callback edge function logs.
--
-- has_access_token = true, has_merchant_id = true, has_location_id = false
--   Square connected but no location chosen. Square locations step
--   was skipped. Action: have her open Settings, Payments, Square,
--   pick a location from the dropdown.
--
-- square_connected = false but all three tokens are set
--   The flag wasn't flipped at end of OAuth. Bug in the callback.
--   Action: I can flip it manually with one UPDATE:
--   UPDATE therapists SET square_connected = true WHERE id = '<her uuid>';
--
-- square_connected = true and all three tokens set
--   She is actually connected. Her "still not attached" may mean
--   the visual indicator in Settings isn't reflecting state, or
--   she's looking at the wrong screen. Action: ask her for a
--   screenshot of Settings, Payments to see what she's seeing.
-- ─────────────────────────────────────────────────────────────────
