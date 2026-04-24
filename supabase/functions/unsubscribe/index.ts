// Unsubscribe edge function.
// URL: POST /functions/v1/unsubscribe  { token, reason? }
//
// Called from the public /unsubscribe page on mybodymap.app.
// No JWT required (gateway bypassed via no-verify-jwt in workflow), we
// authenticate via the HMAC-signed token only.
//
// Side effects when a valid token is posted:
//   1. Flips email_unsubscribed=true on the therapist row
//   2. Logs to notification_log
//   3. Sends a notification email to bodymap01@gmail.com so the founder
//      sees the opt-out in real time
//   4. Returns { ok: true, email } so the page can confirm.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyUnsubToken } from "../_shared/unsubscribe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const FOUNDER_BCC = "bodymapdemo@gmail.com";
const FOUNDER_NOTIFY = "bodymap01@gmail.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const fail = (error: string, step: string) =>
    json({ ok: false, error, step }, 200);

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return fail("Supabase env not set", "env_check");
    }

    let token: string | null = null;
    let reason: string | null = null;

    if (req.method === "GET") {
      // Support direct GET with ?token=... for link clicks that do a direct
      // form-less unsubscribe (e.g., email clients that unfurl links).
      const url = new URL(req.url);
      token = url.searchParams.get("token");
    } else if (req.method === "POST") {
      let body: any;
      try { body = await req.json(); } catch { return fail("Invalid JSON", "parse"); }
      token = body?.token || null;
      reason = typeof body?.reason === "string" ? body.reason.slice(0, 500) : null;
    } else {
      return fail("Method not allowed", "method");
    }

    if (!token) return fail("Missing token", "validation");

    const therapistId = await verifyUnsubToken(token);
    if (!therapistId) return fail("Invalid or tampered token", "auth");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: therapist, error: tErr } = await admin
      .from("therapists")
      .select("id,email,full_name,business_name,email_unsubscribed")
      .eq("id", therapistId)
      .single();

    if (tErr) return fail(tErr.message, "load_therapist");
    if (!therapist) return fail("Therapist not found", "load_therapist");

    const alreadyUnsubscribed = !!therapist.email_unsubscribed;

    if (!alreadyUnsubscribed) {
      const { error: updErr } = await admin
        .from("therapists")
        .update({
          email_unsubscribed: true,
          email_unsubscribed_at: new Date().toISOString(),
          email_unsubscribe_reason: reason,
        })
        .eq("id", therapistId);

      if (updErr) return fail(updErr.message, "update_flag");

      // Log to notification_log (best-effort)
      try {
        await admin.from("notification_log").insert({
          therapist_id: therapistId,
          notification_type: "unsubscribe",
          audience: "therapist",
          channel: "email",
          recipient: therapist.email,
          status: "sent",
          provider_id: null,
          error_message: reason ? `reason: ${reason}` : null,
        });
      } catch (_e) { /* non-blocking */ }

      // Real-time founder notification
      if (RESEND_API_KEY) {
        try {
          const name = therapist.business_name || therapist.full_name || therapist.email;
          const html = `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:24px auto;padding:24px;background:#FFF9F3;border:1px solid #E8E4DC;border-radius:12px;color:#1F2937;line-height:1.6;font-size:14px">
  <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;color:#B44A3A;text-transform:uppercase;margin-bottom:10px">Founder alert</div>
  <div style="font-family:Georgia,serif;font-size:18px;font-weight:700;margin-bottom:8px">${escapeHtml(name)} unsubscribed</div>
  <div>${escapeHtml(therapist.email)} just unsubscribed from MyBodyMap marketing emails.</div>
  ${reason ? `<div style="margin-top:10px;padding:10px 12px;background:#fff;border-radius:6px;border:1px solid #E8E4DC;font-size:13px"><strong>Reason:</strong> ${escapeHtml(reason)}</div>` : ""}
  <div style="margin-top:16px;font-size:12px;color:#6B7280">They will no longer receive founder nudges, drip emails, or Practice Pulse. Transactional emails (welcome, booking confirmations) still go through.</div>
</div>`;
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "MyBodyMap Team <reminders@mybodymap.app>",
              to: [FOUNDER_NOTIFY],
              bcc: [FOUNDER_BCC],
              subject: `Unsubscribe: ${name}`,
              html,
              text: `${name} (${therapist.email}) just unsubscribed from MyBodyMap marketing emails.${reason ? `\n\nReason: ${reason}` : ""}`,
            }),
          });
        } catch (_e) { /* non-blocking */ }
      }
    }

    return json({
      ok: true,
      email: therapist.email,
      already_unsubscribed: alreadyUnsubscribed,
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "unhandled", step: "catch_all" }, 200);
  }
});

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
