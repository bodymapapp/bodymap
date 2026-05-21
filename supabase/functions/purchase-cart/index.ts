// supabase/functions/purchase-cart/index.ts
//
// Multi-package cart checkout. Refactored May 2026 to use the
// PaymentProvider abstraction.
//
// Before: 200 lines branching internally on stripe_account_id vs
// square_access_token, copy-pasted with confirm-cart-purchase.
// After: ~70 lines that delegate everything provider-specific to
// PaymentProvider implementations.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, respond, getSupabaseClient, loadTherapist,
  getProvider, ProviderError,
} from '../_shared/payment-provider.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      therapist_id, cart_items,
      client_name, client_email, client_phone,
      redirect_url,
    } = await req.json();

    console.log('[purchase-cart] start', { therapist_id, size: cart_items?.length, client_email });

    if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);
    if (!Array.isArray(cart_items) || cart_items.length === 0) {
      return respond({ error: 'cart_items must be non-empty array' }, 400);
    }
    if (!client_email) return respond({ error: 'client_email required' }, 400);

    const supabase = getSupabaseClient();
    const therapist = await loadTherapist(supabase, therapist_id);

    // Load all packages in the cart in one query.
    const packageIds = cart_items.map((c: any) => c.package_id).filter(Boolean);
    const { data: pkgs } = await supabase
      .from('packages').select('*')
      .in('id', packageIds)
      .eq('therapist_id', therapist_id)
      .eq('active', true);
    if (!pkgs || pkgs.length === 0) return respond({ error: 'no_active_packages_found' }, 404);

    // Preserve cart order; drop missing/inactive items silently
    // (the cart UI already filtered to active; this is defense-in-depth).
    // Server-side guard (HK May 19 2026 audit item 8): also drop any
    // package whose visibility flipped to 'private' between cart add
    // and checkout. Treat private as unavailable, same as inactive.
    const lineItems = cart_items
      .map((c: any) => pkgs.find((p: any) => p.id === c.package_id))
      .filter(Boolean)
      .filter((p: any) => p.visibility !== 'private');
    if (lineItems.length === 0) return respond({ error: 'all_cart_items_inactive' }, 400);

    const therapistName = therapist.business_name || therapist.full_name || 'Therapist';

    // Build the abstraction's CartItem shape from the package rows.
    const items = lineItems.map((p: any) => ({
      itemId: p.id,
      name: `${p.name} · ${p.session_count} sessions`,
      description: `Package from ${therapistName}`,
      amountCents: Math.round(Number(p.price) * 100),
      quantity: 1,
      metadata: { package_id: p.id, item_type: 'package' },
    }));

    // Pick the provider. Auto policy: Stripe wins, Square fallback.
    const provider = await getProvider(therapist, 'auto');
    console.log('[purchase-cart] provider:', provider.name);

    const result = await provider.createCheckoutLink({
      therapist,
      items,
      customer: { name: client_name || null, email: client_email, phone: client_phone || null },
      redirectUrl: redirect_url,
      metadata: {
        therapist_id,
        client_name: client_name || '',
        client_email,
        client_phone: client_phone || '',
        purpose: 'cart_purchase',
        // Comma-separated fallback id list for the rare case where
        // a provider can't preserve per-line metadata. Multi-line
        // cart on Square uses order shape which DOES preserve, but
        // we include this for defense-in-depth.
        package_ids: items.map((i) => i.itemId).join(','),
      },
      mode: 'payment',
    });

    return respond({
      url: result.url,
      processor: provider.name,
      session_id: result.providerSessionId,
      payment_ref_id: result.paymentRefId,
      total_cents: result.totalCents,
      line_count: items.length,
    });

  } catch (e) {
    if (e instanceof ProviderError) {
      console.error('[purchase-cart] provider error', e.code, e.message);
      return respond({ error: e.message, code: e.code }, 400);
    }
    console.error('[purchase-cart] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
