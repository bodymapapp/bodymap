import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const code        = url.searchParams.get('code');
  const therapistId = url.searchParams.get('state');
  const error       = url.searchParams.get('error');

  if (error || !code || !therapistId) {
    return new Response(`<html><body><script>window.opener?.postMessage({type:'square-oauth-error',error:'${error||'missing_code'}'},'*');window.close();</script></body></html>`, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  const SQUARE_APP_ID     = Deno.env.get('SQUARE_APP_ID');
  const SQUARE_APP_SECRET = Deno.env.get('SQUARE_APP_SECRET');
  const SUPABASE_URL      = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const REDIRECT_URI      = 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/square-oauth-callback';

  // Exchange code for access token
  const tokenRes = await fetch('https://connect.squareup.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Square-Version': '2024-01-18' },
    body: JSON.stringify({
      client_id: SQUARE_APP_ID,
      client_secret: SQUARE_APP_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    return new Response(`<html><body><script>window.opener?.postMessage({type:'square-oauth-error',error:'token_exchange_failed'},'*');window.close();</script></body></html>`, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Get merchant location ID
  const locRes = await fetch('https://connect.squareup.com/v2/locations', {
    headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Square-Version': '2024-01-18' }
  });
  const locData = await locRes.json();
  const locationId = locData.locations?.[0]?.id || '';

  // Save to therapist record
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
  await supabase.from('therapists').update({
    square_access_token: tokenData.access_token,
    square_merchant_id: tokenData.merchant_id,
    square_location_id: locationId,
    square_connected: true,
  }).eq('id', therapistId);

  return new Response(`
    <html>
      <body>
        <p style="font-family:system-ui;text-align:center;margin-top:40px;color:#2A5741;font-size:16px;">
          Square connected. Closing...
        </p>
        <script>
          if (window.opener) {
            window.opener.postMessage({type:'square-oauth-success'},'*');
            setTimeout(() => window.close(), 500);
          } else {
            window.location.href = 'https://mybodymap.app/dashboard?square=connected';
          }
        </script>
      </body>
    </html>
  `, { headers: { 'Content-Type': 'text/html' } });
});
