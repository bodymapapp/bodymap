import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const CAL_CLIENT_ID = Deno.env.get('CAL_CLIENT_ID');
  const CAL_CLIENT_SECRET = Deno.env.get('CAL_CLIENT_SECRET');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  try {
    const { action, code, therapist_id } = await req.json();

    // Action: get_auth_url - generate the Cal.com OAuth URL
    if (action === 'get_auth_url') {
      const redirectUri = 'https://www.mybodymap.app/dashboard/cal-connect';
      const authUrl = `https://app.cal.com/oauth/authorize?client_id=${CAL_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
      return new Response(JSON.stringify({ url: authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: exchange_code - exchange auth code for access token
    if (action === 'exchange_code' && code && therapist_id) {
      const redirectUri = 'https://www.mybodymap.app/dashboard/cal-connect';

      const tokenRes = await fetch('https://app.cal.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: CAL_CLIENT_ID,
          client_secret: CAL_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenData.access_token) {
        return new Response(JSON.stringify({ error: 'Token exchange failed', details: tokenData }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Store tokens in Supabase
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
      await supabase.from('therapists').update({
        cal_access_token: tokenData.access_token,
        cal_refresh_token: tokenData.refresh_token,
        cal_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        cal_connected: true,
      }).eq('id', therapist_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
