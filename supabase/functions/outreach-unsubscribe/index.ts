// outreach-unsubscribe edge function.
//
// Public endpoint hit by the unsubscribe link in every campaign email.
// Different from /unsubscribe (which is for therapists opting out of
// founder broadcasts). This one flips clients.outreach_unsubscribed
// for a specific (client, therapist) pair.
//
// URL: GET /functions/v1/outreach-unsubscribe?u=<token>
//   token = base64url(`${client_id}.${therapist_id}.${sig}`)
//   sig = HMAC-SHA256(`${client_id}:${therapist_id}`, UNSUBSCRIBE_SECRET).slice(0,16)
//
// On valid token: flips flag, returns a friendly HTML confirmation page.
// On invalid: returns a friendly "link expired" page (no error details).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HTML_CSS = `
  body { font-family: system-ui, -apple-system, sans-serif; background: #F5F0E8; margin: 0; padding: 24px; }
  .card { max-width: 480px; margin: 60px auto; background: #fff; border-radius: 16px; padding: 36px 28px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); text-align: center; }
  .leaf { font-size: 32px; margin-bottom: 12px; }
  h1 { font-family: Georgia, serif; font-size: 22px; color: #2A5741; margin: 0 0 12px; }
  p { font-size: 14px; color: #4B5563; line-height: 1.6; margin: 0 0 8px; }
  .quiet { font-size: 12px; color: #9CA3AF; margin-top: 18px; }
`;

function htmlPage(title: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${HTML_CSS}</style></head><body><div class="card"><div class="leaf">🌿</div>${body}</div></body></html>`;
}

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyToken(token: string): Promise<{ client_id: string; therapist_id: string } | null> {
  if (!token) return null;
  let decoded = "";
  try {
    decoded = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
  } catch { return null; }
  const parts = decoded.split(".");
  if (parts.length !== 3) return null;
  const [client_id, therapist_id, sig] = parts;
  const secret = Deno.env.get("UNSUBSCRIBE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const expected = (await hmacHex(secret, `${client_id}:${therapist_id}`)).slice(0, 32);
  if (sig !== expected) return null;
  return { client_id, therapist_id };
}

serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("u") || "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const respondHtml = (status: number, body: string) =>
    new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return respondHtml(500, htmlPage("Error", `<h1>Something went wrong</h1><p>Please try again later.</p>`));
  }

  const verified = await verifyToken(token);
  if (!verified) {
    return respondHtml(400, htmlPage("Link expired", `<h1>This link is no longer valid</h1><p>If you'd like to stop receiving emails, please reply directly to your therapist.</p>`));
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, therapist_id, outreach_unsubscribed, therapists(business_name, full_name)")
    .eq("id", verified.client_id)
    .eq("therapist_id", verified.therapist_id)
    .maybeSingle();

  if (!client) {
    return respondHtml(404, htmlPage("Link expired", `<h1>This link is no longer valid</h1><p>If you'd like to stop receiving emails, please reply directly to your therapist.</p>`));
  }

  const therapistName = client.therapists?.business_name || client.therapists?.full_name || "your therapist";

  if (client.outreach_unsubscribed) {
    return respondHtml(200, htmlPage("Already unsubscribed", `<h1>You're already unsubscribed</h1><p>You will not receive marketing emails from ${therapistName}.</p><p class="quiet">Booking confirmations and appointment reminders will still go through.</p>`));
  }

  await supabase
    .from("clients")
    .update({
      outreach_unsubscribed: true,
      outreach_unsubscribed_at: new Date().toISOString(),
    })
    .eq("id", verified.client_id);

  return respondHtml(200, htmlPage("Unsubscribed", `<h1>You've been unsubscribed</h1><p>You will not receive marketing emails from ${therapistName} going forward.</p><p class="quiet">Booking confirmations and appointment reminders will still go through. Reply to your therapist directly if you'd like to opt back in.</p>`));
});
