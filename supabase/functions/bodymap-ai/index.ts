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
    const { messages, context } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

    const systemPrompt = `You are BodyMap AI — a practice intelligence assistant for massage therapists. You have full access to the therapist's practice data below. Be concise, warm, and practical. When asked to draft SMS messages, make them friendly and professional. Always use the therapist's actual client names and data in your responses.

PRACTICE DATA:
${context}

GUIDELINES:
- Answer questions about specific clients using their real data
- Draft SMS messages when asked — format them clearly between --- markers
- Give business insights based on actual session and revenue data
- Flag re-engagement opportunities for lapsed clients
- Keep responses concise — therapists are busy
- Never make up data that isn't in the context above`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
      }),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
