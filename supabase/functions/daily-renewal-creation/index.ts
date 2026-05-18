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

        const { error: insErr } = await supabase
          .from('member_subscription_renewals')
          .insert({
            member_subscription_id: sub.id,
            therapist_id: sub.therapist_id,
            client_id: sub.client_id,
            period_start: periodStartStr,
            period_end: isoDate(periodEnd),
            due_on: periodStartStr,
            amount_due_cents: Math.round(Number(sub.monthly_price) * 100),
            status: 'pending',
          });
        if (insErr) {
          console.error(`insert failed for sub ${sub.id}:`, insErr);
          errored++;
        } else {
          created++;
        }
      } catch (e) {
        console.error(`sub ${sub.id} threw:`, e);
        errored++;
      }
    }

    console.log(`[daily-renewal-creation] today=${todayStr} subs=${subs?.length || 0} created=${created} skipped=${skipped} errored=${errored}`);

    return new Response(
      JSON.stringify({
        ok: true,
        today: todayStr,
        subs_evaluated: subs?.length || 0,
        renewals_created: created,
        renewals_skipped: skipped,
        renewals_errored: errored,
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
