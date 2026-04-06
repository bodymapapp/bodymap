import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
  const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN');
  const TWILIO_FROM        = Deno.env.get('TWILIO_PHONE_NUMBER');

  const { to, message } = await req.json();

  if (!to || !message) return new Response(JSON.stringify({ error: 'to and message required' }), {
    status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
  });

  // Clean phone number
  const cleaned = to.replace(/\D/g, '');
  const e164 = cleaned.startsWith('1') ? `+${cleaned}` : `+1${cleaned}`;

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: e164, From: TWILIO_FROM!, Body: message }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(res.ok ? { success: true, sid: data.sid } : { error: data.message }), {
    status: res.ok ? 200 : 400,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
});
