// supabase/functions/google-calendar-forward-sync/index.ts
//
// Forward sync (cron). Reconciles MyBodyMap bookings into each
// connected therapist's Google Calendar so their MyBodyMap sessions
// show up alongside their personal events. This is the mirror image
// of google-calendar-sync (which pulls Google events IN).
//
// Why a cron instead of inline push calls in every booking flow:
//   The old approach only fired google-calendar-push from the public
//   booking page, and only when a booking landed as 'confirmed'.
//   Therapist-created sessions, approvals (pending -> confirmed),
//   reschedules, and cancellations never pushed. One reconciling
//   cron covers every path regardless of where the change came from.
//
// Each run it looks for, across connected therapists:
//   - CREATE: status='confirmed', no google_event_id, future date
//   - CANCEL: has google_event_id, now cancelled or no_show
//   - UPDATE: has google_event_id, still confirmed, edited since the
//             last push (updated_at well after google_synced_at)
// and calls google-calendar-push per booking. push owns the token
// refresh and the actual Google API call, so this stays simple.
//
// Body (optional): { therapist_id } to scope to one therapist (used
// to kick off an immediate forward sync right after connect).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Keep each run small so a therapist with a big backlog backfills
// over several runs rather than timing out the function.
const PER_ACTION_LIMIT = 25;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let onlyTherapist: string | null = null;
  try {
    const b = await req.json();
    onlyTherapist = b?.therapist_id || null;
  } catch (_e) {
    // no body is fine (cron sends {})
  }

  // Connected therapists with a usable refresh token.
  let tq = supabase
    .from("therapists")
    .select("id")
    .eq("google_calendar_connected", true)
    .not("google_refresh_token", "is", null);
  if (onlyTherapist) tq = tq.eq("id", onlyTherapist);
  const { data: therapists, error: tErr } = await tq;
  if (tErr) return json({ ok: false, error: tErr.message }, 500);

  const ids = (therapists || []).map((t: any) => t.id);
  if (!ids.length) {
    return json({ ok: true, therapists: 0, queued: 0, note: "no connected therapists" });
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const work: { booking_id: string; action: "create" | "update" | "cancel" }[] = [];

  // CREATE: confirmed, future, never pushed.
  const { data: creates } = await supabase
    .from("bookings")
    .select("id")
    .in("therapist_id", ids)
    .eq("status", "confirmed")
    .is("google_event_id", null)
    .gte("booking_date", today)
    .limit(PER_ACTION_LIMIT);
  for (const b of creates || []) work.push({ booking_id: b.id, action: "create" });

  // CANCEL: was pushed, now cancelled or no-show. (Completed sessions
  // keep their Google event as a record, so they are excluded.)
  const { data: cancels } = await supabase
    .from("bookings")
    .select("id")
    .in("therapist_id", ids)
    .not("google_event_id", "is", null)
    .in("status", ["cancelled", "no_show"])
    .limit(PER_ACTION_LIMIT);
  for (const b of cancels || []) work.push({ booking_id: b.id, action: "cancel" });

  // UPDATE: still confirmed, already on Google, edited after the last
  // push. The 10s buffer ignores push's own google_synced_at write so
  // we do not loop.
  const { data: maybeUpd } = await supabase
    .from("bookings")
    .select("id, updated_at, google_synced_at")
    .in("therapist_id", ids)
    .eq("status", "confirmed")
    .not("google_event_id", "is", null)
    .limit(500);
  let updCount = 0;
  for (const b of maybeUpd || []) {
    if (updCount >= PER_ACTION_LIMIT) break;
    if (
      b.updated_at &&
      b.google_synced_at &&
      new Date(b.updated_at).getTime() >
        new Date(b.google_synced_at).getTime() + 10_000
    ) {
      work.push({ booking_id: b.id, action: "update" });
      updCount++;
    }
  }

  const results = {
    created: 0,
    updated: 0,
    cancelled: 0,
    failed: 0,
    errors: [] as { booking_id: string; action: string; error: string }[],
  };

  for (const w of work) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify(w),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) {
        results.failed++;
        results.errors.push({
          booking_id: w.booking_id,
          action: w.action,
          error: String(j.error || `http_${r.status}`),
        });
      } else if (w.action === "create") results.created++;
      else if (w.action === "update") results.updated++;
      else if (w.action === "cancel") results.cancelled++;
    } catch (e) {
      results.failed++;
      results.errors.push({
        booking_id: w.booking_id,
        action: w.action,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return json({
    ok: true,
    therapists: ids.length,
    queued: work.length,
    ...results,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
