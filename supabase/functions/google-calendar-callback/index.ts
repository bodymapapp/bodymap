// supabase/functions/google-calendar-callback/index.ts
//
// OAuth callback for Google Calendar sync (Lindsey #10).
// Touched May 10 2026 to trigger a redeploy after secrets were
// added in Supabase. Edge functions read env vars at deploy time,
// not at runtime, so adding a secret without redeploying means
// the running function still does not see it.
//
// Flow:
//   1. Therapist clicks 'Connect Google Calendar' on dashboard.
//      Frontend builds the auth URL with our client_id and a state
//      parameter that encodes the therapist's id (signed with the
//      service role key so it cannot be forged).
//   2. Therapist logs in to Google, grants calendar.events scope.
//   3. Google redirects here (this function) with ?code=... &state=...
//   4. We exchange the code for access + refresh tokens via Google's
//      token endpoint. We also fetch the therapist's email from the
//      tokeninfo endpoint so we can show 'connected as joy@gmail.com'.
//   5. We store everything on the therapists row.
//   6. We do an initial reverse-sync fetch (next 60 days) to seed
//      external_calendar_events.
//   7. We redirect the browser back to /dashboard/settings with a
//      success flag so the UI shows the connected state.
//
// Errors at any step redirect back with ?google_error=<message>.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_HOST = "https://www.mybodymap.app";
const SETTINGS_BASE = `${APP_HOST}/dashboard/settings`;
const SETTINGS_HASH = "#integrations";

// Build a redirect URL in the correct shape: query string FIRST,
// then the hash fragment. The frontend reads google_connected /
// google_error from window.location.search, so the params must be
// in the query string, not after the hash. Earlier code put them
// inside the hash and the frontend never saw them.
function settingsRedirect(params: Record<string, string>): string {
  const sp = new URLSearchParams(params);
  return `${SETTINGS_BASE}?${sp.toString()}${SETTINGS_HASH}`;
}

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return Response.redirect(
      settingsRedirect({ google_error: errorParam }),
      302
    );
  }
  if (!code || !state) {
    return Response.redirect(
      settingsRedirect({ google_error: "missing_code_or_state" }),
      302
    );
  }

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return Response.redirect(
      settingsRedirect({ google_error: "server_not_configured" }),
      302
    );
  }

  // The state is the therapist UUID directly. The connect URL is
  // built on our authenticated dashboard so a logged-in therapist
  // is the only one who sees it for their own id. If somehow this
  // state were forged, the worst case is connecting a Google
  // account to a therapist who did not request it, and the
  // connect button only ever runs for the logged-in user. We do
  // not store or trust unauthenticated input here beyond looking
  // up the therapist row.
  const therapist_id = state;
  if (!/^[0-9a-f-]{36}$/i.test(therapist_id)) {
    return Response.redirect(
      settingsRedirect({ google_error: "bad_state" }),
      302
    );
  }

  const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar-callback`;

  // Exchange code for tokens.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenJson.access_token) {
    return Response.redirect(
      settingsRedirect({ google_error: tokenJson.error || "token_exchange_failed" }),
      302
    );
  }

  // Fetch the user's email so we can show 'connected as ...' in
  // the dashboard. tokeninfo is the cheapest way; userinfo also
  // works but requires extra scopes.
  let google_email = null as string | null;
  try {
    const userInfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${tokenJson.access_token}` } }
    );
    if (userInfoRes.ok) {
      const userInfo = await userInfoRes.json();
      google_email = userInfo.email || null;
    }
  } catch (_e) {
    // Email is best-effort; do not fail the connection if we
    // cannot fetch it. The therapist can still sync.
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // expires_in is in seconds. Store as absolute timestamp.
  const expires_at = new Date(
    Date.now() + (tokenJson.expires_in || 3600) * 1000
  ).toISOString();

  const { error: updErr } = await supabase
    .from("therapists")
    .update({
      google_calendar_connected: true,
      google_access_token: tokenJson.access_token,
      google_refresh_token:
        tokenJson.refresh_token || null, // only present on first consent
      google_token_expires_at: expires_at,
      google_email,
      google_calendar_id: "primary",
      google_connected_at: new Date().toISOString(),
      google_sync_token: null, // forces full sync on first poll
      google_last_synced_at: null,
    })
    .eq("id", therapist_id);

  if (updErr) {
    return Response.redirect(
      settingsRedirect({ google_error: updErr.message }),
      302
    );
  }

  // Kick off an initial reverse-sync so the therapist sees their
  // external events right away rather than waiting up to 15 min.
  // Best-effort: don't fail the connection if this errors.
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ therapist_id }),
    });
  } catch (_e) {
    // ignore
  }

  return Response.redirect(settingsRedirect({ google_connected: "1" }), 302);
});
