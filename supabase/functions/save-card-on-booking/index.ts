// supabase/functions/save-card-on-booking/index.ts
//
// Card-on-file capture during the booking flow. Refactored May 2026
// to use PaymentProvider for the Stripe-specific bits (Customer +
// SetupIntent creation), keeping the business logic in this file.
//
// Flow:
//   1. Upsert the client record by therapist_id + (email or phone)
//   2. Hand off to provider.createSetupIntent() for Customer + SetupIntent
//   3. Persist customer_id on clients row
//   4. Record mandate text + agreed-at + hashed IP for audit
//   5. Return client_secret to the frontend, which calls
//      stripe.confirmCardSetup(client_secret, ...) to actually capture
//      the card
//
// Card-on-file requires Stripe by strategic design (Square does not
// have an embedded equivalent of Stripe Elements + SetupIntent in our
// roadmap). This function uses 'stripe-required' policy.

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
    } = await req.json();

    console.log('[save-card-on-booking] start', { therapist_id, booking_id, client_email });

    if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);
    if (!client_email && !client_phone) {
      return respond({ error: 'client_email or client_phone required' }, 400);
    }

    const supabase = getSupabaseClient();
    const therapist = await loadTherapist(supabase, therapist_id);

    // Card-on-file is Stripe-only by strategic design.
    const provider = await getProvider(therapist, 'stripe-required');

    // ─── Step 1: upsert client by email (preferred) or phone ────────
    const normalizedEmail = (client_email || '').trim().toLowerCase();
    const normalizedPhone = (client_phone || '').replace(/\D/g, '').slice(-10);

    let clientId: string | null = null;
    if (normalizedEmail) {
      // Pick the freshest row when duplicates exist. Logs a warning so
      // ops can see how often it happens (HK May 14 fix, mirrors
      // init-card-setup and BookingPage logic).
      const { data: rows } = await supabase
        .from('clients').select('id, stripe_customer_id, card_saved_at, created_at')
        .eq('therapist_id', therapist_id)
        .eq('email', normalizedEmail)
        .order('card_saved_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (Array.isArray(rows) && rows.length > 1) {
        console.warn(`[save-card-on-booking] duplicate client rows: ${rows.length} for therapist=${therapist_id} email=${normalizedEmail}. Using ${rows[0].id}.`);
      }
      if (Array.isArray(rows) && rows.length > 0) clientId = rows[0].id;
    }
    if (!clientId && normalizedPhone) {
      const { data: rows } = await supabase
        .from('clients').select('id, stripe_customer_id, card_saved_at, created_at')
        .eq('therapist_id', therapist_id)
        .ilike('phone', `%${normalizedPhone}%`)
        .order('card_saved_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (Array.isArray(rows) && rows.length > 1) {
        console.warn(`[save-card-on-booking] duplicate client rows by phone: ${rows.length} for therapist=${therapist_id}. Using ${rows[0].id}.`);
      }
      if (Array.isArray(rows) && rows.length > 0) clientId = rows[0].id;
    }

    // Create the client row if it doesn't exist
    if (!clientId) {
      const { data: created, error: cErr } = await supabase
        .from('clients')
        .insert({
          therapist_id,
          name: client_name || null,
          email: normalizedEmail || null,
          phone: normalizedPhone || null,
        })
        .select('id')
        .single();
      if (cErr || !created) {
        return respond({ error: 'client_create_failed: ' + cErr?.message }, 500);
      }
      clientId = created.id;
    }

    // ─── Step 2: provider creates Customer + SetupIntent ────────────
    const setupIntent = await provider.createSetupIntent({
      therapist,
      customer: {
        name: client_name || null,
        email: normalizedEmail || `noemail-${clientId}@nophone.local`,
        phone: normalizedPhone || null,
      },
    });

    // ─── Step 3: persist Stripe customer_id + mandate audit ─────────
    const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '';
    const ip = (ipHeader.split(',')[0] || '').trim();
    const ipHash = ip ? await hashIp(ip) : null;

    await supabase.from('clients').update({
      stripe_customer_id: setupIntent.providerCustomerId,
      card_mandate_text: mandate_text || null,
      card_mandate_agreed_at: mandate_text ? new Date().toISOString() : null,
      card_mandate_ip_hash: ipHash,
    }).eq('id', clientId);

    // Stamp the customer onto the booking too, so cancellation
    // charging can find it via booking_id alone.
    if (booking_id) {
      await supabase.from('bookings').update({
        card_on_file_customer_id: setupIntent.providerCustomerId,
      }).eq('id', booking_id);
    }

    console.log('[save-card-on-booking] success', { client_id: clientId, customer_id: setupIntent.providerCustomerId });

    return respond({
      client_secret: setupIntent.clientSecret,
      customer_id: setupIntent.providerCustomerId,
      client_id: clientId,
      account_id: setupIntent.accountId,
    });

  } catch (e) {
    if (e instanceof ProviderError) {
      console.error('[save-card-on-booking] provider error', e.code, e.message);
      return respond({ error: e.message, code: e.code }, 400);
    }
    console.error('[save-card-on-booking] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
