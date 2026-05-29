import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generateUnsubToken,
  unsubscribeFooterHtml,
  UNSUB_BASE_URL,
} from "../_shared/unsubscribe.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const RESEND_API_KEY     = Deno.env.get('RESEND_API_KEY');
  const SUPABASE_URL       = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

  // Allow single therapist_id for manual/test trigger
  const body = await req.json().catch(() => ({}));
  const singleTherapistId = body?.therapist_id || null;

  // Fetch therapists (all or single). HK May 24 2026: practice_pulse_email
  // was historically in this select; if the column does not exist the
  // entire query silently returns null and the for-loop never runs
  // (processed: 0 with no log). Switch to '*' so future column additions
  // never break this loop. We only read the explicit fields below so the
  // wider projection has no functional cost.
  let therapistQuery = supabase.from('therapists').select('*');
  if (singleTherapistId) therapistQuery = therapistQuery.eq('id', singleTherapistId);
  const { data: therapists, error: therapistsErr } = await therapistQuery;
  if (therapistsErr) {
    console.error('practice-pulse: therapists query failed', therapistsErr);
    return new Response(JSON.stringify({ error: therapistsErr.message, processed: 0 }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const results = [];
  // Per-therapist skip reasons for debug visibility. HK May 24 2026:
  // 'how do we check that people are getting all the notifications.'
  // Returning skip reasons in the response lets the founder dashboard
  // see exactly why a given therapist did or did not receive Pulse on
  // any given run.
  const skipped: Array<{ id: string, name: string, reason: string }> = [];

  for (const therapist of therapists || []) {
    if (!therapist.email) { skipped.push({ id: therapist.id, name: therapist.business_name || therapist.full_name || '?', reason: 'no_email' }); continue; }
    if (therapist.practice_pulse_enabled === false) { skipped.push({ id: therapist.id, name: therapist.business_name || therapist.full_name || '?', reason: 'pulse_disabled' }); continue; }
    if (therapist.email_unsubscribed) { skipped.push({ id: therapist.id, name: therapist.business_name || therapist.full_name || '?', reason: 'unsubscribed' }); continue; }

    const therapistName = therapist.business_name || therapist.full_name || 'Your Practice';
    const lapsedDays = therapist.lapsed_days || 60;
    const dashboardUrl = `https://mybodymap.app/dashboard`;
    const outreachUrl  = `https://mybodymap.app/dashboard/outreach`;

    // 1. Bookings TODAY (real activity signal). HK May 24 2026: was
    // reading from `sessions` table which holds SOAP notes that most
    // therapists never write. bookings is the truth: did real
    // appointments happen today on this therapist's calendar.
    const { data: todayBookings } = await supabase
      .from('bookings')
      .select('id, client_name, client_id, start_time, status, services(name, duration)')
      .eq('therapist_id', therapist.id)
      .eq('booking_date', todayStr)
      .neq('status', 'cancelled')
      .order('start_time');

    // 2. Bookings tomorrow
    const { data: tomorrowBookings } = await supabase
      .from('bookings')
      .select('id, client_name, start_time, services(name, duration)')
      .eq('therapist_id', therapist.id)
      .eq('booking_date', tomorrowStr)
      .neq('status', 'cancelled')
      .order('start_time');

    // 3. Lapsed/due detection from BOOKINGS history (was sessions before).
    // For every client, find their most recent non-cancelled booking and
    // compute the gap pattern. Bookings reflect actual visits regardless
    // of whether the therapist wrote SOAP notes afterward.
    const { data: clientsWithBookings } = await supabase
      .from('clients')
      .select('id, name, email')
      .eq('therapist_id', therapist.id);

    const lapsedClients: any[] = [];
    const dueClients: any[] = [];

    if (clientsWithBookings && clientsWithBookings.length > 0) {
      // Pull last 10 bookings per client in one batched query
      // (a single .in() with client_id list keeps this O(1) queries).
      const clientIds = clientsWithBookings.map(c => c.id).filter(Boolean);
      const { data: recentBookings } = await supabase
        .from('bookings')
        .select('client_id, booking_date, status')
        .eq('therapist_id', therapist.id)
        .in('client_id', clientIds)
        .neq('status', 'cancelled')
        .lte('booking_date', todayStr) // only count past visits, not future scheduled
        .order('booking_date', { ascending: false });

      const byClient = new Map<string, string[]>();
      for (const row of recentBookings || []) {
        if (!row.client_id) continue;
        const arr = byClient.get(row.client_id) || [];
        if (arr.length < 10) arr.push(row.booking_date);
        byClient.set(row.client_id, arr);
      }

      for (const client of clientsWithBookings) {
        const dates = byClient.get(client.id) || [];
        if (!dates.length) continue;

        const lastVisit = new Date(`${dates[0]}T00:00:00Z`);
        const daysSince = Math.floor((today.getTime() - lastVisit.getTime()) / 86400000);

        // Lapsed: crossed the threshold within the last 2 days (newly lapsed).
        if (daysSince >= lapsedDays && daysSince < lapsedDays + 2) {
          lapsedClients.push({ name: client.name, daysSince });
        }

        // Due: has 2+ past visits, past 120% of avg interval, before lapsed cutoff.
        if (dates.length >= 2) {
          let totalGap = 0;
          for (let i = 1; i < Math.min(dates.length, 5); i++) {
            totalGap += new Date(`${dates[i-1]}T00:00:00Z`).getTime() - new Date(`${dates[i]}T00:00:00Z`).getTime();
          }
          const avgDays = totalGap / Math.min(dates.length - 1, 4) / 86400000;
          if (avgDays > 0 && daysSince >= avgDays * 1.2 && daysSince < lapsedDays) {
            dueClients.push({ name: client.name, daysSince, avgDays: Math.round(avgDays) });
          }
        }
      }
    }

    // Only send if there's something to report
    const hasSomething = (todayBookings?.length || 0) > 0 || (tomorrowBookings?.length || 0) > 0 || lapsedClients.length > 0 || dueClients.length > 0;
    if (!hasSomething && !singleTherapistId) {
      skipped.push({ id: therapist.id, name: therapistName, reason: 'nothing_to_report' });
      continue;
    }

    // HK May 29 2026: surface what the platform did on the therapist's
    // behalf today. Reasoning: the daily evening digest should answer
    // "what did MyBodyMap do for me today" not just "what's on tomorrow."
    // Pulls automated outreach (lapse nudges, intake reminders, 48h
    // reminders) AND custom quicksend messages from today's notification_log.
    const last24h = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: outreachToday } = await supabase
      .from('notification_log')
      .select('notification_type, audience, status, recipient')
      .eq('therapist_id', therapist.id)
      .gte('sent_at', last24h)
      .eq('audience', 'client')
      .eq('status', 'sent')
      .in('notification_type', ['lapse_nudge', 'lapse_final_nudge', 'lapse_signal', 'intake_reminder', 'reminder_48h', 'custom_quicksend']);

    const outreachByType: Record<string, number> = {};
    for (const row of (outreachToday || [])) {
      const t = row.notification_type;
      outreachByType[t] = (outreachByType[t] || 0) + 1;
    }
    const outreachLabels: Record<string, string> = {
      lapse_nudge: 'lapse check-ins (45-day soft nudge)',
      lapse_final_nudge: 'final goodbye notes (90 days)',
      lapse_signal: 'lapse signals to you',
      intake_reminder: 'intake reminders to upcoming clients',
      reminder_48h: '48-hour appointment reminders',
      custom_quicksend: 'custom messages you sent',
    };

    // Backwards compatibility: rename todayBookings -> todaySessions
    // so the existing email HTML template (below) does not have to
    // change. Same semantic: 'sessions that happened today'.
    const todaySessions = (todayBookings || []).map(b => ({
      id: b.id,
      completed: ['completed', 'confirmed'].includes(b.status),
      clients: { name: b.client_name, email: null },
      public_notes: null,
      therapist_notes: null,
    }));

    const fmt12 = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
    };

    const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:system-ui,sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:28px 16px;">

  <div style="text-align:center;margin-bottom:20px;">
    <span style="font-size:28px;">🌿</span>
    <div style="font-family:Georgia,serif;font-size:13px;font-weight:700;color:#2A5741;margin:6px 0 2px;text-transform:uppercase;letter-spacing:0.1em;">Practice Pulse</div>
    <div style="font-size:12px;color:#6B7280;">${today.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
  </div>

  <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

    ${todaySessions && todaySessions.length > 0 ? `
    <div style="padding:20px 24px;border-bottom:1px solid #F3F4F6;">
      <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px;">Today's Sessions (${todaySessions.length})</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
      ${todaySessions.map((s: any) => `
        <tr>
          <td style="font-size:14px;font-weight:600;color:#1A1A2E;padding:8px 0;border-bottom:1px solid #F9F9F9;text-align:left;">${s.clients?.name || 'Client'}</td>
          <td style="font-size:12px;color:${s.completed?'#16A34A':'#D97706'};font-weight:600;padding:8px 0;border-bottom:1px solid #F9F9F9;text-align:right;">${s.completed ? '✓ Complete' : '⏳ Needs notes'}</td>
        </tr>
      `).join('')}
      </table>
    </div>` : ''}

    ${tomorrowBookings && tomorrowBookings.length > 0 ? `
    <div style="padding:20px 24px;border-bottom:1px solid #F3F4F6;background:#FAFEF7;">
      <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px;">Tomorrow (${tomorrowBookings.length} booked)</div>
      ${tomorrowBookings.map((b: any) => `
        <div style="padding:8px 0;border-bottom:1px solid #F0FDF4;">
          <div style="font-size:14px;font-weight:600;color:#1A1A2E;">${b.client_name}</div>
          <div style="font-size:12px;color:#6B7280;">${fmt12(b.start_time)} · ${b.services?.name || 'Session'}</div>
        </div>
      `).join('')}
    </div>` : `
    <div style="padding:20px 24px;border-bottom:1px solid #F3F4F6;background:#FAFEF7;">
      <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px;">Tomorrow</div>
      <div style="font-size:13px;color:#9CA3AF;">No bookings yet.</div>
    </div>`}

    ${dueClients.length > 0 ? `
    <div style="padding:20px 24px;border-bottom:1px solid #F3F4F6;">
      <div style="font-size:11px;font-weight:700;color:#D97706;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px;">⏰ Due for a Visit (${dueClients.length})</div>
      ${dueClients.slice(0,5).map((c: any) => `
        <div style="padding:7px 0;border-bottom:1px solid #FEF9F0;">
          <div style="font-size:14px;font-weight:600;color:#1A1A2E;">${c.name}</div>
          <div style="font-size:12px;color:#92400E;">${c.daysSince} days since last visit · usually every ${c.avgDays} days</div>
        </div>
      `).join('')}
      ${dueClients.length > 5 ? `<div style="font-size:12px;color:#9CA3AF;margin-top:8px;">+${dueClients.length-5} more</div>` : ''}
    </div>` : ''}

    ${lapsedClients.length > 0 ? `
    <div style="padding:20px 24px;border-bottom:1px solid #F3F4F6;">
      <div style="font-size:11px;font-weight:700;color:#EF4444;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px;">🍂 Newly Lapsed (${lapsedClients.length})</div>
      ${lapsedClients.map((c: any) => `
        <div style="padding:7px 0;border-bottom:1px solid #FEF2F2;">
          <div style="font-size:14px;font-weight:600;color:#1A1A2E;">${c.name}</div>
          <div style="font-size:12px;color:#991B1B;">${c.daysSince} days since last visit</div>
        </div>
      `).join('')}
    </div>` : ''}

    ${Object.keys(outreachByType).length > 0 ? `
    <div style="padding:20px 24px;border-bottom:1px solid #F3F4F6;background:#F5F7F2;">
      <div style="font-size:11px;font-weight:700;color:#2A5741;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px;">📬 What we sent for you today</div>
      ${Object.entries(outreachByType).map(([type, n]) => `
        <div style="padding:6px 0;font-size:13px;color:#1F4030;">
          <strong style="color:#2A5741;">${n}</strong> ${outreachLabels[type] || type.replace(/_/g, ' ')}
        </div>
      `).join('')}
      <div style="font-size:11px;color:#4B6353;margin-top:8px;line-height:1.5;">These ran automatically, no action needed.</div>
    </div>` : ''}

    <div style="padding:20px 24px;display:flex;gap:12px;flex-wrap:wrap;">
      <a href="${dashboardUrl}" style="flex:1;min-width:120px;display:block;background:#2A5741;color:#fff;text-decoration:none;border-radius:8px;padding:11px 16px;text-align:center;font-size:13px;font-weight:700;">Open Dashboard →</a>
      ${(dueClients.length > 0 || lapsedClients.length > 0) ? `<a href="${outreachUrl}" style="flex:1;min-width:120px;display:block;background:#F5F0E8;color:#2A5741;text-decoration:none;border-radius:8px;padding:11px 16px;text-align:center;font-size:13px;font-weight:700;border:1.5px solid #E8E4DC;">Reach Out →</a>` : ''}
    </div>
  </div>

  <p style="font-size:11px;color:#9CA3AF;text-align:center;margin:20px 0 0;">
    Practice Pulse by MyBodyMap · <a href="https://mybodymap.app" style="color:#9CA3AF;">mybodymap.app</a>
  </p>
</div>
</body></html>`;

    // Generate signed unsubscribe link + append footer
    const unsubToken = await generateUnsubToken(therapist.id);
    const unsubUrl = `${UNSUB_BASE_URL}?token=${encodeURIComponent(unsubToken)}`;
    const emailHtmlWithUnsub = emailHtml.replace(
      '</body></html>',
      `${unsubscribeFooterHtml(therapist.id, unsubUrl)}</body></html>`
    );

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Practice Pulse <reminders@mybodymap.app>',
        to: therapist.practice_pulse_email ? [therapist.email, therapist.practice_pulse_email] : [therapist.email],
        reply_to: therapist.email,
        subject: `Your Practice Pulse for ${today.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}`,
        html: emailHtmlWithUnsub,
      }),
    });

    const data = await res.json();

    // Log to notification_log for founder dashboard comms grid
    const subjectLine = `Your Practice Pulse for ${today.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}`;
    try {
      await supabase.from('notification_log').insert({
        therapist_id: therapist.id,
        notification_type: 'practice_pulse',
        audience: 'therapist',
        channel: 'email',
        recipient: therapist.email,
        status: res.ok ? 'sent' : 'failed',
        provider_id: data?.id || null,
        subject: subjectLine,
        body_snippet: 'Daily practice digest: bookings, sessions, clients.',
      });
    } catch (_e) {
      try {
        await supabase.from('notification_log').insert({
          therapist_id: therapist.id,
          notification_type: 'practice_pulse',
          audience: 'therapist',
          channel: 'email',
          recipient: therapist.email,
          status: res.ok ? 'sent' : 'failed',
          provider_id: data?.id || null,
        });
      } catch (_e2) { /* non-blocking */ }
    }

    results.push({ therapist: therapistName, email: therapist.email, status: res.ok ? 'sent' : 'failed', id: data.id, error: data.message });
  }

  return new Response(JSON.stringify({ processed: results.length, results, skipped }), {
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
});
