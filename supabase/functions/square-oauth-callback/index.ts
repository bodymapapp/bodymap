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

  // HK May 31 2026: page must be invisible (no checkmark glyph
  // to mojibake, no copy to render). Previous version gated the
  // redirect behind the "is this a popup?" check, which left
  // tab/redirect flows stranded when window.close() silently
  // failed on a tab not opened via window.open.
  //
  // New behavior: ALWAYS redirect. The script attempts postMessage
  // and close for the popup case (the receiver listener on the
  // dashboard side handles "this was a popup so I should refresh
  // myself"), and unconditionally calls location.replace
  // afterward so the current window navigates to the dashboard
  // regardless. Meta refresh content="0" is the no-JS safety
  // net. Three independent paths, all aiming at the dashboard.
  //
  // Visible time on this page: one paint cycle in the popup case
  // (window.close succeeds before paint), or one paint cycle
  // followed by redirect in the tab case. Imperceptible either
  // way.
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
  var url = ${JSON.stringify(dashboardUrl)};
  // Popup case: tell opener and try to close. Best effort.
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({type:'square-oauth-success'}, '*');
      window.close();
    }
  } catch(_e) {}
  // Always redirect this window. If close() succeeded above, this
  // is a no-op on a closed window. If it failed (tab flow or
  // browser blocked close), this is the redirect that actually
  // moves the user forward.
  try { window.location.replace(url); } catch(_e) { window.location.href = url; }
})();
</script>
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
});
