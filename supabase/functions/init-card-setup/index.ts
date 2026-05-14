// supabase/functions/init-card-setup/index.ts
//
// Unified card-setup initialization. Routes to whichever provider
// the therapist uses for card-on-file (per payment_routing settings,
// or auto-pick if unset). Returns the data the frontend needs to
// mount the appropriate card form:
//
//   For Stripe: client_secret (for Stripe Elements + confirmCardSetup)
//   For Square: applicationId + locationId + customerId (for Square
//               Web Payments SDK card.attach + tokenize)
//
// Both processors return the data via the same response shape:
//   - client_secret: string (Stripe's client_secret OR Square's
//     JSON-encoded identity bundle)
//   - processor: 'stripe' | 'square'
//   - account_id: string (Stripe connected account or Square merchant
//     id; the frontend may pass it back to a tokenize call)
//   - customer_id: string (provider's customer id)
//   - client_id: string (our clients row id)
//   - capability: { status, limitations? } (so the frontend can
//     show a 'limited' notice inline if applicable)
//
// This replaces save-card-on-booking for the unified flow but keeps
// save-card-on-booking deployed for backward compat with any
// existing in-flight bookings on older code paths.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, respond, getSupabaseClient, loadTherapist,
  getProvider, ProviderError,
} from '../_shared/payment-provider.ts';

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      therapist_id,
      booking_id,
      client_name, client_email, client_phone,
      mandate_text,
      preferred_processor,    // optional 'stripe' | 'square' override
    } = await req.json();

    if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);
    if (!client_email && !client_phone) {
      return respond({ error: 'client_email or client_phone required' }, 400);
    }

    const supabase = getSupabaseClient();
    const therapist = await loadTherapist(supabase, therapist_id);

    // Resolve which provider to use for card-on-file.
    // Priority order:
    //   1. preferred_processor from the call (frontend can override)
    //   2. therapist.payment_routing.card_on_file (per-feature setting)
    //   3. auto-pick: Stripe wins ties (capability matrix prefers it)
    const routing = therapist.payment_routing as any || {};
    let resolved = preferred_processor || routing.card_on_file || 'auto';
    if (resolved === 'auto') {
      // Stripe wins by default for card-on-file (capability matrix
      // declares it 'supported' on Stripe and 'limited' on Square).
      if (therapist.stripe_account_id) resolved = 'stripe';
      else if (therapist.square_access_token) resolved = 'square';
      else return respond({ error: 'no_processor_connected' }, 400);
    }

    // Instantiate the chosen provider.
    let provider;
    if (resolved === 'stripe') {
      if (!therapist.stripe_account_id) {
        return respond({
          error: 'Stripe is not connected on this therapist profile',
          code: 'stripe_not_connected',
        }, 400);
      }
      const { StripeProvider } = await import('../_shared/providers/stripe.ts');
      provider = new StripeProvider();
    } else if (resolved === 'square') {
      if (!therapist.square_access_token) {
        return respond({
          error: 'Square is not connected on this therapist profile',
          code: 'square_not_connected',
        }, 400);
      }
      const { SquareProvider } = await import('../_shared/providers/square.ts');
      provider = new SquareProvider(therapist);
    } else {
      provider = await getProvider(therapist, 'auto');
    }

    // Capability check
    const capability = provider.getCapability('createSetupIntent');
    if (capability.status === 'unsupported') {
      return respond({
        error: `Card-on-file setup is not available on ${provider.name}`,
        code: 'capability_unsupported',
      }, 400);
    }

    // Upsert the client record (same as legacy save-card-on-booking).
    // When duplicates exist (HK May 14 2026: bodymap01 has 4 rows on
    // demo), prior maybeSingle() returned null and this branch
    // inserted yet ANOTHER row, compounding the problem. New behavior:
    // pull the freshest row by card_saved_at desc then created_at
    // desc, prefer that one, log a warning so duplicates surface in
    // the function logs for later cleanup.
    const normalizedEmail = (client_email || '').trim().toLowerCase();
    const normalizedPhone = (client_phone || '').replace(/\D/g, '').slice(-10);

    let clientId: string | null = null;
    if (normalizedEmail) {
      const { data: rows } = await supabase
        .from('clients').select('id, card_saved_at, created_at')
        .eq('therapist_id', therapist_id).eq('email', normalizedEmail)
        .order('card_saved_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (Array.isArray(rows) && rows.length > 1) {
        console.warn(`[init-card-setup] duplicate client rows: ${rows.length} for therapist=${therapist_id} email=${normalizedEmail}. Using ${rows[0].id}.`);
      }
      if (Array.isArray(rows) && rows.length > 0) clientId = rows[0].id;
    }
    if (!clientId && normalizedPhone) {
      const { data: rows } = await supabase
        .from('clients').select('id, card_saved_at, created_at')
        .eq('therapist_id', therapist_id).ilike('phone', `%${normalizedPhone}%`)
        .order('card_saved_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (Array.isArray(rows) && rows.length > 1) {
        console.warn(`[init-card-setup] duplicate client rows by phone: ${rows.length} for therapist=${therapist_id}. Using ${rows[0].id}.`);
      }
      if (Array.isArray(rows) && rows.length > 0) clientId = rows[0].id;
    }
    if (!clientId) {
      const { data: created, error: cErr } = await supabase
        .from('clients').insert({
          therapist_id,
          name: client_name || null,
          email: normalizedEmail || null,
          phone: normalizedPhone || null,
        }).select('id').single();
      if (cErr || !created) return respond({ error: 'client_create_failed: ' + cErr?.message }, 500);
      clientId = created.id;
    }

    // Provider creates Customer + SetupIntent (or Square equivalent)
    const setupIntent = await provider.createSetupIntent({
      therapist,
      customer: {
        name: client_name || null,
        email: normalizedEmail || `noemail-${clientId}@nophone.local`,
        phone: normalizedPhone || null,
      },
    });

    // Persist provider customer id + mandate audit
    const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '';
    const ip = (ipHeader.split(',')[0] || '').trim();
    const ipHash = ip ? await hashIp(ip) : null;

    const clientUpdates: Record<string, unknown> = {
      card_mandate_text: mandate_text || null,
      card_mandate_agreed_at: mandate_text ? new Date().toISOString() : null,
      card_mandate_ip_hash: ipHash,
    };
    if (provider.name === 'stripe') {
      clientUpdates.stripe_customer_id = setupIntent.providerCustomerId;
    } else {
      clientUpdates.square_customer_id = setupIntent.providerCustomerId;
    }
    await supabase.from('clients').update(clientUpdates).eq('id', clientId);

    if (booking_id) {
      const bookingUpdates: Record<string, unknown> = {};
      if (provider.name === 'stripe') {
        bookingUpdates.card_on_file_customer_id = setupIntent.providerCustomerId;
      } else {
        bookingUpdates.card_on_file_square_customer_id = setupIntent.providerCustomerId;
      }
      await supabase.from('bookings').update(bookingUpdates).eq('id', booking_id);
    }

    return respond({
      ok: true,
      processor: provider.name,
      client_secret: setupIntent.clientSecret,
      account_id: setupIntent.accountId,
      customer_id: setupIntent.providerCustomerId,
      client_id: clientId,
      capability: {
        status: capability.status,
        limitations: capability.limitations,
        recommendedAlternative: capability.recommendedAlternative,
      },
    });

  } catch (e) {
    if (e instanceof ProviderError) {
      console.error('[init-card-setup] provider error', e.code, e.message);
      return respond({ error: e.message, code: e.code }, 400);
    }
    console.error('[init-card-setup] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
