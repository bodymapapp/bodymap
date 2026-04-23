// Admin-only migration runner. Executes pre-approved migration SQL via
// direct Postgres connection. Admin JWT check prevents abuse.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = new Set([
  "bodymap01@gmail.com",
  "bodymapdemo@gmail.com",
  "harshk.mba@gmail.com",
]);

const MIGRATIONS: Record<string, string> = {
  email_feedback: `
CREATE TABLE IF NOT EXISTS email_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id text NOT NULL,
  feedback text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  addressed_at timestamptz,
  addressed_note text
);
CREATE INDEX IF NOT EXISTS email_feedback_email_id_idx ON email_feedback(email_id);
CREATE INDEX IF NOT EXISTS email_feedback_status_idx ON email_feedback(status);
ALTER TABLE email_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_feedback_admin_all" ON email_feedback;
CREATE POLICY "email_feedback_admin_all" ON email_feedback
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (
      'bodymap01@gmail.com','bodymapdemo@gmail.com','harshk.mba@gmail.com'
    )
  );
`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "Missing token" }, 401);
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const email = (payload?.email || "").toLowerCase();
      if (!ADMIN_EMAILS.has(email)) return json({ ok: false, error: "Not authorized" }, 403);
    } catch {
      return json({ ok: false, error: "Invalid token" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const name = body?.name || "";
    if (!name || !MIGRATIONS[name]) {
      return json({ ok: false, error: "Unknown migration", available: Object.keys(MIGRATIONS) });
    }

    const DB_URL = Deno.env.get("SUPABASE_DB_URL") || "";
    if (!DB_URL) {
      return json({ ok: false, error: "SUPABASE_DB_URL env var not available" });
    }

    const { Client } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
    const client = new Client(DB_URL);
    try {
      await client.connect();
      await client.queryArray(MIGRATIONS[name]);
      await client.end();
      return json({ ok: true, migration: name, message: "Migration applied" });
    } catch (err: any) {
      try { await client.end(); } catch (_) { /* ignore */ }
      return json({ ok: false, error: `Migration failed: ${err?.message || String(err)}` });
    }
  } catch (e: any) {
    return json({ ok: false, error: e?.message || String(e) });
  }
});
