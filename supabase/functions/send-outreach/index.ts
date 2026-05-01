// send-outreach edge function.
//
// Sends a single outreach email via Resend. Caller provides:
//   to             — recipient email
//   subject        — email subject line
//   html           — full email HTML; may contain {unsubscribe_url}
//                    placeholder which is replaced server-side with a
//                    signed unsubscribe link (so the secret never
//                    leaves the server)
//   from           — sender (e.g. "Healing Hands <outreach@mybodymap.app>")
//   reply_to       — therapist's email
//   client_id      — recipient client id (for unsubscribe token)
//   therapist_id   — sender therapist id
//
// Unsubscribe token format:
//   base64url(`${client_id}.${therapist_id}.${sig}`)
//   where sig = HMAC-SHA256(`${client_id}:${therapist_id}`, secret).slice(0,16)
// Verified by outreach-unsubscribe edge function.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function base64UrlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateClientUnsubToken(clientId: string, therapistId: string): Promise<string> {
  const secret = Deno.env.get("UNSUBSCRIBE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const sig = (await hmacHex(secret, `${clientId}:${therapistId}`)).slice(0, 32);
  return base64UrlEncode(`${clientId}.${therapistId}.${sig}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://rmnqfrljoknmellbnpiy.supabase.co';

  const payload = await req.json();
  const { to, subject, html, from, reply_to, client_id, therapist_id } = payload;

  if (!to || !html) {
    return new Response(JSON.stringify({ error: 'missing fields' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  // If client_id + therapist_id present, generate unsubscribe link and
  // substitute {unsubscribe_url} in the HTML.
  let finalHtml = html;
  let unsubUrl: string | null = null;
  if (client_id && therapist_id) {
    const token = await generateClientUnsubToken(client_id, therapist_id);
    unsubUrl = `${SUPABASE_URL}/functions/v1/outreach-unsubscribe?u=${token}`;
    if (finalHtml.includes('{unsubscribe_url}')) {
      finalHtml = finalHtml.replace(/\{unsubscribe_url\}/g, unsubUrl);
    }
  }

  const body: Record<string, unknown> = { from, to: [to], subject, html: finalHtml };
  if (reply_to) body.reply_to = reply_to;

  // List-Unsubscribe headers improve inbox reputation and let mail
  // clients (Gmail, Apple Mail) show a one-click unsubscribe button.
  if (unsubUrl) {
    body.headers = {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return new Response(JSON.stringify(res.ok ? { success: true, id: data.id } : { error: data.message }), {
    status: res.ok ? 200 : 400,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
});
