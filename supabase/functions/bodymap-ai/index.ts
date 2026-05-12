// supabase/functions/bodymap-ai/index.ts
//
// Practice Assistant (renamed from "MyBodyMap Platform"). Answers
// therapist questions using their own practice data as context.
// Currently rate-limited to 10 questions per therapist per month
// while we are in pre-revenue beta. Per HK direction: revisit cap
// once Silver / Gold tiers are paying. Tracked in BLOCK_PLAN.
//
// Why "Practice Assistant" and not "Platform":
//   The whole website is the platform. "Practice Assistant" is
//   clearer about scope and does not overpromise.
//
// Three modes:
//   - 'public': demo on the marketing pages, no auth required,
//     answers general MyBodyMap questions, no practice data
//   - 'practice': authenticated therapist asking about their own
//     practice data. Rate-limited 10 / month.
//
// Hardening this update introduces:
//   1. Auth check on practice mode (was missing before, security hole)
//   2. Rate limit table 'ai_usage_monthly' (therapist_id, year_month, count)
//   3. Scope-locked system prompt that redirects off-topic questions
//   4. Returns 429 with usage details when cap exceeded
//   5. Returns usage in every response so client can show counter

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MONTHLY_QUESTION_LIMIT = 10;
const MONTHLY_DRAFT_LIMIT = 30;

// Draft-note mode generates short text for two specific therapist fields.
// 'private' = clinical shorthand for the therapist's own record
// 'client'  = warm 2-3 sentence message that mirrors the recap tone
function buildDraftSystemPrompt(kind: "private" | "client"): string {
  const common = `Style rules:
- No em dashes anywhere. Use periods, commas, parentheses, or middots instead.
- Always use "MyBodyMap" not "BodyMap".
- No buzzwords (synergy, leverage, ecosystem, best-in-class, game-changer).
- 10th grade reading level.
- Do not invent facts not present in the session data provided.
- If the SOAP fields are empty, base your draft only on intake data and what areas were worked.`;

  if (kind === "private") {
    return `You are drafting PRIVATE clinical notes for a solo licensed massage therapist's own record. The therapist will read this, edit, and save. Clients NEVER see this text.

Goal: a short, factual, clinically useful note (50 to 90 words) that captures what happened in today's session and what to remember for next time. Think of it as a quick journal entry for the therapist, not a SOAP note (SOAP is a separate field).

Output format:
- 1 or 2 short paragraphs, no headers, no bullet points.
- Include: client's stated focus today, what response the body had (tissue, breath, mood), and 1 to 2 specific things to remember for the next visit.
- Do NOT include client name or pronouns like "the client", just write directly ("worked R shoulder, holding tension at..." style).
- Do NOT include warmth, reassurance, or aftercare advice. Those belong in the client-facing message.

${common}`;
  }

  return `You are drafting a WARM, brief message from a massage therapist to their client. The therapist will read your draft, edit, and send. The client receives this in their post-session summary on MyBodyMap.

Goal: 2 to 3 sentences (40 to 70 words) that feel personal and human. The client should feel seen, encouraged about progress, and gently nudged toward consistency.

Output format:
- Plain sentences, no greeting line ("Hi Sarah,") and no signature ("from Jane"). The platform adds the therapist name automatically.
- Reference 1 specific thing from today (a focus area, a shift you noticed, an improvement they mentioned). Specificity beats generic warmth.
- End with a forward-looking line. Examples: "see you in two weeks", "stretch those shoulders this week", "rest well tonight".
- Tone: warm professional, not gushing. The therapist is a trusted practitioner, not a friend.

${common}`;
}

// Build the user message that gives the model the session context
// it needs to draft a useful note. Kept short to control tokens.
function buildDraftUserMessage(sessionData: any, kind: "private" | "client"): string {
  const s = sessionData.session || {};
  const c = sessionData.client || {};
  const soap = sessionData.soap || {};
  const lastVisit = sessionData.lastVisit || null;
  const firstName = (c.name || "").split(" ")[0] || "client";

  const focusFront = (s.front_focus || []).join(", ");
  const focusBack = (s.back_focus || []).join(", ");
  const allFocus = [focusFront, focusBack].filter(Boolean).join("; ") || "(no specific areas)";
  const avoid = [...(s.front_avoid || []), ...(s.back_avoid || [])].join(", ") || "(none)";

  const soapText = [
    soap.S ? `S: ${soap.S}` : "",
    soap.O ? `O: ${soap.O}` : "",
    soap.A ? `A: ${soap.A}` : "",
    soap.P ? `P: ${soap.P}` : "",
  ].filter(Boolean).join("\n");

  const lines = [
    `Today's session for ${firstName}.`,
    `Pressure: ${s.pressure || "n/a"}/5. Goal: ${s.goal || "n/a"}.`,
    `Focus areas: ${allFocus}.`,
    `Avoid: ${avoid}.`,
    s.client_notes ? `Client's words: "${s.client_notes}"` : "",
    soapText ? `Therapist's SOAP notes today:\n${soapText}` : "Therapist SOAP not yet filled in.",
    lastVisit ? `Last visit (${lastVisit.daysAgo} days ago): pressure ${lastVisit.pressure || "n/a"}/5, focus ${lastVisit.focus || "n/a"}.` : "First visit on record.",
  ].filter(Boolean).join("\n");

  return `Draft a ${kind === "private" ? "private clinical" : "warm client-facing"} note based on this session:\n\n${lines}`;
}

// Public mode is a marketing demo, light scope-locked prompt.
const publicSystemPrompt = `You are the MyBodyMap Practice Assistant, demonstrated on the marketing site. You only answer questions about massage therapy practice management, the MyBodyMap product, and adjacent professional topics like client retention, scheduling, and pricing for solo licensed massage therapists.

If asked about anything unrelated to massage therapy practice or MyBodyMap (weather, current events, general topics, other software), politely redirect: "I only answer questions about massage therapy practice and the MyBodyMap product. For other topics, please use a general assistant."

Be warm, concise, and practical. Keep responses under 150 words. Mention MyBodyMap features when genuinely relevant (body map intake, longitudinal tension tracking, retention automation). Do not push a sale; just answer the question.

Style rules:
- No em dashes anywhere. Use periods, commas, parentheses, or middots instead.
- Always use "MyBodyMap" not "BodyMap"
- No buzzwords (synergy, leverage, ecosystem, best-in-class, game-changer)`;

// Practice mode is authenticated therapist asking about their own data.
function buildPracticeSystemPrompt(context: string): string {
  return `You are the MyBodyMap Practice Assistant. You help solo licensed massage therapists run their practice. You have full access to THIS therapist's practice data below.

You ONLY answer questions about:
- This therapist's own clients, sessions, schedule, revenue, and patterns
- The MyBodyMap product itself (how features work, how to configure, where to find things)
- Massage therapy practice topics directly relevant to running this practice

If asked about anything outside this scope (weather, news, general questions, unrelated topics), politely redirect: "I only answer questions about your MyBodyMap practice. For other topics, please use a general assistant."

PRACTICE DATA:
${context}

GUIDELINES:
- Answer questions about specific clients using their real data
- Draft SMS messages when asked, format them clearly between --- markers
- Give business insights based on actual session and revenue data
- Flag re-engagement opportunities for lapsed clients
- Keep responses concise, therapists are busy
- Cite MyBodyMap settings or features by their location when relevant ("Settings, Cancellation Policy section")
- If the answer requires data you do not have, say so clearly rather than guessing

Style rules:
- No em dashes anywhere. Use periods, commas, parentheses, or middots instead.
- Always use "MyBodyMap" not "BodyMap"
- No buzzwords (synergy, leverage, ecosystem, best-in-class, game-changer)
- Be direct, no fluff`;
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages, context, mode, sessionData, kind } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUBLIC MODE: marketing demo. No auth, no rate limit per user
    // because there is no user. Could be abused so we keep tokens low.
    if (mode === "public") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          system: publicSystemPrompt,
          messages,
        }),
      });
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PRACTICE MODE: authenticated therapist. Auth + rate limit required.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve therapist row from auth user. The schema uses therapists.id
    // = auth.user.id directly (no separate auth_user_id column).
    const { data: therapistRow, error: therapistErr } = await supabase
      .from("therapists")
      .select("id, email")
      .eq("id", user.id)
      .maybeSingle();

    if (therapistErr || !therapistRow) {
      return new Response(JSON.stringify({ error: "Therapist not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const therapistId = therapistRow.id;
    const yearMonth = currentYearMonth();

    // ────────────────── DRAFT-NOTE MODE ──────────────────
    // Generates a short note for the therapist to edit and save. Uses
    // a separate rate limit table (ai_drafts_monthly) so drafting
    // doesn't eat into the Practice Assistant question budget.
    if (mode === "draft-note") {
      const draftKind: "private" | "client" = kind === "client" ? "client" : "private";

      if (!sessionData || !sessionData.session) {
        return new Response(JSON.stringify({ error: "Missing session data for draft" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Read current draft usage
      const { data: draftUsageRow } = await supabase
        .from("ai_drafts_monthly")
        .select("draft_count")
        .eq("therapist_id", therapistId)
        .eq("year_month", yearMonth)
        .maybeSingle();

      const currentDraftCount = draftUsageRow?.draft_count ?? 0;

      if (currentDraftCount >= MONTHLY_DRAFT_LIMIT) {
        return new Response(JSON.stringify({
          error: "monthly_limit_reached",
          message: `You have reached this month's limit of ${MONTHLY_DRAFT_LIMIT} AI drafts. Resets on the 1st.`,
          drafts_used: currentDraftCount,
          drafts_limit: MONTHLY_DRAFT_LIMIT,
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const draftUserMsg = buildDraftUserMessage(sessionData, draftKind);
      const draftSystem = buildDraftSystemPrompt(draftKind);

      const draftResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 250,
          system: draftSystem,
          messages: [{ role: "user", content: draftUserMsg }],
        }),
      });

      if (!draftResponse.ok) {
        const errText = await draftResponse.text();
        return new Response(JSON.stringify({
          error: "Anthropic API error",
          details: errText,
        }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const draftData = await draftResponse.json();
      const draftText = (draftData?.content?.[0]?.text || "").trim();

      // Increment draft counter on success
      await supabase
        .from("ai_drafts_monthly")
        .upsert({
          therapist_id: therapistId,
          year_month: yearMonth,
          draft_count: currentDraftCount + 1,
          last_draft_at: new Date().toISOString(),
        }, { onConflict: "therapist_id,year_month" });

      return new Response(JSON.stringify({
        draft: draftText,
        kind: draftKind,
        usage_meta: {
          drafts_used: currentDraftCount + 1,
          drafts_limit: MONTHLY_DRAFT_LIMIT,
          drafts_remaining: MONTHLY_DRAFT_LIMIT - (currentDraftCount + 1),
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ────────────────── PRACTICE MODE ──────────────────
    const { data: usageRow } = await supabase
      .from("ai_usage_monthly")
      .select("question_count")
      .eq("therapist_id", therapistId)
      .eq("year_month", yearMonth)
      .maybeSingle();

    const currentCount = usageRow?.question_count ?? 0;

    if (currentCount >= MONTHLY_QUESTION_LIMIT) {
      return new Response(JSON.stringify({
        error: "monthly_limit_reached",
        message: `You have reached this month's limit of ${MONTHLY_QUESTION_LIMIT} Practice Assistant questions. Resets on the 1st.`,
        questions_used: currentCount,
        questions_limit: MONTHLY_QUESTION_LIMIT,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Anthropic
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: buildPracticeSystemPrompt(context || ""),
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({
        error: "Anthropic API error",
        details: errText,
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // Increment usage counter ONLY on successful response. Use upsert
    // to handle the first question of the month cleanly.
    await supabase
      .from("ai_usage_monthly")
      .upsert({
        therapist_id: therapistId,
        year_month: yearMonth,
        question_count: currentCount + 1,
        last_question_at: new Date().toISOString(),
      }, { onConflict: "therapist_id,year_month" });

    // Return Anthropic response plus usage info so client can show counter
    return new Response(JSON.stringify({
      ...data,
      usage_meta: {
        questions_used: currentCount + 1,
        questions_limit: MONTHLY_QUESTION_LIMIT,
        questions_remaining: MONTHLY_QUESTION_LIMIT - (currentCount + 1),
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
