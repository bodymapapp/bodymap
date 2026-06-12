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

  // HK May 14 2026: verbose logs at every step so we can see in
  // edge function logs exactly where forward push fails. Was flying
  // blind before; logs showed only boot / shutdown noise.
  console.log("[push] invoked", { method: req.method });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  console.log("[push] env check", {
    hasUrl: !!SUPABASE_URL,
    hasServiceKey: !!SUPABASE_SERVICE_KEY,
    hasGoogleId: !!GOOGLE_CLIENT_ID,
    hasGoogleSecret: !!GOOGLE_CLIENT_SECRET,
  });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let body: { booking_id?: string; action?: Action } = {};
  try {
    body = await req.json();
  } catch (_e) {
    console.error("[push] invalid body");
    return json({ error: "invalid_body" }, 400);
  }
  console.log("[push] body parsed", body);

  if (!body.booking_id || !body.action) {
    console.error("[push] missing booking_id or action");
    return json({ error: "missing_booking_id_or_action" }, 400);
  }

  // Load the booking + therapist + service.
  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select(
      "id, therapist_id, service_id, booking_date, start_time, end_time, client_email, client_name, google_event_id"
    )
    .eq("id", body.booking_id)
    .single();
  if (bErr || !booking) {
    console.error("[push] booking not found", { bookingId: body.booking_id, error: bErr });
    return json({ error: "booking_not_found", details: bErr?.message }, 404);
  }
  console.log("[push] booking loaded", {
    id: booking.id,
    booking_date: booking.booking_date,
    start_time: booking.start_time,
    end_time: booking.end_time,
    has_google_event_id: !!booking.google_event_id,
  });

  const { data: therapist, error: tErr } = await supabase
    .from("therapists")
    .select(
      "id, google_calendar_connected, google_access_token, google_refresh_token, google_token_expires_at, google_calendar_id, timezone"
    )
    .eq("id", booking.therapist_id)
    .single();
  if (tErr || !therapist) {
    console.error("[push] therapist not found", { therapistId: booking.therapist_id, error: tErr });
    return json({ error: "therapist_not_found" }, 404);
  }
  console.log("[push] therapist loaded", {
    id: therapist.id,
    connected: therapist.google_calendar_connected,
    hasAccessToken: !!therapist.google_access_token,
    hasRefreshToken: !!therapist.google_refresh_token,
    expiresAt: therapist.google_token_expires_at,
    calendarId: therapist.google_calendar_id,
  });
  if (!therapist.google_calendar_connected) {
    console.warn("[push] therapist not connected to Google");
    return json({ ok: true, skipped: "not_connected" });
  }

  let serviceName = "Booking";
  let serviceDurationMin = 60;
  if (booking.service_id) {
    const { data: svc } = await supabase
      .from("services")
      .select("name, duration")
      .eq("id", booking.service_id)
      .single();
    if (svc) {
      serviceName = svc.name;
      if (svc.duration) serviceDurationMin = svc.duration;
    }
  }

  let accessToken: string;
  try {
    accessToken = await ensureFreshToken(
      therapist,
      supabase,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET
    );
    console.log("[push] access token ready (length:", accessToken.length, ")");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[push] token refresh failed:", msg);
    return json({ ok: false, error: msg });
  }

  const calendarId = therapist.google_calendar_id || "primary";

  // Build the Google datetime strings from real columns
  // (booking_date + start_time / end_time). Format Google expects:
  //   "YYYY-MM-DDTHH:MM:SS"  (no timezone suffix)
  // Combined with timeZone field on the start/end object, Google
  // interprets this as "this wall-clock time in the therapist's
  // calendar timezone", which is what we want. If we passed a UTC
  // ISO string, a 2pm booking would be saved to Google as 9am EST
  // (or wherever the calendar lives), which is the wrong outcome.
  //
  // We do NOT have a therapist timezone column yet, so we use
  // 'UTC' as the timeZone hint. Google will then create the event
  // at wall-clock UTC time. For a US-Eastern therapist viewing
  // their calendar, this looks 4-5 hours off. Real fix: add a
  // therapists.timezone column and read it here. Follow-up bug.
  //
  // For now this at least fixes the create-fails-with-Invalid-Date
  // problem, which is the urgent issue. Time-zone polish is its
  // own commit.
  const bookingDate = booking.booking_date as string; // 'YYYY-MM-DD'
  const startTime = (booking.start_time as string || '').slice(0, 8); // 'HH:MM:SS' or 'HH:MM'
  const endTime = (booking.end_time as string || '').slice(0, 8);

  if (!bookingDate || !startTime) {
    return json({ ok: false, error: "missing_booking_date_or_start_time" });
  }

  // Ensure the time is HH:MM:SS form (pad seconds if absent).
  const normalize = (t: string) => (t.length === 5 ? `${t}:00` : t);
  const startLocal = `${bookingDate}T${normalize(startTime)}`;
  const endLocal = endTime
    ? `${bookingDate}T${normalize(endTime)}`
    : (() => {
        // Fall back to start + service duration if end_time is null
        const [h, m] = startTime.split(':').map(Number);
        const totalStartMin = h * 60 + m;
        const totalEndMin = totalStartMin + serviceDurationMin;
        const eh = Math.floor(totalEndMin / 60);
        const em = totalEndMin % 60;
        return `${bookingDate}T${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00`;
      })();

  // Wall-clock booking time interpreted in the therapist's own
  // timezone. Falls back to UTC only if the therapist has no tz set.
  const eventTimeZone = therapist.timezone || "UTC";

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
    // Use local datetime + timeZone. Google interprets as wall-
    // clock in the named tz. Documented format:
    //   https://developers.google.com/calendar/api/v3/reference/events#resource
    start: { dateTime: startLocal, timeZone: eventTimeZone },
    end:   { dateTime: endLocal,   timeZone: eventTimeZone },
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
  console.log("[push] creating Google event", {
    calendarId,
    summary,
    startLocal,
    endLocal,
    timeZone: eventTimeZone,
  });
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
    console.error("[push] Google create failed", { status: cRes.status, body: txt.slice(0, 500) });
    return json({ ok: false, error: `create_failed: ${txt.slice(0, 200)}` });
  }
  const created = await cRes.json();
  console.log("[push] Google event created", { eventId: created.id, htmlLink: created.htmlLink });
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
