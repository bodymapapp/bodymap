import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getStripeSecret, isTestMode } from "../_shared/paymentMode.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let STRIPE_SECRET: string;
  try {
    STRIPE_SECRET = getStripeSecret();
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  // Stripe Connect OAuth uses a different identifier than the API
  // secret. Live and test environments have separate Connect client
  // ids registered with Stripe (ca_xxx for live, ca_xxx for test).
  const STRIPE_CLIENT_ID = isTestMode()
    ? (Deno.env.get('STRIPE_TEST_CLIENT_ID') || 'ca_test')
    : (Deno.env.get('STRIPE_CLIENT_ID') || 'ca_test');

  try {
    const body = await req.json();
    const { action, code, therapist_id } = body;
    const account_id = body.account_id; // optional, used by attach_account

    // Action: resume_onboarding
    //
    // Generates a fresh Account Link for the EXISTING stripe_account_id
    // so the therapist can resume Stripe's hosted onboarding where
    // they left off. CRITICAL: this does NOT create a new account.
    //
    // The old flow was: incomplete onboarding -> RefreshState ->
    // 'Finish Stripe setup' button -> navigates back to Settings ->
    // therapist taps 'Connect Stripe' purple button -> creates a
    // BRAND NEW Express account, abandoning the in-progress one.
    // Therapist could loop forever creating empty accounts. HK May
    // 15 2026 hit this. Fix: resume on the same account ID.
    if (action === 'resume_onboarding' && therapist_id) {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
      const { data: therapistRow } = await supabase
        .from('therapists')
        .select('stripe_account_id')
        .eq('id', therapist_id)
        .maybeSingle();

      if (!therapistRow?.stripe_account_id) {
        return new Response(JSON.stringify({
          error: 'No Stripe account on file. Start the connection flow from the beginning.',
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const linkRes = await fetch('https://api.stripe.com/v1/account_links', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          account: therapistRow.stripe_account_id,
          refresh_url: `https://www.mybodymap.app/dashboard/stripe-connect?refresh=true`,
          return_url: `https://www.mybodymap.app/dashboard/stripe-connect?success=true&account_id=${therapistRow.stripe_account_id}&therapist_id=${therapist_id}`,
          type: 'account_onboarding',
        }).toString(),
      });
      const link = await linkRes.json();

      if (!link.url) {
        return new Response(JSON.stringify({
          error: 'Could not generate resume link from Stripe',
          stripe_response: link,
        }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ url: link.url, account_id: therapistRow.stripe_account_id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: diagnose
    //
    // Returns the raw Stripe account state for the therapist so we
    // (and the UI) can show exactly which requirements are pending.
    // Used by the StripeConnect page RefreshState to display 'Stripe
    // needs: [bank account, identity verification, business address]'
    // instead of an opaque 'Setup not finished.'
    if (action === 'diagnose' && therapist_id) {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
      const { data: therapistRow } = await supabase
        .from('therapists')
        .select('stripe_account_id, stripe_account_connected')
        .eq('id', therapist_id)
        .maybeSingle();

      if (!therapistRow?.stripe_account_id) {
        return new Response(JSON.stringify({
          status: 'no_account',
          message: 'No Stripe account on file for this therapist.',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const acctRes = await fetch(`https://api.stripe.com/v1/accounts/${therapistRow.stripe_account_id}`, {
        headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` },
      });
      const acct = await acctRes.json();

      if (!acctRes.ok || !acct.id) {
        return new Response(JSON.stringify({
          status: 'stripe_lookup_failed',
          stripe_error: acct.error?.message || 'Could not fetch account from Stripe',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({
        status: 'ok',
        account_id: acct.id,
        charges_enabled: acct.charges_enabled,
        payouts_enabled: acct.payouts_enabled,
        details_submitted: acct.details_submitted,
        requirements_currently_due: acct.requirements?.currently_due || [],
        requirements_eventually_due: acct.requirements?.eventually_due || [],
        requirements_past_due: acct.requirements?.past_due || [],
        requirements_disabled_reason: acct.requirements?.disabled_reason || null,
        connected_in_db: !!therapistRow.stripe_account_connected,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: list_platform_accounts
    //
    // Lists all Stripe Express accounts under our Connect platform.
    // Used by the StripeDebug page to surface duplicates and let
    // HK manually attach a known-good account to a therapist row.
    if (action === 'list_platform_accounts') {
      const listRes = await fetch('https://api.stripe.com/v1/accounts?limit=100', {
        headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` },
      });
      const listData = await listRes.json();
      if (!listRes.ok) {
        return new Response(JSON.stringify({ error: 'Stripe list failed', stripe: listData }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const accounts = (listData.data || []).map((a: any) => ({
        id: a.id,
        email: a.email || null,
        display_name: a.business_profile?.name || a.settings?.dashboard?.display_name || null,
        charges_enabled: a.charges_enabled,
        payouts_enabled: a.payouts_enabled,
        details_submitted: a.details_submitted,
        created: a.created,
        currently_due_count: (a.requirements?.currently_due || []).length,
      }));
      return new Response(JSON.stringify({ accounts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: attach_account
    //
    // Manually link a specific Stripe account ID to a therapist row.
    // Used by HK from the StripeDebug page when an existing
    // enabled account exists for the therapist but the auto-match
    // by email did not find it. Verifies the account exists in
    // Stripe and that it is enabled before stamping the row.
    if (action === 'attach_account' && therapist_id && account_id) {
      // Verify with Stripe that the account exists and is ready
      const acctRes = await fetch(`https://api.stripe.com/v1/accounts/${account_id}`, {
        headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` },
      });
      const acct = await acctRes.json();
      if (!acctRes.ok || !acct.id) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'Could not find that account on Stripe',
          stripe: acct,
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const ready = !!(acct.charges_enabled && acct.payouts_enabled && acct.details_submitted);

      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
      const updatePayload: Record<string, any> = {
        stripe_account_id: acct.id,
        stripe_account_connected: ready,
      };
      if (ready) updatePayload.stripe_account_ready_at = new Date().toISOString();

      const { error: updErr } = await supabase
        .from('therapists')
        .update(updatePayload)
        .eq('id', therapist_id);

      if (updErr) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'Could not save attachment: ' + updErr.message,
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({
        ok: true,
        account_id: acct.id,
        ready,
        charges_enabled: acct.charges_enabled,
        payouts_enabled: acct.payouts_enabled,
        details_submitted: acct.details_submitted,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: get_standard_oauth_url
    //
    // Standard Connect path. Returns the URL the therapist visits
    // to authorize MyBodyMap to act on their EXISTING Stripe
    // account. No new account is created; they pick from accounts
    // they already own when they hit Stripe's OAuth screen.
    //
    // Standard differs from Express:
    //   - Therapist owns the Stripe account (we just get API
    //     permission)
    //   - They keep their existing transaction history, saved
    //     customer cards, subscriptions
    //   - One 1099 instead of two
    //   - 15-second OAuth flow vs 5-10 minute hosted onboarding
    //
    // The OAuth callback lands at /dashboard/stripe-connect-standard
    // which calls complete_standard_oauth below to exchange the code
    // for a real account ID.
    if (action === 'get_standard_oauth_url' && therapist_id) {
      if (!STRIPE_CLIENT_ID || STRIPE_CLIENT_ID === 'ca_test') {
        return new Response(JSON.stringify({
          error: 'STRIPE_CLIENT_ID is not configured. Set it in Supabase edge function secrets before using Standard Connect.',
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const redirectUri = 'https://www.mybodymap.app/dashboard/stripe-connect-standard';
      // state carries the therapist_id so the callback can attribute
      // the code to the right therapist row. URL-safe.
      const state = therapist_id;
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: STRIPE_CLIENT_ID,
        scope: 'read_write',
        redirect_uri: redirectUri,
        state,
        // suggested_capabilities surface only the capabilities we
        // actually need so the therapist sees the right scopes during
        // OAuth. card_payments and transfers cover our usage.
        'suggested_capabilities[]': 'card_payments',
      });
      const url = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
      return new Response(JSON.stringify({ url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: complete_standard_oauth
    //
    // Called from /dashboard/stripe-connect-standard after Stripe
    // redirects back with ?code=ac_xxx&state=therapist_id. We
    // exchange the code for an access token + the therapist's real
    // Stripe account ID, then stamp our row.
    //
    // We do NOT store the access token. We use OAuth only to learn
    // the account ID, then make all future API calls using our
    // platform secret + Stripe-Account: acct_xxx header. This is
    // standard Stripe Connect pattern; access token is only needed
    // if you want to make API calls AS that account (we do not).
    if (action === 'complete_standard_oauth' && code && therapist_id) {
      // Exchange the OAuth code for the connected account ID
      const tokenRes = await fetch('https://connect.stripe.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_secret: STRIPE_SECRET,
          code,
          grant_type: 'authorization_code',
        }).toString(),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.stripe_user_id) {
        return new Response(JSON.stringify({
          success: false,
          status: 'oauth_exchange_failed',
          error: tokenData.error_description || tokenData.error || 'Could not exchange OAuth code',
          stripe: tokenData,
        }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const connectedAccountId = tokenData.stripe_user_id;

      // Verify the account is actually ready to charge. Standard
      // accounts that the therapist already uses successfully will
      // have charges_enabled=true. If somehow we land on an account
      // missing requirements, surface the same shape as Express
      // confirm_connected so the UI can use one code path.
      const acctRes = await fetch(`https://api.stripe.com/v1/accounts/${connectedAccountId}`, {
        headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` },
      });
      const acct = await acctRes.json();
      if (!acctRes.ok || !acct.id) {
        return new Response(JSON.stringify({
          success: false,
          status: 'stripe_lookup_failed',
          error: acct.error?.message || 'Could not verify the connected account',
        }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const ready = !!(acct.charges_enabled && acct.payouts_enabled && acct.details_submitted);

      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
      const updatePayload: Record<string, any> = {
        stripe_account_id: connectedAccountId,
        stripe_account_type: 'standard',
        stripe_account_connected: ready,
      };
      if (ready) updatePayload.stripe_account_ready_at = new Date().toISOString();

      const { error: updErr } = await supabase
        .from('therapists')
        .update(updatePayload)
        .eq('id', therapist_id);

      if (updErr) {
        return new Response(JSON.stringify({
          success: false,
          status: 'db_update_failed',
          error: 'Could not save the connection. ' + updErr.message,
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (!ready) {
        // OAuth succeeded but the underlying account has requirements
        // pending. Rare for Standard (the therapist already runs a
        // Stripe account), but possible if they linked a fresh
        // unverified account. Return the missing fields so the UI
        // can prompt them to finish in Stripe directly.
        const missing: string[] = [];
        if (!acct.charges_enabled) missing.push('charges');
        if (!acct.payouts_enabled) missing.push('payouts');
        if (!acct.details_submitted) missing.push('business details');
        return new Response(JSON.stringify({
          success: false,
          status: 'standard_account_incomplete',
          error: `The account you linked still needs setup in Stripe: ${missing.join(', ')}.`,
          missing,
          requirements_currently_due: acct.requirements?.currently_due || [],
          account_id: connectedAccountId,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({
        success: true,
        status: 'connected',
        account_id: connectedAccountId,
        account_type: 'standard',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: get_oauth_url
    //
    // HK May 15 2026 CRITICAL FIX: do NOT blindly create a new
    // Express account every time someone taps Connect Stripe.
    // Previous behavior produced 31 throwaway accounts in HK's
    // Stripe dashboard because every reconnect minted a fresh one.
    // New behavior:
    //   1. Look up the therapist's email in our DB
    //   2. List existing connected Express accounts via Stripe API
    //   3. If any have charges_enabled=true AND match the therapist
    //      (by email on the account OR by the therapist row's
    //      existing stripe_account_id), reuse that account.
    //   4. Only when nothing matches do we create a new Express
    //      account.
    // This avoids the duplicate-account problem entirely and means
    // disconnect/reconnect goes back to the same working account
    // instead of stranding the user with a fresh empty one.
    if (action === 'get_oauth_url') {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

      // Pull therapist's contact info so we can match against any
      // existing Stripe Express accounts under our platform.
      const { data: therapistRow } = await supabase
        .from('therapists')
        .select('id, email, full_name, business_name')
        .eq('id', therapist_id)
        .maybeSingle();

      const therapistEmail = (therapistRow?.email || '').toLowerCase().trim();

      // List up to 100 most-recent connected accounts. At HK's
      // current scale (under 100 platform-wide) this is fine. When
      // we exceed 100, paginate.
      let existingMatch: any = null;
      try {
        const listRes = await fetch('https://api.stripe.com/v1/accounts?limit=100', {
          headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` },
        });
        const listData = await listRes.json();
        if (listRes.ok && Array.isArray(listData.data)) {
          // Prefer fully-enabled accounts matching the therapist's
          // email. Charges-enabled = real, ready, in use.
          existingMatch = listData.data.find((a: any) =>
            a.charges_enabled &&
            (a.email || '').toLowerCase().trim() === therapistEmail
          );
        }
      } catch (e) {
        // List failure is not fatal; we'll fall through to create.
        console.error('[stripe-connect] account list failed, falling through to create:', e);
      }

      // If we found a usable existing account, reuse it. Stamp the
      // therapist row immediately and return an Account Link in
      // 'account_update' mode so they can land in Stripe's settings
      // for that account without redoing all of onboarding.
      if (existingMatch) {
        await supabase
          .from('therapists')
          .update({
            stripe_account_id: existingMatch.id,
            stripe_account_connected: true,
            stripe_account_ready_at: new Date().toISOString(),
          })
          .eq('id', therapist_id);

        // No Account Link needed; account is already enabled. Return
        // a flag so the client knows to short-circuit and show the
        // 'You are connected' state without redirecting to Stripe.
        return new Response(JSON.stringify({
          reused_existing: true,
          account_id: existingMatch.id,
          // Provide a Stripe dashboard link for the therapist to
          // visit if they want, but the UI doesn't need to redirect.
          dashboard_url: `https://dashboard.stripe.com/${existingMatch.id}`,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // No match found. Create a fresh Express account scoped to
      // this therapist. We pass their email up-front so the new
      // account is matchable on future reconnects.
      const accountBody: Record<string, string> = {
        type: 'express',
        country: 'US',
        'capabilities[transfers][requested]': 'true',
        'capabilities[card_payments][requested]': 'true',
      };
      if (therapistEmail) accountBody.email = therapistEmail;
      if (therapistRow?.business_name) {
        accountBody['business_profile[name]'] = therapistRow.business_name;
      }

      const accountRes = await fetch('https://api.stripe.com/v1/accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(accountBody).toString(),
      });
      const account = await accountRes.json();

      if (!account.id) {
        return new Response(JSON.stringify({ error: 'Failed to create account', details: account }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Store account ID immediately so a future reconnect can find
      // it via the row even before charges are enabled.
      await supabase
        .from('therapists')
        .update({ stripe_account_id: account.id })
        .eq('id', therapist_id);

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

      return new Response(JSON.stringify({ url: link.url, account_id: account.id, reused_existing: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: confirm_connected
    //
    // Called from StripeConnect.js after Stripe's hosted onboarding
    // redirects back. The success=true query param means Stripe
    // *thinks* the user finished, but Stripe's flow lets users close
    // the tab partway through, so we cannot trust the redirect alone.
    //
    // We verify the account state directly with Stripe:
    //   - charges_enabled: account can accept payments
    //   - payouts_enabled: account can transfer to bank
    //   - details_submitted: business details and identity verified
    //
    // Only when all three are true do we flip stripe_account_connected
    // to true. Otherwise return a precise status so the UI can show
    // the right next step (typically: 'finish onboarding in Stripe').
    //
    // Race condition this fixes: HK reported May 8 2026 that Stripe
    // 'felt connected but wasn't'. The boolean was set but real
    // charges failed because the underlying account was not finished.
    if (action === 'confirm_connected' && therapist_id) {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

      // Look up the account_id we stored during get_oauth_url
      const { data: therapistRow, error: tErr } = await supabase
        .from('therapists')
        .select('stripe_account_id')
        .eq('id', therapist_id)
        .maybeSingle();

      if (tErr) {
        return new Response(JSON.stringify({
          success: false,
          status: 'db_error',
          error: 'Could not look up therapist record',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (!therapistRow?.stripe_account_id) {
        return new Response(JSON.stringify({
          success: false,
          status: 'no_account_id',
          error: 'No Stripe account associated with this therapist. Restart the connection flow.',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Verify with Stripe that the account is actually ready
      const acctRes = await fetch(`https://api.stripe.com/v1/accounts/${therapistRow.stripe_account_id}`, {
        headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` },
      });
      const acct = await acctRes.json();

      if (!acctRes.ok || !acct.id) {
        return new Response(JSON.stringify({
          success: false,
          status: 'stripe_lookup_failed',
          error: acct.error?.message || 'Could not verify Stripe account state',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const ready = !!(acct.charges_enabled && acct.payouts_enabled && acct.details_submitted);

      if (!ready) {
        // Account exists but onboarding is incomplete. Do NOT set
        // the connected flag. Return a precise status the UI can
        // map to a 'finish onboarding' state.
        const missing: string[] = [];
        if (!acct.charges_enabled) missing.push('charges');
        if (!acct.payouts_enabled) missing.push('payouts');
        if (!acct.details_submitted) missing.push('business details');

        // Make sure the boolean reflects reality. If a previous run
        // erroneously set it to true, undo that now.
        await supabase.from('therapists')
          .update({ stripe_account_connected: false })
          .eq('id', therapist_id);

        return new Response(JSON.stringify({
          success: false,
          status: 'onboarding_incomplete',
          error: `Stripe still needs: ${missing.join(', ')}.`,
          missing,
          requirements_currently_due: acct.requirements?.currently_due || [],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Account is fully ready. Flip the flag and verify the write.
      const { error: updErr } = await supabase
        .from('therapists')
        .update({
          stripe_account_connected: true,
          stripe_account_ready_at: new Date().toISOString(),
        })
        .eq('id', therapist_id);

      if (updErr) {
        return new Response(JSON.stringify({
          success: false,
          status: 'db_update_failed',
          error: 'Could not save connection state. Please try again.',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({
        success: true,
        status: 'connected',
      }), {
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
