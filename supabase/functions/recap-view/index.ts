// supabase/functions/recap-view/index.ts
//
// Server-side reader for the two CLIENT-FACING session documents:
//   - the post-session recap  (/recap/:sessionId)
//   - the care summary        (/summary/:code, by feedback_code or id)
//
// Why this exists (HK Jun 8 2026, Stage 2 of the read lockdown): those
// pages are public links. Before this, they read the whole session row
// with the public key, which pulled the therapist's private notes and
// the client's medical detail down to the browser, and the recap parsed
// the private notes client-side to show the client their aftercare note.
//
// This function reads the session with the service role, parses the note
// on the SERVER, and returns ONLY client-safe fields. The raw private
// notes, medical note, medical conditions, intake answers, and AI
// insights never leave the server. Once the client pages call this, the
// broad read-all policy on sessions can be removed.
//
// Capability model: knowing the session id or summary code is the
// capability, same as the links work today. No clinical data is exposed
// regardless of who calls it.
//
// Input:  { sessionId } OR { code }
// Output: { ok, session, note, client, therapist, history } | { ok:false }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Ported verbatim from src/lib/sessionIntelligence.js so the client note
// and aftercare render identically to before.
const AFTERCARE_PRESETS: { id: string; label: string }[] = [
  { id: "hydrate", label: "Drink plenty of water today" },
  { id: "rest", label: "Take it easy for the rest of the day" },
  { id: "no-strenuous", label: "Avoid strenuous exercise for 24 hours" },
  { id: "epsom-bath", label: "A warm Epsom salt bath can help" },
  { id: "gentle-stretch", label: "Do some gentle stretching tonight" },
  { id: "ice", label: "Apply ice if you feel any soreness" },
  { id: "heat", label: "Apply heat to help muscles relax" },
  { id: "no-alcohol", label: "Avoid alcohol for 24 hours" },
];

function parseSoap(raw: string) {
  const empty = { __soap: true, S: "", O: "", A: "", P: "", noteToClient: "", aftercare: [] as string[], aftercareCustom: "", legacy: "" };
  if (!raw) return empty;
  try {
    const p = JSON.parse(raw);
    if (p && p.__soap) {
      return {
        __soap: true,
        S: p.S || "", O: p.O || "", A: p.A || "", P: p.P || "",
        noteToClient: p.noteToClient || "",
        aftercare: Array.isArray(p.aftercare) ? p.aftercare : [],
        aftercareCustom: p.aftercareCustom || "",
        legacy: p.legacy || "",
      };
    }
  } catch (_e) { /* fall through */ }
  return { ...empty, legacy: raw };
}

function getAftercareItems(soap: any) {
  if (!soap || !Array.isArray(soap.aftercare)) return [];
  return soap.aftercare
    .map((id: string) => AFTERCARE_PRESETS.find((p) => p.id === id))
    .filter(Boolean);
}

// Only these session columns ever leave the server. No therapist_notes,
// med_note, medical_conditions, custom_intake_answers, ai_insights,
// client_notes, or client_feedback.
const SAFE_SESSION_COLS =
  "id, client_id, therapist_id, completed, completed_at, created_at, front_focus, front_avoid, back_focus, back_avoid, pressure, goal, public_notes, booking_id";
const SAFE_HISTORY_COLS =
  "id, created_at, completed, pressure, goal, front_focus, front_avoid, back_focus, back_avoid";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;
const CODE_RE = /^[A-Za-z0-9_-]{4,64}$/;

function pickSafeSession(s: any) {
  return {
    id: s.id, client_id: s.client_id, therapist_id: s.therapist_id,
    completed: s.completed, completed_at: s.completed_at, created_at: s.created_at,
    front_focus: s.front_focus, front_avoid: s.front_avoid,
    back_focus: s.back_focus, back_avoid: s.back_avoid,
    pressure: s.pressure, goal: s.goal, public_notes: s.public_notes,
    booking_id: s.booking_id,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { sessionId, code } = await req.json().catch(() => ({}));

    // Resolve the session by id or by summary code (feedback_code or id).
    let sessionRow: any = null;
    if (sessionId) {
      if (!UUID_RE.test(String(sessionId))) return json({ ok: false, error: "bad id" }, 400);
      const { data } = await admin.from("sessions").select("*").eq("id", sessionId).maybeSingle();
      sessionRow = data;
    } else if (code) {
      const c = String(code);
      if (!CODE_RE.test(c)) return json({ ok: false, error: "bad code" }, 400);
      const { data } = await admin.from("sessions").select("*").or(`feedback_code.eq.${c},id.eq.${c}`).maybeSingle();
      sessionRow = data;
    } else {
      return json({ ok: false, error: "sessionId or code required" }, 400);
    }

    if (!sessionRow) return json({ ok: false, error: "not found" }, 404);

    // Parse the note on the server. The client only ever receives the
    // note-to-client and the aftercare list, never the raw notes.
    const soap = parseSoap(sessionRow.therapist_notes || "");
    const note = {
      noteToClient: sessionRow.public_notes || soap.noteToClient || "",
      aftercareItems: getAftercareItems(soap),
      aftercareCustom: soap.aftercareCustom || "",
    };

    const [{ data: client }, { data: therapist }, { data: history }] = await Promise.all([
      admin.from("clients").select("name").eq("id", sessionRow.client_id).maybeSingle(),
      admin.from("therapists").select("name, full_name, business_name, custom_url, phone").eq("id", sessionRow.therapist_id).maybeSingle(),
      admin.from("sessions").select(SAFE_HISTORY_COLS).eq("client_id", sessionRow.client_id).order("created_at", { ascending: false }).limit(20),
    ]);

    return json({
      ok: true,
      session: pickSafeSession(sessionRow),
      note,
      client: client ? { name: client.name } : null,
      therapist: therapist || null,
      history: history || [],
    });
  } catch (err) {
    console.error("[recap-view] error:", err);
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});
