// supabase/functions/square-pos-config/index.ts
//
// Returns the small, non-secret configuration the browser needs to build
// a Square Point of Sale "Tap to Pay" deep link for the authenticated
// therapist:
//
//   { applicationId, locationId, environment }
//
// applicationId is our Square OAuth application id (non-secret, the same
// value that appears in the OAuth authorize URL). It lives server-side in
// the SQUARE_APP_ID env var, so the browser fetches it here rather than
// hard-coding it. locationId is the therapist's own Square location.
//
// The Point of Sale deep link itself is built and opened on the device.
// Nothing here moves money; the charge is confirmed server-side later by
// square-pos-reconcile after Square hands control back.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: therapist, error: tErr } = await supabase
      .from("therapists")
      .select("id, square_location_id, square_connected, square_access_token")
      .eq("id", user.id)
      .maybeSingle();

    if (tErr || !therapist) {
      return new Response(JSON.stringify({ error: "Therapist not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!therapist.square_access_token || !therapist.square_location_id) {
      return new Response(JSON.stringify({ ok: false, reason: "square_not_connected" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const applicationId = Deno.env.get("SQUARE_APP_ID") || "";
    // Sandbox application ids start with 'sandbox-'; production ids start
    // with 'sq0idp-'. The browser uses this to target the correct Square
    // Point of Sale handoff in sandbox testing vs production.
    const environment = applicationId.startsWith("sandbox-") ? "sandbox" : "production";

    return new Response(
      JSON.stringify({
        ok: true,
        applicationId,
        locationId: therapist.square_location_id,
        environment,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
