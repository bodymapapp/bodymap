// Founder outreach. Admin-only edge function.
// Sends a branded BodyMap email to a therapist from reminders@mybodymap.app
// with reply-to bodymap01@gmail.com. Logs the send to notification_log.
//
// Request body: { therapist_id: string, action_type: 'welcome'|'checkin'|'reminder'|'testimonial' }
//
// Auth: caller JWT must belong to an ADMIN_EMAILS address. Non-admins get 403.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAILS = new Set([
  "bodymap01@gmail.com",
  "bodymapdemo@gmail.com",
  "harshk.mba@gmail.com",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const FROM = "BodyMap Founder <reminders@mybodymap.app>";
const REPLY_TO = "bodymap01@gmail.com";

type ActionType = "welcome" | "checkin" | "reminder" | "testimonial" | "first_session" | "setup_nudge" | "churned" | "referral_thankyou";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Decode the JWT payload. Safe because Supabase gateway already verified signature
// before this function ran (verify_jwt is on by default).
function decodeJwt(jwt: string): any {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const payload = atob(b64);
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function firstName(fullName: string | null | undefined): string {
  return (fullName || "").split(" ")[0] || "there";
}

function buildMessage(
  action: ActionType,
  t: { full_name: string | null; days_on_platform: number; days_since_use: number | null; sessions_total: number }
): { subject: string; text: string; html: string } {
  const name = firstName(t.full_name);

  const templates: Record<ActionType, { subject: string; lines: string[] }> = {
    welcome: {
      subject: `Welcome to BodyMap, ${name}`,
      lines: [
        `Hi ${name},`,
        ``,
        `I'm the founder. Just wanted to say welcome to BodyMap personally.`,
        ``,
        `If you have 30 seconds, what brought you in? Anything I can help with to get you set up?`,
        ``,
        `MyBodyMap`,
      ],
    },
    checkin: {
      subject: `Checking in, ${name}`,
      lines: [
        `Hi ${name},`,
        ``,
        `I'm the founder of BodyMap. I saw you signed up ${t.days_on_platform} days ago but haven't added a client yet.`,
        ``,
        `What's in the way? I'd love to help you get your first client imported so you can see the platform in action.`,
        ``,
        `MyBodyMap`,
      ],
    },
    reminder: {
      subject: `Haven't seen you in a bit, ${name}`,
      lines: [
        `Hi ${name},`,
        ``,
        `Noticed it's been ${t.days_since_use ?? "a while"} days since you last used BodyMap. Everything okay?`,
        ``,
        `Is there something friction-y getting in the way, or just busy? Either way I'd love to hear.`,
        ``,
        `MyBodyMap`,
      ],
    },
    testimonial: {
      subject: `Quick favor, ${name}?`,
      lines: [
        `Hi ${name},`,
        ``,
        `You've logged ${t.sessions_total} sessions on BodyMap. That's amazing.`,
        ``,
        `Would you be open to sharing a one or two sentence testimonial about what BodyMap does for your practice? I'd like to feature it on the homepage.`,
        ``,
        `No pressure. And thank you either way.`,
        ``,
        `MyBodyMap`,
      ],
    },
    first_session: {
      subject: `Congrats on your first session, ${name}`,
      lines: [
        `Hi ${name},`,
        ``,
        `Just saw you logged your first session on BodyMap. That's a real moment. Your practice now has a memory it didn't have yesterday.`,
        ``,
        `A small suggestion: next time that client books, open their body map before they walk in. You'll know where they hold tension, what pressure they like, what to avoid. That thirty seconds is what turns a first-timer into a regular.`,
        ``,
        `I'm here if you hit any bumps.`,
        ``,
        `MyBodyMap`,
      ],
    },
    setup_nudge: {
      subject: `One quick thing to finish, ${name}`,
      lines: [
        `Hi ${name},`,
        ``,
        `Noticed you've been using BodyMap for ${t.days_on_platform} days but haven't connected your payment account or calendar yet.`,
        ``,
        `Without these, clients can't book or pay you through your BodyMap link. Both take about a minute each from Settings.`,
        ``,
        `Want me to walk you through it? Happy to.`,
        ``,
        `MyBodyMap`,
      ],
    },
    churned: {
      subject: `Are you still with us, ${name}?`,
      lines: [
        `Hi ${name},`,
        ``,
        `It's been ${t.days_since_use ?? "over a month"} days since you last logged into BodyMap. I'm not writing to push you back in. I'm writing to understand why.`,
        ``,
        `If BodyMap didn't fit your practice, I'd genuinely love to know. Was it the interface? A missing feature? Something else?`,
        ``,
        `One sentence back would help me build something better for therapists like you. Thank you.`,
        ``,
        `MyBodyMap`,
      ],
    },
    referral_thankyou: {
      subject: `Thank you for the referral, ${name}`,
      lines: [
        `Hi ${name},`,
        ``,
        `Someone just signed up through your link. That means a lot.`,
        ``,
        `You're helping another therapist find a platform that actually works for how they practice. I don't take that lightly.`,
        ``,
        `If there's anything I can do to make BodyMap better for you, reply and tell me.`,
        ``,
        `MyBodyMap`,
      ],
    },
  };

  const tpl = templates[action];
  const text = tpl.lines.join("\n");

  const html = `
<div style="font-family:Georgia,serif;max-width:560px;margin:24px auto;padding:32px 28px;background:#FFF9F3;border:1px solid #E8E4DC;border-radius:12px;color:#1F2937;line-height:1.6;font-size:15px">
  <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;color:#6B9E80;text-transform:uppercase;margin-bottom:16px">🌿 BodyMap</div>
  ${tpl.lines.map((l) => (l === "" ? "<br/>" : `<div>${escapeHtml(l)}</div>`)).join("")}
  <div style="margin-top:28px;padding-top:18px;border-top:1px solid #E8E4DC;font-size:12px;color:#9CA3AF">
    Reply to this email and it reaches me directly.
  </div>
</div>`.trim();

  return { subject: tpl.subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // We return 200 on handled errors with { ok: false, error, step } so the client
  // can always read the detail. Only unhandled exceptions throw a 500.
  const fail = (error: string, step: string, detail?: unknown) =>
    json({ ok: false, error, step, detail: detail ?? null }, 200);

  try {
    // Env check
    if (!RESEND_API_KEY) return fail("RESEND_API_KEY not set in edge function env", "env_check");
    if (!SUPABASE_URL) return fail("SUPABASE_URL not set", "env_check");
    if (!SUPABASE_SERVICE_KEY) return fail("SUPABASE_SERVICE_ROLE_KEY not set", "env_check");

    // Decode JWT (gateway has already verified signature since verify_jwt is on)
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return fail("Missing Authorization header", "auth");

    const payload = decodeJwt(jwt);
    const callerEmail = (payload?.email || "").toLowerCase();
    if (!callerEmail) return fail("Could not read email from JWT", "auth", { payload_keys: payload ? Object.keys(payload) : null });
    if (!ADMIN_EMAILS.has(callerEmail)) return fail(`${callerEmail} is not in admin allowlist`, "authz");

    // Parse request body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return fail("Invalid JSON body", "parse");
    }
    const { therapist_id, action_type, custom_subject, custom_body } = body || {};
    if (!therapist_id) return fail("therapist_id required", "validation");
    if (!action_type) return fail("action_type required", "validation");
    const validActions: ActionType[] = ["welcome", "checkin", "reminder", "testimonial", "first_session", "setup_nudge", "churned", "referral_thankyou"];
    if (!validActions.includes(action_type)) {
      return fail(`action_type must be one of ${validActions.join(", ")}`, "validation");
    }

    // Load therapist via service role
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: therapist, error: tErr } = await admin
      .from("therapists")
      .select("id,email,full_name,created_at")
      .eq("id", therapist_id)
      .single();

    if (tErr) return fail(tErr.message, "load_therapist");
    if (!therapist) return fail("therapist not found", "load_therapist");
    if (!therapist.email) return fail("therapist has no email on record", "load_therapist");

    // Compute context
    const now = Date.now();
    const signedUpMs = new Date(therapist.created_at).getTime();
    const days_on_platform = Math.max(0, Math.floor((now - signedUpMs) / 86400000));

    const [{ data: lastSession }, { data: lastClient }, { count: sessionsCount }] =
      await Promise.all([
        admin.from("sessions").select("created_at").eq("therapist_id", therapist_id).order("created_at", { ascending: false }).limit(1),
        admin.from("clients").select("created_at").eq("therapist_id", therapist_id).order("created_at", { ascending: false }).limit(1),
        admin.from("sessions").select("*", { count: "exact", head: true }).eq("therapist_id", therapist_id),
      ]);

    const lastAct = Math.max(
      lastSession?.[0]?.created_at ? new Date(lastSession[0].created_at).getTime() : 0,
      lastClient?.[0]?.created_at ? new Date(lastClient[0].created_at).getTime() : 0
    );
    const days_since_use = lastAct > 0 ? Math.floor((now - lastAct) / 86400000) : null;

    const tpl = buildMessage(action_type, {
      full_name: therapist.full_name,
      days_on_platform,
      days_since_use,
      sessions_total: sessionsCount || 0,
    });

    // If caller supplied custom subject/body (from modal edit), use them; else use template.
    const subject = (typeof custom_subject === "string" && custom_subject.trim()) ? custom_subject.trim() : tpl.subject;
    const text = (typeof custom_body === "string" && custom_body.trim()) ? custom_body.trim() : tpl.text;
    // Regenerate HTML from potentially edited text (preserves the branded card).
    const html = `
<div style="font-family:Georgia,serif;max-width:560px;margin:24px auto;padding:32px 28px;background:#FFF9F3;border:1px solid #E8E4DC;border-radius:12px;color:#1F2937;line-height:1.6;font-size:15px">
  <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;color:#6B9E80;text-transform:uppercase;margin-bottom:16px">🌿 BodyMap</div>
  ${text.split("\n").map((l: string) => (l === "" ? "<br/>" : `<div>${escapeHtml(l)}</div>`)).join("")}
  <div style="margin-top:28px;padding-top:18px;border-top:1px solid #E8E4DC;font-size:12px;color:#9CA3AF">
    Reply to this email and it reaches me directly.
  </div>
</div>`.trim();
    const msg = { subject, text, html };

    // Send via Resend
    let resendJson: any = null;
    let resendOk = false;
    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM,
          to: [therapist.email],
          reply_to: REPLY_TO,
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
        }),
      });
      resendJson = await resendRes.json();
      resendOk = resendRes.ok && !!resendJson?.id;
    } catch (e: any) {
      return fail(`Network call to Resend threw: ${e?.message || "unknown"}`, "resend_fetch");
    }

    // Log regardless (best effort)
    try {
      await admin.from("notification_log").insert({
        therapist_id,
        notification_type: `founder_outreach_${action_type}`,
        audience: "therapist",
        channel: "email",
        recipient: therapist.email,
        status: resendOk ? "sent" : "failed",
        provider_id: resendJson?.id || null,
        error_message: resendOk ? null : JSON.stringify(resendJson).slice(0, 500),
      });
    } catch (_e) {
      // non-blocking
    }

    // Side effects on specific action types
    if (resendOk && action_type === "referral_thankyou") {
      try {
        await admin
          .from("referrals")
          .update({ status: "rewarded", reward_sent: true })
          .eq("referrer_therapist_id", therapist_id)
          .eq("status", "confirmed");
      } catch (_e) {
        // non-blocking
      }
    }

    if (!resendOk) {
      const detail =
        resendJson?.message ||
        resendJson?.error?.message ||
        (typeof resendJson === "object" ? JSON.stringify(resendJson).slice(0, 400) : String(resendJson));
      return fail(`Resend rejected: ${detail}`, "resend_response", resendJson);
    }

    return json({
      ok: true,
      sent_at: new Date().toISOString(),
      provider_id: resendJson.id,
      subject: msg.subject,
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "unhandled exception", step: "catch_all" }, 200);
  }
});
