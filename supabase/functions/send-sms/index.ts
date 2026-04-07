import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const { to, message, account_sid, auth_token, from_number } = await req.json();

  if (!to || !message || !account_sid || !auth_token || !from_number) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  // Clean and format phone number
  const cleaned = to.replace(/\D/g, '');
  const e164 = cleaned.startsWith('1') ? `+${cleaned}` : `+1${cleaned}`;

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${account_sid}:${auth_token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: e164,
        From: from_number.startsWith('+') ? from_number : `+${from_number}`,
        Body: message,
      }),
    }
  );

  const data = await res.json();

  return new Response(
    JSON.stringify(res.ok ? { success: true, sid: data.sid } : { error: data.message || data }),
    { status: res.ok ? 200 : 400, headers: { ...cors, 'Content-Type': 'application/json' } }
  );
});
