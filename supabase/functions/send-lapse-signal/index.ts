// T10 - Therapist lapse signal
//
// Fires when a client reaches 45 days lapsed. Tells the therapist:
// "X just hit your lapse threshold. We sent them a warm nudge. Want
// to reach out personally too?" This pairs with C14 (which goes to
// the client). Daily cron at 10:45am UTC, after C14 cron has run.
//
// Batches up to 8 lapsed clients per therapist per day into one email
// so therapists don't get 30 separate notifications.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logNotification } from "../_shared/notifications.ts";
import { emailWrapper, ctaButton, eyebrow, factBox } from "../_shared/emailTemplate.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { therapist_id } = await req.json().catch(() => ({}));
  const therapistIds = therapist_id ? [therapist_id] : await findTherapistsWithNewlyLapsedClients(supabase);

  const results: any[] = [];
  for (const id of therapistIds) {
    const r = await sendForTherapist(supabase, RESEND_API_KEY!, id);
    results.push({ therapist_id: id, ...r });
    await new Promise(r => setTimeout(r, 250));
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});

async function findTherapistsWithNewlyLapsedClients(supabase: any): Promise<string[]> {
  // Look at notification_log for C14 fires in the past 24h. Each
  // unique therapist with at least one fire is a candidate.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: c14s } = await supabase
    .from('notification_log')
    .select('therapist_id')
    .eq('notification_type', 'lapse_nudge')
    .eq('audience', 'client')
    .eq('channel', 'email')
    .gte('created_at', since)
    .limit(2000);

  if (!c14s?.length) return [];

  // Dedup
  const seen = new Set<string>();
  const therapistIds: string[] = [];
  for (const r of c14s) {
    if (r.therapist_id && !seen.has(r.therapist_id)) {
      seen.add(r.therapist_id);
      therapistIds.push(r.therapist_id);
    }
  }

  // Filter out therapists who already got their T10 today
  if (!therapistIds.length) return [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: t10sToday } = await supabase
    .from('notification_log')
    .select('therapist_id')
    .eq('notification_type', 'lapse_signal')
    .eq('audience', 'therapist')
    .eq('channel', 'email')
    .in('therapist_id', therapistIds)
    .gte('created_at', todayStart.toISOString());
  const sent = new Set((t10sToday || []).map((r: any) => r.therapist_id));
  return therapistIds.filter(id => !sent.has(id));
}

async function sendForTherapist(supabase: any, RESEND_KEY: string, therapistId: string) {
  const { data: therapist } = await supabase
    .from('therapists')
    .select('id, full_name, business_name, email, notification_prefs')
    .eq('id', therapistId)
    .single();

  if (!therapist?.email) return { status: 'skipped', reason: 'no_therapist_email' };
  if (therapist?.notification_prefs?.therapist?.lapse_signal?.email === false) {
    return { status: 'skipped', reason: 'therapist_opted_out' };
  }

  // Find clients who got C14 in past 24h for this therapist
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: lapseLog } = await supabase
    .from('notification_log')
    .select('client_id')
    .eq('therapist_id', therapistId)
    .eq('notification_type', 'lapse_nudge')
    .eq('audience', 'client')
    .eq('channel', 'email')
    .gte('created_at', since)
    .limit(50);

  const clientIds = [...new Set((lapseLog || []).map((r: any) => r.client_id).filter(Boolean))];
  if (!clientIds.length) return { status: 'skipped', reason: 'no_lapsed_clients' };

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, email, phone')
    .in('id', clientIds)
    .limit(8);

  if (!clients?.length) return { status: 'skipped', reason: 'no_client_rows' };

  const totalCount = clientIds.length;
  const shownCount = clients.length;
  const moreCount = Math.max(0, totalCount - shownCount);

  const therapistFirstName = therapist.full_name?.split(' ')[0] || 'there';
  const subject = totalCount === 1
    ? `${clients[0].name} hasn't booked in 45 days`
    : `${totalCount} clients just hit the 45-day mark`;

  const clientRows = clients.map((c: any) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E0D0;">
        <a href="https://mybodymap.app/dashboard/clients/${c.id}" style="color:#2A5741;font-weight:600;text-decoration:none;font-size:14px;">${c.name || 'Client'}</a>
        ${c.email ? `<div style="font-size:11px;color:#6B7F72;margin-top:2px;">${c.email}</div>` : ''}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E0D0;text-align:right;">
        <a href="mailto:${c.email || ''}" style="font-size:12px;color:#6B9E80;text-decoration:none;font-weight:600;">Email →</a>
      </td>
    </tr>
  `).join('');

  const tableHtml = `
    <div style="background:#FAFAF7;border-radius:12px;padding:0;margin:16px 0;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">${clientRows}</table>
    </div>
    ${moreCount > 0 ? `<p class="muted" style="font-size:12px;text-align:center;">+ ${moreCount} more in your dashboard</p>` : ''}
  `;

  const bodyHtml = `
    ${eyebrow('Lapsed clients', 'sage')}
    <h1>${totalCount === 1 ? `${clients[0].name} hasn't booked in a while` : `${totalCount} clients just hit the 45-day mark`}</h1>
    <p>Hi ${therapistFirstName},</p>
    <p>We've already sent ${totalCount === 1 ? 'a warm "thinking of you" nudge' : `each of them a warm "thinking of you" nudge`}. Sometimes a personal note from you lands differently. Here ${totalCount === 1 ? 'is the client' : 'are the clients'}:</p>
    ${tableHtml}
    ${ctaButton('Open your client list', `https://mybodymap.app/dashboard?tab=clients&filter=lapsed`)}
    <p class="muted" style="font-size:12px;">You can adjust or disable these check-ins in Settings > Notifications.</p>
  `;

  const html = emailWrapper({ subject, bodyHtml, preheader: `Quick reach-out opportunity. ${totalCount} client${totalCount === 1 ? '' : 's'} just hit your lapse threshold.` });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'MyBodyMap <hello@mybodymap.app>',
      to: [therapist.email],
      reply_to: 'support@mybodymap.app',
      subject,
      html,
    }),
  });
  const data = await res.json();
  const status = res.ok ? 'sent' : 'failed';

  await logNotification(supabase, {
    therapist_id: therapist.id,
    notification_type: 'lapse_signal',
    audience: 'therapist',
    channel: 'email',
    recipient: therapist.email,
    status,
    provider_id: data.id,
    error_message: res.ok ? null : (data.message || JSON.stringify(data)),
    subject,
  });

  return { status, email_id: data.id, client_count: totalCount };
}
