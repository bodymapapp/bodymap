// supabase/functions/backfill-booking-emails/index.ts
//
// Orchestrates retroactive sending of booking confirmation emails for
// bookings that have no 'sent' notification_log entry. Loops through
// gap bookings sequentially, waiting between each send to stay under
// Resend's rate limit (2/second on free tier).
//
// Why a separate function: the SQL backfill via pg_net is async — all
// queued requests fire in parallel, blowing the rate limit. This
// function uses await + setTimeout to truly serialize the sends.
//
// Idempotent: re-runs are safe. Each invocation picks up where the
// previous left off, scoped to bookings without 'sent' log entries.
//
// Invoke via SQL:
//   SELECT net.http_post(
//     url := '<project>.supabase.co/functions/v1/backfill-booking-emails',
//     headers := jsonb_build_object(
//       'Content-Type', 'application/json',
//       'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
//     ),
//     body := jsonb_build_object('limit', 30, 'delay_ms', 600)
//   );
//
// Or via curl:
//   curl -X POST '.../functions/v1/backfill-booking-emails' \
//     -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
//     -H "Content-Type: application/json" \
//     -d '{"limit": 30, "delay_ms": 600}'

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(
      JSON.stringify({ error: "missing_env" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const body = await req.json().catch(() => ({}));
  // Process up to N bookings per invocation. Default 30 keeps us under
  // edge function timeout (~60s) given 600ms per send.
  const limit = Math.min(Math.max(body.limit || 30, 1), 60);
  // Delay between sends. 600ms keeps us at ~1.6/sec, safely under
  // Resend's 2/sec free tier cap.
  const delayMs = Math.max(body.delay_ms || 600, 200);

  console.log("[backfill] starting", { limit, delayMs });

  // Find candidate bookings — recent confirmed or pending-approval.
  const { data: candidates, error: cErr } = await supabase
    .from("bookings")
    .select("id, client_email, client_name, created_at, status")
    .in("status", ["confirmed", "pending-approval"])
    .gte("created_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
    .not("client_email", "is", null)
    .order("created_at", { ascending: true })
    .limit(500);

  if (cErr) {
    console.error("[backfill] candidate query failed:", cErr.message);
    return new Response(
      JSON.stringify({ error: "candidate_query_failed", details: cErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const candidateBookings = (candidates || []).filter(b => b.client_email && b.client_email.length > 0);

  if (candidateBookings.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, processed: 0, total_gap: 0, remaining: 0, message: "no candidates" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Find which already have successful confirmations logged.
  const candidateIds = candidateBookings.map(b => b.id);
  const { data: sentLogs, error: lErr } = await supabase
    .from("notification_log")
    .select("booking_id")
    .in("booking_id", candidateIds)
    .eq("audience", "client")
    .eq("status", "sent")
    .in("notification_type", ["booking_confirmation", "booking_request_received"]);

  if (lErr) {
    console.error("[backfill] log query failed:", lErr.message);
    return new Response(
      JSON.stringify({ error: "log_query_failed", details: lErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const sentSet = new Set((sentLogs || []).map(l => l.booking_id));
  const gap = candidateBookings.filter(b => !sentSet.has(b.id));
  const toProcess = gap.slice(0, limit);

  console.log("[backfill] gap analysis", {
    candidates: candidateBookings.length,
    already_sent: sentSet.size,
    gap_total: gap.length,
    will_process_now: toProcess.length,
  });

  const results: any[] = [];
  let okCount = 0;
  let failCount = 0;

  for (const b of toProcess) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-booking-confirmation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ booking_id: b.id, source: "backfill" }),
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.ok && data?.results?.client_email?.ok;
      if (ok) okCount++; else failCount++;
      results.push({
        booking_id: b.id,
        recipient: b.client_email,
        http_status: res.status,
        client_send: data?.results?.client_email,
        therapist_send: data?.results?.therapist_email,
      });
      console.log("[backfill] send result", { booking_id: b.id, ok });
    } catch (e) {
      failCount++;
      results.push({ booking_id: b.id, recipient: b.client_email, error: String(e) });
      console.error("[backfill] send threw:", b.id, String(e));
    }
    // Rate limit: wait between sends so we stay under Resend's cap.
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  const remaining = Math.max(0, gap.length - toProcess.length);
  console.log("[backfill] done", { processed: toProcess.length, ok: okCount, failed: failCount, remaining });

  return new Response(
    JSON.stringify({
      ok: true,
      processed: toProcess.length,
      succeeded: okCount,
      failed: failCount,
      total_gap: gap.length,
      remaining_after_this_run: remaining,
      next_run_needed: remaining > 0,
      results,
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
