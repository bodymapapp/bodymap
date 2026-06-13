// supabase/functions/square-pos-reconcile/index.ts
//
// After the therapist taps a card in the Square Point of Sale app (Tap to
// Pay), Square hands control back to our page with a transaction_id. This
// function VERIFIES that charge directly with Square before recording a
// single cent as paid, then writes the session_payments row.
//
// Verification path (the supported, non-deprecated one):
//   1. The Point of Sale transaction_id IS the Square Order id.
//      GET /v2/orders/{transaction_id}  -> order.tenders[].payment_id
//   2. For each payment id:
//      GET /v2/payments/{payment_id}    -> amount_money.amount + status
//   3. Sum the amounts of payments whose status is COMPLETED or APPROVED.
//
// Safety rules this function never breaks:
//   - It records "paid" ONLY for amounts Square itself confirms as
//     completed. If anything cannot be confirmed, it returns ok:false with
//     a reason and writes nothing, so the page can say "we could not
//     confirm this, please check your Square app" and offer a retry.
//   - It is idempotent: the Square transaction_id is stored in
//     payment_method_detail, and a second callback for the same
//     transaction returns the already-recorded result instead of double
//     charging the books.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SQUARE_VERSION = "2024-01-18";

function squareHost() {
  // Match how square-oauth / square-pos-config choose the environment:
  // sandbox application ids start with 'sandbox-', production with 'sq0idp-'.
  const appId = Deno.env.get("SQUARE_APP_ID") || "";
  return appId.startsWith("sandbox-")
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, reason: "auth_required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const bookingId = body.booking_id;
    const clientId = body.client_id;
    const transactionId = (body.transaction_id || "").toString().trim();

    if (!bookingId || !transactionId) {
      return new Response(JSON.stringify({ ok: false, reason: "missing_params" }), {
        status: 400,
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
      return new Response(JSON.stringify({ ok: false, reason: "invalid_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: therapist, error: tErr } = await supabase
      .from("therapists")
      .select("id, square_access_token, square_location_id")
      .eq("id", user.id)
      .maybeSingle();

    if (tErr || !therapist || !therapist.square_access_token) {
      return new Response(JSON.stringify({ ok: false, reason: "square_not_connected" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const detailTag = `Square Tap to Pay · ${transactionId}`;

    // --- Idempotency: has this exact Square transaction already been recorded? ---
    const { data: existing } = await supabase
      .from("session_payments")
      .select("id, amount_cents, status")
      .eq("booking_id", bookingId)
      .eq("payment_method_detail", detailTag)
      .eq("status", "succeeded")
      .maybeSingle();

    if (existing?.id) {
      return new Response(
        JSON.stringify({ ok: true, already_recorded: true, amount_cents: existing.amount_cents, payment_id: existing.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const host = squareHost();
    const sqHeaders = {
      "Authorization": `Bearer ${therapist.square_access_token}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
    };

    // --- Step 1: the POS transaction id is the Order id. Retrieve the order. ---
    const orderRes = await fetch(`${host}/v2/orders/${encodeURIComponent(transactionId)}`, {
      method: "GET",
      headers: sqHeaders,
    });

    if (!orderRes.ok) {
      const t = await orderRes.text();
      return new Response(
        JSON.stringify({ ok: false, reason: "order_not_found", detail: t.slice(0, 300) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orderJson = await orderRes.json();
    const tenders = orderJson?.order?.tenders || [];
    const paymentIds: string[] = tenders
      .map((t: any) => t?.payment_id)
      .filter((x: any) => typeof x === "string" && x.length > 0);

    if (paymentIds.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, reason: "no_payment_on_order" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Step 2: retrieve each payment and sum only the confirmed amounts. ---
    let confirmedCents = 0;
    let anyConfirmed = false;
    for (const pid of paymentIds) {
      const payRes = await fetch(`${host}/v2/payments/${encodeURIComponent(pid)}`, {
        method: "GET",
        headers: sqHeaders,
      });
      if (!payRes.ok) continue;
      const payJson = await payRes.json();
      const pay = payJson?.payment;
      const status = (pay?.status || "").toUpperCase();
      const amt = Number(pay?.amount_money?.amount || 0);
      if ((status === "COMPLETED" || status === "APPROVED") && amt > 0) {
        confirmedCents += amt;
        anyConfirmed = true;
      }
    }

    if (!anyConfirmed || confirmedCents <= 0) {
      return new Response(
        JSON.stringify({ ok: false, reason: "not_completed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Step 3: record the confirmed payment against the booking. ---
    const { data: inserted, error: insErr } = await supabase
      .from("session_payments")
      .insert({
        booking_id: bookingId,
        member_subscription_id: null,
        member_subscription_renewal_id: null,
        package_purchase_id: null,
        therapist_id: therapist.id,
        client_id: clientId || null,
        amount_cents: confirmedCents,
        tip_cents: 0,
        payment_method: "other",
        payment_method_detail: detailTag,
        status: "succeeded",
        paid_at: new Date().toISOString(),
        created_by_therapist_id: therapist.id,
      })
      .select("id")
      .single();

    if (insErr) {
      return new Response(
        JSON.stringify({ ok: false, reason: "record_failed", detail: insErr.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, amount_cents: confirmedCents, payment_id: inserted?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, reason: "exception", detail: String(e?.message || e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
