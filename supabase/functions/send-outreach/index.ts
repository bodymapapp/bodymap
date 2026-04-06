import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

  const { to, subject, html, from } = await req.json();

  if (!to || !html) return new Response(JSON.stringify({ error: 'missing fields' }), {
    status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
  });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(res.ok ? { success: true, id: data.id } : { error: data.message }), {
    status: res.ok ? 200 : 400,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
});
