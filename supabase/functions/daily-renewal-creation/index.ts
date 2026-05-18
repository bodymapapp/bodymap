// supabase/functions/daily-renewal-creation/index.ts
//
// HK May 18 2026, Phase 19 Pass 5: daily job that pre-creates
// member_subscription_renewals rows for active subscriptions whose
// renewal date is within the next 3 days.
//
// Idempotent: if a row already exists for (subscription, period_start)
// the insert is skipped. Safe to run multiple times in a day.
//
// Scheduling: Supabase cron, daily at 06:00 UTC (about 1 am Central).
// HK to wire via Supabase Database > Cron Jobs.
//
// Logic per active subscription:
//   1. Skip if status != 'active' (canceled / paused subs don't renew)
//   2. Skip if renewal_day_of_month is NULL (record-only subscription
//      that the therapist isn't tracking renewals for; e.g. annual or
//      bespoke arrangements)
//   3. Compute next due_on: the next occurrence of renewal_day_of_month.
//      For months without that day (Feb 30/31), land on the last day
//      of the month.
//   4. If due_on is within 3 days from today, create a pending renewal
//      row for that period. The period_start is the same as due_on;
//      period_end is one cadence-unit later (next renewal_day).
//   5. Skip if a renewal row already exists with this period_start
//      for this subscription.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { notifyTherapist } from "../_shared/notifications.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// How many days ahead of due_on to create the renewal row. Setting
// this to 3 means the therapist sees the upcoming renewal in their
// billing dashboard with a few days of lead time, not just on the
// exact due day.
const LEAD_DAYS = 3;

function computeNextRenewalDue(today: Date, renewalDay: number): Date {
  // Try this month first. If renewalDay has already passed (or is
  // today), roll to next month. If the target month doesn't have
  // that day (Feb 30/31), use the last day of the month.
  let year = today.getUTCFullYear();
  let month = today.getUTCMonth();
  const candidateThisMonth = new Date(Date.UTC(year, month, renewalDay));
  if (candidateThisMonth.getUTCMonth() !== month) {
    // Day rolled over (e.g. Feb 31 became Mar 3); use last day of
    // the original month.
    candidateThisMonth.setUTCDate(0);
  }
  if (candidateThisMonth.getTime() > today.getTime()) {
    return candidateThisMonth;
  }
  // Roll to next month.
  month += 1;
  if (month > 11) { month = 0; year += 1; }
  const candidateNextMonth = new Date(Date.UTC(year, month, renewalDay));
  if (candidateNextMonth.getUTCMonth() !== month) {
    candidateNextMonth.setUTCDate(0);
  }
  return candidateNextMonth;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
    const now = new Date();
    const todayStr = isoDate(now);

    // Fetch all active subscriptions with a renewal day set.
    const { data: subs, error: subsErr } = await supabase
      .from('member_subscriptions')
      .select('id, therapist_id, client_id, monthly_price, renewal_day_of_month, billing_cadence, status')
      .eq('status', 'active')
      .not('renewal_day_of_month', 'is', null);

    if (subsErr) {
      console.error('subs fetch failed:', subsErr);
      return new Response(JSON.stringify({ error: subsErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let created = 0;
    let skipped = 0;
    let errored = 0;
    let notified = 0;

    // Cache therapists + memberships to avoid re-fetching per sub.
    const therapistCache: Record<string, any> = {};
    const membershipCache: Record<string, any> = {};
    async function loadTherapist(id: string) {
      if (therapistCache[id]) return therapistCache[id];
      const { data } = await supabase
        .from('therapists').select('*').eq('id', id).maybeSingle();
      if (data) therapistCache[id] = data;
      return data;
    }
    async function loadMembership(id: string) {
      if (membershipCache[id]) return membershipCache[id];
      const { data } = await supabase
        .from('memberships').select('id, name').eq('id', id).maybeSingle();
      if (data) membershipCache[id] = data;
      return data;
    }

    for (const sub of (subs || [])) {
      try {
        const due = computeNextRenewalDue(now, sub.renewal_day_of_month);
        const daysUntilDue = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilDue > LEAD_DAYS) {
          skipped++;
          continue;
        }

        const periodStartStr = isoDate(due);
        // Period end: next renewal day after this one.
        const periodEnd = computeNextRenewalDue(due, sub.renewal_day_of_month);
        // If period_end somehow equals period_start (shouldn't happen
        // given the function rolls to next month when candidate is in
        // the past), nudge it forward by one month to keep the period
        // non-zero.
        if (periodEnd.getTime() <= due.getTime()) {
          periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
        }

        // Idempotency: skip if a renewal row already exists with this
        // period_start for this subscription.
        const { data: existing } = await supabase
          .from('member_subscription_renewals')
          .select('id')
          .eq('member_subscription_id', sub.id)
          .eq('period_start', periodStartStr)
          .maybeSingle();
        if (existing) {
          skipped++;
          continue;
        }

        const amountCents = Math.round(Number(sub.monthly_price) * 100);
        const { data: insertedRenewal, error: insErr } = await supabase
          .from('member_subscription_renewals')
          .insert({
            member_subscription_id: sub.id,
            therapist_id: sub.therapist_id,
            client_id: sub.client_id,
            period_start: periodStartStr,
            period_end: isoDate(periodEnd),
            due_on: periodStartStr,
            amount_due_cents: amountCents,
            status: 'pending',
          })
          .select('id')
          .single();
        if (insErr) {
          console.error(`insert failed for sub ${sub.id}:`, insErr);
          errored++;
        } else {
          created++;

          // Fire renewal-due notification when due_on is today or
          // tomorrow (1 day window). Avoid spamming the therapist
          // every day for a 3-day-out renewal; the billing dashboard
          // banner already surfaces those quietly.
          if (daysUntilDue <= 1) {
            try {
              const therapist = await loadTherapist(sub.therapist_id);
              if (therapist) {
                // Fetch sub with membership name + client for richer message.
                const { data: fullSub } = await supabase
                  .from('member_subscriptions')
                  .select('id, client_name, client_email, membership:memberships(name)')
                  .eq('id', sub.id).maybeSingle();
                const planName = fullSub?.membership?.name || 'Membership';
                const clientLabel = fullSub?.client_name || fullSub?.client_email || 'Client';
                const dueLabel = daysUntilDue === 0 ? 'today' : 'tomorrow';
                const amountLabel = `$${(amountCents / 100).toFixed(2)}`;
                const title = `Renewal due ${dueLabel}: ${clientLabel}`;
                const body = `${clientLabel} owes ${amountLabel} for ${planName} ${dueLabel}. Tap Charge on the billing dashboard.`;
                const emailHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1F2937;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#854F0B;margin-bottom:8px;">Membership renewal due ${dueLabel}</div>
      <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#2A5741;margin:0 0 6px;">${escapeHtml(clientLabel)}</h1>
      <p style="font-size:14px;color:#6B7280;margin:0 0 18px;line-height:1.6;">${escapeHtml(planName)} &middot; ${amountLabel} due ${dueLabel}.</p>
      <p style="font-size:13px;color:#1F2937;margin:0 0 18px;line-height:1.6;">MyBodyMap is reminding you, not charging the card. Open the billing dashboard, tap Charge, and pick how the client is paying.</p>
      <a href="https://mybodymap.app/dashboard/billing" style="display:inline-block;background:#2A5741;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:13px;font-weight:700;">Open billing dashboard</a>
      <div style="font-size:11px;color:#9CA3AF;margin-top:24px;line-height:1.6;">You are getting this because Membership renewal due is on in your notification settings.</div>
    </div>
  </div>
</body></html>`;
                await notifyTherapist({
                  supabase, therapist,
                  eventType: 'renewal_due',
                  title,
                  body,
                  icon: '⏰',
                  linkUrl: '/dashboard/billing',
                  payload: {
                    renewal_id: insertedRenewal?.id || null,
                    member_subscription_id: sub.id,
                    amount_due_cents: amountCents,
                    due_on: periodStartStr,
                  },
                  emailSubject: title,
                  emailHtml,
                  smsText: `MyBodyMap: ${clientLabel}'s ${amountLabel} ${planName} renewal is due ${dueLabel}. Open billing to charge.`,
                  clientId: sub.client_id,
                });
                notified++;
              }
            } catch (notifyErr) {
              console.warn(`notify failed for sub ${sub.id}:`, notifyErr);
            }
          }
        }
      } catch (e) {
        console.error(`sub ${sub.id} threw:`, e);
        errored++;
      }
    }

    console.log(`[daily-renewal-creation] today=${todayStr} subs=${subs?.length || 0} created=${created} skipped=${skipped} errored=${errored} notified=${notified}`);

    return new Response(
      JSON.stringify({
        ok: true,
        today: todayStr,
        subs_evaluated: subs?.length || 0,
        renewals_created: created,
        renewals_skipped: skipped,
        renewals_errored: errored,
        notifications_fired: notified,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[daily-renewal-creation] uncaught:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
