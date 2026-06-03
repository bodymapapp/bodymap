import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSquareScopeError, flagSquareReconnect } from "../_shared/squareReconnect.ts";

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
    const { therapist_id, client_id, client_email, client_name, card_nonce } = await req.json();

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

    // Get therapist Square credentials
    const { data: therapist } = await supabase
      .from('therapists').select('square_access_token, square_location_id').eq('id', therapist_id).single();

    if (!therapist?.square_access_token) return respond({ error: 'Square not connected' }, 400);

    const token = therapist.square_access_token;
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Square-Version': '2024-01-18' };

    // Create or find Square customer
    const { data: client } = await supabase.from('clients').select('square_customer_id').eq('id', client_id).single();
    let customerId = client?.square_customer_id;

    if (!customerId) {
      const custRes = await fetch('https://connect.squareup.com/v2/customers', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          given_name: client_name?.split(' ')[0] || '',
          family_name: client_name?.split(' ').slice(1).join(' ') || '',
          email_address: client_email || '',
          idempotency_key: crypto.randomUUID(),
        }),
      });
      const custData = await custRes.json();
      if (!custRes.ok && isSquareScopeError(custRes.status, custData)) {
        await flagSquareReconnect(therapist_id, custData.errors?.[0]?.detail || 'Square save-card: permission error');
      }
      customerId = custData.customer?.id;
      if (customerId) {
        await supabase.from('clients').update({ square_customer_id: customerId }).eq('id', client_id);
      }
    }

    if (!customerId) return respond({ error: 'Failed to create Square customer' }, 400);

    // Save card using card nonce
    const cardRes = await fetch(`https://connect.squareup.com/v2/cards`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        source_id: card_nonce,
        card: { customer_id: customerId },
      }),
    });
    const cardData = await cardRes.json();

    if (!cardRes.ok || !cardData.card) {
      if (isSquareScopeError(cardRes.status, cardData)) {
        await flagSquareReconnect(therapist_id, cardData.errors?.[0]?.detail || 'Square save-card: permission error');
      }
      return respond({ error: cardData.errors?.[0]?.detail || 'Failed to save card' }, 400);
    }

    const card = cardData.card;

    // Save card info to client record
    await supabase.from('clients').update({
      square_card_id: card.id,
      square_customer_id: customerId,
      card_last4: card.last_4,
      card_brand: card.card_brand,
    }).eq('id', client_id);

    return respond({ success: true, last4: card.last_4, brand: card.card_brand, card_id: card.id });

  } catch (e) {
    return respond({ error: String(e) }, 500);
  }
});
