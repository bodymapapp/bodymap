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

  const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  try {
    const { action, code, therapist_id } = await req.json();

    // Action: get_oauth_url
    if (action === 'get_oauth_url') {
      const redirectUri = 'https://www.mybodymap.app/dashboard/stripe-connect';
      const state = therapist_id;
      const url = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${Deno.env.get('STRIPE_CLIENT_ID') || 'ca_test'}&scope=read_write&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
      
      // Alternative: use Account Links for hosted onboarding (simpler)
      const accountRes = await fetch('https://api.stripe.com/v1/accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          type: 'express',
          country: 'US',
          'capabilities[transfers][requested]': 'true',
          'capabilities[card_payments][requested]': 'true',
        }).toString(),
      });
      const account = await accountRes.json();
      
      if (!account.id) {
        return new Response(JSON.stringify({ error: 'Failed to create account', details: account }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Store account ID immediately
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
      await supabase.from('therapists').update({ stripe_account_id: account.id }).eq('id', therapist_id);

      // Create account link for onboarding
      const linkRes = await fetch('https://api.stripe.com/v1/account_links', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          account: account.id,
          refresh_url: `https://www.mybodymap.app/dashboard/stripe-connect?refresh=true`,
          return_url: `https://www.mybodymap.app/dashboard/stripe-connect?success=true&account_id=${account.id}&therapist_id=${therapist_id}`,
          type: 'account_onboarding',
        }).toString(),
      });
      const link = await linkRes.json();

      return new Response(JSON.stringify({ url: link.url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: confirm_connected
    if (action === 'confirm_connected' && therapist_id) {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
      await supabase.from('therapists').update({ stripe_account_connected: true }).eq('id', therapist_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: get_transactions - fetch real payment data
    if (action === 'get_transactions' && therapist_id) {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
      const { data: therapist } = await supabase.from('therapists').select('stripe_account_id').eq('id', therapist_id).single();
      
      if (!therapist?.stripe_account_id) {
        return new Response(JSON.stringify({ transactions: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const txRes = await fetch('https://api.stripe.com/v1/payment_intents?limit=100', {
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET}`,
          'Stripe-Account': therapist.stripe_account_id,
        },
      });
      const txData = await txRes.json();

      const transactions = (txData.data || []).map((tx: any) => ({
        id: tx.id,
        amount: tx.amount / 100,
        currency: tx.currency,
        status: tx.status,
        created: new Date(tx.created * 1000).toISOString(),
        client: tx.metadata?.client_name || 'Unknown',
        description: tx.description,
      }));

      return new Response(JSON.stringify({ transactions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
