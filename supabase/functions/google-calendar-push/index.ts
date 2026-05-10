// supabase/functions/google-calendar-push/index.ts
//
// Forward sync: push a MyBodyMap booking to the therapist's Google
// Calendar so it appears alongside their personal events.
//
// Called from:
//   - confirm-booking edge function (when a new booking lands)
//   - update-booking flow (rescheduled / edited)
//   - cancel-booking flow (deleted)
//
// We tag created events with extendedProperties.private.mybodymap_source
// = 'mybodymap' so the reverse sync ignores them and we do not get
// a feedback loop.
//
// On forward sync failure we silently continue. The booking exists
// in MyBodyMap regardless. The therapist may need to reconnect if
// their refresh token was revoked.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action = "create" | "update" | "cancel";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let body: { booking_id?: string; action?: Action } = {};
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "invalid_body" }, 400);
  }
  if (!body.booking_id || !body.action) {
    return json({ error: "missing_booking_id_or_action" }, 400);
  }

  // Load the booking + therapist + service.
  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select(
      "id, therapist_id, service_id, scheduled_at, duration_minutes, client_email, client_name, google_event_id"
    )
    .eq("id", body.booking_id)
    .single();
  if (bErr || !booking) {
    return json({ error: "booking_not_found", details: bErr?.message }, 404);
  }

  const { data: therapist, error: tErr } = await supabase
    .from("therapists")
    .select(
      "id, google_calendar_connected, google_access_token, google_refresh_token, google_token_expires_at, google_calendar_id"
    )
    .eq("id", booking.therapist_id)
    .single();
  if (tErr || !therapist) {
    return json({ error: "therapist_not_found" }, 404);
  }
  if (!therapist.google_calendar_connected) {
    return json({ ok: true, skipped: "not_connected" });
  }

  let serviceName = "Booking";
  if (booking.service_id) {
    const { data: svc } = await supabase
      .from("services")
      .select("name, duration_minutes")
      .eq("id", booking.service_id)
      .single();
    if (svc) serviceName = svc.name;
  }

  let accessToken: string;
  try {
    accessToken = await ensureFreshToken(
      therapist,
      supabase,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg });
  }

  const calendarId = therapist.google_calendar_id || "primary";
  const startAt = new Date(booking.scheduled_at as string);
  const endAt = new Date(
    startAt.getTime() + (booking.duration_minutes || 60) * 60 * 1000
  );

  if (body.action === "cancel") {
    if (!booking.google_event_id) {
      return json({ ok: true, skipped: "no_google_event_id" });
    }
    const delRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events/${encodeURIComponent(booking.google_event_id)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    // 410 = already gone, treat as success
    if (!delRes.ok && delRes.status !== 410) {
      const txt = await delRes.text();
      return json({ ok: false, error: `delete_failed: ${txt.slice(0, 200)}` });
    }
    await supabase
      .from("bookings")
      .update({ google_event_id: null, google_synced_at: new Date().toISOString() })
      .eq("id", booking.id);
    return json({ ok: true, action: "cancelled" });
  }

  // Build event payload. Title shows '<Service> with <Client>'.
  // Description is internal, only therapist sees it. Set the
  // private metadata flag so the reverse sync ignores this event.
  const summary = `${serviceName} with ${booking.client_name || "client"}`;
  const description = [
    `MyBodyMap booking`,
    `Service: ${serviceName}`,
    booking.client_email ? `Client: ${booking.client_email}` : null,
    `Booking ID: ${booking.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  const eventPayload: any = {
    summary,
    description,
    start: { dateTime: startAt.toISOString() },
    end: { dateTime: endAt.toISOString() },
    extendedProperties: {
      private: {
        mybodymap_source: "mybodymap",
        mybodymap_booking_id: booking.id,
      },
    },
    reminders: { useDefault: true },
  };

  if (body.action === "update" && booking.google_event_id) {
    // PATCH the existing event.
    const upRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events/${encodeURIComponent(booking.google_event_id)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventPayload),
      }
    );
    if (!upRes.ok) {
      const txt = await upRes.text();
      // If the event was deleted on Google's side (404), fall through and create.
      if (upRes.status !== 404) {
        return json({ ok: false, error: `update_failed: ${txt.slice(0, 200)}` });
      }
    } else {
      await supabase
        .from("bookings")
        .update({ google_synced_at: new Date().toISOString() })
        .eq("id", booking.id);
      return json({ ok: true, action: "updated" });
    }
  }

  // Create
  const cRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    }
  );
  if (!cRes.ok) {
    const txt = await cRes.text();
    return json({ ok: false, error: `create_failed: ${txt.slice(0, 200)}` });
  }
  const created = await cRes.json();
  await supabase
    .from("bookings")
    .update({
      google_event_id: created.id,
      google_synced_at: new Date().toISOString(),
    })
    .eq("id", booking.id);
  return json({ ok: true, action: "created", event_id: created.id });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function ensureFreshToken(
  t: any,
  supabase: any,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const expiresAt = t.google_token_expires_at
    ? new Date(t.google_token_expires_at).getTime()
    : 0;
  if (expiresAt > Date.now() + 60_000 && t.google_access_token) {
    return t.google_access_token;
  }
  if (!t.google_refresh_token) {
    throw new Error("no_refresh_token");
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
    throw new Error(`token_refresh_failed: ${j.error || "unknown"}`);
  }
  await supabase
    .from("therapists")
    .update({
      google_access_token: j.access_token,
      google_token_expires_at: new Date(
        Date.now() + (j.expires_in || 3600) * 1000
      ).toISOString(),
    })
    .eq("id", t.id);
  return j.access_token;
}
