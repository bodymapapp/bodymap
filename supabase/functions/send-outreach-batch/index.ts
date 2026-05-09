// supabase/functions/send-outreach-batch/index.ts
//
// Sends a quick-send template to all matching clients of an
// audience preset. Handles:
//   - Re-send protection: skip clients who received this template
//     within the last 14 days
//   - Unsubscribed filter (defense in depth; the audience query
//     already excludes them)
//   - Per-recipient smart-token rendering ({{first_name}},
//     {{therapist_name}}, {{rebook_link}})
//   - One Resend API call per recipient (sequential with small
//     delay to stay under Resend rate limits)
//   - One outreach_quicksend_sends row per successful send for future
//     re-send protection and reporting
//
// Returns: { sent, skipped_recent, skipped_unsubscribed, failed }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API = 'https://api.resend.com/emails';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://rmnqfrljoknmellbnpiy.supabase.co';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const RESEND_PROTECTION_DAYS = 14;

// Smart-token renderer (mirrors src/lib/outreachQuicksend.js)
function renderTokens(template: string, recipient: any, therapist: any): string {
  const customUrl = therapist?.custom_url || '';
  const tokens: Record<string, string> = {
    '{{first_name}}': recipient?.first_name || 'there',
    '{{therapist_name}}': therapist?.full_name || therapist?.business_name || 'your therapist',
    '{{rebook_link}}': customUrl
      ? `https://mybodymap.app/${customUrl}`
      : 'https://mybodymap.app',
  };
  let out = template || '';
  for (const [k, v] of Object.entries(tokens)) {
    out = out.split(k).join(v);
  }
  return out;
}

function deriveFirstName(name: string | null): string {
  if (!name) return 'there';
  const t = name.trim();
  const space = t.indexOf(' ');
  return space > 0 ? t.slice(0, space) : t;
}

// Convert plain-text body to simple HTML for email. Preserves line
// breaks, escapes HTML special chars, makes URLs clickable.
function plainTextToHtml(text: string): string {
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  // Auto-link URLs
  const linked = esc.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" style="color:#2A5741;text-decoration:underline;">$1</a>'
  );
  // Newlines to <br>, double-newlines as paragraph breaks
  const paragraphs = linked.split(/\n\s*\n/).map(p =>
    `<p style="margin:0 0 12px;">${p.replace(/\n/g, '<br>')}</p>`
  ).join('');
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#1A1A2E;max-width:560px;">${paragraphs}</div>`;
}

// Audience query (server-side mirror of src/lib/outreachQuicksend.js).
// Returns Array<{client_id, name, email, first_name}>.
//
// We re-implement here rather than calling the frontend function so
// the recipient list is computed authoritatively server-side and
// can never be tampered with by a malicious client.
async function getRecipients(supabase: any, therapistId: string, preset: string) {
  const shape = (rows: any[]) => (rows || [])
    .filter(r => r.email && !r.email_unsubscribed)
    .map(r => ({
      client_id: r.id,
      name: r.name,
      email: r.email,
      first_name: deriveFirstName(r.name),
    }));

  if (preset === 'new_clients') {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const { data } = await supabase.from('clients')
      .select('id, name, email, email_unsubscribed')
      .eq('therapist_id', therapistId)
      .gte('created_at', cutoff.toISOString());
    return shape(data);
  }

  if (preset === 'returning_recent') {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
    const { data: recent } = await supabase.from('bookings')
      .select('client_id, booking_date')
      .eq('therapist_id', therapistId)
      .neq('status', 'cancelled')
      .gte('booking_date', cutoff.toISOString().split('T')[0]);
    const recentIds = [...new Set((recent || []).map((b: any) => b.client_id).filter(Boolean))];
    if (recentIds.length === 0) return [];
    const { data: all } = await supabase.from('bookings')
      .select('client_id')
      .eq('therapist_id', therapistId)
      .neq('status', 'cancelled')
      .in('client_id', recentIds);
    const counts: Record<string, number> = {};
    for (const b of (all || [])) counts[b.client_id] = (counts[b.client_id] || 0) + 1;
    const qualifyingIds = Object.entries(counts).filter(([, c]) => (c as number) >= 2).map(([id]) => id);
    if (qualifyingIds.length === 0) return [];
    const { data: clients } = await supabase.from('clients')
      .select('id, name, email, email_unsubscribed')
      .eq('therapist_id', therapistId)
      .in('id', qualifyingIds);
    return shape(clients);
  }

  if (preset === 'lapsed') {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
    const { data: ever } = await supabase.from('bookings')
      .select('client_id')
      .eq('therapist_id', therapistId)
      .neq('status', 'cancelled');
    const everIds = [...new Set((ever || []).map((b: any) => b.client_id).filter(Boolean))];
    if (everIds.length === 0) return [];
    const { data: recent } = await supabase.from('bookings')
      .select('client_id')
      .eq('therapist_id', therapistId)
      .neq('status', 'cancelled')
      .gte('booking_date', cutoff.toISOString().split('T')[0]);
    const recentIds = new Set((recent || []).map((b: any) => b.client_id).filter(Boolean));
    const lapsedIds = everIds.filter(id => !recentIds.has(id));
    if (lapsedIds.length === 0) return [];
    const { data: clients } = await supabase.from('clients')
      .select('id, name, email, email_unsubscribed')
      .eq('therapist_id', therapistId)
      .in('id', lapsedIds);
    return shape(clients);
  }

  if (preset === 'all_active') {
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1);
    const { data: recent } = await supabase.from('bookings')
      .select('client_id')
      .eq('therapist_id', therapistId)
      .neq('status', 'cancelled')
      .gte('booking_date', cutoff.toISOString().split('T')[0]);
    const ids = [...new Set((recent || []).map((b: any) => b.client_id).filter(Boolean))];
    if (ids.length === 0) return [];
    const { data: clients } = await supabase.from('clients')
      .select('id, name, email, email_unsubscribed')
      .eq('therapist_id', therapistId)
      .in('id', ids);
    return shape(clients);
  }

  if (preset === 'package_holders_idle') {
    const { data: pkgs } = await supabase.from('package_purchases')
      .select('client_id, sessions_remaining')
      .eq('therapist_id', therapistId)
      .gt('sessions_remaining', 0);
    const pkgIds = [...new Set((pkgs || []).map((p: any) => p.client_id).filter(Boolean))];
    if (pkgIds.length === 0) return [];
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
    const { data: recent } = await supabase.from('bookings')
      .select('client_id')
      .eq('therapist_id', therapistId)
      .neq('status', 'cancelled')
      .in('client_id', pkgIds)
      .gte('booking_date', cutoff.toISOString().split('T')[0]);
    const recentIds = new Set((recent || []).map((b: any) => b.client_id).filter(Boolean));
    const idleIds = pkgIds.filter(id => !recentIds.has(id));
    if (idleIds.length === 0) return [];
    const { data: clients } = await supabase.from('clients')
      .select('id, name, email, email_unsubscribed')
      .eq('therapist_id', therapistId)
      .in('id', idleIds);
    return shape(clients);
  }

  return [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const respond = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

  if (!RESEND_API_KEY) return respond({ error: 'RESEND_API_KEY not set' }, 500);
  if (!SERVICE_ROLE_KEY) return respond({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, 500);

  try {
    const { template_id, therapist_id } = await req.json();
    if (!template_id || !therapist_id) return respond({ error: 'Missing template_id or therapist_id' }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Fetch the template
    const { data: template, error: tErr } = await supabase
      .from('outreach_templates')
      .select('*')
      .eq('id', template_id)
      .eq('therapist_id', therapist_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (tErr || !template) return respond({ error: 'Template not found' }, 404);

    // Fetch the therapist (for from-line and smart token rendering)
    const { data: therapist, error: thErr } = await supabase
      .from('therapists')
      .select('id, full_name, business_name, custom_url, email')
      .eq('id', therapist_id)
      .maybeSingle();

    if (thErr || !therapist) return respond({ error: 'Therapist not found' }, 404);

    // Fetch recipients server-side (do not trust frontend list)
    const recipients = await getRecipients(supabase, therapist_id, template.audience_preset);
    if (recipients.length === 0) {
      return respond({ sent: 0, skipped_recent: 0, skipped_unsubscribed: 0, failed: 0 });
    }

    // Re-send protection: look up sends of this template in last 14 days
    const protectionCutoff = new Date();
    protectionCutoff.setDate(protectionCutoff.getDate() - RESEND_PROTECTION_DAYS);
    const { data: recentSends } = await supabase
      .from('outreach_quicksend_sends')
      .select('client_id')
      .eq('template_id', template_id)
      .gte('sent_at', protectionCutoff.toISOString());
    const recentClientIds = new Set((recentSends || []).map((s: any) => s.client_id).filter(Boolean));

    let sent = 0, skipped_recent = 0, failed = 0;
    const fromLine = `${therapist.business_name || therapist.full_name || 'Your therapist'} <outreach@mybodymap.app>`;
    const replyTo = therapist.email || 'hello@mybodymap.app';

    for (const recipient of recipients) {
      // Re-send protection
      if (recentClientIds.has(recipient.client_id)) {
        skipped_recent++;
        continue;
      }

      const renderedSubject = renderTokens(template.subject, recipient, therapist);
      const renderedBody = renderTokens(template.body, recipient, therapist);
      const html = plainTextToHtml(renderedBody);

      try {
        const res = await fetch(RESEND_API, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromLine,
            reply_to: replyTo,
            to: recipient.email,
            subject: renderedSubject,
            html,
          }),
        });

        if (!res.ok) {
          failed++;
          const err = await res.text();
          console.error(`[send-outreach-batch] Resend error for ${recipient.email}:`, err);
          continue;
        }

        const data = await res.json();

        // Log the send
        await supabase.from('outreach_quicksend_sends').insert({
          template_id,
          therapist_id,
          client_id: recipient.client_id,
          client_email: recipient.email,
          resend_message_id: data.id || null,
        });

        sent++;
      } catch (e) {
        failed++;
        console.error(`[send-outreach-batch] threw for ${recipient.email}:`, e);
      }

      // Small delay to be polite to Resend's rate limit (typical
      // limit is 10/sec; 100ms gives us 10/sec exactly).
      await new Promise(r => setTimeout(r, 100));
    }

    return respond({
      sent,
      skipped_recent,
      skipped_unsubscribed: 0, // already filtered in getRecipients
      failed,
    });

  } catch (e: any) {
    return respond({ error: `Error: ${e?.message || String(e)}` }, 500);
  }
});
