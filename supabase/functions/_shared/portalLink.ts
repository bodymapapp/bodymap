// supabase/functions/_shared/portalLink.ts
//
// Reuse-or-mint a passwordless client-portal token for a client email and
// return the magic link into their "My visits" page. This mirrors the
// request-link op in the client-portal function exactly, so a link minted
// here behaves the same as one a client requests for themselves: reuse a
// token still valid for at least 24h, otherwise mint a fresh 30-day one.
//
// Pass a service-role Supabase client as `admin`; client_portal_tokens is
// service-role only. Returns null on bad input or any error so callers can
// fall back to a safe URL and never render a broken button.

const SITE = "https://mybodymap.app";
const TOKEN_TTL_DAYS = 30;

function newToken() {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
}

export async function portalLinkForEmail(admin: any, email: string): Promise<string | null> {
  const em = (email || "").toLowerCase().trim();
  if (!em || !em.includes("@")) return null;
  try {
    let tok = "";
    const { data: existing } = await admin.from("client_portal_tokens")
      .select("token, expires_at").ilike("email", em)
      .gt("expires_at", new Date(Date.now() + 24 * 3600 * 1000).toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing?.token) {
      tok = existing.token;
    } else {
      tok = newToken();
      const { error } = await admin.from("client_portal_tokens").insert({
        email: em,
        token: tok,
        expires_at: new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 3600 * 1000).toISOString(),
      });
      if (error) return null;
    }
    return `${SITE}/my-visits?t=${tok}`;
  } catch {
    return null;
  }
}
