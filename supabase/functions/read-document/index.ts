// supabase/functions/read-document/index.ts
//
// On-demand reader for a client document (consent / intake / other).
// Triggered by the therapist tapping "Read this document". Sends the
// file to Claude Haiku 4.5 (cheap, vision + PDF), extracts a plain
// summary, key facts, and a faithful text transcription, and writes
// them back onto the client_documents row. The document itself is the
// home for everything read, so nothing is lost when there is no
// matching client field.
//
// Cost shape (HK Jun 7 2026): opt-in only, cheap model, size capped.
// No auto-run on upload. Cost is logged via the shared ai_cost helper.
//
// Input:  { document_id: uuid }
// Output: { ok: true, extracted: {...} } | { ok: false, error }
//
// Auth: the caller's JWT is verified and must own the document
// (therapist_id === auth uid). The actual file read + writeback use
// the service role.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as b64encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { logAiCall } from "../_shared/ai_cost.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "claude-haiku-4-5-20251001";
const BUCKET = "client-documents";
const MAX_BYTES = 10 * 1024 * 1024; // read files up to 10 MB; larger ones are skipped

const SYSTEM_PROMPT = `You read a single document that a massage therapist uploaded and attached to a client. It is usually a signed consent form, an intake or health history form, or other client paperwork. Transcribe and summarize it. Do not give medical advice. Never invent content that is not present.

Return ONLY valid JSON with this exact shape, no commentary, no code fences:

{
  "summary": "Two or three plain sentences: what this document is and the key things it contains.",
  "fields": [{ "label": "Client name", "value": "Jane Doe" }],
  "full_text": "A faithful transcription of the readable text in the document.",
  "client_fields": { "name": "Jane Doe", "phone": "555-123-4567", "allergies": "Latex" }
}

Rules:
- summary: plain language, factual, max 60 words.
- fields: the key facts a therapist would want at a glance, as label/value pairs. Examples: client name, date, signature present (Yes/No), date of birth, emergency contact, allergies, medical conditions, medications, areas to avoid, pressure preference, consent granted (Yes/No). Include only what is actually on the document. Max 14. Keep values short.
- full_text: transcribe the text you can read. If handwriting or scan quality makes parts unreadable, transcribe what you can and note [unclear] inline. Do not pad.
- client_fields: an object of values that clearly belong to the client, for filling their profile. Include a key ONLY when the value is clearly present on the form. Do not guess. Allowed keys exactly: name, email, phone, alt_phone, birthday, gender, address_line1, address_line2, city, state, zip, referral_source, allergies, health_conditions, medications, areas_to_avoid, emergency_contact. Format birthday as YYYY-MM-DD only if a full date is present, otherwise omit it. Keep each value concise. Omit any key not present. If nothing applies, use an empty object.
- If the document is blank or unreadable, set summary to say so, fields to an empty array, full_text to an empty string, and client_fields to an empty object.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "Missing ANTHROPIC_API_KEY" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ ok: false, error: "document_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller owns this document.
    const authHeader = req.headers.get("Authorization") || "";
    const authed = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await authed.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) {
      return new Response(JSON.stringify({ ok: false, error: "not signed in" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: doc, error: dErr } = await admin
      .from("client_documents")
      .select("id, therapist_id, file_path, mime_type, size_bytes, deleted_at")
      .eq("id", document_id)
      .maybeSingle();

    if (dErr || !doc || doc.deleted_at) {
      return new Response(JSON.stringify({ ok: false, error: "document not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (doc.therapist_id !== uid) {
      return new Response(JSON.stringify({ ok: false, error: "not your document" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (doc.size_bytes && doc.size_bytes > MAX_BYTES) {
      await admin.from("client_documents").update({
        extract_status: "failed",
        extract_error: "File is too large to read automatically.",
      }).eq("id", document_id);
      return new Response(JSON.stringify({ ok: false, error: "file too large" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("client_documents").update({ extract_status: "processing", extract_error: null }).eq("id", document_id);

    // Pull the file bytes with the service role.
    const dl = await admin.storage.from(BUCKET).download(doc.file_path);
    if (dl.error || !dl.data) {
      await admin.from("client_documents").update({ extract_status: "failed", extract_error: "Could not read the file." }).eq("id", document_id);
      return new Response(JSON.stringify({ ok: false, error: "download failed" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const bytes = new Uint8Array(await dl.data.arrayBuffer());
    const b64 = b64encode(bytes);

    const mime = doc.mime_type || (doc.file_path.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    const isPdf = mime.includes("pdf");
    const sourceBlock = isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
      : { type: "image", source: { type: "base64", media_type: mime, data: b64 } };

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: [sourceBlock, { type: "text", text: "Read this document and return the JSON described." }] }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      await logAiCall({ supabase: admin, caller: "read-document", purpose: "document_read", model: MODEL, usage: null, therapist_id: doc.therapist_id, success: false, error_message: errText.slice(0, 200) });
      await admin.from("client_documents").update({ extract_status: "failed", extract_error: "The reader could not process this document." }).eq("id", document_id);
      return new Response(JSON.stringify({ ok: false, error: "anthropic error" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await anthropicRes.json();
    const responseText = (data.content?.[0]?.text || "").trim();
    let extracted: any = null;
    try {
      const cleaned = responseText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      extracted = JSON.parse(cleaned);
    } catch (_e) {
      console.error("[read-document] parse failed:", responseText.slice(0, 300));
    }

    await logAiCall({ supabase: admin, caller: "read-document", purpose: "document_read", model: MODEL, usage: data?.usage, therapist_id: doc.therapist_id, success: extracted !== null, error_message: extracted === null ? "parse_failed" : undefined });

    if (!extracted) {
      await admin.from("client_documents").update({ extract_status: "failed", extract_error: "The reader could not understand this document." }).eq("id", document_id);
      return new Response(JSON.stringify({ ok: false, error: "parse failed" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fields = Array.isArray(extracted.fields)
      ? extracted.fields.filter((f: any) => f && f.label).slice(0, 14).map((f: any) => ({ label: String(f.label).slice(0, 60), value: String(f.value ?? "").slice(0, 300) }))
      : [];

    // Normalize the reader's profile-field guesses to known columns only.
    const ALLOWED = ["name","email","phone","alt_phone","birthday","gender","address_line1","address_line2","city","state","zip","referral_source","allergies","health_conditions","medications","areas_to_avoid","emergency_contact"];
    const rawCF = (extracted.client_fields && typeof extracted.client_fields === "object") ? extracted.client_fields : {};
    const clientFields: Record<string, string> = {};
    for (const k of ALLOWED) {
      let v = rawCF[k];
      if (v == null) continue;
      v = String(v).trim();
      if (!v) continue;
      if (k === "birthday" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) continue; // only a clean date
      clientFields[k] = v.slice(0, 300);
    }

    const { error: upErr } = await admin.from("client_documents").update({
      extract_status: "done",
      extracted_summary: (extracted.summary || "").slice(0, 2000),
      extracted_fields: fields,
      extracted_text: (extracted.full_text || "").slice(0, 20000),
      extracted_client_fields: clientFields,
      extracted_at: new Date().toISOString(),
      extract_error: null,
    }).eq("id", document_id);

    if (upErr) {
      return new Response(JSON.stringify({ ok: false, error: upErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      extracted: { summary: extracted.summary || "", fields, full_text: (extracted.full_text || "").slice(0, 20000), client_fields: clientFields },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[read-document] error:", err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
