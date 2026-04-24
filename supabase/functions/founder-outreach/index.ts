// Founder outreach. Admin-only edge function.
// Sends a branded MyBodyMap email to a therapist from reminders@mybodymap.app
// with reply-to bodymap01@gmail.com. Logs the send to notification_log.
//
// Request body: { therapist_id: string, action_type: ActionType, custom_subject?, custom_body? }
// ActionType = welcome | checkin | reminder | testimonial | first_session
//            | setup_nudge | churned | referral_thankyou | activation_nudge
//
// Auth: caller JWT must belong to an ADMIN_EMAILS address. Non-admins get 403.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generateUnsubToken,
  unsubscribeFooterHtml,
  unsubscribeFooterText,
  UNSUB_BASE_URL,
} from "../_shared/unsubscribe.ts";

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

const FROM = "MyBodyMap Team <reminders@mybodymap.app>";
const REPLY_TO = "bodymap01@gmail.com";
const BCC_FOUNDER = "bodymapdemo@gmail.com";

type ActionType = "welcome" | "checkin" | "reminder" | "testimonial" | "first_session" | "setup_nudge" | "churned" | "referral_thankyou" | "activation_nudge";

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
      subject: `${name}, the 60-second question that decides how this goes`,
      lines: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. We already sent you the real welcome email with all the steps. So this one is different.`,
        ``,
        `This is the honest one.`,
        ``,
        `Here's what happens to most therapists who sign up for any new practice tool. They mean to set it up. The week gets busy. A client cancels last minute. Life happens. Three weeks later they realize they never actually used the thing, and they move on.`,
        ``,
        `There is one small thing that seems to prevent that pattern almost every time.`,
        ``,
        `Get your full client list in today. Not tomorrow. Not "when things slow down." Today.`,
        ``,
        `Once your real clients are in MyBodyMap, everything else follows. You see names you recognize. You send an intake to one of them. You watch their body map come back. It becomes real.`,
        ``,
        `If you have a CSV export from your current tool, send it to us as a reply to this email. Doesn't matter what format. Vagaro, MassageBook, Square, a messy spreadsheet, handwritten list you photographed. We will clean it up and load it in for you by tomorrow morning. No charge. No catch. Reply "import" and attach the file.`,
        ``,
        `Or, if you would rather do it yourself, this link takes you there now: https://mybodymap.app/dashboard`,
        ``,
        `Either way, today is the day this either becomes real or quietly fades. We are rooting for real.`,
        ``,
        `Cheers,`,
        `MyBodyMap Team`,
      ],
    },
    checkin: {
      subject: `${name}, how are your hands?`,
      lines: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. Not writing to push anything. Just checking in.`,
        ``,
        `You signed up a little while ago, and we know signup week is the busiest week. New clients find you. Old clients need you. A hundred small things land on your plate that have nothing to do with the software you were going to set up on Tuesday.`,
        ``,
        `So we want to do something small and useful instead of sending another reminder.`,
        ``,
        `Want us to import your client list for you? Send us a CSV export from your current tool, or even a photo of a handwritten list. We will get it into your MyBodyMap dashboard by tomorrow morning. No forms, no back-and-forth, just send whatever you have.`,
        ``,
        `Or if something else is in the way, hit reply and tell us. "The payments setup confused me." "I'm not sure which plan I need." "I just need more time." Any of those, we can help with in one message.`,
        ``,
        `Take care of your hands this week.`,
        ``,
        `Cheers,`,
        `MyBodyMap Team`,
      ],
    },
    reminder: {
      subject: `${name}, still thinking about you`,
      lines: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. It has been about ${t.days_since_use ?? "a while"} days since you last opened MyBodyMap.`,
        ``,
        `We are not writing to drag you back. Your practice runs on your schedule, not ours.`,
        ``,
        `But we were thinking about you today, and we had a small idea.`,
        ``,
        `Want us to send you a short video of your dashboard? Two minutes, voiceover, walking through what's new since you last logged in and what other therapists are doing with it. No sales pitch. Just so the next time you have a quiet Sunday, you already know what you are walking back into.`,
        ``,
        `Reply with "yes video" and we'll record one and send it by the end of the day.`,
        ``,
        `Or if the honest truth is that this was not the right tool for you, tell us that too. "It did not click" is useful, and we promise to take it well.`,
        ``,
        `Either way, thank you for trying us. That alone is more than most therapists have time for.`,
        ``,
        `Cheers,`,
        `MyBodyMap Team`,
      ],
    },
    testimonial: {
      subject: `${name}, the kindest thing you could do for another therapist`,
      lines: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. We are writing because of something real.`,
        ``,
        `You have logged ${t.sessions_total} sessions on MyBodyMap so far. That is not a vanity number to us. That is ${t.sessions_total} clients who walked in, were seen, and walked out a little lighter.`,
        ``,
        `Somewhere right now, another massage therapist is typing a search into Google. "Is there anything better than paper forms." "How do I stop losing regulars." "Something for a solo practice that actually respects my time."`,
        ``,
        `If they found one sentence from you, in your own words, about what this platform does for how you work, it would mean more to them than anything we could write.`,
        ``,
        `Would you share one sentence with us? Just hit reply. Say it how you would say it to a friend over coffee. One line. No need to be polished. No need to praise. Just true.`,
        ``,
        `We will put it on our site, with your name and practice (or anonymous, your call). If you want to see how we use it before committing, we will show you the draft first.`,
        ``,
        `And if you would rather not, no worries at all. Reply with "pass" and we will never ask again. That is a real promise.`,
        ``,
        `Cheers,`,
        `MyBodyMap Team`,
      ],
    },
    first_session: {
      subject: `Congrats on your first session, ${name}`,
      lines: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. Just saw you logged your first session. Big moment.`,
        ``,
        `Tip: next time that client books, open their body map 30 seconds before they walk in. You'll see exactly where they hold tension and what pressure they like. Those 30 seconds are what bring clients back.`,
        ``,
        `Here if you need anything.`,
        ``,
        `Cheers!`,
        `MyBodyMap Team`,
      ],
    },
    setup_nudge: {
      subject: `${name}, some free career advice (that we will take back in a second)`,
      lines: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here with some genuinely useful career advice.`,
        ``,
        `Keep taking payment in Venmo, Zelle, cash, check, and occasionally baked goods. It is charming. It is personal. It is how massage therapy has worked for decades. Please do not let us talk you out of it.`,
        ``,
        `...`,
        ``,
        `Okay we lied. We're going to try to talk you out of it. Just a little.`,
        ``,
        `You haven't connected Stripe or Square yet. Which means when a client books through your MyBodyMap link, they can't actually pay you. Which means after a long day of holding space for everyone else, you still have to send the awkward "oh by the way, can you Venmo me" text. Which, fine. It's just one more small thing on top of a day that was already full.`,
        ``,
        `One minute in Settings and it's done. Clients pay the moment they book. You get to close the laptop and go back to the actual work.`,
        ``,
        `Want a hand walking through it? Hit reply and we'll help.`,
        ``,
        `Cheers,`,
        `MyBodyMap Team`,
      ],
    },
    churned: {
      subject: `${name}, we miss your hands`,
      lines: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. Not writing to sell you anything. We just noticed you have not been back in about ${t.days_since_use ?? "over a month"} days, and we wanted to send something small.`,
        ``,
        `We built this platform for a particular kind of therapist. Someone who cares about their clients' actual bodies, not just their booking calendar. Someone who notices when a regular's shoulders are tighter than last month. Someone who would rather be good than fast.`,
        ``,
        `If that is you, and MyBodyMap fell short of that somehow, we want to know what happened. Not for a survey. For our next build.`,
        ``,
        `Pick whichever is easiest:`,
        ``,
        `- Hit reply with one sentence. What went wrong, what was missing, what you wish existed. We read every word.`,
        `- Or, if you'd like, we will get on a 15-minute call with you this week. No sales pitch. Just the two of us, listening. Reply with "call" and we'll send a link.`,
        ``,
        `And if the honest answer is that life got busy and MyBodyMap slipped off the list, that is a fine answer too. We understand. Your hands matter more than our retention rate.`,
        ``,
        `Whatever the reason, thank you for trying us. Really.`,
        ``,
        `Cheers,`,
        `MyBodyMap Team`,
      ],
    },
    referral_thankyou: {
      subject: `Thank you, ${name}`,
      lines: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. Someone just signed up through your link. That means a lot.`,
        ``,
        `You're helping another therapist find something that actually fits how they practice. Thank you.`,
        ``,
        `If there's anything we can do to make MyBodyMap better for you, reply and tell us.`,
        ``,
        `Cheers!`,
        `MyBodyMap Team`,
      ],
    },
    activation_nudge: {
      // Placeholder — dashboard always passes custom_subject + custom_body
      // built from the therapist's missing setup steps.
      subject: `${name}, small things left`,
      lines: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. Just a quiet nudge. You've got a couple of setup steps left, and finishing them unlocks the whole point of the platform. No alarm, no urgency. You could knock them out during your next coffee break.`,
        ``,
        `If something is in the way, tell us. "I couldn't figure out the Stripe connection." "I don't know what to put for services." "I ran out of time." Any of those, we help with in one reply.`,
        ``,
        `Want us to walk through it on a quick call? Reply with "call" and we'll send you a 15-minute slot this week. We sit with you, you share your screen, we get it done.`,
        ``,
        `You are almost there.`,
        ``,
        `Cheers,`,
        `MyBodyMap Team`,
      ],
    },
  };

  const tpl = templates[action];
  const text = tpl.lines.join("\n");

  const html = `
<div style="font-family:Georgia,serif;max-width:560px;margin:24px auto;padding:32px 28px;background:#FFF9F3;border:1px solid #E8E4DC;border-radius:12px;color:#1F2937;line-height:1.6;font-size:15px">
  <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;color:#6B9E80;text-transform:uppercase;margin-bottom:16px">🌿 MyBodyMap</div>
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
    const validActions: ActionType[] = ["welcome", "checkin", "reminder", "testimonial", "first_session", "setup_nudge", "churned", "referral_thankyou", "activation_nudge"];
    if (!validActions.includes(action_type)) {
      return fail(`action_type must be one of ${validActions.join(", ")}`, "validation");
    }

    // Load therapist via service role
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: therapist, error: tErr } = await admin
      .from("therapists")
      .select("id,email,full_name,created_at,email_unsubscribed")
      .eq("id", therapist_id)
      .single();

    if (tErr) return fail(tErr.message, "load_therapist");
    if (!therapist) return fail("therapist not found", "load_therapist");
    if (!therapist.email) return fail("therapist has no email on record", "load_therapist");
    if (therapist.email_unsubscribed) {
      return fail("Recipient has unsubscribed from marketing emails", "unsubscribed");
    }

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
    const bodyText = (typeof custom_body === "string" && custom_body.trim()) ? custom_body.trim() : tpl.text;

    // Generate signed unsubscribe link for this recipient
    const unsubToken = await generateUnsubToken(therapist.id);
    const unsubUrl = `${UNSUB_BASE_URL}?token=${encodeURIComponent(unsubToken)}`;

    // Append CAN-SPAM-compliant footer to both text and HTML
    const text = bodyText + unsubscribeFooterText(unsubUrl);

    // Regenerate HTML from potentially edited text (preserves the branded card).
    const html = `
<div style="font-family:Georgia,serif;max-width:560px;margin:24px auto;padding:32px 28px;background:#FFF9F3;border:1px solid #E8E4DC;border-radius:12px;color:#1F2937;line-height:1.6;font-size:15px">
  <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;color:#6B9E80;text-transform:uppercase;margin-bottom:16px">🌿 MyBodyMap</div>
  ${bodyText.split("\n").map((l: string) => (l === "" ? "<br/>" : `<div>${escapeHtml(l)}</div>`)).join("")}
  <div style="margin-top:28px;padding-top:18px;border-top:1px solid #E8E4DC;font-size:12px;color:#9CA3AF">
    Reply to this email and it reaches me directly.
  </div>
  ${unsubscribeFooterHtml(therapist.id, unsubUrl)}
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
          bcc: [BCC_FOUNDER],
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

    // Log regardless (best effort). Includes subject + body snippet so the
    // dashboard can show HK exactly what was sent and when.
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
        subject: msg.subject,
        body_snippet: (msg.text || "").slice(0, 200),
      });
    } catch (_e) {
      // non-blocking — if subject/body_snippet columns don't exist yet,
      // fall back to the legacy insert shape so logging doesn't block sends.
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
      } catch (_e2) { /* give up */ }
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
