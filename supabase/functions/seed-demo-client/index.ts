// supabase/functions/seed-demo-client/index.ts
//
// Seeds the canonical demo client (Sarah Chen) and her 5-session
// history into Supabase. Used by /founder/seed-demo on the dashboard.
//
// Bypasses RLS via service_role so HK can seed regardless of which
// therapist account they are logged in as. Sessions are tied to the
// therapist that owns the target client, looked up at runtime.
//
// Payload shape:
//   {
//     client: { id, name, phone, email },
//     sessions: [ { id, client_id, created_at, ... }, ... ]
//   }
//
// Behavior:
//   1. Look up client by id to get therapist_id (must already exist)
//   2. Update the client row with the supplied name/phone/email
//   3. Delete all existing sessions for this client_id (clean slate)
//   4. Insert all supplied sessions with the looked-up therapist_id
//   5. Return counts

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { client, sessions } = body || {};

    if (!client || !client.id || !Array.isArray(sessions) || sessions.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing client or sessions in payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Look up the existing client to get therapist_id
    const { data: existingClient, error: clientErr } = await supabase
      .from('clients')
      .select('id, therapist_id')
      .eq('id', client.id)
      .maybeSingle();

    if (clientErr || !existingClient) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Client ${client.id} not found. Create the client first in the dashboard, then re-run the seed.`,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const therapistId = existingClient.therapist_id;

    // 2. Update the client row with the supplied demographic info
    const clientUpdate: Record<string, unknown> = {};
    if (client.name) clientUpdate.name = client.name;
    if (client.phone) clientUpdate.phone = client.phone;
    if (client.email) clientUpdate.email = client.email;
    if (Object.keys(clientUpdate).length > 0) {
      await supabase.from('clients').update(clientUpdate).eq('id', client.id);
    }

    // 3. Delete existing sessions for this client to ensure a clean
    //    seed (no leftover rows from previous tests)
    const { error: deleteErr } = await supabase
      .from('sessions')
      .delete()
      .eq('client_id', client.id);

    if (deleteErr) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to clear existing sessions: ' + deleteErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Prepare sessions for insert, attaching the therapist_id from
    //    the client record
    const sessionsToInsert = sessions.map((s: Record<string, unknown>) => ({
      ...s,
      client_id: client.id,
      therapist_id: therapistId,
    }));

    const { error: insertErr, data: inserted } = await supabase
      .from('sessions')
      .insert(sessionsToInsert)
      .select('id');

    if (insertErr) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to insert sessions: ' + insertErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        client_id: client.id,
        therapist_id: therapistId,
        sessions_inserted: inserted?.length || 0,
        session_ids: inserted?.map((r: { id: string }) => r.id) || [],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Unexpected error: ' + (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
