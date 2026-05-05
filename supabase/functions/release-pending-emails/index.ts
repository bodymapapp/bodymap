// supabase/functions/release-pending-emails/index.ts
//
// SELF-CONTAINED backfill. Reads gap bookings, calls Resend directly,
// logs to notification_log. No chained calls to other functions.
//
// Why: the previous backfill chained through send-booking-confirmation
// which added points of failure. This function inlines all email logic
// so there is exactly one moving part: this function + Resend.
//
// Invoke via curl OR SQL. Single call processes up to 30 bookings with
// proper rate-limited sequential sends.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const C = {
  forest: "#2A5741",
  rose: "#A87468",
  cream: "#FAF6EE",
  beige: "#F5EFE0",
  ink: "#1F2937",
  gray: "#6B7280",
};

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAppt(dateStr: string, timeStr: string): { date: string; time: string; full: string } {
  try {
    const isoStr = `${dateStr}T${(timeStr || "00:00:00").slice(0, 8)}`;
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) {
      return { date: dateStr, time: timeStr || "", full: `${dateStr} ${timeStr || ""}`.trim() };
    }
    const date = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return { date, time, full: `${date} at ${time}` };
  } catch {
    return { date: dateStr, time: timeStr || "", full: `${dateStr} ${timeStr || ""}`.trim() };
  }
}

async function sendResend(apiKey: string, payload: any): Promise<{ ok: boolean; id?: string; status: number; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch {}
    if (res.ok && data?.id) return { ok: true, id: data.id, status: res.status };
    return { ok: false, status: res.status, error: text.slice(0, 300) };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(
      JSON.stringify({ error: "missing_env", has_resend: !!RESEND_API_KEY, has_url: !!SUPABASE_URL, has_key: !!SUPABASE_SERVICE_KEY }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(body.limit || 30, 1), 50);
  const delayMs = Math.max(body.delay_ms || 800, 500);

  console.log("[release-pending] starting", { limit, delayMs });

  // Find candidate bookings with full therapist + service joins
  const { data: candidates, error: cErr } = await supabase
    .from("bookings")
    .select("id, client_email, client_name, client_phone, booking_date, start_time, status, therapists(*), services(*)")
    .in("status", ["confirmed", "pending-approval"])
    .gte("created_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
    .not("client_email", "is", null)
    .order("created_at", { ascending: true })
    .limit(200);

  if (cErr || !candidates) {
    console.error("[release-pending] candidate query failed", cErr);
    return new Response(
      JSON.stringify({ error: "candidate_query_failed", details: cErr?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const valid = candidates.filter((b: any) => b.client_email && b.client_email.length > 0);

  // Find which already have successful client confirmations
  const ids = valid.map((b: any) => b.id);
  const { data: sentLogs, error: lErr } = await supabase
    .from("notification_log")
    .select("booking_id")
    .in("booking_id", ids)
    .eq("audience", "client")
    .eq("status", "sent")
    .in("notification_type", ["booking_confirmation", "booking_request_received"]);

  if (lErr) {
    console.error("[release-pending] log query failed", lErr);
    return new Response(
      JSON.stringify({ error: "log_query_failed", details: lErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const sentSet = new Set((sentLogs || []).map((l: any) => l.booking_id));
  const gap = valid.filter((b: any) => !sentSet.has(b.id));
  const toProcess = gap.slice(0, limit);

  console.log("[release-pending] gap", {
    candidates: valid.length,
    already_sent: sentSet.size,
    gap_total: gap.length,
    will_process: toProcess.length,
  });

  let okCount = 0;
  let failCount = 0;
  const results: any[] = [];

  for (const booking of toProcess) {
    const therapist = (booking as any).therapists;
    const service = (booking as any).services;

    if (!therapist) {
      results.push({ booking_id: booking.id, error: "no_therapist" });
      failCount++;
      continue;
    }

    const apt = formatAppt(booking.booking_date, booking.start_time);
    const therapistName = therapist.business_name || therapist.full_name || "Your therapist";
    const therapistFirst = (therapist.full_name || therapistName).split(" ")[0];
    const clientName = booking.client_name || "Client";
    const serviceName = service?.name || "Massage session";
    const servicePrice = service?.price;
    const intakeUrl = `https://mybodymap.app/${therapist.custom_url}?name=${encodeURIComponent(clientName)}&email=${encodeURIComponent(booking.client_email)}&booking_id=${booking.id}`;
    const isPending = booking.status === "pending-approval";

    // ---- Client email ----
    const clientSubject = isPending
      ? `Request received: ${serviceName} with ${therapistName}`
      : `Booking confirmed: ${serviceName} with ${therapistName}`;

    const clientHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:${C.beige};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${C.ink};">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
<div style="background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
<div style="text-align:center;margin-bottom:24px;"><div style="width:64px;height:64px;border-radius:50%;background:${C.cream};display:inline-flex;align-items:center;justify-content:center;font-size:32px;line-height:64px;">🌿</div></div>
<h1 style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:${C.forest};margin:0 0 8px;text-align:center;">${isPending ? "Your request was received" : "Your booking is confirmed"}</h1>
<p style="font-size:14px;color:${C.gray};text-align:center;margin:0 0 24px;line-height:1.6;">${isPending ? `${escapeHtml(therapistFirst)} will review and reply soon.` : `We will see you on ${escapeHtml(apt.date)} at ${escapeHtml(apt.time)}.`}</p>
<div style="background:${C.cream};border-radius:12px;padding:20px;margin-bottom:20px;">
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${C.gray};margin-bottom:10px;">Your booking</div>
<div style="font-size:15px;font-weight:700;color:${C.ink};margin-bottom:6px;">${escapeHtml(serviceName)}</div>
<div style="font-size:14px;color:${C.gray};line-height:1.7;">${escapeHtml(apt.full)}<br/>with ${escapeHtml(therapistName)}${servicePrice ? `<br/>$${servicePrice}` : ""}</div>
</div>
${!isPending ? `<div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:12px;padding:18px 20px;margin-bottom:20px;"><div style="font-size:13px;font-weight:700;color:${C.forest};margin-bottom:6px;">📋 Save time, fill your intake now</div><div style="font-size:13px;color:${C.ink};line-height:1.6;margin-bottom:12px;">Filling your body map ahead of time means you are ready the moment you arrive.</div><a href="${intakeUrl}" style="display:inline-block;background:${C.forest};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;">Fill my intake form</a></div>` : ""}
<div style="font-size:12px;color:${C.gray};text-align:center;margin-top:24px;line-height:1.6;">Questions? Reply to this email and ${escapeHtml(therapistFirst)} will get back to you.</div>
</div>
<div style="text-align:center;margin-top:16px;font-size:11px;color:${C.gray};">Sent by ${escapeHtml(therapistName)} via MyBodyMap</div>
</div></body></html>`;

    const safeName = String(therapistName).replace(/"/g, "");
    const clientResult = await sendResend(RESEND_API_KEY, {
      from: `"${safeName}" <reminders@mybodymap.app>`,
      to: [booking.client_email],
      ...(therapist.email ? { reply_to: therapist.email } : {}),
      subject: clientSubject,
      html: clientHtml,
    });

    await supabase.from("notification_log").insert({
      therapist_id: therapist.id,
      notification_type: isPending ? "booking_request_received" : "booking_confirmation",
      audience: "client",
      channel: "email",
      recipient: booking.client_email,
      status: clientResult.ok ? "sent" : "failed",
      provider_id: clientResult.id || null,
      subject: clientSubject,
      body_snippet: clientResult.ok ? `${serviceName} on ${apt.date}` : `RESEND_${clientResult.status}: ${(clientResult.error || "").slice(0, 200)}`,
      booking_id: booking.id,
    });

    if (clientResult.ok) okCount++; else failCount++;
    console.log("[release-pending] client", { booking_id: booking.id, ok: clientResult.ok, status: clientResult.status });

    await sleep(delayMs);

    // ---- Therapist email ----
    if (therapist.email) {
      const therapistSubject = isPending
        ? `New booking REQUEST: ${clientName} wants ${serviceName}`
        : `New booking: ${clientName} booked ${serviceName}`;

      const therapistHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:${C.beige};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${C.ink};">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
<div style="background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${C.gray};margin-bottom:8px;">${isPending ? "New request" : "New booking"}</div>
<h1 style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:${C.forest};margin:0 0 4px;">${escapeHtml(clientName)}</h1>
<p style="font-size:14px;color:${C.gray};margin:0 0 20px;">${isPending ? "Wants to book" : "Just booked"} ${escapeHtml(serviceName)}</p>
<div style="background:${C.cream};border-radius:12px;padding:18px;margin-bottom:18px;font-size:14px;color:${C.ink};line-height:1.8;">
<strong>When:</strong> ${escapeHtml(apt.full)}<br/>
<strong>Service:</strong> ${escapeHtml(serviceName)}${servicePrice ? ` ($${servicePrice})` : ""}<br/>
<strong>Email:</strong> <a href="mailto:${escapeHtml(booking.client_email)}" style="color:${C.forest};">${escapeHtml(booking.client_email)}</a>
${booking.client_phone ? `<br/><strong>Phone:</strong> <a href="tel:${escapeHtml(booking.client_phone)}" style="color:${C.forest};">${escapeHtml(booking.client_phone)}</a>` : ""}
</div>
<a href="https://mybodymap.app/dashboard" style="display:inline-block;background:${C.forest};color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:13px;font-weight:700;">Open dashboard</a>
</div></div></body></html>`;

      const therapistResult = await sendResend(RESEND_API_KEY, {
        from: `"MyBodyMap" <reminders@mybodymap.app>`,
        to: [therapist.email],
        subject: therapistSubject,
        html: therapistHtml,
      });

      await supabase.from("notification_log").insert({
        therapist_id: therapist.id,
        notification_type: "new_booking",
        audience: "therapist",
        channel: "email",
        recipient: therapist.email,
        status: therapistResult.ok ? "sent" : "failed",
        provider_id: therapistResult.id || null,
        subject: therapistSubject,
        body_snippet: therapistResult.ok ? `${clientName} booked ${serviceName} on ${apt.date}` : `RESEND_${therapistResult.status}: ${(therapistResult.error || "").slice(0, 200)}`,
        booking_id: booking.id,
      });

      if (therapistResult.ok) okCount++; else failCount++;
      console.log("[release-pending] therapist", { booking_id: booking.id, ok: therapistResult.ok, status: therapistResult.status });

      await sleep(delayMs);
    }

    results.push({
      booking_id: booking.id,
      client_recipient: booking.client_email,
      client_ok: clientResult.ok,
      client_error: clientResult.ok ? null : `${clientResult.status}: ${(clientResult.error || "").slice(0, 100)}`,
    });
  }

  const remaining = Math.max(0, gap.length - toProcess.length);
  console.log("[release-pending] done", { processed: toProcess.length, ok: okCount, failed: failCount, remaining });

  return new Response(
    JSON.stringify({
      ok: true,
      processed: toProcess.length,
      ok_count: okCount,
      fail_count: failCount,
      total_gap: gap.length,
      remaining,
      results,
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
