// supabase/functions/board-publish/index.ts
//
// Publishes the Agent Board's tasks into the brain so the agents read
// their assignments. Writes a numbered, per-agent list between the
// ASSIGNMENTS markers at the top of docs/2_state/BLOCK_PLAN.md, which
// every agent already reads at the start of a session. So a task shows
// up as, for example, "Engineering 1", and HK can dispatch it in the
// Engineering chat by saying "complete Engineering 1".
//
// Body (optional): { ids: ["uuid", ...] } publishes only those tasks.
// With no ids, publishes all open and in-progress tasks.
//
// Founder-only. The GitHub token lives as the GITHUB_TOKEN secret and
// never leaves the server. Auto-deploys via GitHub Actions.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FOUNDER_EMAIL = "bodymapdemo@gmail.com";
const REPO = "bodymapapp/bodymap";
const FILE_PATH = "docs/2_state/BLOCK_PLAN.md";
const BRANCH = "main";
const START = "<!-- ASSIGNMENTS:START -->";
const END = "<!-- ASSIGNMENTS:END -->";

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
function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function buildBlock(tasks: any[]): string {
  const when = new Date().toISOString().slice(0, 16).replace("T", " ");
  let md = "## Assignments by agent\n\n";
  md += "Published from the Agent Board. Each agent reads its own section and ";
  md += "works the top open item by number. [ ] is open, [~] is in progress. ";
  md += "This block is written by the board, do not hand-edit it.\n\n";
  md += `Last published: ${when} (UTC).\n\n`;
  for (const [key, label] of AGENTS) {
    const rows = tasks
      .filter((t) => t.agent === key)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    md += `### ${label}\n`;
    if (rows.length === 0) {
      md += "- No open assignment.\n\n";
      continue;
    }
    rows.forEach((t, i) => {
      const box = t.status === "in_progress" ? "[~]" : "[ ]";
      let line = `${i + 1}. ${box} ${t.title}`;
      if (t.detail && String(t.detail).trim()) line += `: ${String(t.detail).trim()}`;
      md += line + "\n";
    });
    md += "\n";
  }
  return md.trimEnd();
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

    let ids: string[] | null = null;
    try {
      const body = await req.json();
      if (Array.isArray(body?.ids) && body.ids.length > 0) ids = body.ids;
    } catch (_e) {
      // no body, publish everything active
    }

    const admin = createClient(supabaseUrl, serviceKey);
    let query = admin.from("agent_tasks").select("*").in("status", ["open", "in_progress"]);
    if (ids) query = query.in("id", ids);
    const { data: tasks, error: readErr } = await query;
    if (readErr) return json({ error: "Could not read the board." }, 500);

    const block = buildBlock(tasks || []);

    const ghBase = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
    const ghHeaders = {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "mybodymap-board-publish",
      "Content-Type": "application/json",
    };

    const getRes = await fetch(`${ghBase}?ref=${BRANCH}`, { headers: ghHeaders });
    if (!getRes.ok) return json({ error: "Could not read the block plan." }, 502);
    const existing = await getRes.json();
    const current = fromBase64(existing.content || "");

    const si = current.indexOf(START);
    const ei = current.indexOf(END);
    if (si === -1 || ei === -1 || ei < si) {
      return json(
        { error: "The assignments markers are missing from the block plan, so nothing was changed." },
        409
      );
    }
    const before = current.slice(0, si + START.length);
    const after = current.slice(ei);
    const next = `${before}\n${block}\n${after}`;

    const putRes = await fetch(ghBase, {
      method: "PUT",
      headers: ghHeaders,
      body: JSON.stringify({
        message: "Publish agent assignments from the Agent Board",
        content: toBase64(next),
        branch: BRANCH,
        sha: existing.sha,
      }),
    });
    if (!putRes.ok) {
      const detail = await putRes.text();
      return json({ error: "Could not write to the brain.", detail }, 502);
    }

    return json({ ok: true, published: (tasks || []).length });
  } catch (e) {
    return json({ error: "Publish failed.", detail: String(e) }, 500);
  }
});
