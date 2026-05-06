// supabase/functions/square-create-deposit/index.ts
//
// Square equivalent of create-deposit (Stripe). Creates a hosted
// Square Payment Link the client can visit to pay the deposit, and
// returns the URL.
//
// Why Payment Links instead of Web Payments SDK:
//   - No SDK to load, no card form to mount, no JS state machine
//   - Square hosts the entire checkout (Apple Pay, Google Pay, card)
//   - On success, Square redirects back to a URL we provide
//   - Way faster to ship and matches the "click button, pay, done"
//     mental model for Ashley's clients on mobile
//
// The redirect URL carries the booking_id back so the booking page
// can mark deposit_paid=true.
//
// NOTE: webhook for payment.created is a TODO. For Phase 1 we trust
// the redirect arrival, since Square only redirects after a
// successful payment. A determined attacker could hit the redirect
// URL directly without paying — but they would still need the booking
// id and they would not get any service since the therapist has not
// yet rendered service. Mitigation comes in Phase 2 (webhook).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const {
      therapist_id,
      booking_id,
      amount_cents,
      service_name,
      therapist_name,
      client_email,
      redirect_url,
    } = await req.json();

    console.log('[square-create-deposit] start', { therapist_id, booking_id, amount_cents });

    if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);
    if (!booking_id) return respond({ error: 'booking_id required' }, 400);
    if (!amount_cents || amount_cents <= 0) return respond({ error: 'amount_cents must be positive' }, 400);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return respond({ error: 'Supabase env not set' }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: therapist, error: tErr } = await supabase
      .from('therapists')
      .select('square_access_token, square_location_id, business_name, full_name')
      .eq('id', therapist_id)
      .single();

    if (tErr || !therapist) {
      console.error('[square-create-deposit] therapist lookup failed', tErr);
      return respond({ error: 'therapist_not_found' }, 404);
    }
    if (!therapist.square_access_token) return respond({ error: 'Square is not connected on this therapist profile' }, 400);

    // SELF-HEALING: if square_location_id is missing, fetch it now and
    // persist before continuing. Some therapists connected Square before
    // the OAuth callback was setting this column, so they have a token
    // but no location stored. Rather than failing with 'location not
    // configured' and forcing them to re-OAuth, we look it up via the
    // Square Locations API and write it back. Idempotent and silent.
    let locationId = therapist.square_location_id;
    if (!locationId) {
      console.log('[square-create-deposit] location_id missing, self-healing via /v2/locations');
      try {
        const locRes = await fetch('https://connect.squareup.com/v2/locations', {
          headers: {
            'Authorization': `Bearer ${therapist.square_access_token}`,
            'Square-Version': '2024-01-18',
          },
        });
        const locData = await locRes.json();
        if (locRes.ok) {
          const locs = locData.locations || [];
          const active = locs.find((l: any) => l.status === 'ACTIVE') || locs[0];
          if (active?.id) {
            locationId = active.id;
            await supabase.from('therapists').update({ square_location_id: locationId }).eq('id', therapist_id);
            console.log('[square-create-deposit] healed location_id:', locationId);
          }
        } else {
          console.error('[square-create-deposit] locations API failed', locData);
        }
      } catch (e) {
        console.error('[square-create-deposit] location heal threw', e);
      }
    }
    if (!locationId) return respond({ error: 'Square location not configured. Please disconnect and reconnect Square in Settings.' }, 400);

    // ----- Square Payment Link API -----
    // POST /v2/online-checkout/payment-links
    // Returns a hosted checkout URL. Client visits, pays, gets
    // redirected to redirect_url with order id in the query string.
    const idempotencyKey = `dep-${booking_id}-${Date.now()}`;
    const linkRes = await fetch('https://connect.squareup.com/v2/online-checkout/payment-links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${therapist.square_access_token}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        quick_pay: {
          name: `Deposit · ${service_name || 'Massage session'}`,
          price_money: { amount: amount_cents, currency: 'USD' },
          location_id: locationId,
        },
        checkout_options: {
          ask_for_shipping_address: false,
          // Where Square redirects after successful payment. Carries
          // the booking_id back so the booking page can mark the
          // deposit paid and continue confirming.
          redirect_url: redirect_url || null,
          merchant_support_email: client_email || undefined,
        },
        pre_populated_data: client_email ? { buyer_email: client_email } : undefined,
        description: `Deposit for ${service_name || 'session'} with ${therapist_name || therapist.business_name || therapist.full_name || 'therapist'}`,
      }),
    });

    const linkData = await linkRes.json();
    if (!linkRes.ok) {
      console.error('[square-create-deposit] link create failed', linkData);
      return respond({ error: linkData.errors?.[0]?.detail || 'square_payment_link_failed', raw: linkData }, 400);
    }

    const link = linkData.payment_link;
    const url = link?.url;
    const orderId = link?.order_id;
    if (!url) {
      console.error('[square-create-deposit] no url in response', linkData);
      return respond({ error: 'no_url_returned' }, 500);
    }

    // Persist the order_id on the booking so we can match it on the
    // redirect / webhook. Using cancellation_charge_payment_intent_id
    // would be wrong since this is a deposit; using a new column
    // square_deposit_order_id keeps semantics clean.
    await supabase.from('bookings').update({
      square_deposit_order_id: orderId,
      square_deposit_link_id: link?.id || null,
    }).eq('id', booking_id);

    console.log('[square-create-deposit] success', { booking_id, orderId, url });

    return respond({
      url,
      order_id: orderId,
      payment_link_id: link?.id,
    });

  } catch (e) {
    console.error('[square-create-deposit] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
