// supabase/functions/extract-session-intelligence/index.ts
//
// Runs once per SOAP save. Extracts structured intelligence from
// the unstructured therapist_notes blob and caches it in
// session_intelligence so the Schedule briefing card can read it
// with no AI cost at view time.
//
// Per founder playbook (MARKETING_MYBODYMAP.md > How we win > SOAP
// intelligence). HK approved Option C cached extraction May 14 2026.
// Model: Claude Haiku 4.5. ~one-eighth of a cent per call.
//
// Input: { session_id: uuid }
// Output: { ok: true, cached_existing?: true, extracted?: object }
//
// Idempotent: if source_hash matches existing row, skips re-extraction.
// Fire-and-forget from the frontend; failures are logged but never
// surface to the therapist.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAiCall } from "../_shared/ai_cost.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You extract structured clinical intelligence from a massage therapist's session notes. The therapist will look at this on her Schedule tab before the client's next visit to remember what mattered.

Read the SOAP note (subjective, objective, assessment, plan) and any free-text. Return ONLY valid JSON with this exact shape, no commentary:

{
  "focus_areas": ["lower back", "right shoulder"],
  "preferences_observed": ["quiet session, dim lights"],
  "outcome": "One short sentence about how the session went and what worked.",
  "concerns_flagged": ["pregnancy noted, avoid prone position"],
  "homework_or_followup": "stretch hamstrings nightly",
  "next_session_priority": "continue glute work, address hip flexor"
}

Rules:
- focus_areas: body zones worked or that need attention. Lowercase. Max 4.
- preferences_observed: what the client preferred (pressure, music, conversation, lighting, oils). Max 3.
- outcome: one sentence, past tense, factual. Max 20 words. Null if no signal.
- concerns_flagged: safety or medical issues to remember. Empty array if none.
- homework_or_followup: what the therapist told the client to do. Null if nothing.
- next_session_priority: what to prioritize next time. Null if no signal.

Be concise. The therapist sees this in a small card on her phone. If a field has no signal in the notes, return null or empty array. Never invent.`;

function hashString(s: string): string {
  // Simple non-cryptographic hash for change detection.
  // djb2. Sufficient for "did the notes change since last extract."
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h = h & 0xffffffff;
  }
  return h.toString(36);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load the session
    const { data: session, error: sErr } = await supabase
      .from("sessions")
      .select("id, therapist_id, client_id, therapist_notes")
      .eq("id", session_id)
      .maybeSingle();

    if (sErr || !session) {
      return new Response(JSON.stringify({ error: "session not found", details: sErr?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notes = session.therapist_notes || "";
    if (notes.trim().length < 20) {
      // Too short to extract meaningfully. Skip silently.
      return new Response(JSON.stringify({ ok: true, skipped: "notes too short" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newHash = hashString(notes);

    // Check if we already have an extraction with same source_hash
    const { data: existing } = await supabase
      .from("session_intelligence")
      .select("session_id, source_hash, extracted")
      .eq("session_id", session_id)
      .maybeSingle();

    if (existing && existing.source_hash === newHash && existing.extracted) {
      return new Response(JSON.stringify({ ok: true, cached_existing: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Run Haiku extraction. SOAP notes may be JSON-stringified or
    // plain prose. Pass the raw text either way; Claude can read both.
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: notes.slice(0, 8000) }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      await logAiCall({
        supabase,
        caller: "extract-session-intelligence",
        purpose: "soap_extract",
        model: MODEL,
        usage: null,
        therapist_id: session.therapist_id,
        success: false,
        error_message: errText.slice(0, 200),
      });
      return new Response(JSON.stringify({ error: "anthropic error", details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await anthropicRes.json();
    const responseText = (data.content?.[0]?.text || "").trim();

    // Parse JSON out of the response. Strip possible code fences.
    let extracted: any = null;
    try {
      const cleaned = responseText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      extracted = JSON.parse(cleaned);
    } catch (e) {
      console.error("[extract-session-intelligence] parse failed:", responseText);
    }

    // Log cost regardless of parse success
    await logAiCall({
      supabase,
      caller: "extract-session-intelligence",
      purpose: "soap_extract",
      model: MODEL,
      usage: data?.usage,
      therapist_id: session.therapist_id,
      success: extracted !== null,
      error_message: extracted === null ? "parse_failed" : undefined,
    });

    if (!extracted) {
      return new Response(JSON.stringify({ ok: false, error: "extraction parse failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute cost for the cached row attribution
    const inputTok = data?.usage?.input_tokens || 0;
    const outputTok = data?.usage?.output_tokens || 0;
    const cost = (inputTok / 1_000_000) * 1.0 + (outputTok / 1_000_000) * 5.0;

    // Upsert into session_intelligence
    const { error: upErr } = await supabase
      .from("session_intelligence")
      .upsert({
        session_id: session.id,
        therapist_id: session.therapist_id,
        client_id: session.client_id,
        extracted,
        model: MODEL,
        input_tokens: inputTok,
        output_tokens: outputTok,
        cost_usd: cost,
        source_hash: newHash,
        extracted_at: new Date().toISOString(),
      }, { onConflict: "session_id" });

    if (upErr) {
      console.error("[extract-session-intelligence] upsert error:", upErr);
      return new Response(JSON.stringify({ ok: false, error: upErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[extract-session-intelligence] error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
