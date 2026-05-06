import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const respond = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...cors, 'Content-Type': 'application/json' }
  });

  try {
    const { therapist_id, square_card_id, square_customer_id, amount_cents, tip_cents, description, client_email, send_receipt } = await req.json();

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

    const { data: therapist } = await supabase
      .from('therapists').select('square_access_token, square_location_id').eq('id', therapist_id).single();

    if (!therapist?.square_access_token) return respond({ error: 'Square not connected' }, 400);

    // SELF-HEALING location_id: see square-create-deposit for the
    // rationale. Look up via Square API and persist if missing.
    let locationId = therapist.square_location_id;
    if (!locationId) {
      try {
        const locRes = await fetch('https://connect.squareup.com/v2/locations', {
          headers: { 'Authorization': `Bearer ${therapist.square_access_token}`, 'Square-Version': '2024-01-18' },
        });
        const locData = await locRes.json();
        if (locRes.ok) {
          const active = (locData.locations || []).find((l: any) => l.status === 'ACTIVE') || (locData.locations || [])[0];
          if (active?.id) {
            locationId = active.id;
            await supabase.from('therapists').update({ square_location_id: locationId }).eq('id', therapist_id);
          }
        }
      } catch (e) { /* fall through */ }
    }
    if (!locationId) return respond({ error: 'Square location not configured. Please reconnect Square in Settings.' }, 400);

    const total = amount_cents + (tip_cents || 0);
    const token = therapist.square_access_token;

    const payRes = await fetch('https://connect.squareup.com/v2/payments', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Square-Version': '2024-01-18' },
      body: JSON.stringify({
        idempotency_key: `pay-${therapist_id}-${Date.now()}`,
        source_id: square_card_id,
        customer_id: square_customer_id,
        amount_money: { amount: total, currency: 'USD' },
        tip_money: tip_cents ? { amount: tip_cents, currency: 'USD' } : undefined,
        location_id: locationId,
        note: description || 'Massage session',
        ...(send_receipt && client_email ? { buyer_email_address: client_email } : {}),
      }),
    });

    const payData = await payRes.json();
    if (!payRes.ok) return respond({ error: payData.errors?.[0]?.detail || 'Payment failed' }, 400);

    return respond({ success: true, payment_id: payData.payment?.id, amount: total, status: payData.payment?.status });

  } catch (e) {
    return respond({ error: String(e) }, 500);
  }
});
