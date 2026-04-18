// send-push edge function
// Sends Web Push notifications to all of a therapist's subscribed devices.
// Body: { therapist_id: uuid, title: string, body: string, url?: string, tag?: string }
// Also accepts { user_id } as alias for therapist_id.

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
    const therapistId = body.therapist_id || body.user_id;
    if (!therapistId) {
      return new Response(JSON.stringify({ error: 'therapist_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

    // Respect therapist's push preference
    const { data: therapist } = await supabase
      .from('therapists')
      .select('push_notifications_enabled')
      .eq('id', therapistId)
      .single();

    if (therapist && therapist.push_notifications_enabled === false) {
      return new Response(JSON.stringify({ skipped: 'push disabled by user' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch all subscriptions for this therapist
    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('therapist_id', therapistId);

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
      title: body.title || 'BodyMap',
      body: body.body || '',
      url: body.url || '/dashboard',
      tag: body.tag || 'bodymap',
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
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id);
      } catch (err: any) {
        // 404/410 = subscription gone, remove it
        const statusCode = err?.statusCode || err?.status;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
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
          console.error('push send failed:', JSON.stringify(errInfo));
        }
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('send-push fatal error:', err?.message, err?.stack);
    return new Response(JSON.stringify({ error: err?.message || String(err), stack: err?.stack?.split('\n').slice(0, 3) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
