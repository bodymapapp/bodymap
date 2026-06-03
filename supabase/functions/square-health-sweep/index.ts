// supabase/functions/square-health-sweep/index.ts
//
// Proactive Square connection health check. Square never upgrades an
// existing token's scopes, so therapists who connected before a scope was
// added (e.g. MERCHANT_PROFILE_READ) carry stale tokens that fail
// permission-gated calls with no signal. They look connected, so the app
// offers them nothing, and they silently churn.
//
// This sweep tests every connected Square token against a
// MERCHANT_PROFILE_READ-gated endpoint (/v2/merchants/me) and sets or
// clears square_needs_reconnect accordingly, so the dashboard can nudge the
// stale ones to reconnect BEFORE they ever hit a wall.
//
// Idempotent and safe to run repeatedly. Triggered from the founder
// dashboard (or workflow_dispatch). Pass { therapist_id } to check one.
//
// Returns aggregate counts plus the flagged businesses so the founder can
// follow up.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSquareScopeError } from "../_shared/squareReconnect.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const respond = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const onlyId = body?.therapist_id || null;

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return respond({ error: 'env_not_set' }, 500);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    let q = supabase
      .from('therapists')
      .select('id, business_name, square_access_token, square_connected')
      .not('square_access_token', 'is', null);
    if (onlyId) q = q.eq('id', onlyId);

    const { data: therapists, error } = await q;
    if (error) return respond({ error: error.message }, 500);

    let checked = 0, healthy = 0, flagged = 0, errored = 0;
    const flaggedList: Array<{ id: string; business_name: string | null; reason: string }> = [];
    const now = new Date().toISOString();

    for (const t of (therapists || [])) {
      if (!t.square_access_token) continue;
      checked++;
      try {
        // /v2/merchants/me requires MERCHANT_PROFILE_READ. A stale
        // pre-scope token fails here exactly like the repair path did.
        const res = await fetch('https://connect.squareup.com/v2/merchants/me', {
          headers: {
            'Authorization': `Bearer ${t.square_access_token}`,
            'Square-Version': '2024-01-18',
          },
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          healthy++;
          await supabase.from('therapists').update({
            square_needs_reconnect: false,
            square_reconnect_reason: null,
            square_reconnect_checked_at: now,
          }).eq('id', t.id);
        } else if (isSquareScopeError(res.status, data)) {
          flagged++;
          const reason = (data?.errors?.[0]?.detail || 'Square token is missing required permissions').slice(0, 300);
          flaggedList.push({ id: t.id, business_name: t.business_name, reason });
          await supabase.from('therapists').update({
            square_needs_reconnect: true,
            square_reconnect_reason: reason,
            square_reconnect_checked_at: now,
          }).eq('id', t.id);
        } else {
          // A non-scope error (e.g. transient Square 5xx). Do not flag;
          // just record that we checked so we do not misclassify.
          errored++;
          await supabase.from('therapists').update({
            square_reconnect_checked_at: now,
          }).eq('id', t.id);
        }
      } catch (_e) {
        errored++;
      }
    }

    return respond({
      ok: true,
      checked,
      healthy,
      flagged,
      errored,
      flagged_businesses: flaggedList,
      ran_at: now,
    });
  } catch (e) {
    return respond({ error: String(e) }, 500);
  }
});
