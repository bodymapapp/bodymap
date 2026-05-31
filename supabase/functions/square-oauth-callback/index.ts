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

  // Get merchant locations. HK May 30 2026: previously this fetched
  // locations and if anything went wrong (API error, empty array,
  // network blip) the code fell back to locationId = '' and STILL
  // wrote square_connected: true to the DB. Two real customers
  // (Puro Glow, Somatic Shift) ended up in this broken-but-thinks-
  // it-is-connected state. Square charges fail downstream because
  // square-create-deposit needs a real location_id.
  //
  // Two production rules now:
  //   1. If the locations API fails or returns no ACTIVE locations,
  //      DO NOT write square_connected: true. Show a real error page
  //      so the therapist knows to fix the issue (most likely: they
  //      have not finished onboarding their Square account yet, or
  //      they granted the OAuth without MERCHANT_PROFILE_READ scope).
  //   2. Prefer the ACTIVE location over the first one. Matches the
  //      square-repair-location function (which exists exactly because
  //      this callback was broken before).
  const locRes = await fetch(`${apiHost}/v2/locations`, {
    headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Square-Version': '2024-01-18' }
  });
  const locData = await locRes.json();

  const locs = locData?.locations || [];
  const activeLoc = locs.find((l: any) => l.status === 'ACTIVE') || locs[0];
  const locationId = activeLoc?.id || '';

  if (!locRes.ok || !locationId) {
    // Real failure path. Render a real error page so the therapist
    // does not think they are connected. Do NOT write to the
    // therapists table (no token, no square_connected flag) so the
    // UI continues to show "Not connected" and they can retry.
    const errorDetail = locData?.errors?.[0]?.detail
      || (locs.length === 0 ? 'No Square locations found on this account. Please finish your Square onboarding (set up at least one business location) and try connecting again.' : 'Could not read your Square account details. Please try again.');
    return new Response(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Square connection issue</title>
  </head>
  <body style="margin:0;padding:40px 20px;font-family:system-ui,sans-serif;background:#FAF5EE;min-height:100vh;display:flex;align-items:center;justify-content:center;">
    <div style="max-width:380px;width:100%;background:#fff;border-radius:14px;padding:28px 24px;box-shadow:0 4px 20px rgba(0,0,0,0.06);text-align:center;">
      <div style="width:56px;height:56px;border-radius:50%;background:#FEF3C7;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:32px;color:#D97706;">!</div>
      <h2 style="margin:0 0 10px;color:#2A5741;font-size:18px;font-weight:700;font-family:Georgia,serif;">Square needs a location</h2>
      <p style="margin:0 0 20px;color:#6B7280;font-size:13px;line-height:1.55;">${errorDetail}</p>
      <a href="https://mybodymap.app/dashboard?square=needs_location" style="display:inline-block;background:#2A5741;color:#fff;text-decoration:none;border-radius:10px;padding:11px 22px;font-size:13px;font-weight:700;">Back to Dashboard</a>
    </div>
  </body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  // Save to therapist record
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
  await supabase.from('therapists').update({
    square_access_token: tokenData.access_token,
    square_merchant_id: tokenData.merchant_id,
    square_location_id: locationId,
    square_connected: true,
  }).eq('id', therapistId);

  // Success page. Three end states this page must handle gracefully:
  //   1. Opened as a popup with window.opener set: post message,
  //      auto-close. Most desktop OAuth flows.
  //   2. Opened as a popup but window.opener was lost (cross-origin
  //      isolation, popup blocker reset, etc): try to close anyway,
  //      then redirect as fallback.
  //   3. Opened as a regular tab/redirect: redirect back to dashboard.
  //
  // Always provide a visible 'Continue to dashboard' button so the
  // therapist is never stranded on the success page if the auto-
  // close + auto-redirect both fail. HK reported being stuck on the
  // raw HTML once; this fixes that.
  return new Response(`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Square Connected</title>
      </head>
      <body style="margin:0;padding:40px 20px;font-family:system-ui,sans-serif;background:#FAF5EE;min-height:100vh;display:flex;align-items:center;justify-content:center;">
        <div style="max-width:380px;width:100%;background:#fff;border-radius:14px;padding:28px 24px;box-shadow:0 4px 20px rgba(0,0,0,0.06);text-align:center;">
          <div style="width:56px;height:56px;border-radius:50%;background:#DCFCE7;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:28px;color:#16A34A;">✓</div>
          <h2 style="margin:0 0 6px;color:#2A5741;font-size:18px;font-weight:700;font-family:Georgia,serif;">Square connected</h2>
          <p style="margin:0 0 20px;color:#6B7280;font-size:13px;line-height:1.5;">
            All set. You can close this window or continue to your dashboard.
          </p>
          <a href="https://mybodymap.app/dashboard?square=connected" id="continueBtn"
             style="display:inline-block;background:#2A5741;color:#fff;text-decoration:none;border-radius:10px;padding:11px 22px;font-size:13px;font-weight:700;">
            Continue to Dashboard
          </a>
          <p id="autoClose" style="margin:14px 0 0;font-size:11px;color:#9CA3AF;display:none;">
            This window will close automatically...
          </p>
        </div>
        <script>
          (function() {
            try {
              if (window.opener && !window.opener.closed) {
                // Popup case: notify parent and auto-close.
                document.getElementById('autoClose').style.display = 'block';
                window.opener.postMessage({type:'square-oauth-success'}, '*');
                setTimeout(function(){
                  try { window.close(); } catch(e) {}
                }, 800);
              } else {
                // Regular tab/redirect case: auto-redirect to
                // dashboard after a short delay so the success
                // confirmation has a moment to register.
                document.getElementById('autoClose').textContent = 'Redirecting to dashboard...';
                document.getElementById('autoClose').style.display = 'block';
                setTimeout(function(){
                  window.location.href = 'https://mybodymap.app/dashboard?square=connected';
                }, 1200);
              }
            } catch (e) {
              // Defensive: if anything in the script throws, the
              // visible button above is still tappable. Log for
              // diagnostics.
              console.warn('OAuth callback post-success script error:', e);
            }
          })();
        </script>
      </body>
    </html>
  `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
});
