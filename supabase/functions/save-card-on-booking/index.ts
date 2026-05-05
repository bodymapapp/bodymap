// supabase/functions/save-card-on-booking/index.ts
//
// Card-on-file capture during booking flow. Distinct from save-card
// (which assumes an existing client_id from the therapist's dashboard).
//
// This function:
//   1. Upserts the client record by therapist_id + (email or phone match)
//   2. Creates a Stripe Customer on the therapist's connected account if
//      one does not yet exist
//   3. Creates a SetupIntent with off_session usage so the card can be
//      charged later for cancellation fees without the client present
//   4. Records the mandate text + agreed-at timestamp + hashed IP for
//      audit (state law compliance: CA, NY, MA, FL want disclosure proof)
//
// Returns: client_secret, customer_id, client_id, account_id
// The frontend then calls stripe.confirmCardSetup(client_secret, ...)
// to actually save the card. After that succeeds, frontend stores the
// resulting payment_method_id on the client record.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const respond = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });

  try {
    const {
      therapist_id,
      stripe_account_id,
      client_name,
      client_email,
      client_phone,
      mandate_text,
    } = await req.json();

    console.log('[save-card-on-booking] start', { therapist_id, has_email: !!client_email, has_phone: !!client_phone });

    if (!therapist_id) return respond({ error: 'therapist_id required' }, 400);
    if (!stripe_account_id) return respond({ error: 'No Stripe account connected on this therapist profile' }, 400);
    if (!client_email && !client_phone) return respond({ error: 'Email or phone required to identify client' }, 400);

    const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!STRIPE_SECRET) return respond({ error: 'STRIPE_SECRET_KEY not set' }, 500);
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return respond({ error: 'Supabase env not set' }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ----- Step 1: find or create client -----
    let client: any = null;
    const cleanEmail = client_email ? String(client_email).toLowerCase().trim() : null;
    const cleanPhone = client_phone ? String(client_phone).trim() : null;

    if (cleanEmail) {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('therapist_id', therapist_id)
        .eq('email', cleanEmail)
        .maybeSingle();
      if (data) client = data;
    }
    if (!client && cleanPhone) {
      const phoneNorm = cleanPhone.replace(/\D/g, '').slice(-10);
      if (phoneNorm.length >= 7) {
        const { data: byPhone } = await supabase
          .from('clients')
          .select('*')
          .eq('therapist_id', therapist_id)
          .not('phone', 'is', null);
        client = (byPhone || []).find((c: any) =>
          String(c.phone || '').replace(/\D/g, '').slice(-10) === phoneNorm
        ) || null;
      }
    }

    if (!client) {
      const { data: created, error: insErr } = await supabase
        .from('clients')
        .insert({
          therapist_id,
          name: client_name || 'Client',
          email: cleanEmail,
          phone: cleanPhone,
        })
        .select()
        .single();
      if (insErr) {
        console.error('[save-card-on-booking] client create failed', insErr);
        return respond({ error: 'client_create_failed: ' + insErr.message }, 500);
      }
      client = created;
      console.log('[save-card-on-booking] created new client', client.id);
    } else {
      console.log('[save-card-on-booking] matched existing client', client.id);
    }

    // ----- Step 2: Stripe Customer on connected account -----
    let customerId = client.stripe_customer_id;
    if (!customerId) {
      const params: Record<string, string> = {
        'metadata[client_id]': String(client.id),
        'metadata[therapist_id]': String(therapist_id),
      };
      if (cleanEmail) params.email = cleanEmail;
      if (client_name) params.name = String(client_name);
      if (cleanPhone) params.phone = cleanPhone;

      const custRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET}`,
          'Stripe-Account': stripe_account_id,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
      });
      const cust = await custRes.json();
      if (!custRes.ok) {
        console.error('[save-card-on-booking] customer create failed', cust);
        return respond({ error: cust.error?.message || 'stripe_customer_failed' }, 400);
      }
      customerId = cust.id;
      await supabase.from('clients')
        .update({ stripe_customer_id: customerId })
        .eq('id', client.id);
      console.log('[save-card-on-booking] created stripe customer', customerId);
    }

    // ----- Step 3: SetupIntent for off_session future charges -----
    const siRes = await fetch('https://api.stripe.com/v1/setup_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Stripe-Account': stripe_account_id,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customerId,
        'payment_method_types[]': 'card',
        usage: 'off_session',
        'metadata[therapist_id]': String(therapist_id),
        'metadata[client_id]': String(client.id),
        'metadata[purpose]': 'cancellation_policy_card_on_file',
      }),
    });
    const si = await siRes.json();
    if (!siRes.ok) {
      console.error('[save-card-on-booking] setup intent failed', si);
      return respond({ error: si.error?.message || 'setup_intent_failed' }, 400);
    }

    // ----- Step 4: record mandate audit trail -----
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || '';
    const ipHash = ip ? await hashIp(ip) : null;

    await supabase.from('clients').update({
      card_mandate_text: mandate_text || null,
      card_mandate_agreed_at: new Date().toISOString(),
      card_mandate_ip_hash: ipHash,
    }).eq('id', client.id);

    console.log('[save-card-on-booking] success', { client_id: client.id, customer_id: customerId });

    return respond({
      client_secret: si.client_secret,
      customer_id: customerId,
      client_id: client.id,
      account_id: stripe_account_id,
    });

  } catch (e) {
    console.error('[save-card-on-booking] uncaught error', e);
    return respond({ error: String(e) }, 500);
  }
});
