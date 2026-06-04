// supabase/functions/send-booking-confirmation/index.ts
//
// Fired after a booking is created (or approved, or deposit-paid) to:
//   1. Send confirmation email to the CLIENT  (if therapist's notification_prefs.client.booking_confirmation.email is on)
//   2. Send "new booking" notification to the THERAPIST (if notification_prefs.therapist.new_booking.email is on)
//   3. Log every attempt (including skips and failures) to notification_log
//
// VERBOSE LOGGING: Every decision point logs to console.log so we can
// trace exactly what happened in Supabase Edge Function logs. The
// previous version was silent on success and we had a Lindsey Thomas
// case where the function returned 200 but no emails landed and no
// Resend record existed. Could not diagnose without re-running with
// added prints. This version makes that scenario impossible.
//
// Defaults are conservative: if notification_prefs is missing or the
// specific channel boolean is missing, we still send (because that
// matches the Settings UI default-on state). Therapist must explicitly
// opt out for an email to be skipped.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyTherapist } from "../_shared/notifications.ts";
import { renderClientEmailDoc } from "../_shared/clientEmail.ts";

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
function shouldSend(therapist: any, audience: string, type: string, channel: string): { send: boolean; reason: string } {
  const prefs = therapist?.notification_prefs;
  if (!prefs) return { send: true, reason: "no_prefs_default_on" };
  // Supabase JSONB usually returns a parsed object, but if it returns
  // a JSON string somehow, parse it.
  let parsed: any = prefs;
  if (typeof prefs === "string") {
    try {
      parsed = JSON.parse(prefs);
    } catch (_e) {
      return { send: true, reason: "prefs_unparseable_default_on" };
    }
  }
  if (!parsed || typeof parsed !== "object") return { send: true, reason: "prefs_not_object_default_on" };
  const a = parsed[audience];
  if (!a || typeof a !== "object") return { send: true, reason: `${audience}_missing_default_on` };
  const t = a[type];
  if (!t || typeof t !== "object") return { send: true, reason: `${audience}.${type}_missing_default_on` };
  if (typeof t[channel] !== "boolean") return { send: true, reason: `${audience}.${type}.${channel}_missing_default_on` };
  if (t[channel]) return { send: true, reason: "pref_explicit_on" };
  return { send: false, reason: "pref_explicit_off" };
}

function formatAppointment(dateStr: string, timeStr: string, _tz: string = "America/Chicago"): { date: string; time: string; full: string } {
  try {
    const isoStr = `${dateStr}T${(timeStr || "00:00:00").slice(0, 8)}`;
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) {
      return { date: dateStr, time: timeStr || "", full: `${dateStr} ${timeStr || ""}`.trim() };
    }
    const date = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
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
    .replace(/'/g, "&#39;");
}

// RFC 5322: display names with special characters need to be quoted.
// Quote always (defensive). Escape any embedded quotes in the name.
function quotedFrom(displayName: string, email: string): string {
  const safe = String(displayName || "").replace(/"/g, "");
  return `"${safe}" <${email}>`;
}

// Send a Resend email and capture the response carefully. Returns
// { ok, status, id?, errorBody? } where errorBody is the raw text
// of the response if Resend did not return success JSON.
async function resendSend(apiKey: string, payload: any): Promise<{ ok: boolean; status: number; id?: string; errorBody?: string; rawText?: string }> {
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("[resend] fetch threw:", String(e));
    return { ok: false, status: 0, errorBody: `fetch_threw: ${String(e)}` };
  }

  const status = res.status;
  // Read as text first so we never crash on non-JSON responses.
  let text = "";
  try { text = await res.text(); } catch (_e) { text = ""; }

  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch (_e) { parsed = null; }

  if (res.ok && parsed?.id) {
    return { ok: true, status, id: parsed.id, rawText: text.slice(0, 200) };
  }
  return { ok: false, status, errorBody: text.slice(0, 500), rawText: text.slice(0, 500) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  console.log("[send-booking-confirmation] invoked", {
    has_resend_key: !!RESEND_API_KEY,
    has_supabase_url: !!SUPABASE_URL,
    has_service_key: !!SUPABASE_SERVICE_KEY,
  });

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("[fatal] missing env vars");
    return new Response(
      JSON.stringify({ error: "missing_env", detail: { resend: !!RESEND_API_KEY, url: !!SUPABASE_URL, key: !!SUPABASE_SERVICE_KEY } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const debug: Record<string, any> = {};

  try {
    const body = await req.json();
    // Accept either {booking_id: "..."} (frontend fire-and-forget call)
    // or {type: "INSERT", record: {id: "..."}} (Supabase Database Webhook).
    // The webhook fires automatically on every bookings INSERT — that path
    // is the bulletproof one because it does not depend on any frontend
    // wiring. The frontend call still works as a fallback for legacy or
    // out-of-band booking creation.
    const booking_id = body.booking_id || body.record?.id || body.old_record?.id;
    debug.booking_id = booking_id;
    debug.payload_shape = body.booking_id ? "frontend" : (body.record ? "db_webhook" : "unknown");
    console.log("[step] received payload, shape:", debug.payload_shape, "booking_id:", booking_id);

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: "missing_booking_id", received_keys: Object.keys(body) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For DB webhook, only fire on INSERT — UPDATE webhooks would re-send
    // confirmations every time the booking is touched, which is wrong.
    // The webhook also fires for status changes (deposit-paid, cancelled,
    // etc.) which we handle elsewhere.
    if (body.type && body.type !== "INSERT") {
      console.log("[skip] ignoring webhook type:", body.type);
      return new Response(
        JSON.stringify({ ok: true, skipped: "non_insert_webhook", type: body.type }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("*, therapists(*), services(*), location:therapist_locations(*)")
      .eq("id", booking_id)
      .maybeSingle();

    if (bErr || !booking) {
      console.error("[error] booking lookup failed", { bErr: bErr?.message, booking_id });
      return new Response(
        JSON.stringify({ error: "booking_not_found", details: bErr?.message, debug }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const therapist = booking.therapists;
    const service = booking.services;
    debug.therapist_id = therapist?.id || null;
    debug.therapist_email = therapist?.email || null;
    debug.therapist_name = therapist?.business_name || therapist?.full_name || null;
    debug.service_name = service?.name || null;
    debug.client_email = booking.client_email || null;
    debug.booking_status = booking.status || null;
    debug.has_notification_prefs = !!therapist?.notification_prefs;
    debug.notification_prefs_type = typeof therapist?.notification_prefs;

    console.log("[step] booking loaded", debug);

    if (!therapist) {
      return new Response(
        JSON.stringify({ error: "therapist_not_found", debug }),
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
    const serviceName = service?.name || "Massage session";
    const servicePrice = service?.price;
    // HK Jun 3 2026: the confirmation price must include add-ons, not just
    // the base service price. A $1 service with a $1 add-on was showing $1
    // in the email. addon_total_price is stored in dollars on the booking.
    const addonTotalPrice = Number(booking.addon_total_price) || 0;
    const displayPrice = (typeof servicePrice === "number" ? servicePrice : 0) + addonTotalPrice;
    const displayPriceStr = Number.isInteger(displayPrice) ? String(displayPrice) : displayPrice.toFixed(2);
    const intakeUrl = `https://mybodymap.app/${therapist.custom_url}?name=${encodeURIComponent(clientName)}&email=${encodeURIComponent(clientEmail || "")}&booking_id=${booking.id}`;
    const dashboardUrl = `https://mybodymap.app/dashboard`;
    // HK May 25 2026: pending-approval bookings should send the
    // therapist to /dashboard/schedule where the Pending Requests
    // panel lives at the top, NOT /dashboard which is the home tab.
    // Confirmed bookings still go to home dashboard.
    const therapistCtaUrl = `https://mybodymap.app/dashboard/schedule`;
    const status = booking.status || "confirmed";
    const isPendingApproval = status === "pending-approval";

    // Multi-location (HK May 18 2026): build display strings for the
    // booked location. NULL when therapist has no locations set up or
    // the booking pre-dates multi-location; in that case all the
    // location_* fields below stay empty and the email renders without
    // a location block, exactly as before.
    const location = (booking as any).location || null;
    const locationName = location?.name || null;
    const locationAddress = location
      ? [location.street1, location.street2, location.city, location.state, location.postal_code]
          .filter(Boolean).join(", ")
      : null;
    const locationNotes = location?.notes || null;

    const results: Record<string, any> = { client_email: null, therapist_email: null };

    // ---------- 1. CLIENT CONFIRMATION EMAIL ----------
    {
      const decision = shouldSend(therapist, "client", "booking_confirmation", "email");
      const hasEmail = !!clientEmail;
      console.log("[client_email] decision", { hasEmail, decision });
      debug.client_decision = { hasEmail, ...decision };

      if (!hasEmail) {
        results.client_email = { skipped: "no_client_email" };
        await supabase.from("notification_log").insert({
          therapist_id: therapist.id,
          notification_type: "booking_confirmation",
          audience: "client",
          channel: "email",
          recipient: null,
          status: "skipped",
          subject: "(skipped: no client email)",
          body_snippet: `Booking ${booking.id} had no client_email`,
          booking_id: booking.id,
        }).then((r: any) => { if (r.error) console.error("[log] skip insert failed", r.error); });
      } else if (!decision.send) {
        results.client_email = { skipped: "pref_off", reason: decision.reason };
        await supabase.from("notification_log").insert({
          therapist_id: therapist.id,
          notification_type: "booking_confirmation",
          audience: "client",
          channel: "email",
          recipient: clientEmail,
          status: "skipped",
          subject: `(skipped: ${decision.reason})`,
          body_snippet: `Therapist has booking_confirmation.email turned off`,
          booking_id: booking.id,
        }).then((r: any) => { if (r.error) console.error("[log] skip insert failed", r.error); });
      } else {
        // HK May 29 2026: per EMAIL_COPY_SPEC C1. Welcoming, set
        // expectation for the intake, single CTA to fill it. The
        // policy note when therapist has cancellation_policy_enabled
        // renders inline so the client sees what they're agreeing to.
        const policyText = (therapist.cancellation_policy_enabled && therapist.cancellation_policy)
          ? `Need to change plans? Please let ${therapistFirstName} know as early as possible. Late cancellations and no-shows may be charged per the policy you agreed to at booking.`
          : null;

        const subject = isPendingApproval
          ? `Request received: ${serviceName} with ${therapistName}`
          : `Your session with ${therapistFirstName} is confirmed`;

        const title = isPendingApproval
          ? `Your request was received`
          : `Your session is confirmed`;

        const opener = isPendingApproval
          ? `Hi ${clientFirstName || 'there'}, your booking request for ${serviceName} has come through. ${therapistFirstName} will review and reply within a day. Here are the details I have so far.`
          : `Hi ${clientFirstName || 'there'}, looking forward to seeing you. Here are the details for your records.`;

        const fullLocation = locationAddress
          ? (locationName ? `${locationName}, ${locationAddress}` : locationAddress)
          : (locationName || null);

        const extraRows: Array<{ label: string, value: string }> = [];
        if (displayPrice > 0) {
          extraRows.push({ label: 'Price', value: `$${displayPriceStr}` });
        }

        const html = renderClientEmailDoc(subject, {
          therapist,
          toneEyebrow: isPendingApproval ? 'Booking request' : 'Session confirmed',
          toneEyebrowKind: 'sage',
          title,
          opener,
          serviceName,
          bookingDate: booking.booking_date,
          startTime: booking.start_time,
          durationMin: service?.duration || null,
          locationAddress: fullLocation,
          extraFactRows: extraRows,
          policyInline: policyText,
          primaryCta: isPendingApproval ? null : { label: 'Fill my intake form', href: intakeUrl },
          // HK May 31 2026: secondary CTA pointed at /manage?b=... which
          // is not yet wired for clients to self-reschedule/cancel.
          // Removed to stop sending dead links. Clients can reply to the
          // email if they need to change anything; the closing line
          // already invites that.
          secondaryCta: null,
          closingLine: isPendingApproval
            ? `Reply to this email if you'd like to add a note for ${therapistFirstName}.`
            : `Filling your intake ahead of time means you're ready the moment you arrive. Questions? Just reply to this email.`,
          prefName: isPendingApproval ? 'Booking request received' : 'Booking confirmation',
        }, isPendingApproval
            ? `${therapistFirstName} will review and reply soon.`
            : `Your ${serviceName} on ${apt.full}.`);

        const fromAddr = quotedFrom(therapistName, "reminders@mybodymap.app");
        const replyTo = therapist.email || undefined;

        console.log("[client_email] sending via Resend", { to: clientEmail, from: fromAddr, replyTo });
        const sendResult = await resendSend(RESEND_API_KEY, {
          from: fromAddr,
          to: [clientEmail],
          ...(replyTo ? { reply_to: replyTo } : {}),
          subject,
          html,
        });
        console.log("[client_email] resend result", sendResult);
        results.client_email = sendResult;

        await supabase.from("notification_log").insert({
          therapist_id: therapist.id,
          notification_type: isPendingApproval ? "booking_request_received" : "booking_confirmation",
          audience: "client",
          channel: "email",
          recipient: clientEmail,
          status: sendResult.ok ? "sent" : "failed",
          provider_id: sendResult.id || null,
          subject,
          body_snippet: sendResult.ok ? `${serviceName} on ${apt.date}` : null,
          // HK May 25 2026: error_message captures the Resend error
          // body so we can diagnose failures from the audit query
          // instead of inferring from body_snippet (which was the
          // prior workaround). status=failed without an
          // error_message used to leave us flying blind on 100+
          // production failures this month.
          error_message: sendResult.ok ? null : `HTTP ${sendResult.status}: ${(sendResult.errorBody || "no body").slice(0, 400)}`,
          booking_id: booking.id,
        }).then((r: any) => { if (r.error) console.error("[log] insert failed", r.error); });
      }
    }

    // ---------- 2. THERAPIST "NEW BOOKING" EMAIL ----------
    {
      const decision = shouldSend(therapist, "therapist", "new_booking", "email");
      const hasEmail = !!therapist.email;
      console.log("[therapist_email] decision", { hasEmail, decision });
      debug.therapist_decision = { hasEmail, ...decision };

      if (!hasEmail) {
        results.therapist_email = { skipped: "no_therapist_email" };
        await supabase.from("notification_log").insert({
          therapist_id: therapist.id,
          notification_type: "new_booking",
          audience: "therapist",
          channel: "email",
          recipient: null,
          status: "skipped",
          subject: "(skipped: therapist has no email on file)",
          body_snippet: `Therapist record missing email column`,
          booking_id: booking.id,
        }).then((r: any) => { if (r.error) console.error("[log] skip insert failed", r.error); });
      } else if (!decision.send) {
        results.therapist_email = { skipped: "pref_off", reason: decision.reason };
        await supabase.from("notification_log").insert({
          therapist_id: therapist.id,
          notification_type: "new_booking",
          audience: "therapist",
          channel: "email",
          recipient: therapist.email,
          status: "skipped",
          subject: `(skipped: ${decision.reason})`,
          body_snippet: `Therapist has new_booking.email turned off`,
          booking_id: booking.id,
        }).then((r: any) => { if (r.error) console.error("[log] skip insert failed", r.error); });
      } else {
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
        <strong>Service:</strong> ${escapeHtml(serviceName)}${displayPrice > 0 ? ` ($${displayPriceStr})` : ""}<br/>
        ${locationName ? `<strong>Location:</strong> ${escapeHtml(locationName)}${locationAddress ? ` (${escapeHtml(locationAddress)})` : ""}<br/>` : ""}
        <strong>Email:</strong> <a href="mailto:${escapeHtml(clientEmail || "")}" style="color:${C.forest};">${escapeHtml(clientEmail || "(not provided)")}</a>
        ${booking.client_phone ? `<br/><strong>Phone:</strong> <a href="tel:${escapeHtml(booking.client_phone)}" style="color:${C.forest};">${escapeHtml(booking.client_phone)}</a>` : ""}
      </div>

      <a href="${isPendingApproval ? therapistCtaUrl : dashboardUrl}" style="display:inline-block;background:${C.forest};color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:13px;font-weight:700;">${isPendingApproval ? "Review request" : "Open dashboard"}</a>

      <div style="font-size:11px;color:${C.gray};margin-top:24px;line-height:1.6;">
        You are getting this because "New booking came in" is on in your notification settings.
      </div>
    </div>
  </div>
</body></html>`;

        const fromAddr = quotedFrom("MyBodyMap", "reminders@mybodymap.app");
        console.log("[therapist_email] sending via Resend", { to: therapist.email, from: fromAddr });
        const sendResult = await resendSend(RESEND_API_KEY, {
          from: fromAddr,
          to: [therapist.email],
          subject,
          html,
        });
        console.log("[therapist_email] resend result", sendResult);
        results.therapist_email = sendResult;

        await supabase.from("notification_log").insert({
          therapist_id: therapist.id,
          notification_type: "new_booking",
          audience: "therapist",
          channel: "email",
          recipient: therapist.email,
          status: sendResult.ok ? "sent" : "failed",
          provider_id: sendResult.id || null,
          subject,
          body_snippet: sendResult.ok ? `${clientName} booked ${serviceName} on ${apt.date}` : null,
          error_message: sendResult.ok ? null : `HTTP ${sendResult.status}: ${(sendResult.errorBody || "no body").slice(0, 400)}`,
          booking_id: booking.id,
        }).then((r: any) => { if (r.error) console.error("[log] insert failed", r.error); });
      }
    }

    // ─── 3. THERAPIST "NEW CLIENT SIGNUP" NOTIFICATION ──────────────
    //
    // Fire only when this booking represents a brand-new client
    // identity (no prior bookings under the same email+therapist).
    // Repeat clients booking again should NOT trigger this.
    //
    // Definition: count all bookings for this therapist with the
    // same client_email (case-insensitive). If count is exactly 1,
    // this is the first one, and we treat the client as new.
    // HK May 25 2026: SKIP this notification when the booking is
    // pending-approval. Previously it fired regardless, and the copy
    // said "just booked their first session with you" - which is
    // misleading when the booking is actually awaiting therapist
    // approval. The therapist already received a "New booking
    // REQUEST" email from the main flow above. Firing this duplicate
    // confused therapists into thinking the booking was confirmed.
    try {
      const normalizedEmail = (booking.client_email || "").trim().toLowerCase();
      if (normalizedEmail && !isPendingApproval) {
        const { count } = await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("therapist_id", therapist.id)
          .ilike("client_email", normalizedEmail);

        if (count === 1) {
          const title = `New client: ${clientName}`;
          const summary = `${clientName} just booked their first session with you (${serviceName} on ${apt.date}).`;
          const emailHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0D1F17;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6B9E80;margin-bottom:8px;">✨ First-time client</div>
      <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#2A5741;margin:0 0 6px;">${escapeHtml(clientName)}</h1>
      <p style="font-size:14px;color:#6B7280;margin:0 0 18px;line-height:1.6;">${summary}</p>
      <a href="https://mybodymap.app/dashboard/schedule" style="display:inline-block;background:#2A5741;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:13px;font-weight:700;">View on schedule</a>
      <div style="font-size:11px;color:#9CA3AF;margin-top:24px;line-height:1.6;">
        You are getting this because "New client signup" is on in your notification settings.
      </div>
    </div>
  </div>
</body></html>`;
          await notifyTherapist({
            supabase, therapist,
            eventType: "new_client_signup",
            title,
            body: summary,
            icon: "✨",
            linkUrl: "/dashboard/schedule",
            payload: {
              client_name: clientName,
              client_email: clientEmail,
              booking_id: booking.id,
              service_name: serviceName,
            },
            emailSubject: `New client: ${clientName} just booked you`,
            emailHtml,
            smsText: `MyBodyMap: ${clientName} booked their first session with you (${serviceName} on ${apt.date}).`,
            bookingId: booking.id,
          });
          debug.fired_new_client_signup = true;
        }
      }
    } catch (newClientErr) {
      console.warn("[new_client_signup] non-blocking error:", newClientErr);
    }

    console.log("[done] returning ok", { results, debug });
    return new Response(
      JSON.stringify({ ok: true, results, debug }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[fatal] uncaught error:", String(err));
    return new Response(
      JSON.stringify({ error: String(err), debug }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
