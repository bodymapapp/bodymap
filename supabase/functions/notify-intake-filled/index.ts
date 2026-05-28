// supabase/functions/notify-intake-filled/index.ts
//
// HK May 28 2026: T03 (intake_filled) was declared in NOTIFICATION_SPEC
// and the prefs UI but had no fire site in production code. Clients
// submit intake directly from src/pages/ClientIntake.js, so the
// therapist never knew it happened unless they manually checked the
// client profile. This function fires the intake_filled event when
// ClientIntake's handleSubmit succeeds: it sends the therapist email
// (with a small detail box) + in-app bell, prefs-gated, logged.
//
// Input: { booking_id, therapist_id, client_name?, session_id? }
// Auto-deploys via GitHub Actions.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyTherapist } from "../_shared/notifications.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function esc(s: string) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'missing_env' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { booking_id, therapist_id, client_name, session_id } = await req.json();
    if (!therapist_id) {
      return new Response(JSON.stringify({ error: 'therapist_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: therapist } = await supabase
      .from('therapists')
      .select('*')
      .eq('id', therapist_id)
      .single();

    if (!therapist) {
      return new Response(JSON.stringify({ error: 'therapist_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Try to enrich with the booking (when, service) and the session row
    // (which intake sections the client filled, red flags, etc).
    let whenStr = '';
    let serviceName = '';
    if (booking_id) {
      const { data: b } = await supabase
        .from('bookings')
        .select('booking_date, start_time, services(name), client_name')
        .eq('id', booking_id)
        .maybeSingle();
      if (b) {
        if (b.booking_date && b.start_time) {
          const dt = new Date(`${b.booking_date}T${b.start_time}`);
          whenStr = isNaN(dt.getTime())
            ? `${b.booking_date} ${b.start_time}`
            : dt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        }
        serviceName = (b as any).services?.name || '';
      }
    }

    const who = client_name || 'Your client';
    const subject = `${who} just filled their intake`;

    const rows: Array<[string, string]> = [];
    rows.push(['Client', who]);
    if (serviceName) rows.push(['Service', serviceName]);
    if (whenStr) rows.push(['Upcoming session', whenStr]);
    rows.push(['Filled at', new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })]);

    const detail = `
      <table style="width:100%;border-collapse:collapse;margin:14px 0;background:#FAFAF7;border:1px solid #ECE7DC;border-radius:10px;overflow:hidden;">
        ${rows.map(([k, v], i) => `
          <tr style="${i < rows.length - 1 ? 'border-bottom:1px solid #ECE7DC;' : ''}">
            <td style="padding:9px 14px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;vertical-align:top;">${esc(k)}</td>
            <td style="padding:9px 14px;font-size:14px;color:#1A2E22;text-align:right;">${esc(v)}</td>
          </tr>`).join('')}
      </table>`;

    const html = `<!DOCTYPE html><html><body style="margin:0;background:#FAFAF7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
      <div style="max-width:520px;margin:0 auto;padding:28px 22px;">
        <div style="background:#fff;border:1px solid #ECE7DC;border-radius:16px;padding:24px;">
          <h2 style="font-family:Georgia,serif;color:#1A2E22;margin:0 0 6px;font-size:21px;">Intake submitted</h2>
          <p style="font-size:14px;color:#6B7280;margin:0 0 10px;line-height:1.6;">${esc(who)} just filled out their intake. Their preferences, pressure, focus areas, and any flags are now on their client card.</p>
          ${detail}
          <a href="https://mybodymap.app/dashboard/schedule" style="display:inline-block;background:#2A5741;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:13px;font-weight:700;">Open schedule</a>
          <div style="font-size:11px;color:#6B7280;margin-top:22px;line-height:1.6;">You are getting this because "Intake filled" is on in your notification settings.</div>
        </div>
      </div>
    </body></html>`;

    const result = await notifyTherapist({
      supabase,
      therapist,
      eventType: 'intake_filled',
      title: subject,
      body: `${who} submitted their intake.`,
      linkUrl: '/dashboard/schedule',
      emailSubject: subject,
      emailHtml: html,
      smsText: null,
      booking_id: booking_id || null,
      session_id: session_id || null,
    });

    return new Response(JSON.stringify({ ok: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[notify-intake-filled] error', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
