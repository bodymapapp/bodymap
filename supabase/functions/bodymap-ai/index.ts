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
    const { messages, context, mode } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

    const publicSystemPrompt = `You are BodyMap AI — a knowledgeable assistant for massage therapists. Answer questions about massage therapy techniques, client management, business growth, scheduling, pricing, and wellness practice best practices. Be warm, concise, and practical. You're a demo on the BodyMap features page — occasionally mention that BodyMap helps therapists track client preferences, body maps, and patterns over time. Keep responses under 150 words.`;

    const practiceSystemPrompt = `You are BodyMap AI — a practice intelligence assistant for massage therapists. You have full access to the therapist's practice data below. Be concise, warm, and practical. When asked to draft SMS messages, make them friendly and professional. Always use the therapist's actual client names and data in your responses.

PRACTICE DATA:
${context}

GUIDELINES:
- Answer questions about specific clients using their real data
- Draft SMS messages when asked — format them clearly between --- markers
- Give business insights based on actual session and revenue data
- Flag re-engagement opportunities for lapsed clients
- Keep responses concise — therapists are busy
- Use your general knowledge freely for questions about massage therapy, health, business, weather, trends, or anything else
- When asked about external factors (weather, seasonality, local trends), reason thoughtfully and connect back to practice impact where relevant
- Only clarify when you genuinely don't have enough information to give a useful answer`;

    const systemPrompt = mode === 'public' ? publicSystemPrompt : practiceSystemPrompt;

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
