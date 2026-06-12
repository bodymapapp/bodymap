// supabase/functions/board-publish/index.ts
//
// Publishes the Agent Board's active tasks (open + in progress) into the
// brain as docs/2_state/ASSIGNMENTS.md, so the other agents read their
// assignments at the start of every session. Triggered by the Publish
// button on the Founder Hub Agent Board.
//
// Why a function and not a direct write from the browser: committing to
// GitHub needs a token, and the token must never touch the browser or the
// repo. It lives here as the GITHUB_TOKEN edge-function secret.
//
// Founder-only: the caller's Supabase session is verified and must be the
// founder email before anything is written.
//
// Auto-deploys via GitHub Actions on push to supabase/functions/**.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FOUNDER_EMAIL = "bodymapdemo@gmail.com";
const REPO = "bodymapapp/bodymap";
const FILE_PATH = "docs/2_state/ASSIGNMENTS.md";
const BRANCH = "main";

const AGENTS: [string, string][] = [
  ["engineering", "Engineering"],
  ["customer_support", "Customer Support"],
  ["marketing", "Marketing"],
  ["strategy", "Strategy"],
  ["chief_of_staff", "Chief of Staff"],
];

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function buildMarkdown(tasks: any[]): string {
  const when = new Date().toISOString().slice(0, 16).replace("T", " ");
  let md = "# ASSIGNMENTS.md\n\n";
  md += "Published from the Agent Board. Each agent reads its own section at the ";
  md += "start of every session and works the top open item. [ ] is open, [~] is ";
  md += "in progress. Done and archived tasks are not published here, they live on ";
  md += "the board.\n\n";
  md += `Last published: ${when} (UTC) from the Founder Hub.\n\n`;
  for (const [key, label] of AGENTS) {
    const rows = tasks
      .filter((t) => t.agent === key)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    md += `## ${label}\n`;
    if (rows.length === 0) {
      md += "- No open assignment.\n\n";
      continue;
    }
    for (const t of rows) {
      const box = t.status === "in_progress" ? "[~]" : "[ ]";
      let line = `- ${box} ${t.title}`;
      if (t.detail && String(t.detail).trim()) line += `: ${String(t.detail).trim()}`;
      md += line + "\n";
    }
    md += "\n";
  }
  return md;
}

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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const githubToken = Deno.env.get("GITHUB_TOKEN");

    // Verify the caller is the founder.
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user || userData.user.email !== FOUNDER_EMAIL) {
      return json({ error: "Founder only." }, 403);
    }

    if (!githubToken) {
      return json(
        { error: "Publishing needs one setup step: add the GITHUB_TOKEN secret to this function." },
        400
      );
    }

    // Read the active tasks with the service role.
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: tasks, error: readErr } = await admin
      .from("agent_tasks")
      .select("*")
      .in("status", ["open", "in_progress"]);
    if (readErr) return json({ error: "Could not read the board." }, 500);

    const markdown = buildMarkdown(tasks || []);

    const ghBase = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
    const ghHeaders = {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "mybodymap-board-publish",
      "Content-Type": "application/json",
    };

    // Find the current file SHA, if the file already exists.
    let sha: string | undefined;
    const getRes = await fetch(`${ghBase}?ref=${BRANCH}`, { headers: ghHeaders });
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    }

    const putBody: Record<string, unknown> = {
      message: "Publish agent assignments from the Agent Board",
      content: toBase64(markdown),
      branch: BRANCH,
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(ghBase, {
      method: "PUT",
      headers: ghHeaders,
      body: JSON.stringify(putBody),
    });

    if (!putRes.ok) {
      const detail = await putRes.text();
      return json({ error: "Could not write to the brain.", detail }, 502);
    }

    const count = (tasks || []).length;
    return json({ ok: true, published: count });
  } catch (e) {
    return json({ error: "Publish failed.", detail: String(e) }, 500);
  }
});
