// supabase/functions/confirm-membership-purchase/index.ts
//
// After hosted checkout returns, verifies + creates the
// member_subscriptions row + grants the first month's credits.
// Works with both Stripe and Square subscription flows.
//
// Stripe flow:
//   - One Checkout Session in 'subscription' mode
//   - verifyCheckout returns subscriptionId + customerId + period_end
//     all in one call
//   - Insert member_subscriptions row directly
//
// Square flow (more involved per the capability matrix's 'limited'
// declaration):
//   - First month was paid via a regular Payment Link (not a sub)
//   - Square's Catalog plan_variation_id was created in Chunk α and
//     persisted on memberships.square_plan_variation_id
//   - We get the Square customer_id from the redirect URL params
//     (passed through by SquareV1.createSubscriptionLink)
//   - Real recurring billing requires a saved card on the customer
//     plus an actual Subscription resource. For tonight, we
//     RECORD the membership as active for the first month (paid
//     up front) and flag that the recurring renewal needs the
//     therapist to ensure the client has a card on file (we'll
//     prompt this in the UI).
//   - This is the documented limitation in the capability matrix:
//     'no automatic proration, weaker dunning'. Recurring
//     renewals on Square will be handled in a follow-up commit.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, respond, getSupabaseClient, loadTherapist,
  getProvider, ProviderError,
} from '../_shared/payment-provider.ts';
import { notifyTherapist } from '../_shared/notifications.ts';
import { emailWrapper, factBox, eyebrow, fromFor, replyToFor } from '../_shared/emailTemplate.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      session_id,         // Stripe checkout session id
      order_id,           // Square order id
      processor,          // 'stripe' | 'square' from redirect params
      plan_variation_id,  // Square: from redirect params (created in createSubscriptionLink)
      customer_id,        // Square: from redirect params (Square customer id)
      start_date,         // Square: from redirect params
      membership_id,
      therapist_id: therapistIdParam,
      client_email, client_name, client_phone,
    } = await req.json();

    if (!membership_id) return respond({ error: 'membership_id required' }, 400);
    if (!session_id && !order_id) return respond({ error: 'session_id or order_id required' }, 400);

    const supabase = getSupabaseClient();
    const { data: m } = await supabase
      .from('memberships').select('*').eq('id', membership_id).single();
    if (!m) return respond({ error: 'membership_not_found' }, 404);

    const therapist_id = therapistIdParam || m.therapist_id;
    const therapist = await loadTherapist(supabase, therapist_id);

    // Pick provider explicitly when caller tells us, else auto.
    let provider;
    if (processor === 'square') {
      const { SquareProvider } = await import('../_shared/providers/square.ts');
      provider = new SquareProvider(therapist);
    } else if (processor === 'stripe') {
      provider = await getProvider(therapist, 'stripe-required');
    } else {
      provider = await getProvider(therapist, 'auto');
    }

    const paymentRefId = processor === 'square' ? order_id : session_id;
    const verified = await provider.verifyCheckout({ therapist, paymentRefId });
    if (!verified.paid) {
      return respond({ error: 'payment_not_completed', status: verified.status }, 400);
    }

    const verifiedEmail = (verified.customerEmail || client_email || '').toLowerCase();
    let clientId: string | null = null;
    if (verifiedEmail) {
      const { data: c } = await supabase
        .from('clients').select('id')
        .eq('therapist_id', therapist_id).eq('email', verifiedEmail).maybeSingle();
      if (c) clientId = c.id;
    }

    // ─── STRIPE PATH ─────────────────────────────────────────────────
    if (processor === 'stripe' || (!processor && verified.subscriptionId)) {
      if (!verified.subscriptionId) {
        return respond({ error: 'no_subscription_returned' }, 400);
      }

      // Idempotency by subscription_id
      const { data: existing } = await supabase
        .from('member_subscriptions').select('id')
        .eq('stripe_subscription_id', verified.subscriptionId).maybeSingle();
      if (existing) {
        return respond({ ok: true, idempotent: true, subscription_id: existing.id });
      }

      const { data: insertedSub, error: insErr } = await supabase
        .from('member_subscriptions')
        .insert({
          therapist_id, membership_id,
          client_id: clientId,
          client_email: verifiedEmail,
          client_name: client_name || null,
          stripe_subscription_id: verified.subscriptionId,
          stripe_customer_id: verified.subscriberCustomerId || null,
          status: 'active',
          current_period_end: verified.currentPeriodEnd || null,
          monthly_price: m.monthly_price,
          monthly_session_credits: m.monthly_session_credits,
          current_credits: m.monthly_session_credits,
          processor: 'stripe',
        })
        .select()
        .single();

      if (insErr) {
        console.error('[confirm-membership-purchase] stripe insert failed', insErr);
        return respond({ error: 'insert_failed: ' + insErr.message }, 500);
      }

      await supabase.from('member_credit_events').insert({
        member_subscription_id: insertedSub.id,
        delta: m.monthly_session_credits,
        reason: 'monthly_grant',
      });

      // HK May 29 2026: fire therapist notification on first successful
      // purchase. Previously this function returned silently and the
      // therapist had no idea a real customer just bought a membership.
      // Real money was flowing without therapist visibility.
      await fireMembershipPurchasedNotification(supabase, {
        therapist, membership: m, subscription: insertedSub,
        clientName: client_name || verifiedEmail,
        clientEmail: verifiedEmail,
      }).catch(e => console.error('[confirm-membership-purchase] notify failed (stripe)', e));

      return respond({ ok: true, subscription_id: insertedSub.id, processor: 'stripe' });
    }

    // ─── SQUARE PATH ─────────────────────────────────────────────────
    // First month is paid. Record the subscription locally as active.
    // Recurring renewals on Square require additional setup (saved
    // card, Subscription resource creation, webhook for renewal
    // events) which is documented in the capability matrix as
    // 'limited' and will be wired in a follow-up commit when needed.
    //
    // For now: the membership is active for the current month (paid
    // up front), credits granted, end date set 30 days out. The
    // therapist gets a manual reminder before period_end to renew
    // the client's billing.

    // Idempotency by order_id (Square's stable reference)
    const idempotencyMarker = `square-sub-${order_id}`;
    const { data: existing } = await supabase
      .from('member_subscriptions').select('id')
      .eq('square_subscription_id', idempotencyMarker).maybeSingle();
    if (existing) {
      return respond({ ok: true, idempotent: true, subscription_id: existing.id });
    }

    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    const { data: insertedSub, error: insErr } = await supabase
      .from('member_subscriptions')
      .insert({
        therapist_id, membership_id,
        client_id: clientId,
        client_email: verifiedEmail,
        client_name: client_name || null,
        // Use the idempotency marker so this row links back to the
        // checkout that created it. Real Square Subscription id will
        // be persisted when recurring billing is wired up.
        square_subscription_id: idempotencyMarker,
        square_customer_id: customer_id || null,
        square_plan_variation_id: plan_variation_id || m.square_plan_variation_id || null,
        status: 'active',
        current_period_end: periodEnd.toISOString(),
        monthly_price: m.monthly_price,
        monthly_session_credits: m.monthly_session_credits,
        current_credits: m.monthly_session_credits,
        processor: 'square',
      })
      .select()
      .single();

    if (insErr) {
      console.error('[confirm-membership-purchase] square insert failed', insErr);
      return respond({ error: 'insert_failed: ' + insErr.message }, 500);
    }

    await supabase.from('member_credit_events').insert({
      member_subscription_id: insertedSub.id,
      delta: m.monthly_session_credits,
      reason: 'monthly_grant',
    });

    // HK May 29 2026: fire therapist notification on Square purchase too.
    await fireMembershipPurchasedNotification(supabase, {
      therapist, membership: m, subscription: insertedSub,
      clientName: client_name || verifiedEmail,
      clientEmail: verifiedEmail,
    }).catch(e => console.error('[confirm-membership-purchase] notify failed (square)', e));

    return respond({
      ok: true,
      subscription_id: insertedSub.id,
      processor: 'square',
      // Hint for the UI: Square memberships need follow-up for
      // recurring billing. UI shows this as a banner on the
      // membership detail row.
      requires_renewal_setup: true,
    });

  } catch (e) {
    if (e instanceof ProviderError) {
      console.error('[confirm-membership-purchase] provider error', e.code, e.message);
      return respond({ error: e.message, code: e.code }, 400);
    }
    console.error('[confirm-membership-purchase] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});

// HK May 29 2026: shared notification helper called by both the Stripe
// and Square success branches. Sends therapist email + in-app + SMS
// (per their prefs) so they know a membership was just purchased.
// Failure here must NOT roll back the subscription, since the row is
// already inserted - so the caller wraps in .catch().
async function fireMembershipPurchasedNotification(supabase: any, opts: {
  therapist: any,
  membership: any,
  subscription: any,
  clientName: string,
  clientEmail: string,
}) {
  const { therapist, membership, subscription, clientName, clientEmail } = opts;
  const firstName = (clientName || '').split(' ')[0] || 'a client';
  const monthlyDollars = ((membership.monthly_price || 0) / 100).toFixed(2);
  const credits = membership.monthly_session_credits || 0;

  const title = `${firstName} signed up for ${membership.name || 'your membership'}`;
  const summary = `${clientName || clientEmail} just purchased ${membership.name || 'a membership'} at $${monthlyDollars} per month.`;

  const rows = [
    { label: 'Client',       value: clientName || clientEmail },
    { label: 'Email',        value: clientEmail },
    { label: 'Membership',   value: membership.name || 'Membership' },
    { label: 'Monthly price', value: `$${monthlyDollars}` },
    { label: 'Credits granted', value: `${credits} sessions / month` },
    { label: 'Processor',    value: subscription.processor === 'square' ? 'Square' : 'Stripe' },
  ];

  const bodyHtml = `
    ${eyebrow('New membership', 'sage')}
    <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#2A5741;margin:0 0 8px;">${title}</h1>
    <p style="font-size:14px;color:#3D4F43;margin:0 0 14px;line-height:1.6;">${summary}</p>
    ${factBox(rows)}
    <p style="font-size:12px;color:#9CA3AF;margin-top:18px;line-height:1.55;">
      The first month's credits have been granted automatically. You can see and manage this membership from the client's profile.
    </p>
  `;

  const html = emailWrapper({ subject: title, bodyHtml, preheader: summary });

  await notifyTherapist({
    supabase, therapist,
    eventType: 'membership_purchased',
    title,
    body: summary,
    icon: '🎫',
    linkUrl: '/dashboard',
    payload: {
      membership_id: membership.id,
      subscription_id: subscription.id,
      client_email: clientEmail,
      monthly_price_cents: membership.monthly_price,
    },
    emailSubject: title,
    emailHtml: html,
    smsText: `MyBodyMap: ${firstName} signed up for ${membership.name || 'your membership'} ($${monthlyDollars}/mo). Credits granted.`,
    clientId: subscription.client_id || null,
  });
}
