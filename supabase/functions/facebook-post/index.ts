import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { message, link } = await req.json()
    const PAGE_TOKEN = Deno.env.get('FB_PAGE_ACCESS_TOKEN')
    const PAGE_ID = Deno.env.get('FB_PAGE_ID') || '1099536706567950'
    if (!PAGE_TOKEN) return new Response(JSON.stringify({ error: 'FB_PAGE_ACCESS_TOKEN not set' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const body: Record<string, string> = { message, access_token: PAGE_TOKEN }
    if (link) body.link = link
    const res = await fetch(`https://graph.facebook.com/v19.0/${PAGE_ID}/feed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) return new Response(JSON.stringify({ error: data }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify({ success: true, post_id: data.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
