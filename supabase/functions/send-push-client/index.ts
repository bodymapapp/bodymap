// send-push-client edge function
// Sends Web Push notifications to all of a client's active subscriptions.
// Body: { client_id: uuid, title: string, body: string, url?: string, tag?: string }
//
// Companion to send-push (therapist version). Reads from
// client_push_subscriptions which has a separate identity model
// (clients have no auth users, just a (therapist_id, client_id) tuple).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@mybodymap.app';

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const body = await req.json();
    const clientId = body.client_id;
    if (!clientId) {
      return new Response(JSON.stringify({ error: 'client_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

    // Fetch active subscriptions (not soft-unsubscribed) for this client
    const { data: subs, error: subsErr } = await supabase
      .from('client_push_subscriptions')
      .select('*')
      .eq('client_id', clientId)
      .is('unsubscribed_at', null);

    if (subsErr) {
      return new Response(JSON.stringify({ error: subsErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payload = JSON.stringify({
      title: body.title || 'MyBodyMap',
      body: body.body || '',
      url: body.url || '/',
      tag: body.tag || 'bodymap-client',
    });

    const results = { sent: 0, failed: 0, removed: 0, errors: [] as any[] };

    for (const sub of subs) {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(subscription, payload);
        results.sent++;
        await supabase
          .from('client_push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id);
      } catch (err: any) {
        // 404/410 means the subscription is gone; soft-unsubscribe it
        const statusCode = err?.statusCode || err?.status;
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from('client_push_subscriptions')
            .update({ unsubscribed_at: new Date().toISOString() })
            .eq('id', sub.id);
          results.removed++;
        } else {
          results.failed++;
          const errInfo = {
            statusCode,
            body: err?.body,
            message: err?.message,
            endpoint_host: (() => { try { return new URL(sub.endpoint).host; } catch { return null; } })(),
          };
          results.errors.push(errInfo);
          console.error('client push send failed:', JSON.stringify(errInfo));
        }
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('send-push-client fatal error:', err?.message, err?.stack);
    return new Response(JSON.stringify({ error: err?.message || String(err), stack: err?.stack?.split('\n').slice(0, 3) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
