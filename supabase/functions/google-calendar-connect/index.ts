// supabase/functions/google-calendar-connect/index.ts
//
// Returns the Google OAuth consent URL for the therapist to click,
// built server-side using the GOOGLE_CLIENT_ID secret. This way the
// frontend never has to know about any Google credentials and we
// avoid the Vercel env var dance entirely.
//
// Created May 10 2026 because the previous flow required
// REACT_APP_GOOGLE_CLIENT_ID in Vercel which kept failing to load
// for HK during connect, even after multiple redeploys. Moving the
// client ID lookup to the server side makes the connect button
// work as long as the Supabase secret is set, which we can verify
// from the server-side error response.
//
// Request:    POST  with JSON body { therapist_id: <uuid> }
// Response:   { url: <google_consent_url> }
//             or 500 with { error: "<reason>" }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const APP_HOST = "https://www.mybodymap.app";

// CORS so the browser can call this from mybodymap.app.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const therapistId = body?.therapist_id;
    if (!therapistId || typeof therapistId !== "string") {
      return new Response(
        JSON.stringify({ error: "missing_therapist_id" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

    if (!GOOGLE_CLIENT_ID) {
      // Specific error so HK can tell from the response whether the
      // secret is set.
      return new Response(
        JSON.stringify({
          error: "GOOGLE_CLIENT_ID secret not set in Supabase. Add it under Edge Functions, Secrets.",
        }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (!SUPABASE_URL) {
      return new Response(
        JSON.stringify({ error: "SUPABASE_URL not present (this should always be set automatically)" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-callback`;

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email",
      access_type: "offline",
      prompt: "consent",
      state: therapistId,
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return new Response(
      JSON.stringify({ url }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
