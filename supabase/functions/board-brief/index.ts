// supabase/functions/board-brief/index.ts
//
// Writes a clear, specific work brief for an Agent Board task, using
// Claude. HK taps "Write instructions" on a card, this returns a brief
// the agent can act on, and it gets saved into the task's detail so it
// travels with the task when published.
//
// Founder-only. Reuses the existing ANTHROPIC_API_KEY secret. Auto-deploys
// via GitHub Actions.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FOUNDER_EMAIL = "bodymapdemo@gmail.com";
const MODEL = "claude-opus-4-7";

const LABELS: Record<string, string> = {
  engineering: "Engineering 1",
  engineering_2: "Engineering 2",
  customer_support: "Customer Support",
  marketing: "Marketing",
  strategy: "Strategy",
  chief_of_staff: "Chief of Staff",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user || userData.user.email !== FOUNDER_EMAIL) {
      return json({ error: "Founder only." }, 403);
    }
    if (!apiKey) return json({ error: "Brief writing is not configured yet." }, 400);

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || "").trim();
    const detail = String(body?.detail || "").trim();
    const agentLabel = LABELS[String(body?.agent || "")] || "the";
    const refinement = String(body?.refinement || "").trim();
    if (!title) return json({ error: "No task title." }, 400);

    const system =
      `You write a clear, specific work prompt for a MyBodyMap agent. The agent is the ${agentLabel} agent. ` +
      `It will read this prompt and do the work, with HK reviewing. Given the task title, any notes, and any ` +
      `refinements from HK, write a prompt the agent can act on right away. Cover, in plain short lines: the goal ` +
      `in one or two sentences; the specifics of what to do and where it lives if known; constraints that matter for ` +
      `MyBodyMap (always say MyBodyMap not BodyMap, always platform not app or tool, no em dashes, mobile first, never ` +
      `show error pages to customers, never delete customer data without confirmation); and what done looks like. ` +
      `End with a short section titled "Risks" in plain words a non-technical founder can read in seconds, naming any ` +
      `risk to the founder, to therapists, or to customers, or write "Risks: low" if there are none worth noting. ` +
      `If HK gave refinements, follow them and weave them in. ` +
      `Output rules: plain and concrete, no fluff, no preamble, no sign off, around 150 to 230 words, no em dashes anywhere. ` +
      `Write only the prompt.`;

    const userMsg = `Task title: ${title}\nNotes: ${detail || "(none)"}\nHK refinements: ${refinement || "(none)"}`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!aiRes.ok) {
      const detailText = await aiRes.text();
      return json({ error: "Could not write the brief just now.", detail: detailText }, 502);
    }
    const data = await aiRes.json();
    const brief = (data?.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    if (!brief) return json({ error: "The brief came back empty, try again." }, 502);
    return json({ ok: true, brief });
  } catch (e) {
    return json({ error: "Brief writing failed.", detail: String(e) }, 500);
  }
});
