// supabase/functions/submit-intake/index.ts
//
// Handles the critical writes for a client intake submission: resolve
// the appointment, resolve the client, and insert the session (body
// map + preferences).
//
// WHY THIS EXISTS (Jun 11 2026)
//
// The public intake page runs as the anon role, which intentionally
// has no SELECT on the clients/sessions tables (the "Public can read
// clients" policy is unrestricted, so granting anon SELECT would
// expose every client's PII). An in-browser insert().select() is an
// INSERT ... RETURNING that needs SELECT to return the row, so it was
// denied and the client saw "error saving your preferences" on the
// final step. Routing the writes through this function (service role)
// removes the dependency on the visitor's role entirely.
//
// IDENTITY RULE (Jun 11 2026)
//
// The appointment is the source of truth for identity. When the link
// carries a booking (every booking email now passes booking_id), the
// session attaches to that booking's existing client, so a typed-over
// name or email still lands on the right person and the body map
// history stays unified for pattern intelligence. Typed values never
// overwrite an existing client's name or email. Only when there is no
// booking at all do we fall back to matching/creating by typed values.

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

    const phone = (client.phone || '').trim();
    const typedEmail = (client.email || '').trim();

    // 1. Resolve the booking. Trust the id the email link carried; if
    //    none, find the next upcoming non-cancelled booking by the
    //    typed email.
    let bookingId: string | null = booking_id_from_url || null;
    let booking: any = null;
    if (bookingId) {
      const { data } = await supabase.from('bookings')
        .select('id, client_id, client_email, client_name, client_phone')
        .eq('id', bookingId).maybeSingle();
      booking = data || null;
      if (!booking) bookingId = null; // stale id; fall back to email match
    }
    if (!bookingId && typedEmail) {
      const today = new Date().toISOString().split('T')[0];
      const { data: nb } = await supabase.from('bookings')
        .select('id, client_id, client_email, client_name, client_phone')
        .eq('therapist_id', therapist_id)
        .ilike('client_email', typedEmail)
        .neq('status', 'cancelled')
        .gte('booking_date', today)
        .order('booking_date', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (nb) { booking = nb; bookingId = nb.id; }
    }

    // 2. Resolve the client. The booking wins: if it already names a
    //    client, use that client id regardless of what was typed.
    let clientId: string | null = booking?.client_id || null;
    if (!clientId) {
      const matchEmail = (booking?.client_email || typedEmail || '').trim();
      if (phone) {
        const { data } = await supabase.from('clients')
          .select('id').eq('therapist_id', therapist_id).eq('phone', phone).maybeSingle();
        if (data?.id) clientId = data.id;
      }
      if (!clientId && matchEmail) {
        const { data } = await supabase.from('clients')
          .select('id').eq('therapist_id', therapist_id).ilike('email', matchEmail).maybeSingle();
        if (data?.id) clientId = data.id;
      }
      if (!clientId) {
        // Brand new client. Prefer the booking's own details when present
        // so the record is clean even if the form was typed over.
        const { data, error } = await supabase.from('clients')
          .insert([{
            therapist_id,
            name: booking?.client_name || client.name || null,
            phone: booking?.client_phone || client.phone || null,
            email: booking?.client_email || client.email || null,
          }])
          .select('id').single();
        if (error || !data) {
          console.error('[submit-intake] client insert failed', error);
          return respond({ error: 'client_save_failed' });
        }
        clientId = data.id;
      }
    }

    // 3. SMS opt-in: only ever flip to true. Never touches name/email.
    if (sms_opt_in && clientId) {
      try {
        await supabase.from('clients')
          .update({ sms_opted_in: true, sms_opted_in_at: new Date().toISOString() })
          .eq('id', clientId);
      } catch (_e) { /* non-blocking */ }
    }

    // 4. Insert the session. therapist_id, client_id, booking_id are set
    //    here so the browser cannot spoof them.
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
