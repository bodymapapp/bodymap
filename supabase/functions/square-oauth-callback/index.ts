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

  const SQUARE_APP_ID     = Deno.env.get('SQUARE_APP_ID');
  const SQUARE_APP_SECRET = Deno.env.get('SQUARE_APP_SECRET');
  const SUPABASE_URL      = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const REDIRECT_URI      = 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/square-oauth-callback';

  // Exchange code for access token
  const tokenRes = await fetch('https://connect.squareup.com/oauth2/token', {
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

  // Get merchant location ID
  const locRes = await fetch('https://connect.squareup.com/v2/locations', {
    headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Square-Version': '2024-01-18' }
  });
  const locData = await locRes.json();
  const locationId = locData.locations?.[0]?.id || '';

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
  return new Response(`
    <html>
      <head>
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
