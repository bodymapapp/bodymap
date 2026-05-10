// supabase/functions/google-calendar-sync/index.ts
//
// Reverse sync (Google -> MyBodyMap). Pulls events from each
// connected therapist's Google Calendar and writes them to the
// external_calendar_events table so they block booking slots.
//
// Two invocation modes:
//   1. Single-therapist mode: POST { therapist_id }
//      Used right after OAuth connect to seed events immediately
//      instead of waiting 15 min for the next cron tick.
//   2. Cron mode: POST {} or no body
//      Sweeps all connected therapists. Triggered by Supabase
//      pg_cron every 15 min.
//
// Per-therapist flow:
//   - Refresh access token if expired
//   - If we have a sync token, do incremental list with that token
//   - Otherwise, do a full list of upcoming 60 days (fresh connect)
//   - For each event, upsert into external_calendar_events
//   - Skip events that are MyBodyMap-created (mirrored bookings,
//     they have a private metadata flag we set on forward sync)
//   - Cancelled events: update row status='cancelled' so it stops
//     blocking slots
//   - Save the new sync token + last_synced_at
//
// Sync token expiry: Google rotates these every ~7 days for
// idle calendars. If we get a 410 GONE on incremental sync, we
// nuke the sync token and do a full re-sync next call.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let body: { therapist_id?: string } = {};
  try {
    body = await req.json();
  } catch (_e) {
    body = {};
  }

  // Resolve therapists to sync.
  let therapists: any[] = [];
  if (body.therapist_id) {
    const { data, error } = await supabase
      .from("therapists")
      .select(
        "id, google_calendar_connected, google_access_token, google_refresh_token, google_token_expires_at, google_calendar_id, google_sync_token"
      )
      .eq("id", body.therapist_id)
      .eq("google_calendar_connected", true)
      .limit(1);
    if (error) {
      return json({ error: error.message }, 500);
    }
    therapists = data || [];
  } else {
    const { data, error } = await supabase
      .from("therapists")
      .select(
        "id, google_calendar_connected, google_access_token, google_refresh_token, google_token_expires_at, google_calendar_id, google_sync_token"
      )
      .eq("google_calendar_connected", true);
    if (error) {
      return json({ error: error.message }, 500);
    }
    therapists = data || [];
  }

  const results: Array<{
    therapist_id: string;
    synced: number;
    deleted: number;
    error?: string;
  }> = [];

  for (const t of therapists) {
    try {
      const r = await syncOneTherapist(
        t,
        supabase,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET
      );
      results.push({ therapist_id: t.id, ...r });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ therapist_id: t.id, synced: 0, deleted: 0, error: msg });
    }
  }

  return json({ ok: true, count: therapists.length, results });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Refreshes the access token if expired. Returns the (possibly new)
// access token. Updates the therapist row with the refreshed values.
async function ensureFreshToken(
  t: any,
  supabase: any,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const expiresAt = t.google_token_expires_at
    ? new Date(t.google_token_expires_at).getTime()
    : 0;
  // 60-second buffer so we do not race the actual expiry.
  if (expiresAt > Date.now() + 60_000 && t.google_access_token) {
    return t.google_access_token;
  }
  if (!t.google_refresh_token) {
    throw new Error(
      "no_refresh_token (therapist must reconnect Google Calendar)"
    );
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: t.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const j = await res.json();
  if (!j.access_token) {
    throw new Error(
      `token_refresh_failed: ${j.error || "unknown"} ${j.error_description || ""}`
    );
  }
  const newExpiresAt = new Date(
    Date.now() + (j.expires_in || 3600) * 1000
  ).toISOString();
  await supabase
    .from("therapists")
    .update({
      google_access_token: j.access_token,
      google_token_expires_at: newExpiresAt,
    })
    .eq("id", t.id);
  return j.access_token;
}

async function syncOneTherapist(
  t: any,
  supabase: any,
  clientId: string,
  clientSecret: string
): Promise<{ synced: number; deleted: number }> {
  const accessToken = await ensureFreshToken(
    t,
    supabase,
    clientId,
    clientSecret
  );
  const calendarId = t.google_calendar_id || "primary";

  // Build list URL. Incremental if we have a sync token, else
  // full sync of upcoming 60 days.
  let pageToken: string | null = null;
  let nextSyncToken: string | null = null;
  let synced = 0;
  let deleted = 0;
  let usedSyncToken = !!t.google_sync_token;

  do {
    const params = new URLSearchParams({
      maxResults: "250",
      showDeleted: "true",
      singleEvents: "true",
    });
    if (usedSyncToken && t.google_sync_token && !pageToken) {
      params.set("syncToken", t.google_sync_token);
    } else if (!pageToken) {
      // Full sync window: now to now+60 days.
      params.set("timeMin", new Date().toISOString());
      const upper = new Date();
      upper.setDate(upper.getDate() + 60);
      params.set("timeMax", upper.toISOString());
    }
    if (pageToken) params.set("pageToken", pageToken);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events?${params.toString()}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 410) {
      // Sync token expired. Wipe it and retry full sync next time.
      await supabase
        .from("therapists")
        .update({ google_sync_token: null })
        .eq("id", t.id);
      throw new Error("sync_token_expired_will_full_resync_next_run");
    }

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`google_list_failed: ${res.status} ${txt.slice(0, 200)}`);
    }

    const data = await res.json();

    for (const ev of data.items || []) {
      // Skip MyBodyMap-mirrored events. We tag them on forward
      // sync with a private extended property so the reverse sync
      // does not loop and treat our own bookings as 'external.'
      const sourceProp =
        ev.extendedProperties?.private?.mybodymap_source;
      if (sourceProp === "mybodymap") continue;

      const externalId = ev.id as string;

      if (ev.status === "cancelled") {
        await supabase
          .from("external_calendar_events")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
            last_synced_at: new Date().toISOString(),
          })
          .eq("therapist_id", t.id)
          .eq("source", "google")
          .eq("external_event_id", externalId);
        deleted += 1;
        continue;
      }

      // Skip events we cannot place on a timeline (no start).
      if (!ev.start) continue;
      const isAllDay = !!ev.start.date;
      const startAt = isAllDay
        ? `${ev.start.date}T00:00:00Z`
        : ev.start.dateTime;
      const endAt = isAllDay
        ? `${ev.end.date}T00:00:00Z`
        : ev.end.dateTime;
      if (!startAt || !endAt) continue;

      // Upsert. unique (therapist_id, source, external_event_id).
      await supabase.from("external_calendar_events").upsert(
        {
          therapist_id: t.id,
          source: "google",
          external_event_id: externalId,
          summary: ev.summary || "(no title)",
          start_at: startAt,
          end_at: endAt,
          is_all_day: isAllDay,
          status: "confirmed",
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "therapist_id,source,external_event_id" }
      );
      synced += 1;
    }

    pageToken = data.nextPageToken || null;
    if (data.nextSyncToken) {
      nextSyncToken = data.nextSyncToken;
    }
  } while (pageToken);

  await supabase
    .from("therapists")
    .update({
      google_sync_token: nextSyncToken || t.google_sync_token,
      google_last_synced_at: new Date().toISOString(),
    })
    .eq("id", t.id);

  return { synced, deleted };
}
