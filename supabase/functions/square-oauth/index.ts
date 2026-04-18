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

  const scopes = [
    'PAYMENTS_WRITE',
    'PAYMENTS_READ',
    'CUSTOMERS_WRITE',
    'CUSTOMERS_READ',
    'ORDERS_WRITE',
  ].join('+');

  const url = `https://connect.squareup.com/oauth2/authorize?client_id=${SQUARE_APP_ID}&scope=${scopes}&session=false&state=${therapist_id}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  return new Response(JSON.stringify({ url }), {
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
});
