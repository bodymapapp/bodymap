import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const { therapist_id } = await req.json();

  const SQUARE_APP_ID = Deno.env.get('SQUARE_APP_ID');
  const REDIRECT_URI  = 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/square-oauth-callback';

  // Full scope list for Square parity. Every scope here maps to a
  // specific operation in the PaymentProvider abstraction:
  //
  //   PAYMENTS_WRITE          - chargeSavedCard, saveCardOnFile, refund
  //   PAYMENTS_READ           - reading payment status
  //   CUSTOMERS_WRITE         - findOrCreateCustomer (create path)
  //   CUSTOMERS_READ          - findOrCreateCustomer (search path)
  //   ORDERS_WRITE            - createCheckoutLink (payment links)
  //   ORDERS_READ             - verifyCheckout, refund (order -> payment_id)
  //   MERCHANT_PROFILE_READ   - loadLocation (/v2/locations)
  //   ITEMS_WRITE             - ensureCatalogPlan (subscriptions)
  //   ITEMS_READ              - reading existing catalog plans
  //   SUBSCRIPTIONS_WRITE     - createSubscriptionLink, recurring renewals
  //   SUBSCRIPTIONS_READ      - reading subscription status
  //
  // Adding scopes after a therapist already connected requires them
  // to disconnect + reconnect Square. Square does not auto-upgrade
  // an existing OAuth session's scopes when we add new ones here.
  const scopes = [
    'PAYMENTS_WRITE',
    'PAYMENTS_READ',
    'CUSTOMERS_WRITE',
    'CUSTOMERS_READ',
    'ORDERS_WRITE',
    'ORDERS_READ',
    'MERCHANT_PROFILE_READ',
    'ITEMS_WRITE',
    'ITEMS_READ',
    'SUBSCRIPTIONS_WRITE',
    'SUBSCRIPTIONS_READ',
  ].join('+');

  const url = `https://connect.squareup.com/oauth2/authorize?client_id=${SQUARE_APP_ID}&scope=${scopes}&session=false&state=${therapist_id}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  return new Response(JSON.stringify({ url }), {
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
});
