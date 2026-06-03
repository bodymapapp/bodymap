// supabase/functions/_shared/squareReconnect.ts
//
// Square never upgrades an existing OAuth token's scopes. A therapist who
// connected before a scope was added (e.g. MERCHANT_PROFILE_READ) keeps a
// stale token that fails permission-gated calls, with no signal to the
// therapist. They look connected and healthy, so the app offers them
// nothing, and they silently churn (Puro Glow / Ashley).
//
// This helper lets any Square-calling edge function (a) recognise a
// scope/authorization failure and (b) flag the connection so the UI can
// surface a one-tap reconnect instead of a raw error. The flag is cleared
// on a successful reconnect (square-oauth-callback) and by the health sweep.
//
// flag/clear are best-effort: they must NEVER throw into the calling flow.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// True when a Square API response indicates the token is missing a scope
// or is otherwise unauthorized (as opposed to a normal decline / bad input).
export function isSquareScopeError(status: number, body: any): boolean {
  if (status === 401 || status === 403) return true;
  const errs = (body && body.errors) || [];
  for (const e of errs) {
    const code = String((e && e.code) || '').toUpperCase();
    const category = String((e && e.category) || '').toUpperCase();
    const detail = String((e && e.detail) || '').toUpperCase();
    if (
      code === 'INSUFFICIENT_SCOPES' ||
      code === 'FORBIDDEN' ||
      code === 'UNAUTHORIZED' ||
      code === 'ACCESS_TOKEN_EXPIRED' ||
      code === 'ACCESS_TOKEN_REVOKED'
    ) return true;
    if (category === 'AUTHENTICATION_ERROR') return true;
    if (
      detail.includes('MERCHANT_PROFILE_READ') ||
      detail.includes('SUFFICIENT PERMISSIONS') ||
      detail.includes('AUTHORIZE YOUR APPLICATION') ||
      detail.includes('MUST AUTHORIZE')
    ) return true;
  }
  return false;
}

function admin() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key);
}

// Mark a therapist's Square connection as needing reconnect. Best-effort.
export async function flagSquareReconnect(therapistId: string, reason: string): Promise<void> {
  try {
    const supabase = admin();
    if (!supabase || !therapistId) return;
    await supabase.from('therapists').update({
      square_needs_reconnect: true,
      square_reconnect_reason: (reason || 'Square permission error').slice(0, 300),
      square_reconnect_checked_at: new Date().toISOString(),
    }).eq('id', therapistId);
  } catch (_e) { /* best effort, never break the caller */ }
}

// Clear the flag (called after a successful reconnect or a healthy check).
export async function clearSquareReconnect(therapistId: string): Promise<void> {
  try {
    const supabase = admin();
    if (!supabase || !therapistId) return;
    await supabase.from('therapists').update({
      square_needs_reconnect: false,
      square_reconnect_reason: null,
      square_reconnect_checked_at: new Date().toISOString(),
    }).eq('id', therapistId);
  } catch (_e) { /* best effort */ }
}
