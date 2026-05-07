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
    const { messages, context, mode } = await req.json();
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

    // Read current usage. Row may not exist yet for first question
    // of the month.
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
