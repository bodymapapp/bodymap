// supabase/functions/send-booking-confirmation/index.ts
//
// Fired after a booking is created (or approved, or deposit-paid) to:
//   1. Send confirmation email to the CLIENT  (if therapist's notification_prefs.client.booking_confirmation.email is on)
//   2. Send "new booking" notification to the THERAPIST (if notification_prefs.therapist.new_booking.email is on)
//   3. Log every attempt to notification_log
//
// Triggered by Lindsey Thomas reporting that no booking confirmation
// emails were arriving for practice bookings she made. Root cause: the
// Settings UI showed toggles for these notifications, the toggle states
// persisted to therapists.notification_prefs, but no edge function was
// ever wired to actually fire the emails. Feature was half-built.
//
// Defaults are conservative: if notification_prefs is missing or the
// specific channel boolean is missing, we still send (because that
// matches the Settings UI default-on state). Therapist must explicitly
// opt out for an email to be skipped.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const C = {
  forest: "#2A5741",
  sage: "#5C7A4F",
  rose: "#A87468",
  cream: "#FAF6EE",
  beige: "#F5EFE0",
  ink: "#1F2937",
  gray: "#6B7280",
};

// Read a notification pref boolean with sensible default-on fallback.
// audience: "client" | "therapist", type: e.g. "booking_confirmation",
// channel: "email" | "sms" | "app_alert"
function shouldSend(therapist: any, audience: string, type: string, channel: string): boolean {
  const prefs = therapist?.notification_prefs;
  if (!prefs || typeof prefs !== "object") return true;
  const a = prefs[audience];
  if (!a || typeof a !== "object") return true;
  const t = a[type];
  if (!t || typeof t !== "object") return true;
  if (typeof t[channel] !== "boolean") return true;
  return t[channel];
}

// Format a booking_date (YYYY-MM-DD) + start_time (HH:MM:SS) into
// a friendly "Tuesday, May 5 at 2:30 PM" string. The bookings table
// stores these as two separate columns, not a single timestamp.
function formatAppointment(dateStr: string, timeStr: string, tz: string = "America/Chicago"): { date: string; time: string; full: string } {
  try {
    // Combine date + time into an ISO string. Treat as local time in
    // the therapist's timezone — booking_date and start_time were
    // recorded in the therapist's local timezone at booking creation.
    const isoStr = `${dateStr}T${(timeStr || "00:00:00").slice(0, 8)}`;
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) {
      return { date: dateStr, time: timeStr || "", full: `${dateStr} ${timeStr || ""}`.trim() };
    }
    const date = d.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric",
    });
    const time = d.toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit",
    });
    return { date, time, full: `${date} at ${time}` };
  } catch (_e) {
    return { date: dateStr, time: timeStr || "", full: `${dateStr} ${timeStr || ""}`.trim() };
  }
}

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\'/g, "&#39;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(
      JSON.stringify({ error: "missing_env" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const { booking_id } = body;
    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: "missing_booking_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch booking + therapist + service in one go. Booking has client
    // info denormalized (client_name, client_email, client_phone) so we
    // do not need to join clients here.
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("*, therapists(*), services(*)")
      .eq("id", booking_id)
      .maybeSingle();

    if (bErr || !booking) {
      console.error("send-booking-confirmation: booking lookup failed", bErr);
      return new Response(
        JSON.stringify({ error: "booking_not_found", details: bErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const therapist = booking.therapists;
    const service = booking.services;
    if (!therapist) {
      return new Response(
        JSON.stringify({ error: "therapist_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tz = therapist.timezone || "America/Chicago";
    const apt = formatAppointment(booking.booking_date, booking.start_time, tz);
    const therapistName = therapist.business_name || therapist.full_name || "Your therapist";
    const therapistFirstName = (therapist.full_name || therapistName).split(" ")[0];
    const clientName = booking.client_name || "Client";
    const clientFirstName = clientName.split(" ")[0];
    const clientEmail = booking.client_email;
    // Service price/name come from the joined services row. Bookings
    // table only has service_id, not denormalized name/price.
    const serviceName = service?.name || "Massage session";
    const servicePrice = service?.price;
    const intakeUrl = `https://mybodymap.app/${therapist.custom_url}?name=${encodeURIComponent(clientName)}&email=${encodeURIComponent(clientEmail || "")}&booking_id=${booking.id}`;
    const dashboardUrl = `https://mybodymap.app/dashboard`;
    // Status uses hyphenated forms in the DB: 'pending-approval',
    // 'pending-deposit', 'confirmed', 'cancelled'
    const status = booking.status || "confirmed";
    const isPendingApproval = status === "pending-approval";

    const results: Record<string, any> = { client_email: null, therapist_email: null };

    // ---------- 1. CLIENT CONFIRMATION EMAIL ----------
    if (clientEmail && shouldSend(therapist, "client", "booking_confirmation", "email")) {
      const subject = isPendingApproval
        ? `Request received: ${serviceName} with ${therapistName}`
        : `Booking confirmed: ${serviceName} with ${therapistName}`;

      const headerLine = isPendingApproval
        ? "Your request was received"
        : "Your booking is confirmed";

      const subText = isPendingApproval
        ? `${therapistFirstName} will review and reply soon. Most replies come within 24 hours.`
        : `We will see you on ${escapeHtml(apt.date)} at ${escapeHtml(apt.time)}.`;

      const policyHtml = (therapist.cancellation_policy_enabled && therapist.cancellation_policy)
        ? `
          <div style="background:${C.cream};border:1px solid ${C.beige};border-radius:10px;padding:14px 16px;margin:16px 0;">
            <div style="font-size:12px;font-weight:700;color:${C.rose};margin-bottom:6px;">CANCELLATION POLICY</div>
            <div style="font-size:13px;color:${C.ink};line-height:1.6;">
              Need to change plans? Please let ${escapeHtml(therapistFirstName)} know as early as possible. Late cancellations and no-shows may be charged per the policy you agreed to at booking.
            </div>
          </div>
        `
        : "";

      const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:${C.beige};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${C.ink};">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="width:64px;height:64px;border-radius:50%;background:${C.cream};display:inline-flex;align-items:center;justify-content:center;font-size:32px;line-height:64px;">🌿</div>
      </div>
      <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:${C.forest};margin:0 0 8px;text-align:center;">${headerLine}</h1>
      <p style="font-size:14px;color:${C.gray};text-align:center;margin:0 0 24px;line-height:1.6;">${subText}</p>

      <div style="background:${C.cream};border-radius:12px;padding:20px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${C.gray};margin-bottom:10px;">Your booking</div>
        <div style="font-size:15px;font-weight:700;color:${C.ink};margin-bottom:6px;">${escapeHtml(serviceName)}</div>
        <div style="font-size:14px;color:${C.gray};line-height:1.7;">
          ${escapeHtml(apt.full)}<br/>
          with ${escapeHtml(therapistName)}
          ${servicePrice ? `<br/>$${servicePrice}` : ""}
        </div>
      </div>

      ${status !== "pending_approval" ? `
      <div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:12px;padding:18px 20px;margin-bottom:20px;">
        <div style="font-size:13px;font-weight:700;color:${C.forest};margin-bottom:6px;">📋 Save time, fill your intake now</div>
        <div style="font-size:13px;color:${C.ink};line-height:1.6;margin-bottom:12px;">
          Filling your body map ahead of time means you are ready the moment you arrive.
        </div>
        <a href="${intakeUrl}" style="display:inline-block;background:${C.forest};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;">Fill my intake form</a>
      </div>
      ` : ""}

      ${policyHtml}

      <div style="font-size:12px;color:${C.gray};text-align:center;margin-top:24px;line-height:1.6;">
        Questions? Reply to this email and ${escapeHtml(therapistFirstName)} will get back to you.
      </div>
    </div>
    <div style="text-align:center;margin-top:16px;font-size:11px;color:${C.gray};">
      Sent by ${escapeHtml(therapistName)} via MyBodyMap
    </div>
  </div>
</body></html>`;

      const fromAddr = `${therapistName} <reminders@mybodymap.app>`;
      const replyTo = therapist.email || undefined;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: fromAddr,
            to: [clientEmail],
            ...(replyTo ? { reply_to: replyTo } : {}),
            subject,
            html,
          }),
        });
        const data = await res.json();
        results.client_email = { ok: res.ok, id: data?.id, error: res.ok ? null : data };

        await supabase.from("notification_log").insert({
          therapist_id: therapist.id,
          notification_type: isPendingApproval ? "booking_request_received" : "booking_confirmation",
          audience: "client",
          channel: "email",
          recipient: clientEmail,
          status: res.ok ? "sent" : "failed",
          provider_id: data?.id || null,
          subject,
          body_snippet: `${serviceName} on ${apt.date}`,
          booking_id: booking.id,
        });
      } catch (e) {
        console.error("Client email send failed:", e);
        results.client_email = { ok: false, error: String(e) };
      }
    } else {
      results.client_email = { skipped: !clientEmail ? "no_email" : "pref_off" };
    }

    // ---------- 2. THERAPIST "NEW BOOKING" EMAIL ----------
    if (therapist.email && shouldSend(therapist, "therapist", "new_booking", "email")) {
      const subject = isPendingApproval
        ? `New booking REQUEST: ${clientName} wants ${serviceName}`
        : `New booking: ${clientName} booked ${serviceName}`;

      const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:${C.beige};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${C.ink};">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${C.gray};margin-bottom:8px;">${isPendingApproval ? "New request" : "New booking"}</div>
      <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:${C.forest};margin:0 0 4px;">${escapeHtml(clientName)}</h1>
      <p style="font-size:14px;color:${C.gray};margin:0 0 20px;">${isPendingApproval ? "Wants to book" : "Just booked"} ${escapeHtml(serviceName)}</p>

      <div style="background:${C.cream};border-radius:12px;padding:18px;margin-bottom:18px;font-size:14px;color:${C.ink};line-height:1.8;">
        <strong>When:</strong> ${escapeHtml(apt.full)}<br/>
        <strong>Service:</strong> ${escapeHtml(serviceName)}${servicePrice ? ` ($${servicePrice})` : ""}<br/>
        <strong>Email:</strong> <a href="mailto:${escapeHtml(clientEmail || "")}" style="color:${C.forest};">${escapeHtml(clientEmail || "(not provided)")}</a>
        ${booking.client_phone ? `<br/><strong>Phone:</strong> <a href="tel:${escapeHtml(booking.client_phone)}" style="color:${C.forest};">${escapeHtml(booking.client_phone)}</a>` : ""}
      </div>

      <a href="${dashboardUrl}" style="display:inline-block;background:${C.forest};color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:13px;font-weight:700;">Open dashboard</a>

      <div style="font-size:11px;color:${C.gray};margin-top:24px;line-height:1.6;">
        You are getting this because "New booking came in" is on in your notification settings.
      </div>
    </div>
  </div>
</body></html>`;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "MyBodyMap <reminders@mybodymap.app>",
            to: [therapist.email],
            subject,
            html,
          }),
        });
        const data = await res.json();
        results.therapist_email = { ok: res.ok, id: data?.id, error: res.ok ? null : data };

        await supabase.from("notification_log").insert({
          therapist_id: therapist.id,
          notification_type: "new_booking",
          audience: "therapist",
          channel: "email",
          recipient: therapist.email,
          status: res.ok ? "sent" : "failed",
          provider_id: data?.id || null,
          subject,
          body_snippet: `${clientName} booked ${serviceName} on ${apt.date}`,
          booking_id: booking.id,
        });
      } catch (e) {
        console.error("Therapist email send failed:", e);
        results.therapist_email = { ok: false, error: String(e) };
      }
    } else {
      results.therapist_email = { skipped: !therapist.email ? "no_email" : "pref_off" };
    }

    return new Response(
      JSON.stringify({ ok: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("send-booking-confirmation error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
