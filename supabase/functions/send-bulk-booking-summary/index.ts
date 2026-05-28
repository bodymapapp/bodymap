// supabase/functions/send-bulk-booking-summary/index.ts
//
// HK May 27 2026: fired once after a client books MULTIPLE sessions in
// one go (the package bulk scheduler). Sends ONE summary email to the
// therapist and ONE summary email to the client listing all the
// sessions, instead of N separate "new booking" emails.
//
// The per-session 48h and 2h reminders are intentionally NOT handled
// here: those stay separate and are fired per booking by the existing
// reminder crons (send-reminder-48h, send-reminders), which already
// pick up these confirmed bookings with no change needed.
//
// Input: { booking_ids: string[], therapist_id: string }
// Logs every send to notification_log via notifyTherapist / notifyClient.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyTherapist, notifyClient } from "../_shared/notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const C = { forest: "#2A5741", ink: "#1A2E22", cream: "#F5F0E8", gray: "#6B7280" };

function escapeHtml(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtWhen(dateStr: string, timeStr: string): string {
  try {
    const d = new Date(`${dateStr}T${(timeStr || "00:00:00").slice(0, 8)}`);
    if (isNaN(d.getTime())) return `${dateStr} ${timeStr || ""}`.trim();
    const date = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${date} at ${time}`;
  } catch (_e) {
    return `${dateStr} ${timeStr || ""}`.trim();
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "missing_env" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { booking_ids, therapist_id } = await req.json();
    if (!Array.isArray(booking_ids) || booking_ids.length === 0) {
      return new Response(JSON.stringify({ error: "booking_ids required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load all the bookings + their services in one query.
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, booking_date, start_time, client_name, client_email, client_id, package_purchase_id, services(name)")
      .in("id", booking_ids)
      .order("booking_date", { ascending: true });

    if (!bookings || bookings.length === 0) {
      return new Response(JSON.stringify({ error: "no_bookings_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tid = therapist_id || null;
    const { data: therapist } = await supabase
      .from("therapists")
      .select("*")
      .eq("id", tid || bookings[0].id /* fallback never matches; tid should be passed */)
      .maybeSingle();

    // Resolve therapist from the first booking if not passed/found.
    let therapistRow = therapist;
    if (!therapistRow) {
      const { data: b0 } = await supabase.from("bookings").select("therapist_id").eq("id", bookings[0].id).maybeSingle();
      if (b0?.therapist_id) {
        const { data: t } = await supabase.from("therapists").select("*").eq("id", b0.therapist_id).maybeSingle();
        therapistRow = t;
      }
    }
    if (!therapistRow) {
      return new Response(JSON.stringify({ error: "therapist_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const clientName = bookings[0].client_name || "Your client";
    const clientEmail = bookings[0].client_email || "";
    const clientId = bookings[0].client_id || null;
    const count = bookings.length;

    // Build the shared session list HTML.
    const rowsHtml = bookings.map(b => {
      const svc = (b as any).services?.name || "Session";
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #ECE7DC;font-size:14px;color:${C.ink};">${escapeHtml(fmtWhen(b.booking_date, b.start_time))}</td>
        <td style="padding:8px 0 8px 12px;border-bottom:1px solid #ECE7DC;font-size:14px;color:${C.gray};text-align:right;">${escapeHtml(svc)}</td>
      </tr>`;
    }).join("");

    const dashboardUrl = "https://mybodymap.app/dashboard/schedule";
    const therapistFirst = (therapistRow.full_name || "").split(" ")[0] || "there";

    // ─── Therapist summary email ───────────────────────────────────
    const tSubject = `${clientName} booked ${count} session${count !== 1 ? "s" : ""}`;
    const tHtml = `<!DOCTYPE html><html><body style="margin:0;background:#FAFAF7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:28px 22px;">
    <div style="background:#fff;border:1px solid #ECE7DC;border-radius:16px;padding:24px;">
      <h2 style="font-family:Georgia,serif;color:${C.ink};margin:0 0 6px;font-size:21px;">${count} new session${count !== 1 ? "s" : ""} booked</h2>
      <p style="font-size:14px;color:${C.gray};margin:0 0 16px;line-height:1.6;">${escapeHtml(clientName)} scheduled ${count} session${count !== 1 ? "s" : ""} from their package. They are on your calendar now. Each session draws from the prepaid package, so no payment is due at the visit.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">${rowsHtml}</table>
      <a href="${dashboardUrl}" style="display:inline-block;background:${C.forest};color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:13px;font-weight:700;">Open schedule</a>
      <div style="font-size:11px;color:${C.gray};margin-top:22px;line-height:1.6;">You are getting this because "New booking came in" is on in your notification settings. Each session also gets its own reminder before the visit.</div>
    </div>
  </div>
</body></html>`;

    const therapistResult = await notifyTherapist({
      supabase,
      therapist: therapistRow,
      eventType: "new_booking",
      title: tSubject,
      body: `${clientName} booked ${count} sessions from their package.`,
      linkUrl: "/dashboard/schedule",
      emailSubject: tSubject,
      emailHtml: tHtml,
      smsText: null, // SMS not in production yet; email only
      resendApiKey: RESEND_API_KEY,
    });

    // ─── Client summary email ──────────────────────────────────────
    let clientResult: any = { skipped: "no_client_email" };
    if (clientEmail) {
      const cSubject = `Your ${count} session${count !== 1 ? "s" : ""} with ${therapistRow.business_name || therapistRow.full_name || "your therapist"} ${count !== 1 ? "are" : "is"} booked`;
      const cHtml = `<!DOCTYPE html><html><body style="margin:0;background:#FAFAF7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:28px 22px;">
    <div style="background:#fff;border:1px solid #ECE7DC;border-radius:16px;padding:24px;">
      <h2 style="font-family:Georgia,serif;color:${C.ink};margin:0 0 6px;font-size:21px;">You are all set</h2>
      <p style="font-size:14px;color:${C.gray};margin:0 0 16px;line-height:1.6;">Here ${count !== 1 ? "are" : "is"} your booked session${count !== 1 ? "s" : ""}. ${count !== 1 ? "They are" : "It is"} drawn from your package, so there is nothing to pay at the visit. We will remind you before each one.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">${rowsHtml}</table>
      <div style="font-size:12px;color:${C.gray};margin-top:8px;line-height:1.6;">Need to change one? Just reply to this email and ${escapeHtml(therapistFirst)} will help.</div>
    </div>
  </div>
</body></html>`;

      clientResult = await notifyClient({
        supabase,
        therapist: therapistRow,
        client: { id: clientId, email: clientEmail, phone: null },
        eventType: "booking_confirmation",
        emailSubject: cSubject,
        emailHtml: cHtml,
        resendApiKey: RESEND_API_KEY,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, count, therapist: therapistResult, client: clientResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[send-bulk-booking-summary] uncaught", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
