// supabase/functions/square-oauth-callback/index.ts
//
// Receives the redirect from Square after a therapist authorizes our
// app to access their Square account. Square redirects with no auth
// header (it does not know about our Supabase JWTs), so this function
// must be deployed with --no-verify-jwt. Authentication is established
// by the OAuth code (proven via Square token exchange) plus the state
// parameter which carries the therapist_id we issued at OAuth start.
//
// Listed in NO_JWT_FUNCTIONS in .github/workflows/deploy-edge-functions.yml.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isTestMode } from "../_shared/paymentMode.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const code        = url.searchParams.get('code');
  const therapistId = url.searchParams.get('state');
  const error       = url.searchParams.get('error');

  if (error || !code || !therapistId) {
    return new Response(`<html><body><script>window.opener?.postMessage({type:'square-oauth-error',error:'${error||'missing_code'}'},'*');window.close();</script></body></html>`, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  const SQUARE_APP_ID     = isTestMode()
    ? Deno.env.get('SQUARE_TEST_APP_ID')
    : Deno.env.get('SQUARE_APP_ID');
  const SQUARE_APP_SECRET = isTestMode()
    ? Deno.env.get('SQUARE_TEST_APP_SECRET')
    : Deno.env.get('SQUARE_APP_SECRET');
  const SUPABASE_URL      = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const REDIRECT_URI      = 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/square-oauth-callback';

  // Auto-detect sandbox vs production from app id prefix. With test
  // mode active, SQUARE_APP_ID resolves to the sandbox app id which
  // starts with 'sandbox-', so the apiHost auto-routes to sandbox.
  const apiHost = (SQUARE_APP_ID || '').startsWith('sandbox-')
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';

  // Exchange code for access token
  const tokenRes = await fetch(`${apiHost}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Square-Version': '2024-01-18' },
    body: JSON.stringify({
      client_id: SQUARE_APP_ID,
      client_secret: SQUARE_APP_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    return new Response(`<html><body><script>window.opener?.postMessage({type:'square-oauth-error',error:'token_exchange_failed'},'*');window.close();</script></body></html>`, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Get merchant locations. HK May 30 2026: this used to error out if
  // location lookup failed, which gave the customer a scary error
  // page. Per HK: "I don't want an error. Why would someone sign up
  // with us if there are errors in CX to begin with."
  //
  // New policy: always succeed gracefully. Save the token + merchant
  // id no matter what. If we can grab a location, great. If we can't
  // (insufficient scope from a pre-MERCHANT_PROFILE_READ connect,
  // network blip, empty account), leave square_location_id empty and
  // let the in-app dashboard banner handle it gently with a one-tap
  // reconnect. NO ERROR PAGES, EVER, IN THE OAUTH FLOW.
  //
  // Prefer ACTIVE location over the first one. Matches the
  // square-repair-location helper.
  let locationId = '';
  try {
    const locRes = await fetch(`${apiHost}/v2/locations`, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Square-Version': '2024-01-18' }
    });
    if (locRes.ok) {
      const locData = await locRes.json();
      const locs = locData?.locations || [];
      const activeLoc = locs.find((l: any) => l.status === 'ACTIVE') || locs[0];
      locationId = activeLoc?.id || '';
    }
  } catch (_e) {
    // Network or parse error: leave locationId empty, handled in-app.
  }

  // Save to therapist record
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
  await supabase.from('therapists').update({
    square_access_token: tokenData.access_token,
    square_merchant_id: tokenData.merchant_id,
    square_location_id: locationId,
    square_connected: true,
  }).eq('id', therapistId);

  // HK May 31 2026: success response is INVISIBLE. Previously this
  // rendered a "Square Connected" card with a green checkmark + "All
  // set" copy + auto-close after 800-1200ms. Two problems HK called
  // out:
  //   1. Checkmark glyph (U+2713) rendered as mojibake "âœ"" in some
  //      browsers regardless of charset header + meta tag.
  //   2. Just SEEING the page after the Square allow screen is bad CX.
  //      It interrupts the flow. The user expects: tap Connect, see
  //      Square allow, done. Not: tap Connect, see Square allow, see
  //      another success page they have to dismiss or wait through.
  //
  // New behavior: empty cream backdrop (matches app, no jarring white),
  // INSTANT postMessage+close for popup case, INSTANT redirect for
  // non-popup case via meta refresh AND location.replace as belt-and-
  // suspenders. No checkmark, no copy, no delay. Total visible time:
  // a single paint cycle, imperceptible.
  //
  // Fallback for stuck cases (popup blocker reset window.opener AND
  // location.replace blocked): the meta refresh at content="0" still
  // navigates the page to the dashboard. Therapist may briefly see a
  // blank cream screen but never gets stuck.
  const dashboardUrl = 'https://mybodymap.app/dashboard?square=connected';
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${dashboardUrl}">
<title>Connecting...</title>
<style>html,body{margin:0;padding:0;background:#FAF5EE;height:100vh}</style>
</head>
<body>
<script>
(function(){
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({type:'square-oauth-success'}, '*');
      window.close();
    } else {
      window.location.replace(${JSON.stringify(dashboardUrl)});
    }
  } catch(_e) {
    window.location.replace(${JSON.stringify(dashboardUrl)});
  }
})();
</script>
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
});
