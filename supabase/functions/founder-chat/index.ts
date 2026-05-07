// supabase/functions/founder-chat/index.ts
//
// Founder Hub chat (section 10). Answers HK's questions using all
// founder-hub documents as the knowledge corpus.
//
// Authorization: HK email allowlist. Other authenticated users get
// 403. Unauthenticated users get 401.
//
// Approach: NOT a vector RAG (would require embeddings + vector
// store + retrieval pipeline). Instead, we put all founder docs
// directly into the Claude system prompt and let Claude reason
// over the full corpus. Total corpus is roughly 30-40k tokens
// of docs, well within Claude's context window.
//
// Why this approach:
//   - Same answer quality as RAG for our scale (small corpus)
//   - No vector DB to maintain
//   - No embedding pipeline to keep in sync
//   - Documents update at end of each session and the chat picks
//     up the new state on next call (we fetch latest from GitHub)
//   - When corpus exceeds ~80k tokens, switch to RAG

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FOUNDER_EMAILS = ["bodymapdemo@gmail.com"];

// Docs to fetch from GitHub. Order matters slightly; runbook first
// so it sets context, then specifics.
const FOUNDER_DOCS = [
  { name: "FOUNDER_RUNBOOK", path: "docs/FOUNDER_RUNBOOK.md" },
  { name: "BLOCK_PLAN", path: "BLOCK_PLAN.md" },
  { name: "CONTRIBUTING", path: "CONTRIBUTING.md" },
  { name: "BILLING_STRATEGY", path: "docs/BILLING_STRATEGY.md" },
  { name: "MARKETING_THERAPISTS", path: "docs/MARKETING_THERAPISTS.md" },
  { name: "MARKETING_INTERNAL", path: "docs/MARKETING_INTERNAL.md" },
];

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/bodymapapp/bodymap/main";

async function fetchAllDocs(): Promise<string> {
  const docFetches = FOUNDER_DOCS.map(async (doc) => {
    try {
      const res = await fetch(`${GITHUB_RAW_BASE}/${doc.path}`);
      if (!res.ok) return `\n\n# ${doc.name}\n\n[Could not load this document. HTTP ${res.status}]`;
      const text = await res.text();
      return `\n\n# ${doc.name}\n\n${text}`;
    } catch (err) {
      return `\n\n# ${doc.name}\n\n[Could not load this document. ${(err as Error).message}]`;
    }
  });
  const allDocs = await Promise.all(docFetches);
  return allDocs.join("\n\n---\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
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

    const userEmail = user.email?.toLowerCase().trim();
    if (!userEmail || !FOUNDER_EMAILS.includes(userEmail)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing messages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing API key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load the corpus fresh on every call. This is slow (~1-2 sec
    // for the GitHub fetches) but ensures the answer reflects the
    // latest committed state of every doc. If latency becomes a
    // problem, cache with a 60s TTL.
    const corpus = await fetchAllDocs();

    const systemPrompt = `You are a knowledgeable assistant for HK, the founder of MyBodyMap. You have full access to all of the founder's strategic documents below. Use them as your knowledge corpus when answering questions.

When HK asks a question:
- Answer directly and concisely
- Cite which document you are drawing from when relevant ("per the runbook," "per BILLING_STRATEGY")
- If a question is not covered in the documents, say so clearly rather than guessing
- Match HK's communication style: direct, no fluff, no em dashes, use "MyBodyMap" not "BodyMap"
- For code or technical questions, give specific file paths and line numbers when you have them
- For strategic questions, reference the design principles (deeper, simpler, automated, modern with way out, changeable) when relevant

Style rules:
- No em dashes anywhere. Use periods, commas, parentheses, or middots instead.
- Always use "MyBodyMap" in user-facing references, never "BodyMap" alone
- Be warm but not flowery. HK appreciates substance over polish.

Here are all the founder documents, current as of when this was loaded from the repo:

${corpus}`;

    const userMessages = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 2048,
        system: systemPrompt,
        messages: userMessages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return new Response(JSON.stringify({
        error: "Anthropic API error",
        details: errText,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await anthropicRes.json();
    const responseText = data.content?.[0]?.text ?? "(empty response)";

    return new Response(JSON.stringify({
      message: responseText,
      docsLoaded: FOUNDER_DOCS.map((d) => d.name),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: "Internal error",
      details: (err as Error).message,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
