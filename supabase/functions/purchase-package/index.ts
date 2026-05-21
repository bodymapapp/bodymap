// supabase/functions/purchase-package/index.ts
//
// Single-package purchase. Refactored May 2026 to use PaymentProvider.
// purchase-cart is the multi-line variant; this is the single-line
// shortcut for "Buy this one package" buttons.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, respond, getSupabaseClient, loadTherapist,
  getProvider, ProviderError,
} from '../_shared/payment-provider.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      therapist_id, package_id,
      client_name, client_email, client_phone,
      redirect_url,
    } = await req.json();

    console.log('[purchase-package] start', { therapist_id, package_id });

    if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);
    if (!package_id) return respond({ error: 'package_id required' }, 400);
    if (!client_email) return respond({ error: 'client_email required' }, 400);

    const supabase = getSupabaseClient();
    const therapist = await loadTherapist(supabase, therapist_id);

    const { data: pkg } = await supabase
      .from('packages').select('*')
      .eq('id', package_id)
      .eq('therapist_id', therapist_id)
      .eq('active', true)
      .single();
    if (!pkg) return respond({ error: 'package_not_found_or_inactive' }, 404);
    // Server-side guard (HK May 19 2026 audit item 8). Reject if the
    // therapist marked this package private after the client loaded
    // the booking page. Mirrors purchase-membership guard.
    if ((pkg as any).visibility === 'private') {
      return respond({ error: 'package_unavailable' }, 410);
    }

    const therapistName = therapist.business_name || therapist.full_name || 'Therapist';

    const provider = await getProvider(therapist, 'auto');
    console.log('[purchase-package] provider:', provider.name);

    const result = await provider.createCheckoutLink({
      therapist,
      items: [{
        itemId: pkg.id,
        name: `${pkg.name} · ${pkg.session_count} sessions`,
        description: `Package from ${therapistName}`,
        amountCents: Math.round(Number(pkg.price) * 100),
        quantity: 1,
        metadata: { package_id: pkg.id, item_type: 'package' },
      }],
      customer: { name: client_name || null, email: client_email, phone: client_phone || null },
      redirectUrl: redirect_url,
      metadata: {
        therapist_id,
        client_name: client_name || '',
        client_email,
        client_phone: client_phone || '',
        purpose: 'package_purchase',
        package_id: pkg.id,
      },
      mode: 'payment',
    });

    return respond({
      url: result.url,
      processor: provider.name,
      session_id: result.providerSessionId,
      payment_ref_id: result.paymentRefId,
    });

  } catch (e) {
    if (e instanceof ProviderError) {
      console.error('[purchase-package] provider error', e.code, e.message);
      return respond({ error: e.message, code: e.code }, 400);
    }
    console.error('[purchase-package] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
