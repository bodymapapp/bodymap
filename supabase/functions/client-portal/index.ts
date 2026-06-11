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
          .eq("therapist_id", therapistId).ilike("client_email", em).neq("status", "cancelled")
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

    // ---- full client profile (read-only portal) ----------------------
    // Returns the same shape pieces the therapist client page builds
    // (patterns, preferences, visits, memberships) but with every
    // therapist-private field stripped: SOAP/therapist_notes, internal
    // flags (do_not_rebook/dnr_reason), the private notes field, payment
    // processor ids, and signature/mandate ip. Service role, own data only.
    if (op === "profile") {
      if (!token || String(token).length < 20) return json({ ok: false }, 401);
      const { data: row } = await admin.from("client_portal_tokens")
        .select("*").eq("token", token).maybeSingle();
      if (!row || new Date(row.expires_at).getTime() < Date.now()) return json({ ok: false }, 401);
      admin.from("client_portal_tokens").update({ last_used_at: new Date().toISOString() }).eq("token", token).then(() => {});
      const em = norm(row.email);
      const tokenTherapistId = row.therapist_id || null;

      // A magic link is keyed to an email; in the common case that maps to
      // one client row. If several therapists have this person, take the
      // most recently updated row (multi-therapist switching is later).
      // Duplicate rows for the same email under one therapist (a known
      // data situation we are not deleting) are aggregated below so the
      // body map and history reflect every session, not just one row.
      const { data: clientRows } = await admin.from("clients")
        .select("*").ilike("email", em).order("updated_at", { ascending: false }).limit(50);
      if (!clientRows || clientRows.length === 0) return json({ ok: true, empty: true });
      // Therapist-scoped token: land on that therapist's row. Email-only
      // token (self-requested): most recently updated row.
      const client = tokenTherapistId
        ? (clientRows.find((r: any) => r.therapist_id === tokenTherapistId) || clientRows[0])
        : clientRows[0];
      const therapistId = client.therapist_id;
      const clientIds = clientRows
        .filter((r: any) => r.therapist_id === therapistId)
        .map((r: any) => r.id);

      const [{ data: sessions }, { data: bookings }, { data: pkgs }, { data: subs }, { data: ther }] = await Promise.all([
        admin.from("sessions")
          .select("id, client_id, completed, completed_at, created_at, front_focus, back_focus, front_avoid, back_avoid, front_focus_therapist, back_focus_therapist, pressure, goal, table_temp, room_temp, music, lighting, conversation, draping, oil_pref, medical_conditions")
          .eq("therapist_id", therapistId).in("client_id", clientIds).order("created_at", { ascending: false }),
        admin.from("bookings")
          .select("id, client_id, client_email, client_phone, booking_date, start_time, end_time, status, service_name, service:services(name, price, duration)")
          .ilike("client_email", em).neq("status", "cancelled").order("booking_date", { ascending: false }).limit(200),
        admin.from("package_purchases")
          .select("id, client_id, sessions_remaining, sessions_purchased, price_paid, status, expires_at, purchased_at, package:packages(name)")
          .eq("therapist_id", therapistId).in("client_id", clientIds).order("purchased_at", { ascending: false }),
        admin.from("member_subscriptions")
          .select("id, client_id, status, current_period_start, current_period_end, monthly_price, monthly_session_credits, current_credits, started_at, membership:memberships(name, monthly_session_credits)")
          .eq("therapist_id", therapistId).in("client_id", clientIds).order("started_at", { ascending: false }),
        admin.from("therapists").select("id, business_name, full_name, custom_url").eq("id", therapistId).maybeSingle(),
      ]);

      const ss = sessions || [];
      const bk = bookings || [];
      const topN = (field: string, n = 3) => {
        const counts = new Map<string, number>();
        for (const s of ss) {
          const arr = Array.isArray((s as any)[field]) ? (s as any)[field] : [];
          for (const z of arr) counts.set(z, (counts.get(z) || 0) + 1);
        }
        return [...counts.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count).slice(0, n);
      };
      const topFrontZones = topN("front_focus_therapist").length ? topN("front_focus_therapist") : topN("front_focus");
      const topBackZones = topN("back_focus_therapist").length ? topN("back_focus_therapist") : topN("back_focus");
      const topAvoidZones = [...topN("front_avoid", 2), ...topN("back_avoid", 2)].sort((a, b) => b.count - a.count).slice(0, 3);
      const latest = ss.find((s: any) => s.completed);
      const preferences = latest ? {
        pressure: latest.pressure, goal: latest.goal, table_temp: latest.table_temp, room_temp: latest.room_temp,
        music: latest.music, lighting: latest.lighting, conversation: latest.conversation, draping: latest.draping, oil_pref: latest.oil_pref,
      } : null;

      // Medical flags from client-entered conditions only (therapist med_flag
      // / med_note are clinical and never leave the therapist).
      const medicalFlags: any[] = [];
      const seen = new Set<string>();
      for (const s of ss) {
        const conds = Array.isArray((s as any).medical_conditions) ? (s as any).medical_conditions : [];
        for (const c2 of conds) { if (c2 && !seen.has(c2)) { seen.add(c2); medicalFlags.push({ type: "condition", text: c2 }); } }
      }

      const today = todayISO();
      const counted = bk.filter((b: any) => !b.status || ["confirmed", "completed"].includes(b.status));
      const completed = bk.filter((b: any) => b.status === "completed");
      const lifetimeEarnings = counted.reduce((sum: number, b: any) => sum + (b.service?.price || 0), 0);
      const sortedByDate = [...counted].sort((a: any, b: any) => (b.booking_date || "").localeCompare(a.booking_date || ""));
      const lastVisitDate = sortedByDate[0]?.booking_date || null;
      const future = bk.filter((b: any) => b.booking_date >= today && (!b.status || b.status === "confirmed")).sort((a: any, b: any) => (a.booking_date || "").localeCompare(b.booking_date || ""));
      const nextBooking = future[0] || null;

      const c = client;
      const safeClient = {
        id: c.id, name: c.name, email: c.email, phone: c.phone, alt_phone: c.alt_phone,
        birthday: c.birthday, gender: c.gender, referral_source: c.referral_source, customer_since: c.customer_since,
        address_line1: c.address_line1, address_line2: c.address_line2, city: c.city, state: c.state, zip: c.zip, country: c.country,
        allergies: c.allergies, health_conditions: c.health_conditions, medications: c.medications,
        areas_to_avoid: c.areas_to_avoid, emergency_contact: c.emergency_contact,
        total_sessions: c.total_sessions, loyalty_points: c.loyalty_points,
        card_brand: c.card_brand, card_last4: c.card_last4,
        practice_agreement_signed_at: c.practice_agreement_signed_at,
        practice_agreement_signer_name: c.practice_agreement_signer_name,
      };

      // Full ClientProfile profile shape (therapist-private fields removed:
      // therapist_notes/SOAP, do_not_rebook/dnr_reason, private notes,
      // processor ids, mandate/signature ip).
      return json({
        ok: true,
        profile: {
          client: safeClient,
          bookings: bk,
          sessions: ss,
          packagePurchases: pkgs || [],
          memberSubscriptions: subs || [],
          giftCertificates: [],
          stats: {
            lifetimeSessions: counted.length,
            lifetimeCompletedSessions: completed.length,
            lifetimeEarnings,
            lastVisitDate,
            daysSinceVisit: null,
            nextBooking,
            pendingIntake: null,
          },
          patterns: { topFrontZones, topBackZones, topAvoidZones },
          preferences,
          medicalFlags,
        },
        therapist: { id: ther?.id, name: ther?.business_name || ther?.full_name || "Your therapist", custom_url: ther?.custom_url || null },
      });
    }

    return json({ ok: false, error: "unknown op" }, 400);
  } catch (err) {
    console.error("[client-portal] error:", err);
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});
