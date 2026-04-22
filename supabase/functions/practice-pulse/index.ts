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

  // Fetch therapists (all or single)
  let therapistQuery = supabase.from('therapists').select('id, full_name, business_name, email, custom_url, lapsed_days, practice_pulse_enabled, practice_pulse_email, email_unsubscribed');
  if (singleTherapistId) therapistQuery = therapistQuery.eq('id', singleTherapistId);
  const { data: therapists } = await therapistQuery;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const results = [];

  for (const therapist of therapists || []) {
    if (!therapist.email) continue;
    if (therapist.practice_pulse_enabled === false) continue;
    // CAN-SPAM: skip anyone who unsubscribed
    if (therapist.email_unsubscribed) continue;

    const therapistName = therapist.business_name || therapist.full_name || 'Your Practice';
    const lapsedDays = therapist.lapsed_days || 60;
    const dashboardUrl = `https://mybodymap.app/dashboard`;
    const outreachUrl  = `https://mybodymap.app/dashboard/outreach`;

    // 1. Sessions today
    const { data: todaySessions } = await supabase
      .from('sessions')
      .select('id, completed, public_notes, clients(name, email), therapist_notes')
      .eq('therapist_id', therapist.id)
      .gte('created_at', `${todayStr}T00:00:00Z`)
      .lte('created_at', `${todayStr}T23:59:59Z`);

    // 2. Bookings tomorrow
    const { data: tomorrowBookings } = await supabase
      .from('bookings')
      .select('id, client_name, start_time, services(name, duration)')
      .eq('therapist_id', therapist.id)
      .eq('booking_date', tomorrowStr)
      .neq('status', 'cancelled')
      .order('start_time');

    // 3. All clients with session data for lapsed/due detection
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, email, sessions(id, created_at)')
      .eq('therapist_id', therapist.id);

    const lapsedClients: any[] = [];
    const dueClients: any[] = [];

    for (const client of clients || []) {
      const sessions = (client.sessions || []).sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      if (!sessions.length) continue;

      const lastVisit = new Date(sessions[0].created_at);
      const daysSince = Math.floor((today.getTime() - lastVisit.getTime()) / 86400000);

      // Lapsed: crossed the threshold within the last 2 days (newly lapsed)
      if (daysSince >= lapsedDays && daysSince < lapsedDays + 2) {
        lapsedClients.push({ name: client.name, daysSince });
      }

      // Due: has 2+ sessions, past 120% of avg interval
      if (sessions.length >= 2) {
        let totalGap = 0;
        for (let i = 1; i < Math.min(sessions.length, 5); i++) {
          totalGap += new Date(sessions[i-1].created_at).getTime() - new Date(sessions[i].created_at).getTime();
        }
        const avgDays = totalGap / Math.min(sessions.length - 1, 4) / 86400000;
        if (daysSince >= avgDays * 1.2 && daysSince < lapsedDays) {
          dueClients.push({ name: client.name, daysSince, avgDays: Math.round(avgDays) });
        }
      }
    }

    // Only send if there's something to report
    const hasSomething = (todaySessions?.length || 0) > 0 || (tomorrowBookings?.length || 0) > 0 || lapsedClients.length > 0 || dueClients.length > 0;
    if (!hasSomething && !singleTherapistId) continue;

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
      ${todaySessions.map((s: any) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F9F9F9;">
          <div style="font-size:14px;font-weight:600;color:#1A1A2E;">${s.clients?.name || 'Client'}</div>
          <div style="font-size:12px;color:${s.completed?'#16A34A':'#D97706'};font-weight:600;">${s.completed ? '✓ Complete' : '⏳ Needs notes'}</div>
        </div>
      `).join('')}
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

    <div style="padding:20px 24px;display:flex;gap:12px;flex-wrap:wrap;">
      <a href="${dashboardUrl}" style="flex:1;min-width:120px;display:block;background:#2A5741;color:#fff;text-decoration:none;border-radius:8px;padding:11px 16px;text-align:center;font-size:13px;font-weight:700;">Open Dashboard →</a>
      ${(dueClients.length > 0 || lapsedClients.length > 0) ? `<a href="${outreachUrl}" style="flex:1;min-width:120px;display:block;background:#F5F0E8;color:#2A5741;text-decoration:none;border-radius:8px;padding:11px 16px;text-align:center;font-size:13px;font-weight:700;border:1.5px solid #E8E4DC;">Reach Out →</a>` : ''}
    </div>
  </div>

  <p style="font-size:11px;color:#9CA3AF;text-align:center;margin:20px 0 0;">
    Practice Pulse by BodyMap · <a href="https://mybodymap.app" style="color:#9CA3AF;">mybodymap.app</a>
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
    results.push({ therapist: therapistName, email: therapist.email, status: res.ok ? 'sent' : 'failed', id: data.id, error: data.message });
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
});
