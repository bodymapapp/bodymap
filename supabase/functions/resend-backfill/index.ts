// Resend backfill. Admin-only one-shot utility.
//
// Pulls every send from Resend's API, matches recipient to a therapist
// row by email, infers notification_type from subject line, and inserts
// a row into notification_log if not already present. Idempotent: uses
// provider_id (Resend email id) as the dedupe key.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = new Set([
  "bodymap01@gmail.com",
  "bodymapdemo@gmail.com",
  "harshk.mba@gmail.com",
]);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function inferType(subject: string, from: string): string | null {
  const s = (subject || "").toLowerCase();
  const f = (from || "").toLowerCase();

  if (/your massage is tomorrow/i.test(s)) return "reminder_24h";
  if (/session summary from/i.test(s)) return "post_session";
  if (/your back office just went on autopilot/i.test(s)) return "welcome";

  if (/5 signs a regular is about to ghost/i.test(s)) return "drip_day2";
  if (/send yourself the body map/i.test(s)) return "drip_day5";
  if (/what terra said|how jamie got|rebooking rate/i.test(s)) return "drip_day10";
  if (/one question about your first month/i.test(s)) return "drip_day30";
  if (/a small ask.*free thing|know another therapist/i.test(s)) return "drip_day60";

  if (/your practice pulse/i.test(s) || f.includes("pulse@")) return "practice_pulse";

  if (/quick hello from bodymap/i.test(s)) return "founder_outreach_activation_nudge";
  if (/checking in/i.test(s)) return "founder_outreach_checkin";
  if (/haven't seen you in a bit/i.test(s)) return "founder_outreach_reminder";
  if (/quick favor/i.test(s)) return "founder_outreach_testimonial";
  if (/congrats on your first session/i.test(s)) return "founder_outreach_first_session";
  if (/one quick thing/i.test(s)) return "founder_outreach_setup_nudge";
  if (/still with us/i.test(s)) return "founder_outreach_churned";
  if (/^thank you, /i.test(s)) return "founder_outreach_referral_thankyou";
  if (/welcome to bodymap/i.test(s)) return "founder_outreach_welcome";

  if (/bodymap daily/i.test(s)) return null;
  if (/new bodymap signup/i.test(s)) return null;

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "Missing token" }, 401);
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const email = (payload?.email || "").toLowerCase();
      if (!ADMIN_EMAILS.has(email)) {
        return json({ ok: false, error: "Not authorized" }, 403);
      }
    } catch {
      return json({ ok: false, error: "Invalid token" }, 401);
    }

    if (!RESEND_API_KEY) return json({ ok: false, error: "RESEND_API_KEY not set" });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json({ ok: false, error: "Supabase env not set" });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: therapists } = await admin.from("therapists").select("id,email,custom_url");
    const byEmail = new Map<string, { id: string; custom_url: string | null }>();
    for (const t of therapists || []) {
      if (t.email) byEmail.set(t.email.toLowerCase(), { id: t.id, custom_url: t.custom_url });
    }

    const { data: existingLogs } = await admin
      .from("notification_log")
      .select("provider_id")
      .not("provider_id", "is", null);
    const seenProviderIds = new Set((existingLogs || []).map((r: any) => r.provider_id));

    const fetched: any[] = [];
    let cursor: string | null = null;
    let pages = 0;
    const maxPages = 10;
    while (pages < maxPages) {
      const url = new URL("https://api.resend.com/emails");
      url.searchParams.set("limit", "100");
      if (cursor) url.searchParams.set("after", cursor);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        return json({ ok: false, error: `Resend API error: ${txt.slice(0, 200)}`, pages_fetched: pages });
      }
      const data: any = await res.json();
      const items = Array.isArray(data?.data) ? data.data : [];
      if (items.length === 0) break;
      fetched.push(...items);
      pages++;
      const next = items[items.length - 1]?.id;
      if (!next || next === cursor) break;
      cursor = next;
    }

    let inserted = 0;
    let skipped_already_logged = 0;
    let skipped_no_therapist_match = 0;
    let skipped_unknown_type = 0;
    let failed = 0;
    const unknownSubjects: string[] = [];
    const unmatchedRecipients: string[] = [];
    const insertErrors: string[] = [];
    const samplesInserted: Array<{ to: string; type: string; subject: string }> = [];

    for (const e of fetched) {
      const providerId = e?.id;
      if (!providerId || seenProviderIds.has(providerId)) {
        skipped_already_logged++;
        continue;
      }

      const toList: string[] = Array.isArray(e?.to) ? e.to : (e?.to ? [e.to] : []);
      const primaryTo = (toList[0] || "").toLowerCase();
      if (!primaryTo) { skipped_no_therapist_match++; continue; }

      const match = byEmail.get(primaryTo);
      if (!match) {
        skipped_no_therapist_match++;
        if (unmatchedRecipients.length < 10) unmatchedRecipients.push(primaryTo);
        continue;
      }

      const type = inferType(e?.subject || "", e?.from || "");
      if (!type) {
        skipped_unknown_type++;
        if (unknownSubjects.length < 10) unknownSubjects.push(e?.subject || "(empty)");
        continue;
      }

      try {
        const { error: insertErr } = await admin.from("notification_log").insert({
          therapist_id: match.id,
          notification_type: type,
          audience: "therapist",
          channel: "email",
          recipient: primaryTo,
          status: "sent",
          provider_id: providerId,
          sent_at: e?.created_at || e?.last_event_at || new Date().toISOString(),
          subject: e?.subject || null,
          body_snippet: null,
        });
        if (insertErr) {
          failed++;
          if (insertErrors.length < 5) insertErrors.push(insertErr.message || JSON.stringify(insertErr));
        } else {
          inserted++;
          if (samplesInserted.length < 5) {
            samplesInserted.push({ to: primaryTo, type, subject: (e?.subject || "").slice(0, 80) });
          }
        }
      } catch (err: any) {
        failed++;
        if (insertErrors.length < 5) insertErrors.push(err?.message || String(err));
      }
    }

    return json({
      ok: true,
      pages_fetched: pages,
      total_fetched_from_resend: fetched.length,
      inserted,
      skipped_already_logged,
      skipped_no_therapist_match,
      skipped_unknown_type,
      failed,
      diagnostics: {
        therapists_in_db: byEmail.size,
        existing_log_provider_ids: seenProviderIds.size,
        samples_inserted: samplesInserted,
        sample_unknown_subjects: unknownSubjects,
        sample_unmatched_recipients: unmatchedRecipients,
        insert_errors: insertErrors,
      },
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || String(e) });
  }
});
