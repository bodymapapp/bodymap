import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { apiKey, dateFrom, dateTo } = await req.json();
    const key = apiKey || Deno.env.get('CAL_API_KEY');

    const params = new URLSearchParams({
      apiKey: key,
      status: 'upcoming',
      limit: '100',
    });

    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);

    const response = await fetch(`https://api.cal.com/v1/bookings?${params}`, {
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    // Normalize bookings to BodyMap format
    const bookings = (data.bookings || []).map((b: any) => ({
      id: b.id,
      client: b.attendees?.[0]?.name || 'Unknown',
      email: b.attendees?.[0]?.email || '',
      date: b.startTime,
      endTime: b.endTime,
      duration: Math.round((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000),
      time: new Date(b.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      status: b.status,
      title: b.title,
      calId: b.id,
    }));

    return new Response(JSON.stringify({ bookings }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, bookings: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
