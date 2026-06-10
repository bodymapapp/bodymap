// supabase/functions/validate-coupon/index.ts
//
// Validates a client-entered coupon code at booking time and returns a
// price preview. The public booking page calls this to show the new
// price, deposit, and balance. It NEVER decides the final charge; the
// deposit functions recompute the discount server-side from the real
// service price when the client pays. Service role is used so the public
// never reads or enumerates the coupons table directly.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCoupon, applyDiscountCents, reasonMessage } from "../_shared/coupon.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const respond = (data: any) => new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

  try {
    const { therapist_id, custom_url, code, client_email, base_price_cents } = await req.json();
    if (!code || !String(code).trim()) return respond({ valid: false, reason: 'not_found', message: reasonMessage('not_found') });

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return respond({ valid: false, reason: 'error', message: reasonMessage() });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Resolve the therapist.
    let tId = therapist_id || null;
    if (!tId && custom_url) {
      const { data: t } = await supabase.from('therapists').select('id').eq('custom_url', custom_url).maybeSingle();
      tId = t?.id || null;
    }
    if (!tId) return respond({ valid: false, reason: 'not_found', message: reasonMessage('not_found') });

    // Load the coupon (case-insensitive match on code).
    const { data: c } = await supabase
      .from('coupons')
      .select('*')
      .eq('therapist_id', tId)
      .ilike('code', String(code).trim())
      .maybeSingle();

    // New-client check only when the code requires it and we have an email.
    let isNewClient = true;
    if (c?.new_clients_only && client_email) {
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('therapist_id', tId)
        .ilike('email', String(client_email).trim())
        .maybeSingle();
      isNewClient = !existing;
    }

    const v = validateCoupon(c as any, { isNewClient });
    if (!v.valid) return respond({ valid: false, reason: v.reason, message: reasonMessage(v.reason) });

    const out: any = {
      valid: true,
      code: c!.code,
      discount_type: c!.discount_type,
      discount_value: Number(c!.discount_value),
    };
    if (base_price_cents != null && !Number.isNaN(Number(base_price_cents))) {
      const { discountCents, discountedCents } = applyDiscountCents(Number(base_price_cents), c as any);
      out.discount_cents = discountCents;
      out.discounted_price_cents = discountedCents;
    }
    return respond(out);
  } catch (e) {
    return respond({ valid: false, reason: 'error', message: reasonMessage() });
  }
});
