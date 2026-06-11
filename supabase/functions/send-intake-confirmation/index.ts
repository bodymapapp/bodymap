// supabase/functions/send-intake-confirmation/index.ts
//
// HK Jun 11 2026: the client confirmation email that goes out when a
// client finishes their intake. Same summary and body map as the
// therapist notice (built in _shared/intakeSummary.ts), but in the
// client's warm voice: "your time on the table is all about you."
//
// Gated to the rich-email test cohort (Joy therapist) for now, so only
// Joy's clients receive it during the test run. Flip to all by changing
// the allowlist check to `true`. Fire-and-forget from ClientIntake;
// never blocks intake. Auto-deploys via GitHub Actions.
//
// Input: { booking_id?, session_id, therapist_id, client_name? }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyClient } from "../_shared/notifications.ts";
import { buildIntakeSummary, summaryRowsHtml, mapBlockHtml } from "../_shared/intakeSummary.ts";

const RICH_EMAIL_THERAPISTS = ['2a2886c3-00f2-4c6f-aaec-4b8150c61fcf'];

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
    const { booking_id, session_id, therapist_id } = await req.json();
    if (!therapist_id || !session_id) {
      return new Response(JSON.stringify({ error: 'therapist_id and session_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Gate: only the test cohort sends during the run.
    if (!RICH_EMAIL_THERAPISTS.includes(therapist_id)) {
      return new Response(JSON.stringify({ ok: true, skipped: 'not_in_test_cohort' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: therapist } = await supabase.from('therapists').select('*').eq('id', therapist_id).single();
    if (!therapist) {
      return new Response(JSON.stringify({ error: 'therapist_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('id, client_id, front_focus, front_avoid, back_focus, back_avoid, pressure, goal, table_temp, room_temp, music, lighting, conversation, draping, oil_pref, med_flag, med_note, medical_conditions, client_notes, public_notes, front_pct, top_pct, middle_pct, bottom_pct')
      .eq('id', session_id)
      .maybeSingle();
    if (!session) {
      return new Response(JSON.stringify({ error: 'session_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Resolve the client and the appointment time.
    let clientId = (session as any).client_id || null;
    let whenStr = '';
    if (booking_id) {
      const { data: b } = await supabase.from('bookings')
        .select('client_id, booking_date, start_time').eq('id', booking_id).maybeSingle();
      if (b) {
        if (!clientId) clientId = (b as any).client_id;
        if (b.booking_date && b.start_time) {
          const dt = new Date(`${b.booking_date}T${b.start_time}`);
          whenStr = isNaN(dt.getTime())
            ? `${b.booking_date} ${b.start_time}`
            : dt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        }
      }
    }
    if (!clientId) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no_client' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: client } = await supabase.from('clients')
      .select('id, name, email, phone, sms_opted_out_at').eq('id', clientId).maybeSingle();
    if (!client || !client.email) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no_client_email' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const summary = buildIntakeSummary(session);
    const biz = (therapist as any).business_name || 'Your therapist';
    const whenLine = whenStr
      ? `${esc(biz)} will read this before your ${esc(whenStr)} session, so your time on the table is all about you.`
      : `${esc(biz)} will read this before your next session, so your time on the table is all about you.`;
    const customUrl = (therapist as any).custom_url;
    const cta = customUrl ? `https://mybodymap.app/${encodeURIComponent(customUrl)}` : 'https://mybodymap.app';

    const html = `<!DOCTYPE html><html><body style="margin:0;background:#F0EEE6;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
      <div style="max-width:520px;margin:0 auto;padding:28px 22px;">
        <div style="background:#fff;border:1px solid #ECE7DC;border-radius:16px;padding:24px;">
          <h2 style="font-family:Georgia,serif;color:#1A2E22;margin:0 0 4px;font-size:21px;">Your intake is in, thank you</h2>
          <p style="font-size:13px;color:#6B7280;margin:0 0 14px;line-height:1.55;">${whenLine}</p>
          ${summaryRowsHtml(summary)}
          ${mapBlockHtml(summary, SUPABASE_URL)}
          <a href="${cta}" style="display:inline-block;background:#2A5741;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:13px;font-weight:600;margin-top:14px;">View your appointment</a>
          <div style="font-size:11px;color:#9A9A90;margin-top:20px;line-height:1.6;border-top:1px solid #F1EEE6;padding-top:12px;">Made with MyBodyMap. Need to change something? Just reply and a real person will help.</div>
        </div>
      </div>
    </body></html>`;

    const result = await notifyClient({
      supabase,
      therapist,
      client,
      eventType: 'intake_confirmation',
      smsText: null,
      emailSubject: 'Your intake is in, thank you',
      emailHtml: html,
      bookingId: booking_id || null,
      sessionId: session_id,
    });

    return new Response(JSON.stringify({ ok: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[send-intake-confirmation] error', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
