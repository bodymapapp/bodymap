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

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FROM = "BodyMap Founder <reminders@mybodymap.app>";
const REPLY_TO = "bodymap01@gmail.com";

type ActionType = "welcome" | "checkin" | "reminder" | "testimonial";

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

  try {
    // Verify caller is an admin
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "").trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerEmail = (userData.user.email || "").toLowerCase();
    if (!ADMIN_EMAILS.has(callerEmail)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request
    const { therapist_id, action_type } = await req.json();
    if (!therapist_id || !action_type) {
      return new Response(JSON.stringify({ error: "therapist_id and action_type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const validActions: ActionType[] = ["welcome", "checkin", "reminder", "testimonial"];
    if (!validActions.includes(action_type)) {
      return new Response(JSON.stringify({ error: "invalid action_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load therapist with full context using service role
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: therapist, error: tErr } = await admin
      .from("therapists")
      .select("id,email,full_name,created_at")
      .eq("id", therapist_id)
      .single();

    if (tErr || !therapist) {
      return new Response(JSON.stringify({ error: "therapist not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute days on platform and days since use
    const now = Date.now();
    const signedUpMs = new Date(therapist.created_at).getTime();
    const days_on_platform = Math.max(0, Math.floor((now - signedUpMs) / 86400000));

    const { data: lastSession } = await admin
      .from("sessions")
      .select("created_at")
      .eq("therapist_id", therapist_id)
      .order("created_at", { ascending: false })
      .limit(1);
    const { data: lastClient } = await admin
      .from("clients")
      .select("created_at")
      .eq("therapist_id", therapist_id)
      .order("created_at", { ascending: false })
      .limit(1);
    const { count: sessionsCount } = await admin
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("therapist_id", therapist_id);

    const lastAct = Math.max(
      lastSession?.[0]?.created_at ? new Date(lastSession[0].created_at).getTime() : 0,
      lastClient?.[0]?.created_at ? new Date(lastClient[0].created_at).getTime() : 0
    );
    const days_since_use = lastAct > 0 ? Math.floor((now - lastAct) / 86400000) : null;

    const msg = buildMessage(action_type, {
      full_name: therapist.full_name,
      days_on_platform,
      days_since_use,
      sessions_total: sessionsCount || 0,
    });

    // Send via Resend
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

    const resendJson = await resendRes.json();
    const ok = resendRes.ok && !!resendJson?.id;

    // Log to notification_log
    await admin.from("notification_log").insert({
      therapist_id,
      notification_type: `founder_outreach_${action_type}`,
      audience: "therapist",
      channel: "email",
      recipient: therapist.email,
      status: ok ? "sent" : "failed",
      provider_id: resendJson?.id || null,
      error_message: ok ? null : JSON.stringify(resendJson).slice(0, 500),
    });

    if (!ok) {
      return new Response(
        JSON.stringify({ error: "resend_failed", detail: resendJson }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sent_at: new Date().toISOString(),
        provider_id: resendJson.id,
        subject: msg.subject,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
