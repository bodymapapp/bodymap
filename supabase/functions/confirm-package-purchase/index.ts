// supabase/functions/confirm-package-purchase/index.ts
//
// Single-package confirmation. After hosted checkout returns, verifies
// payment and creates the package_purchases row. Idempotent.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, respond, getSupabaseClient, loadTherapist,
  getProvider, ProviderError,
} from '../_shared/payment-provider.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      processor, session_id, order_id,
      package_id, therapist_id: therapistIdParam,
      client_email, client_name, client_phone,
    } = await req.json();

    console.log('[confirm-package-purchase] start', { processor, package_id });

    if (!package_id) return respond({ error: 'package_id required' }, 400);

    const supabase = getSupabaseClient();

    // Look up the package, derive therapist_id from it if not passed.
    const { data: pkg } = await supabase
      .from('packages').select('*').eq('id', package_id).single();
    if (!pkg) return respond({ error: 'package_not_found' }, 404);

    const therapist_id = therapistIdParam || pkg.therapist_id;
    const therapist = await loadTherapist(supabase, therapist_id);

    let policy: 'auto' | 'stripe-required' = 'auto';
    if (processor === 'stripe') policy = 'stripe-required';
    const provider = await getProvider(therapist, policy);

    const paymentRefId = processor === 'square' ? order_id : (session_id || order_id);
    if (!paymentRefId) return respond({ error: 'session_id or order_id required' }, 400);

    const verified = await provider.verifyCheckout({ therapist, paymentRefId });
    if (!verified.paid) {
      return respond({ error: 'payment_not_completed', status: verified.status }, 400);
    }

    // Idempotency by paymentRefId
    const { data: existing } = await supabase
      .from('package_purchases')
      .select('id')
      .eq('stripe_payment_id', verified.paymentRefId)
      .maybeSingle();
    if (existing) {
      return respond({ ok: true, idempotent: true, purchase_id: existing.id });
    }

    // Find client by email
    const verifiedEmail = (verified.customerEmail || client_email || '').toLowerCase();
    let clientId: string | null = null;
    if (verifiedEmail) {
      const { data: c } = await supabase
        .from('clients').select('id')
        .eq('therapist_id', therapist_id).eq('email', verifiedEmail).maybeSingle();
      if (c) clientId = c.id;
    }

    const expiresAt = pkg.expires_in_days
      ? new Date(Date.now() + pkg.expires_in_days * 86400000).toISOString()
      : null;

    const amountCents = verified.totalCents || verified.lineItems[0]?.amountCents || 0;

    const { data: inserted, error: insErr } = await supabase
      .from('package_purchases')
      .insert({
        therapist_id, package_id,
        client_id: clientId,
        client_email: verifiedEmail,
        client_name: client_name || null,
        sessions_purchased: pkg.session_count,
        sessions_remaining: pkg.session_count,
        price_paid: amountCents / 100,
        stripe_payment_id: verified.paymentRefId,
        expires_at: expiresAt,
        status: 'active',
      })
      .select('id')
      .single();

    if (insErr) {
      console.error('[confirm-package-purchase] insert failed', insErr);
      return respond({ error: 'insert_failed: ' + insErr.message }, 500);
    }

    return respond({ ok: true, purchase_id: inserted.id });

  } catch (e) {
    if (e instanceof ProviderError) {
      console.error('[confirm-package-purchase] provider error', e.code, e.message);
      return respond({ error: e.message, code: e.code }, 400);
    }
    console.error('[confirm-package-purchase] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
