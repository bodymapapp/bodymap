// supabase/functions/client-portal/index.ts
//
// Phase 1 of the client portal: a passwordless "My visits" page for the
// therapist's clients (HK Jun 2026). Clients NEVER get a Supabase auth
// session. The broad read policies on clients/sessions/bookings also
// grant the authenticated role, so handing a client a real DB session
// would let them read other people's rows. Instead this function runs
// with the service role and returns only the signed-in client's own,
// whitelisted data, keyed off a magic-link token.
//
//   op 'request-link' { email }  -> always { ok:true } (no enumeration);
//                                   if the email is known, emails a link.
//   op 'load'         { token }  -> { ok, name, upcoming[], past[] }
//
// Tokens live in client_portal_tokens (service-role only), expire in 30
// days, and are reused-until-expiry so a client can revisit on a device.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE = "https://mybodymap.app";
const TOKEN_TTL_DAYS = 30;
const norm = (e: string) => (e || "").toLowerCase().trim();
const todayISO = () => new Date().toISOString().split("T")[0];

function newToken() {
  // High-entropy opaque token (two UUIDs, no dashes).
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
}

function fmtWhen(dateStr: string, timeStr: string) {
  try {
    const d = new Date(`${dateStr}T${(timeStr || "00:00:00").slice(0, 8)}`);
    if (isNaN(d.getTime())) return { date: dateStr, time: timeStr || "" };
    return {
      date: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
      time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    };
  } catch { return { date: dateStr, time: timeStr || "" }; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const json = (b: any, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { op, email, token } = await req.json().catch(() => ({}));

    // ---- request a magic link ----------------------------------------
    if (op === "request-link") {
      const em = norm(email);
      // Always answer the same way so the page cannot be used to test
      // whether an email belongs to a client.
      const quiet = json({ ok: true });
      if (!em || !em.includes("@")) return quiet;

      // Is this a known client (by their client record or a past booking)?
      const [{ data: c }, { data: b }] = await Promise.all([
        admin.from("clients").select("id").ilike("email", em).limit(1),
        admin.from("bookings").select("id").ilike("client_email", em).limit(1),
      ]);
      const known = (c && c.length) || (b && b.length);
      if (!known) return quiet;

      // Reuse a still-valid token if one was issued recently, else mint one.
      let tok = "";
      const { data: existing } = await admin.from("client_portal_tokens")
        .select("token, expires_at").ilike("email", em)
        .gt("expires_at", new Date(Date.now() + 24 * 3600 * 1000).toISOString())
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existing?.token) {
        tok = existing.token;
      } else {
        tok = newToken();
        await admin.from("client_portal_tokens").insert({
          email: em, token: tok,
          expires_at: new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 3600 * 1000).toISOString(),
        });
      }

      const link = `${SITE}/my-visits?t=${tok}`;
      if (RESEND_API_KEY) {
        const html = `
          <div style="font-family:Georgia,serif;color:#1F3A2C;max-width:520px;margin:0 auto;line-height:1.6">
            <p>Hello,</p>
            <p>Here is your private link to see your visits, rebook, and review your forms. No password needed.</p>
            <p style="margin:26px 0">
              <a href="${link}" style="background:#2A5741;color:#fff;text-decoration:none;padding:14px 26px;border-radius:10px;font-size:17px;font-weight:700;display:inline-block">See my visits</a>
            </p>
            <p style="font-size:14px;color:#4B5563">This link is just for you. It works for the next 30 days, so you can save this email and come back anytime. If you did not ask for it, you can simply ignore it.</p>
            <p style="margin-top:24px">Warmly,<br/>The MyBodyMap Team</p>
          </div>`;
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: "MyBodyMap <hello@mybodymap.app>",
            to: [em],
            subject: "Your link to see your visits",
            html,
          }),
        }).catch(() => {});
      }
      return quiet;
    }

    // ---- load the client's own visits --------------------------------
    if (op === "load") {
      if (!token || String(token).length < 20) return json({ ok: false }, 401);
      const { data: row } = await admin.from("client_portal_tokens")
        .select("email, expires_at").eq("token", token).maybeSingle();
      if (!row || new Date(row.expires_at).getTime() < Date.now()) return json({ ok: false }, 401);
      admin.from("client_portal_tokens").update({ last_used_at: new Date().toISOString() }).eq("token", token).then(() => {});

      const em = norm(row.email);

      // Their own client records (for a friendly name) and bookings.
      const [{ data: clients }, { data: bookings }] = await Promise.all([
        admin.from("clients").select("name").ilike("email", em).limit(5),
        admin.from("bookings")
          .select("id, booking_date, start_time, status, service_name, service_id, therapist_id, practice_agreement_signed_at, services(name)")
          .ilike("client_email", em).neq("status", "cancelled")
          .order("booking_date", { ascending: true }).limit(200),
      ]);

      const name = (clients || []).map((c: any) => c.name).find(Boolean) || "";

      // Hydrate therapist display + booking link once per therapist.
      const tIds = Array.from(new Set((bookings || []).map((b: any) => b.therapist_id).filter(Boolean)));
      const tMap: Record<string, any> = {};
      if (tIds.length) {
        const { data: ts } = await admin.from("therapists")
          .select("id, business_name, full_name, custom_url").in("id", tIds);
        (ts || []).forEach((t: any) => { tMap[t.id] = t; });
      }

      const today = todayISO();
      const shape = (b: any) => {
        const t = tMap[b.therapist_id] || {};
        const when = fmtWhen(b.booking_date, b.start_time);
        return {
          id: b.id,
          date: when.date,
          time: when.time,
          raw_date: b.booking_date,
          status: b.status,
          service: b.service_name || b.services?.name || "Session",
          therapist_name: t.business_name || t.full_name || "Your therapist",
          therapist_url: t.custom_url || null,
          needs_forms: !b.practice_agreement_signed_at,
        };
      };

      const all = (bookings || []).map(shape);
      const upcoming = all.filter((b: any) => b.raw_date >= today);
      const past = all.filter((b: any) => b.raw_date < today).reverse().slice(0, 12);

      return json({ ok: true, name, upcoming, past });
    }

    return json({ ok: false, error: "unknown op" }, 400);
  } catch (err) {
    console.error("[client-portal] error:", err);
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});
