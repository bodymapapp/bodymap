// supabase/functions/square-list-transactions/index.ts
//
// List recent Square payments for the authenticated therapist so the
// Billing Dashboard can show them alongside Stripe transactions.
//
// HK + Ashley both reported: 'My Square payments are still not
// attached, payments come in but don't show on the billing dashboard.'
// Root cause: BillingDashboard.js only checks
// therapist.stripe_account_connected and only invokes the stripe-connect
// function. Square payments were never wired in. This edge function
// fixes that by pulling from Square's /v2/payments endpoint.

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

    // Pull therapist row to get the Square token + location.
    const { data: therapist, error: tErr } = await supabase
      .from("therapists")
      .select("id, square_access_token, square_location_id, square_connected")
      .eq("id", user.id)
      .maybeSingle();

    if (tErr || !therapist) {
      return new Response(JSON.stringify({ error: "Therapist not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!therapist.square_access_token) {
      // Not connected to Square. Return empty list, not an error,
      // so the dashboard can handle this gracefully alongside the
      // Stripe-only therapists.
      return new Response(JSON.stringify({ transactions: [], connected: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Square /v2/payments returns the most recent payments first
    // by default. Pull up to 100 from the last 365 days, which covers
    // every billing-dashboard period (7d, 30d, MTD, YTD) without
    // pagination.
    const beginTime = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const params = new URLSearchParams({
      begin_time: beginTime,
      sort_order: "DESC",
      limit: "100",
    });
    if (therapist.square_location_id) {
      params.set("location_id", therapist.square_location_id);
    }

    const payRes = await fetch(`https://connect.squareup.com/v2/payments?${params}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${therapist.square_access_token}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-01-18",
      },
    });

    const payData = await payRes.json();
    if (!payRes.ok) {
      return new Response(JSON.stringify({
        error: payData.errors?.[0]?.detail || "Square API error",
        connected: true,
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize Square's payment shape into the same shape the
    // BillingDashboard expects from Stripe transactions:
    //   { id, amount, status, created, description, processor }
    // Square amounts are in cents; convert to dollars to match the
    // Stripe normalization the dashboard already does.
    const transactions = (payData.payments || []).map((p: any) => ({
      id: p.id,
      amount: (p.amount_money?.amount || 0) / 100,
      currency: p.amount_money?.currency || "USD",
      status: p.status === "COMPLETED" ? "succeeded"
            : p.status === "FAILED" ? "failed"
            : p.status === "CANCELED" ? "canceled"
            : "pending",
      created: p.created_at,
      description: p.note || "Square payment",
      processor: "square",
      // Useful for receipt linking
      receipt_url: p.receipt_url || null,
    }));

    return new Response(JSON.stringify({
      transactions,
      connected: true,
      count: transactions.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
