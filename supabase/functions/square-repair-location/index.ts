// supabase/functions/square-repair-location/index.ts
//
// Some therapists connected Square before square_location_id was
// being persisted. They have a square_access_token but no location,
// which makes square-create-deposit fail with "Square location not
// configured". This function looks up their first location via
// the Square Locations API and writes it back.
//
// Idempotent. Safe to call many times.
//
// Returns: { ok, updated, location_id, location_name } or { error }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSquareScopeError, flagSquareReconnect } from "../_shared/squareReconnect.ts";

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
    const { therapist_id } = await req.json();
    if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return respond({ error: 'env_not_set' }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: therapist, error } = await supabase
      .from('therapists')
      .select('id, square_access_token, square_location_id')
      .eq('id', therapist_id)
      .single();

    if (error || !therapist) return respond({ error: 'therapist_not_found' }, 404);
    if (!therapist.square_access_token) return respond({ error: 'square_not_connected' }, 400);

    if (therapist.square_location_id) {
      return respond({ ok: true, already_set: true, location_id: therapist.square_location_id });
    }

    // Look up locations on Square
    const locRes = await fetch('https://connect.squareup.com/v2/locations', {
      headers: {
        'Authorization': `Bearer ${therapist.square_access_token}`,
        'Square-Version': '2024-01-18',
      },
    });
    const locData = await locRes.json();
    if (!locRes.ok) {
      // HK Jun 2 2026: a missing-scope failure here means a stale token
      // (connected before MERCHANT_PROFILE_READ). Flag it so the dashboard
      // shows a one-tap reconnect instead of this raw error.
      if (isSquareScopeError(locRes.status, locData)) {
        await flagSquareReconnect(therapist_id, locData.errors?.[0]?.detail || 'Square repair: missing MERCHANT_PROFILE_READ');
        return respond({ error: 'needs_reconnect', detail: locData.errors?.[0]?.detail || 'Square needs to be reconnected' }, 400);
      }
      return respond({
        error: locData.errors?.[0]?.detail || 'square_locations_api_failed',
        raw: locData,
      }, 400);
    }

    // Pick the first ACTIVE location. If none active, pick the first one.
    const locs = locData.locations || [];
    const active = locs.find((l: any) => l.status === 'ACTIVE') || locs[0];
    if (!active) return respond({ error: 'no_locations_in_square_account' }, 400);

    await supabase.from('therapists')
      .update({ square_location_id: active.id })
      .eq('id', therapist_id);

    return respond({
      ok: true,
      updated: true,
      location_id: active.id,
      location_name: active.name,
    });

  } catch (e) {
    return respond({ error: String(e) }, 500);
  }
});
