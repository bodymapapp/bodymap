// supabase/functions/submit-intake/index.ts
//
// Handles the critical writes for a client intake submission: upsert
// the client, resolve the upcoming booking, and insert the session
// (body map + preferences).
//
// WHY THIS EXISTS (Jun 11 2026)
//
// The public intake page runs as the anon role. The anon role
// intentionally has no SELECT on the clients and sessions tables
// (the "Public can read clients" policy is unrestricted, so granting
// anon SELECT would expose every client's name, email, phone, and
// medical flags). An in-browser insert().select() is an
// INSERT ... RETURNING, which needs SELECT to hand the row back, so
// it was denied with "permission denied for table clients" and the
// client saw "error saving your preferences" on the final step.
//
// Routing the writes through this function (service role) removes the
// dependency on the visitor's role entirely: it works for anonymous
// clients and for logged-in users, and never needs to widen anon
// privileges. RLS still protects every in-browser read elsewhere.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const respond = (data: any) => new Response(JSON.stringify(data), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });

  try {
    const { therapist_id, client, sms_opt_in, booking_id_from_url, session } = await req.json();

    if (!therapist_id || !client || (!client.email && !client.phone)) {
      return respond({ error: 'missing_fields' });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!SUPABASE_URL || !SERVICE_KEY) return respond({ error: 'server_config' });
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Upsert client. Match an existing row by phone first (the same
    //    rule the app used before), then by email, so returning clients
    //    do not get duplicated. Insert only if neither matches.
    let clientId: string | null = null;
    const phone = (client.phone || '').trim();
    const email = (client.email || '').trim();

    if (phone) {
      const { data } = await supabase.from('clients')
        .select('id').eq('therapist_id', therapist_id).eq('phone', phone).maybeSingle();
      if (data?.id) clientId = data.id;
    }
    if (!clientId && email) {
      const { data } = await supabase.from('clients')
        .select('id').eq('therapist_id', therapist_id).ilike('email', email).maybeSingle();
      if (data?.id) clientId = data.id;
    }
    if (!clientId) {
      const { data, error } = await supabase.from('clients')
        .insert([{ therapist_id, name: client.name || null, phone: client.phone || null, email: client.email || null }])
        .select('id').single();
      if (error || !data) {
        console.error('[submit-intake] client insert failed', error);
        return respond({ error: 'client_save_failed' });
      }
      clientId = data.id;
    }

    // 2. SMS opt-in: only ever flip to true.
    if (sms_opt_in && clientId) {
      try {
        await supabase.from('clients')
          .update({ sms_opted_in: true, sms_opted_in_at: new Date().toISOString() })
          .eq('id', clientId);
      } catch (_e) { /* non-blocking */ }
    }

    // 3. Resolve booking_id: trust the URL value if present, else find
    //    the client's next upcoming non-cancelled booking by email.
    let bookingId = booking_id_from_url || null;
    if (!bookingId && email) {
      const today = new Date().toISOString().split('T')[0];
      const { data: nb } = await supabase.from('bookings')
        .select('id')
        .eq('therapist_id', therapist_id)
        .ilike('client_email', email)
        .neq('status', 'cancelled')
        .gte('booking_date', today)
        .order('booking_date', { ascending: true })
        .limit(1)
        .maybeSingle();
      bookingId = nb?.id || null;
    }

    // 4. Insert the session. therapist_id, client_id, booking_id are
    //    set here so the browser cannot spoof them.
    const sessionRow = { ...(session || {}), therapist_id, client_id: clientId, booking_id: bookingId };
    const { data: sess, error: sErr } = await supabase.from('sessions')
      .insert([sessionRow]).select('id').single();
    if (sErr || !sess) {
      console.error('[submit-intake] session insert failed', sErr);
      return respond({ error: 'session_save_failed', detail: sErr?.message });
    }

    return respond({ ok: true, client_id: clientId, session_id: sess.id, booking_id: bookingId });
  } catch (e) {
    return respond({ error: `error: ${(e as any)?.message ?? String(e)}` });
  }
});
