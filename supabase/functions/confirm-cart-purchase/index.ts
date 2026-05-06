// supabase/functions/confirm-cart-purchase/index.ts
//
// Verifies a cart payment via the PaymentProvider abstraction, then
// creates one package_purchases row per recovered line item.
// Idempotent on the payment reference so a double-redirect can't
// grant credits twice.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, respond, getSupabaseClient, loadTherapist,
  getProvider, ProviderError,
} from '../_shared/payment-provider.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      processor,        // 'stripe' | 'square' (used to pick provider when therapist has both)
      session_id,       // Stripe checkout session id
      order_id,         // Square order id
      therapist_id,
      client_email, client_name, client_phone,
    } = await req.json();

    console.log('[confirm-cart-purchase] start', { processor, session_id, order_id });

    const supabase = getSupabaseClient();

    // Resolve therapist_id. May be null if not passed; we can derive
    // it from session metadata for Stripe (set by purchase-cart) but
    // it's much cleaner to require it on the call. The booking page
    // confirm-redirect handler passes it.
    if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);
    const therapist = await loadTherapist(supabase, therapist_id);

    // Pick the provider that processed this payment. If the caller
    // told us, honor that. Otherwise auto-pick (Stripe wins).
    let policy: 'auto' | 'stripe-required' = 'auto';
    if (processor === 'stripe') policy = 'stripe-required';
    const provider = await getProvider(therapist, policy);

    // For Square, paymentRefId is order_id; for Stripe, it's the
    // checkout session id (provider verifyCheckout abstracts this).
    const paymentRefId = processor === 'square'
      ? order_id
      : (session_id || order_id);
    if (!paymentRefId) return respond({ error: 'session_id or order_id required' }, 400);

    const verified = await provider.verifyCheckout({ therapist, paymentRefId });
    if (!verified.paid) {
      console.log('[confirm-cart-purchase] not paid', verified.status);
      return respond({ error: 'payment_not_completed', status: verified.status }, 400);
    }
    if (verified.lineItems.length === 0) {
      return respond({ error: 'no_lines_resolved_to_packages' }, 400);
    }

    // Idempotency: if we already created any purchases for this
    // payment ref, return them rather than duplicating.
    const { data: existing } = await supabase
      .from('package_purchases')
      .select('id, package_id')
      .eq('stripe_payment_id', verified.paymentRefId);
    if (existing && existing.length > 0) {
      return respond({
        ok: true, idempotent: true,
        purchases: existing.map((p: any) => ({ package_id: p.package_id, purchase_id: p.id })),
      });
    }

    // Look up the package configs in bulk.
    const packageIds = verified.lineItems.map((li) => li.itemId);
    const { data: pkgRows } = await supabase
      .from('packages').select('*').in('id', packageIds);
    const pkgById: Record<string, any> = {};
    (pkgRows || []).forEach((p: any) => { pkgById[p.id] = p; });

    // Find or create a clients row for this email.
    let clientId: string | null = null;
    const verifiedEmail = (verified.customerEmail || client_email || '').toLowerCase();
    if (verifiedEmail) {
      const { data: c } = await supabase
        .from('clients')
        .select('id')
        .eq('therapist_id', therapist_id)
        .eq('email', verifiedEmail)
        .maybeSingle();
      if (c) clientId = c.id;
    }

    // Create one package_purchases row per line item.
    const purchases: Array<{ package_id: string; purchase_id: string }> = [];
    for (const line of verified.lineItems) {
      const pkg = pkgById[line.itemId];
      if (!pkg) {
        console.warn('[confirm-cart-purchase] no package row for itemId', line.itemId);
        continue;
      }
      const expiresAt = pkg.expires_in_days
        ? new Date(Date.now() + pkg.expires_in_days * 86400000).toISOString()
        : null;
      const { data: inserted, error: insErr } = await supabase
        .from('package_purchases')
        .insert({
          therapist_id,
          package_id: pkg.id,
          client_id: clientId,
          client_email: verifiedEmail,
          client_name: client_name || null,
          sessions_purchased: pkg.session_count,
          sessions_remaining: pkg.session_count,
          price_paid: line.amountCents / 100,
          stripe_payment_id: verified.paymentRefId,
          expires_at: expiresAt,
          status: 'active',
        })
        .select('id')
        .single();
      if (insErr) {
        console.error('[confirm-cart-purchase] insert failed for', pkg.id, insErr);
        continue;
      }
      purchases.push({ package_id: pkg.id, purchase_id: inserted.id });
    }

    return respond({ ok: true, purchases });

  } catch (e) {
    if (e instanceof ProviderError) {
      console.error('[confirm-cart-purchase] provider error', e.code, e.message);
      return respond({ error: e.message, code: e.code }, 400);
    }
    console.error('[confirm-cart-purchase] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
