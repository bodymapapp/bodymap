// supabase/functions/booking-lookup/index.ts
//
// Server-side helper for the few PUBLIC booking reads that touch contact
// details (HK Jun 8 2026, Stage 2 bookings). The public booking page must
// still see when slots are taken (times only, which stays a direct read),
// but it should not be able to pull a practice's client phone numbers,
// emails, or names with the public key. These three operations move here
// and run with the service role, returning only the minimal answer:
//
//   op 'returning'   { therapistId, email, phone } -> { isRepeat }
//   op 'nextBooking' { therapistId, email }        -> { bookingId|null }
//   op 'manage'      { bookingId }                 -> { booking_date, start_time, client_name, service_name }
//
// 'returning' returns only a boolean (no list of contacts leaves the
// server). 'manage' returns one booking's display fields by its id, the
// same capability the client's own manage link already grants.
//
// After these move here, the broad read-all on bookings is tightened so
// the public key can read scheduling fields but not contact details.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-fA-F-]{36}$/;
const last10 = (s: string) => (s || "").replace(/\D/g, "").slice(-10);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { op, therapistId, email, phone, bookingId } = await req.json().catch(() => ({}));

    if (op === "returning") {
      if (!therapistId || !UUID_RE.test(String(therapistId))) return json({ ok: false, error: "bad therapist" }, 400);
      let isRepeat = false;
      const em = (email || "").toLowerCase().trim();
      if (em) {
        const { data } = await admin.from("bookings").select("id")
          .eq("therapist_id", therapistId).ilike("client_email", em).neq("status", "cancelled").limit(1);
        if (data && data.length) isRepeat = true;
      }
      if (!isRepeat && last10(phone || "").length >= 7) {
        const want = last10(phone);
        const { data } = await admin.from("bookings").select("client_phone")
          .eq("therapist_id", therapistId).neq("status", "cancelled").not("client_phone", "is", null);
        if ((data || []).some((b: any) => last10(b.client_phone) === want)) isRepeat = true;
      }
      return json({ ok: true, isRepeat });
    }

    if (op === "nextBooking") {
      if (!therapistId || !UUID_RE.test(String(therapistId))) return json({ ok: false, error: "bad therapist" }, 400);
      const em = (email || "").toLowerCase().trim();
      if (!em) return json({ ok: true, bookingId: null });
      const today = new Date().toISOString().split("T")[0];
      const { data } = await admin.from("bookings").select("id")
        .eq("therapist_id", therapistId).eq("client_email", em).neq("status", "cancelled")
        .gte("booking_date", today).order("booking_date", { ascending: true }).limit(1).maybeSingle();
      return json({ ok: true, bookingId: data?.id || null });
    }

    if (op === "manage") {
      if (!bookingId || !UUID_RE.test(String(bookingId))) return json({ ok: false, error: "bad id" }, 400);
      const { data } = await admin.from("bookings")
        .select("booking_date, start_time, client_name, service_name, services(name)")
        .eq("id", bookingId).maybeSingle();
      if (!data) return json({ ok: true, booking: null });
      return json({
        ok: true,
        booking: {
          booking_date: data.booking_date,
          start_time: data.start_time,
          client_name: data.client_name,
          service_name: (data as any).services?.name || data.service_name || null,
        },
      });
    }

    return json({ ok: false, error: "unknown op" }, 400);
  } catch (err) {
    console.error("[booking-lookup] error:", err);
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});
