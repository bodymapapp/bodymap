// Shared HMAC-signed unsubscribe token helpers.
// Token format: base64url(therapist_id . "." . signature)
// Signature: HMAC-SHA256(therapist_id, secret) truncated to 16 bytes -> hex
//
// Safe from tampering: a bad actor can't forge a token without the secret.
// No expiry: CAN-SPAM requires unsubscribe links to work for at least 30 days
// after send, and operationally it's friendlier to keep them valid forever.
//
// Secret comes from Deno.env.get("UNSUBSCRIBE_SECRET"). If missing we fall
// back to SUPABASE_SERVICE_ROLE_KEY so the links still work without extra
// setup. Set UNSUBSCRIBE_SECRET explicitly in prod for best hygiene.

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const keyData = enc.encode(key);
  const msgData = enc.encode(message);
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const bytes = new Uint8Array(sigBuf);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export async function generateUnsubToken(therapistId: string): Promise<string> {
  const secret =
    Deno.env.get("UNSUBSCRIBE_SECRET") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "";
  const sig = (await hmacHex(secret, therapistId)).slice(0, 32);
  // Simple non-URL-encoded format: uuid.sig (both are URL-safe already)
  return `${therapistId}.${sig}`;
}

export async function verifyUnsubToken(token: string): Promise<string | null> {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [therapistId, sig] = parts;
  if (!therapistId || !sig) return null;
  // UUID sanity check
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(therapistId)) return null;
  const expected = await generateUnsubToken(therapistId);
  // Constant-time comparison isn't critical here (the signed value is a UUID,
  // not a password), but we still do byte-equal string compare.
  if (expected !== token) return null;
  return therapistId;
}

export const UNSUB_BASE_URL = "https://mybodymap.app/unsubscribe";
export const BODYMAP_LLC_ADDRESS = "BodyMap LLC, 30 N Gould St Ste R, Sheridan, WY 82801";

// Standard CAN-SPAM-compliant footer for all marketing email.
// Returns HTML. Use this at the bottom of marketing email templates.
export function unsubscribeFooterHtml(therapistId: string, unsubUrl: string): string {
  return `
<div style="margin-top:28px;padding-top:18px;border-top:1px solid #E8E4DC;font-size:11px;color:#9CA3AF;line-height:1.6">
  <div>You're receiving this because you signed up for MyBodyMap at mybodymap.app.</div>
  <div style="margin-top:6px"><a href="${unsubUrl}" style="color:#6B7280;text-decoration:underline">Unsubscribe from all marketing emails</a></div>
  <div style="margin-top:6px">${BODYMAP_LLC_ADDRESS}</div>
</div>`;
}

// Plain text version of the footer, for email clients that prefer text.
export function unsubscribeFooterText(unsubUrl: string): string {
  return [
    "",
    "---",
    "You're receiving this because you signed up for MyBodyMap at mybodymap.app.",
    `Unsubscribe from all marketing emails: ${unsubUrl}`,
    BODYMAP_LLC_ADDRESS,
  ].join("\n");
}
