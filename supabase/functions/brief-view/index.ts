// supabase/functions/brief-view/index.ts
//
// Gated reader for the two THERAPIST prep documents:
//   - pre-session brief   (/brief/pre/:sessionId)
//   - post-session record (/brief/post/:sessionId)
//
// These pages legitimately show the therapist's private notes, medical
// note, medical conditions, and AI insights, so unlike the client recap
// the data is not filtered. Instead access is locked: the full detail is
// returned only when the caller is EITHER the logged-in therapist who
// owns the session, OR presents the session's per-session token (the
// ?t=... in the link the app generates). This lets the therapist tap a
// brief link from a notification while logged out and still see it, while
// a stranger guessing a session id sees nothing.
//
// Once the briefs read through this, the broad read-all policy on
// sessions can be tightened so the public key cannot read session notes.
//
// Input:  { sessionId, token }
// Output: { ok, session, client, therapist, history } | { ok:false }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { sessionId, token } = await req.json().catch(() => ({}));
    if (!sessionId || !UUID_RE.test(String(sessionId))) return json({ ok: false, error: "bad id" }, 400);

    const { data: session } = await admin.from("sessions").select("*").eq("id", sessionId).maybeSingle();
    if (!session) return json({ ok: false, error: "not found" }, 404);

    // Authorize: valid per-session token, OR logged-in owner.
    let authorized = false;
    if (token && session.brief_token && String(token) === String(session.brief_token)) {
      authorized = true;
    }
    if (!authorized) {
      const authHeader = req.headers.get("Authorization") || "";
      // The anon key is also a Bearer token, so only treat this as an
      // owner check when getUser resolves to a real user id.
      const authed = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: userData } = await authed.auth.getUser();
      const uid = userData?.user?.id;
      if (uid && uid === session.therapist_id) authorized = true;
    }
    if (!authorized) return json({ ok: false, error: "not authorized" }, 403);

    const [{ data: client }, { data: therapist }, { data: history }] = await Promise.all([
      admin.from("clients").select("name, phone, email").eq("id", session.client_id).maybeSingle(),
      admin.from("therapists").select("full_name, business_name, custom_url, phone").eq("id", session.therapist_id).maybeSingle(),
      admin.from("sessions").select("*").eq("client_id", session.client_id).order("created_at", { ascending: false }).limit(20),
    ]);

    return json({ ok: true, session, client: client || null, therapist: therapist || null, history: history || [] });
  } catch (err) {
    console.error("[brief-view] error:", err);
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});
