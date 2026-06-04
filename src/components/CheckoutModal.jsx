// src/components/CheckoutModal.jsx
//
// Phase 12: Therapist Checkout flow on the calendar slide-over.
// Phase 19 (HK May 18 2026): generalized to charge for memberships
// too. The modal now accepts either an `appt` (charging for a
// booked session, original behavior) or a `subscription` (charging
// for a membership renewal). One modal, one mental model: "collect
// money from this client right now."
//
// Candice request (May 17 2026): 'how do I check someone out /
// collect payments... lets say they did not (pay online)... how
// would they pay the therapist... this link is gone once the
// massage is booked.'
//
// Three payment paths inside, chosen by the therapist after the
// client says how they want to pay:
//
//   1. Card on file (existing saved card, fastest)
//   2. Enter new card now (Stripe Elements inline) [bookings only,
//      not exposed for subscriptions in V1]
//   3. Send pay link (Stripe Payment Links + SMS or email)
//      [bookings only in V1, will gain subscription support in 19.2]
//   4. Mark as paid (offline: cash, Venmo, Zelle, etc) Phase 19,
//      folded in from the previous separate MarkAsPaidModal.

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { getStripePublishableKey } from '../lib/paymentMode';
import { findOrCreateClient } from '../lib/findOrCreateClient';
// HK May 31 2026: single source of truth for payment method enum.
// Replaces the hand-maintained list that drifted from the DB constraint
// (the "trade" check-constraint error HK hit was the drift symptom).
// CI guard in scripts/check-enum-drift.js fails the build if this
// list ever diverges from the live constraint again.
import { OFFLINE_PAYMENT_METHODS_FOR_PICKER as OFFLINE_METHODS_FROM_ENUM } from '../lib/enums';
import SquareCardForm from './payments/SquareCardForm';
import CloseButton from './CloseButton';
import ResultScreen from './ResultScreen';

const C = {
  forest: '#2A5741',
  forestDeep: '#1F4030',
  sage: '#6B9E80',
  sageLight: '#8FBA9E',
  cream: '#FBFAF4',
  border: '#E8E4DC',
  ink: '#1F2937',
  inkSoft: '#6B7280',
  inkFade: '#9CA3AF',
  green: '#16A34A',
  greenSoft: '#DCFCE7',
  red: '#DC2626',
  redSoft: '#FEF2F2',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
};

// Offline payment methods (folded in from MarkAsPaidModal).
// Used when the therapist taps the 'Mark as paid' button and
// the money was already collected outside the platform.
// HK May 31 2026: OFFLINE_METHODS now sourced from src/lib/enums.js
// instead of being maintained inline. Any change to offline payment
// methods now happens in ONE place (enums.js) and is validated by CI
// against the live DB constraint. See lib/enums.js header comment.
const OFFLINE_METHODS = OFFLINE_METHODS_FROM_ENUM;

export default function CheckoutModal({
  appt,
  subscription,         // NEW Phase 19: { id, monthly_price, membership: {name, ...}, ... } when charging a renewal
  renewal,              // NEW Phase 19: an optional member_subscription_renewals row to link this payment to
  packagePurchase,      // NEW May 24 2026: { name, sessions, price, expiresAt, planId, oneoffPlanData } when adding/charging a package
  onPackageCreated,     // NEW May 24 2026: called with the created package_purchase row on success
  onClientLinked,       // NEW May 24 2026 (Phase 13.12b): called with the picked/created client when the inline ClientPicker links a previously orphan booking. Parents use this to patch their own local state (e.g. slide-over header) so the picked client's name renders immediately without waiting for a schedule refetch.
  therapist,
  client: clientProp,
  defaultAmountCents,
  onClose,
  onPaid,
}) {
  // Three charge modes. Exactly one of appt, subscription, or
  // packagePurchase must be set (enforced by callsites; this modal
  // renders an error if all three are unset).
  const isSubscription = !!subscription;
  const isPackage = !!packagePurchase;
  const chargeContextOk = !!(appt || subscription || packagePurchase);

  // Phase 13.12 (HK May 24 2026): inline client picker for booking
  // charges. When CheckoutModal opens on an appt whose underlying
  // bookings.client_id is NULL, the modal previously rendered a red
  // "Client record missing on this charge" error and the therapist
  // could not proceed without an operator running SQL to repair the
  // booking. Now: if appt is present but clientProp is missing/no-id,
  // we open in a new 'select_client' step that lets the therapist
  // pick from their client list or add a new client inline. On
  // confirm, we UPDATE bookings.client_id and advance to the method
  // picker as if the booking had been linked properly all along.
  //
  // The local 'client' state shadows the prop so charge handlers do
  // not need to change. When the therapist picks/creates a client,
  // setClient(picked) and the rest of the modal sees it.
  const [client, setClient] = useState(clientProp);
  useEffect(() => { setClient(clientProp); }, [clientProp]);

  const needsClientPicker = !!appt && !clientProp?.id;
  const [step, setStep] = useState(needsClientPicker ? 'select_client' : 'method'); // 'select_client' | 'method' | 'card_on_file' | 'card_new' | 'send_link' | 'offline' | 'success'
  const [amount, setAmount] = useState(((defaultAmountCents || 0) / 100).toFixed(2));
  const [tip, setTip] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successDetail, setSuccessDetail] = useState(null);

  // Card-on-file state (loaded from client row)
  const [cardOnFile, setCardOnFile] = useState(null);

  // HK May 31 2026: when therapist enters a new card to charge, default
  // to saving it for future card-on-file charges. Stripe's SetupIntent
  // flow attaches the card to the customer automatically; we persist the
  // IDs to bookings + clients so future "Charge saved card" works without
  // re-entering. HK Jun 3 2026: Square now supported too. The Square path
  // vaults the card via square-save-card (Square CreateCard) before
  // charging, so the toggle is shown for both processors.
  const [saveCardForLater, setSaveCardForLater] = useState(true);

  // Stripe Elements refs for new-card path
  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const cardElRef = useRef(null);
  const cardDivRef = useRef(null);
  const [stripeReady, setStripeReady] = useState(false);

  // HK May 31 2026: Square Web Payments SDK flow for new-card path.
  // Mirrors the BookingPage pattern: when therapist has Square (not
  // Stripe), CheckoutModal calls init-card-setup which auto-routes
  // to the right processor, then renders SquareCardForm OR the
  // existing Stripe Elements form based on data.processor.
  //
  // Why now: Risk Register #5. HK has a customer waiting on Square.
  // Reusing the already-built SquareCardSetupForm pattern from
  // BookingPage was the unlock - estimated wrong earlier as "4-6 hour
  // rebuild" when it's actually ~2 hours of integration.
  const [squareCardSecret, setSquareCardSecret] = useState(null);
  const [squareClientId, setSquareClientId] = useState(null);
  const [squareCustomerId, setSquareCustomerId] = useState(null);
  const [cardSetupProcessor, setCardSetupProcessor] = useState(null);
  const [cardSetupLoading, setCardSetupLoading] = useState(false);

  // Send-link state
  const [linkDelivery, setLinkDelivery] = useState('sms'); // 'sms' | 'email' | 'both'
  const [linkUrl, setLinkUrl] = useState(null);

  // HK May 27 2026 Phase Pkg-C: redeem-from-package detection for
  // booking charges. Shape: { id, name, sessions_purchased,
  // sessions_remaining, used_count, this_session_number, expires_at }
  // Or null when not in booking context, or no active package
  // covers this booking's service. Same email + service_id
  // matching logic DetailPanel uses for the badge.
  const [redeemablePackage, setRedeemablePackage] = useState(null);
  const [redeeming, setRedeeming] = useState(false);
  useEffect(() => {
    // Only relevant for booking charges, not new package/subscription.
    if (!appt?.id || isSubscription || isPackage) {
      setRedeemablePackage(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const email = (appt.email || appt.client_email || '').toLowerCase().trim();
        if (!email && !appt.package_purchase_id) {
          setRedeemablePackage(null);
          return;
        }
        let candidates = [];
        if (appt.package_purchase_id) {
          const { data: p } = await supabase
            .from('package_purchases')
            .select('id, sessions_purchased, sessions_remaining, status, purchased_at, expires_at, package:packages(id, name, applicable_service_ids)')
            .eq('id', appt.package_purchase_id)
            .maybeSingle();
          if (p) candidates = [p];
        } else if (email) {
          const { data: ps } = await supabase
            .from('package_purchases')
            .select('id, sessions_purchased, sessions_remaining, status, purchased_at, expires_at, package:packages(id, name, applicable_service_ids)')
            .eq('therapist_id', therapist.id)
            .ilike('client_email', email)
            .eq('status', 'active')
            .order('purchased_at', { ascending: false });
          candidates = ps || [];
        }
        const match = candidates.find(p => {
          if (p.sessions_remaining <= 0) return false;
          const apply = p.package?.applicable_service_ids;
          if (!apply || (Array.isArray(apply) && apply.length === 0)) return true;
          if (Array.isArray(apply)) return apply.includes(appt.service_id);
          return false;
        });
        if (!alive) return;
        if (match) {
          setRedeemablePackage({
            id: match.id,
            name: match.package?.name || 'Package',
            sessions_purchased: match.sessions_purchased,
            sessions_remaining: match.sessions_remaining,
            expires_at: match.expires_at,
          });
        } else {
          setRedeemablePackage(null);
        }
      } catch (err) {
        console.warn('[checkout package detect] failed:', err);
        if (alive) setRedeemablePackage(null);
      }
    })();
    return () => { alive = false; };
  }, [appt?.id, appt?.email, appt?.client_email, appt?.service_id, appt?.package_purchase_id, therapist?.id, isSubscription, isPackage]);

  // Redeem one credit from the matched package for this booking.
  // Writes:
  //   - session_payments row at $0 with package_purchase_id set
  //     (so the booking renders as 'paid' in the schedule)
  //   - package_redemptions row (audit of which package + booking)
  //   - bookings.package_purchase_id (explicit linkage going forward)
  //   - decrements package_purchases.sessions_remaining
  // Last-write-wins on sessions_remaining is acceptable here since
  // the therapist is the only writer for this row in practice.
  async function chargeFromPackage() {
    if (!client?.id || !redeemablePackage?.id) return;
    setRedeeming(true);
    setErrorMsg(null);
    try {
      // HK May 29 2026: fix for the
      // session_payments_charge_context_exactly_one constraint violation.
      // The constraint requires exactly ONE of (booking_id,
      // member_subscription_id, package_purchase_id). When redeeming a
      // package against a session, the "context" of the $0 payment row
      // is the booking, not the package itself. The package linkage
      // lives on the bookings.package_purchase_id column and the
      // package_redemptions audit row. Also: payment_method must be one
      // of the allowed enum values (stripe_*/cash/venmo/zelle/cashapp/
      // check/other). 'package_redemption' is not allowed; use 'other'
      // with a descriptive payment_method_detail.
      const { data: insertedPayment, error: payErr } = await supabase
        .from('session_payments')
        .insert({
          booking_id: appt.id,
          member_subscription_id: null,
          member_subscription_renewal_id: null,
          package_purchase_id: null,                              // moved to bookings + package_redemptions
          therapist_id: therapist.id,
          client_id: client.id,
          amount_cents: 0,
          tip_cents: 0,
          payment_method: 'other',                                // 'package_redemption' is not in the CHECK constraint enum
          payment_method_detail: `Package: ${redeemablePackage.name}`,
          status: 'succeeded',
          paid_at: new Date().toISOString(),
          created_by_therapist_id: therapist.id,
        })
        .select('id')
        .single();
      if (payErr) throw new Error(payErr.message);

      // Redemption audit row
      await supabase.from('package_redemptions').insert({
        package_purchase_id: redeemablePackage.id,
        booking_id: appt.id,
        notes: `Session redeemed: ${appt.service || 'Session'}`,
      });

      // Decrement remaining counter. If it hits 0, mark exhausted.
      const newRemaining = Math.max(0, (redeemablePackage.sessions_remaining || 0) - 1);
      const pkgUpdate = { sessions_remaining: newRemaining };
      if (newRemaining === 0) pkgUpdate.status = 'exhausted';
      await supabase.from('package_purchases').update(pkgUpdate).eq('id', redeemablePackage.id);

      // Link booking to the package explicitly if not already
      if (!appt.package_purchase_id) {
        await supabase.from('bookings').update({ package_purchase_id: redeemablePackage.id }).eq('id', appt.id);
      }

      setSuccessDetail({
        method: 'Redeemed from package',
        amount: 0,
        package_name: redeemablePackage.name,
        sessions_left: newRemaining,
      });
      setStep('success');
      if (typeof onPaid === 'function') onPaid();
    } catch (err) {
      console.error('chargeFromPackage error:', err);
      setErrorMsg(err.message || 'Could not redeem the package. Try again.');
    } finally {
      setRedeeming(false);
    }
  }

  // Load card on file. HK May 31 2026: provider-aware. Loads both
  // Stripe and Square card fields. Picks whichever matches a CONNECTED
  // therapist provider. If the saved card is for a processor the
  // therapist no longer has connected (e.g. Stripe was disconnected
  // after a Stripe card was saved), card-on-file stays hidden so the
  // therapist doesn't tap it and hit "This operation requires Stripe"
  // from the charge-card edge function.
  useEffect(() => {
    if (!client?.id) return;
    const stripeConnected = !!therapist?.stripe_account_id;
    const squareConnected = !!therapist?.square_access_token;
    supabase
      .from('clients')
      .select('payment_method_id, card_last4, card_brand, stripe_customer_id, square_card_id, square_customer_id')
      .eq('id', client.id)
      .single()
      .then(async ({ data }) => {
        if (!data) return;

        // Prefer the card that matches an active therapist provider.
        // If both Stripe-card-saved AND Square-card-saved AND both
        // processors connected: Stripe wins (it's the default in
        // BILLING_STRATEGY.md). If only one processor is connected,
        // only that processor's card can show.
        const hasStripeCard = !!(data.payment_method_id && data.stripe_customer_id);
        const hasSquareCard = !!(data.square_card_id && data.square_customer_id);
        const useStripe = hasStripeCard && stripeConnected;
        const useSquare = hasSquareCard && squareConnected;

        if (!useStripe && !useSquare) return; // No usable card

        // Stripe path: self-heal if card_last4 is null
        if (useStripe && !data.card_last4 && therapist?.stripe_account_id) {
          try {
            const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
            const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
            const res = await fetch(`${supabaseUrl}/functions/v1/get-payment-method`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${anonKey}`,
                'apikey': anonKey,
              },
              body: JSON.stringify({
                stripe_account_id: therapist.stripe_account_id,
                payment_method_id: data.payment_method_id,
              }),
            });
            const fixed = await res.json();
            if (fixed?.last4) {
              await supabase.from('clients').update({
                card_last4: fixed.last4,
                card_brand: fixed.brand,
              }).eq('id', client.id);
              data.card_last4 = fixed.last4;
              data.card_brand = fixed.brand;
            }
          } catch (e) {
            // Silent fail: show 'Enter new card' instead.
          }
        }

        if (useStripe && data.card_last4) {
          setCardOnFile({
            provider: 'stripe',
            payment_method_id: data.payment_method_id,
            last4: data.card_last4,
            brand: data.card_brand || 'Card',
            stripe_customer_id: data.stripe_customer_id,
          });
        } else if (useSquare) {
          setCardOnFile({
            provider: 'square',
            square_card_id: data.square_card_id,
            square_customer_id: data.square_customer_id,
            last4: data.card_last4 || '••••',
            brand: data.card_brand || 'Card',
          });
        }
      });
  }, [client?.id, therapist?.stripe_account_id, therapist?.square_access_token]);

  // Smart default for link delivery: SMS if client has phone AND therapist has twilio configured
  useEffect(() => {
    const hasPhone = !!(client?.phone || appt?.phone);
    const hasTwilio = !!(therapist?.twilio_account_sid && therapist?.twilio_phone_number);
    if (hasPhone && hasTwilio) setLinkDelivery('sms');
    else if (client?.email || appt?.email) setLinkDelivery('email');
  }, [client?.phone, client?.email, appt?.phone, appt?.email, therapist?.twilio_account_sid, therapist?.twilio_phone_number]);

  // Init Stripe Elements when entering card_new step
  useEffect(() => {
    if (step !== 'card_new') return;
    let alive = true;
    const init = async () => {
      if (!window.Stripe) {
        await new Promise(resolve => {
          const s = document.createElement('script');
          s.src = 'https://js.stripe.com/v3/';
          s.onload = resolve;
          document.head.appendChild(s);
        });
      }
      if (!alive || !cardDivRef.current) return;
      const stripeAccountId = therapist?.stripe_account_id;
      stripeRef.current = window.Stripe(
        getStripePublishableKey(),
        stripeAccountId ? { stripeAccount: stripeAccountId } : {}
      );
      elementsRef.current = stripeRef.current.elements();
      cardElRef.current = elementsRef.current.create('card', {
        hidePostalCode: true,
        // Disable Stripe Link's "Save with Link" UI: therapists are
        // collecting cards on behalf of clients in person; we don't
        // want a third-party save prompt cluttering the UX.
        disableLink: true,
        style: {
          base: {
            fontSize: '16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: C.ink,
            iconColor: C.forest,
            '::placeholder': { color: C.inkFade },
          },
          invalid: { color: C.red, iconColor: C.red },
        },
      });
      cardElRef.current.on('ready', () => { if (alive) setStripeReady(true); });
      cardElRef.current.mount(cardDivRef.current);
    };
    init();
    return () => {
      alive = false;
      try { if (cardElRef.current) cardElRef.current.destroy(); } catch (_e) {}
      setStripeReady(false);
    };
  }, [step, therapist?.stripe_account_id]);

  const amountCents = Math.round((parseFloat(amount) || 0) * 100);
  const tipCents = Math.round((parseFloat(tip) || 0) * 100);
  const totalCents = amountCents + tipCents;
  const validAmount = amountCents > 0;

  // Build the session_payments row fields that link this payment to
  // a booking, subscription renewal, or package purchase. Exactly one
  // is set, per the session_payments_charge_context_exactly_one CHECK
  // constraint. For packages, the caller must have already created
  // the package_purchases row (so we have its id to reference here)
  // via createPackagePurchaseRow().
  // For the success view: render a friendly "for June 2026" or similar
  // when we have a renewal row to identify the cycle being paid. Falls
  // back to "for this cycle" when we don't have the period_start info.
  function renewalPeriodLabel(r) {
    if (!r) return 'covered for this cycle';
    if (r.period_start) {
      const d = new Date(r.period_start + 'T12:00:00');
      const monthName = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return `paid for ${monthName}`;
    }
    return 'paid for this cycle';
  }

  function buildPaymentContext(packagePurchaseId = null) {
    if (isSubscription) {
      return {
        booking_id: null,
        member_subscription_id: subscription.id,
        member_subscription_renewal_id: renewal?.id || null,
        package_purchase_id: null,
      };
    }
    if (isPackage) {
      return {
        booking_id: null,
        member_subscription_id: null,
        member_subscription_renewal_id: null,
        package_purchase_id: packagePurchaseId,
      };
    }
    return {
      booking_id: appt.id,
      member_subscription_id: null,
      member_subscription_renewal_id: null,
      package_purchase_id: null,
    };
  }

  // For package charges, create the package_purchases row. Returns
  // the new row's id, or throws on error. Handles the "one-off plan"
  // case (creates a private/inactive package plan first) and the
  // "existing plan" case (uses the provided planId directly).
  //
  // Called BEFORE the payment is recorded so the session_payments
  // row can reference the package_purchase_id. If the payment fails,
  // the orphan package row stays in the DB - this is intentional:
  // it shows up as a record so the therapist can either retry the
  // charge or manually mark it paid. The package row's status starts
  // as 'active' regardless because the sessions belong to the client
  // the moment the row exists; tracking which package rows ARE NOT
  // yet paid is a future enhancement.
  async function createPackagePurchaseRow() {
    if (!isPackage) throw new Error('createPackagePurchaseRow called without package context');
    const pkg = packagePurchase;

    // Existing-package mode (HK May 24 2026): if the package was
    // already added to the client's balance via PackageSection's
    // 'Add package' button, the row already exists and we just need
    // its id to attach a session_payment. Skip the insert entirely.
    // Refetch the row so the success view shows accurate data.
    if (pkg.id) {
      const { data: existing, error: fetchErr } = await supabase
        .from('package_purchases')
        .select('*')
        .eq('id', pkg.id)
        .single();
      if (fetchErr) throw new Error(fetchErr.message);
      return existing;
    }

    let resolvedPlanId = pkg.planId;
    // Inline one-off plan creation: insert a private/inactive plan
    // first so the purchase row has something to reference.
    if (!resolvedPlanId && pkg.oneoffPlanData) {
      const { data: newPlan, error: planErr } = await supabase
        .from('packages')
        .insert({
          therapist_id: therapist.id,
          name: pkg.oneoffPlanData.name,
          description: pkg.oneoffPlanData.description || null,
          session_count: pkg.sessions,
          price: pkg.price,
          active: false,
          visibility: 'private',
          display_order: 0,
        })
        .select('id')
        .single();
      if (planErr) throw new Error('Could not create the one-off plan: ' + planErr.message);
      resolvedPlanId = newPlan.id;
    }
    if (!resolvedPlanId) throw new Error('No package plan resolved.');

    // Look up canonical client email (the prop may be missing it
    // for clients without email on file). client_email is NOT NULL
    // on package_purchases.
    const { data: clientRow } = await supabase
      .from('clients')
      .select('email, name')
      .eq('id', client.id)
      .maybeSingle();
    const resolvedEmail = (clientRow?.email || client?.email || '').trim() || 'no-email@local';
    const resolvedName = clientRow?.name || client?.name || 'Client';

    const { data: inserted, error: purErr } = await supabase
      .from('package_purchases')
      .insert({
        therapist_id: therapist.id,
        package_id: resolvedPlanId,
        client_id: client.id,
        client_email: resolvedEmail,
        client_name: resolvedName,
        sessions_purchased: pkg.sessions,
        sessions_remaining: pkg.sessions,
        price_paid: pkg.price,
        status: 'active',
        purchased_at: new Date().toISOString(),
        expires_at: pkg.expiresAt ? new Date(pkg.expiresAt).toISOString() : null,
      })
      .select('*')
      .single();
    if (purErr) throw new Error(purErr.message);
    return inserted;
  }

  // After a successful subscription payment, mark the linked renewal
  // row as paid (if one was passed in). This is what clears the
  // reminder banner on the billing dashboard.
  async function resolveRenewalAsPaid(sessionPaymentId) {
    if (!isSubscription) return;
    // Path 1: explicit renewal prop passed in (the 'Charge renewal'
    // button took us here). Resolve that exact row.
    if (renewal?.id) {
      try {
        await supabase.from('member_subscription_renewals').update({
          status: 'paid',
          resolved_at: new Date().toISOString(),
          resolved_by_therapist_id: therapist.id,
          session_payment_id: sessionPaymentId,
        }).eq('id', renewal.id);
      } catch (e) {
        console.warn('resolveRenewalAsPaid failed:', e);
      }
      return;
    }
    // Path 2: HK May 24 2026. Ad-hoc charge (no renewal prop). Look
    // up any pending renewal for this subscription whose due_on is
    // today or earlier. The therapist's payment intent is clearly to
    // cover the current due cycle. Resolve the earliest such row.
    // Without this, the ad-hoc charge records the payment correctly
    // but leaves the renewal at 'pending', so the UI keeps showing
    // 'due today' even though the therapist just got paid.
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data: openRows } = await supabase
        .from('member_subscription_renewals')
        .select('id, due_on')
        .eq('member_subscription_id', subscription.id)
        .eq('status', 'pending')
        .lte('due_on', todayStr)
        .order('due_on', { ascending: true })
        .limit(1);
      const open = openRows?.[0];
      if (open?.id) {
        await supabase.from('member_subscription_renewals').update({
          status: 'paid',
          resolved_at: new Date().toISOString(),
          resolved_by_therapist_id: therapist.id,
          session_payment_id: sessionPaymentId,
        }).eq('id', open.id);
      }
    } catch (e) {
      console.warn('resolveRenewalAsPaid (adhoc lookup) failed:', e);
    }
  }

  // Offline-form state (folded in from MarkAsPaidModal).
  const [offlineMethod, setOfflineMethod] = useState('cash');
  const [offlineNote, setOfflineNote] = useState('');

  // ── Action: Mark as paid (offline) ──────────────────────────────
  // HK May 19 2026: $0 IS allowed here. Trade sessions, comped
  // sessions, and sessions paid weeks ago before the therapist
  // switched to MyBodyMap all need to be recorded with a real
  // payment row so the session shows as 'paid' in the schedule
  // and billing dashboards. Card and pay-link paths still require
  // a positive amount since Stripe cannot charge $0.
  async function chargeOffline() {
    if (!client?.id) { setErrorMsg('Client record missing on this charge.'); return; }
    if (amountCents < 0) { setErrorMsg('Amount cannot be negative.'); return; }
    setProcessing(true);
    setErrorMsg(null);
    try {
      // For packages: create the package_purchases row first so we
      // can link the payment to it via package_purchase_id.
      let packageRow = null;
      if (isPackage) {
        packageRow = await createPackagePurchaseRow();
      }

      const { data: insertedPayment, error } = await supabase.from('session_payments').insert({
        ...buildPaymentContext(packageRow?.id || null),
        therapist_id: therapist.id,
        client_id: client.id,
        amount_cents: amountCents,
        tip_cents: tipCents,
        payment_method: offlineMethod,
        payment_method_detail: offlineNote || null,
        status: 'succeeded',
        paid_at: new Date().toISOString(),
        created_by_therapist_id: therapist.id,
      }).select('id').single();
      if (error) throw new Error(error.message);
      if (insertedPayment?.id) {
        firePaymentNotification(insertedPayment.id);
        await resolveRenewalAsPaid(insertedPayment.id);
      }
      if (packageRow && onPackageCreated) {
        onPackageCreated(packageRow);
      }
      setSuccessDetail({
        method: OFFLINE_METHODS.find(m => m.value === offlineMethod)?.label || 'Offline',
        detail: offlineNote || '',
        total: (totalCents / 100).toFixed(2),
      });
      setStep('success');
      onPaid?.();
    } catch (e) {
      setErrorMsg(e?.message || 'Failed to record payment.');
    } finally {
      setProcessing(false);
    }
  }

  // Phase 15.2 (HK May 18 2026): fire-and-forget payment notification.
  // Called after every successful session_payments insert in this modal.
  // The edge function fans out to therapist (Bell + Email + SMS + Push)
  // and to client (Email + SMS) per their notification_prefs. Errors
  // are warned to console but never block the UI success state.
  async function firePaymentNotification(sessionPaymentId) {
    if (!sessionPaymentId) return;
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      await fetch(`${supabaseUrl}/functions/v1/notify-payment-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({ session_payment_id: sessionPaymentId }),
      });
    } catch (e) {
      console.warn('notify-payment-event invocation failed:', e);
    }
  }

  // ── Action: Card on file ────────────────────────────────────────
  // HK May 31 2026: dispatches by saved-card provider.
  async function chargeCardOnFile() {
    if (!validAmount) { setErrorMsg('Enter a valid amount.'); return; }
    if (!cardOnFile) { setErrorMsg('No card on file.'); return; }
    if (!client?.id) { setErrorMsg('Client record missing on this booking.'); return; }
    setProcessing(true);
    setErrorMsg(null);
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      const chargeDescription = isPackage
        ? `${packagePurchase.name} - ${packagePurchase.sessions} sessions`
        : `Session with ${therapist.business_name || therapist.full_name || 'your therapist'}`;

      // Pick the edge function by saved-card provider.
      const isSquareCard = cardOnFile.provider === 'square';
      const url = isSquareCard
        ? `${supabaseUrl}/functions/v1/square-charge-card`
        : `${supabaseUrl}/functions/v1/charge-card`;
      const payload = isSquareCard
        ? {
            therapist_id: therapist.id,
            square_card_id: cardOnFile.square_card_id,
            square_customer_id: cardOnFile.square_customer_id,
            amount_cents: amountCents,
            tip_cents: tipCents,
            description: chargeDescription,
            client_email: client.email || appt?.email,
            send_receipt: true,
          }
        : {
            therapist_id: therapist.id,
            customer_id: cardOnFile.stripe_customer_id,
            payment_method_id: cardOnFile.payment_method_id,
            amount_cents: amountCents,
            tip_cents: tipCents,
            description: chargeDescription,
            client_email: client.email || appt?.email,
            send_receipt: true,
          };
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.success) throw new Error('Charge did not succeed');

      // For packages: create the package_purchase row AFTER the charge
      // succeeds. If we created it first and the charge failed, we'd
      // leave an orphan paid-looking package row. Charge first, record
      // second, link payment to the new row.
      let packageRow = null;
      if (isPackage) {
        packageRow = await createPackagePurchaseRow();
      }

      // Record in session_payments
      // Phase 15.2 (HK May 18 2026): capture the inserted id so we can
      // fire the payment_received notification right after. Prior to
      // this, payments via Checkout produced zero notifications because
      // charge-card doesn't notify (it's a pure provider call) and
      // the client-side insert was fire-and-forget.
      // HK May 31 2026: see chargeNewCardSquare comment block. Same
      // audit-gap fix here. Card on file path serves both Stripe and
      // Square; either provider charged the card before this insert.
      // HK May 31 2026 (Square Parity v1): persist square_payment_id +
      // square_order_id when this is a Square card-on-file charge.
      // Refunds and reconciliation need them; without these columns
      // the Square refund path has nothing to call /v2/refunds with.
      const providerPaymentId = data.payment_id || data.payment_intent_id || null;
      const squareOrderId = isSquareCard ? (data.order_id || null) : null;
      const { data: insertedPayment, error: insertErr } = await supabase
        .from('session_payments')
        .insert({
          ...buildPaymentContext(packageRow?.id || null),
          therapist_id: therapist.id,
          client_id: client.id,
          amount_cents: amountCents,
          tip_cents: tipCents,
          payment_method: isSquareCard ? 'square_card_on_file' : 'stripe_card_on_file',
          payment_method_detail: `${cardOnFile.brand} ${cardOnFile.last4}`,
          stripe_payment_intent_id: isSquareCard ? null : (data.payment_intent_id || null),
          square_payment_id: isSquareCard ? providerPaymentId : null,
          square_order_id: squareOrderId,
          status: 'succeeded',
          paid_at: new Date().toISOString(),
          created_by_therapist_id: therapist.id,
        })
        .select('id')
        .single();

      if (insertErr || !insertedPayment?.id) {
        // eslint-disable-next-line no-console
        console.error('[CheckoutModal] session_payments INSERT failed after card-on-file charge succeeded.', {
          providerPaymentId,
          provider: isSquareCard ? 'square' : 'stripe',
          insertErr,
          therapist_id: therapist.id,
          client_id: client.id,
          booking_id: appt?.id,
          amount_cents: amountCents,
        });
        const msg = insertErr?.message || 'unknown';
        const ref = providerPaymentId ? ` Provider payment ID: ${providerPaymentId}.` : '';
        throw new Error(
          `Card was charged but the payment record could not be saved (${msg}).${ref} Please contact support.`
        );
      }

      firePaymentNotification(insertedPayment.id);
      await resolveRenewalAsPaid(insertedPayment.id);
      if (packageRow && onPackageCreated) {
        onPackageCreated(packageRow);
      }

      setSuccessDetail({
        method: 'Card on file',
        detail: `${cardOnFile.brand} ${cardOnFile.last4}`,
        total: (totalCents / 100).toFixed(2),
      });
      setStep('success');
      onPaid?.();
    } catch (e) {
      setErrorMsg(e?.message || 'Charge failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  }

  // ── Action: Enter new card now ──────────────────────────────────
  //
  // ARCHITECTURE NOTE (Phase 12.4, May 17 2026):
  // This path does NOT take shortcuts. It mirrors what the booking page
  // does when a client saves a card, then immediately charges it. End
  // state: one Stripe customer per real client (linked via
  // clients.stripe_customer_id), the new PaymentMethod attached to that
  // customer, clients.payment_method_id + card_last4 + card_brand
  // updated so the next visit shows card-on-file automatically.
  //
  // Flow:
  //   1. Call save-card edge function (find-or-create Stripe customer,
  //      return SetupIntent client_secret + customer_id).
  //   2. Stripe.confirmCardSetup against the SetupIntent (this attaches
  //      the card to the customer, returns payment_method_id).
  //   3. Persist payment_method_id + card_last4 + card_brand on the
  //      clients row so it appears as card-on-file next time.
  //   4. Call charge-card with the real customer_id + payment_method_id
  //      (uses off_session because the card is now saved).
  //   5. Write session_payments row.
  async function chargeNewCard() {
    if (!validAmount) { setErrorMsg('Enter a valid amount.'); return; }
    if (!stripeRef.current || !cardElRef.current) { setErrorMsg('Card form not ready.'); return; }
    setProcessing(true);
    setErrorMsg(null);
    try {
      // Phase 13.4 (HK May 17 2026): bookings.client_id is now always
      // populated (Phase 13.2 wires it at booking creation, Phase 13.3
      // backfilled history, Phase 13.3.1 added the FK and fixed orphans).
      // So client.id is always present here. Hard-guard for safety.
      if (!client?.id) throw new Error('Client record missing on this booking.');

      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

      // Step 1: find-or-create Stripe customer + get a SetupIntent.
      const saveCardRes = await fetch(`${supabaseUrl}/functions/v1/save-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          stripe_account_id: therapist.stripe_account_id,
          client_id: client.id,
          client_email: client.email || appt?.email,
          client_name: client.name || appt?.client,
          therapist_id: therapist.id,
        }),
      });
      const saveCardData = await saveCardRes.json();
      if (saveCardData.error) throw new Error(saveCardData.error);
      const { client_secret, customer_id } = saveCardData;
      if (!client_secret || !customer_id) throw new Error('Card setup did not initialize.');

      // Step 2: confirm card setup. Attaches the card to the customer
      // and returns a usable payment_method_id.
      const { error: setupErr, setupIntent } = await stripeRef.current.confirmCardSetup(client_secret, {
        payment_method: { card: cardElRef.current },
      });
      if (setupErr) throw new Error(setupErr.message);
      if (setupIntent?.status !== 'succeeded') throw new Error('Card setup did not complete.');
      const paymentMethodId = setupIntent.payment_method;

      // Step 3: pull PaymentMethod details for card_last4 + card_brand.
      // Phase 13.5 followup (HK May 17 2026): cannot use Stripe's API
      // directly from the browser with the publishable key (Stripe
      // blocks reads of PaymentMethod objects without a secret key).
      // Call our get-payment-method edge function instead.
      const pmRes = await fetch(`${supabaseUrl}/functions/v1/get-payment-method`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          stripe_account_id: therapist.stripe_account_id,
          payment_method_id: paymentMethodId,
        }),
      });
      const pmDetails = await pmRes.json().catch(() => null);
      const cardLast4 = pmDetails?.last4 || null;
      const cardBrand = pmDetails?.brand || null;

      // Persist on clients row so next visit shows card-on-file.
      await supabase.from('clients').update({
        stripe_customer_id: customer_id,
        payment_method_id: paymentMethodId,
        card_last4: cardLast4,
        card_brand: cardBrand,
        card_saved_at: new Date().toISOString(),
      }).eq('id', client.id);

      // Step 4: charge the now-saved card via charge-card with real
      // customer_id. Same path as 'Card on file' would take.
      const chargeDescription = isPackage
        ? `${packagePurchase.name} - ${packagePurchase.sessions} sessions`
        : `Session with ${therapist.business_name || therapist.full_name || 'your therapist'}`;
      const chargeRes = await fetch(`${supabaseUrl}/functions/v1/charge-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          therapist_id: therapist.id,
          customer_id: customer_id,
          payment_method_id: paymentMethodId,
          amount_cents: amountCents,
          tip_cents: tipCents,
          description: chargeDescription,
          client_email: client.email || appt?.email,
          send_receipt: true,
        }),
      });
      const chargeData = await chargeRes.json();
      if (chargeData.error) throw new Error(chargeData.error);
      if (!chargeData.success) throw new Error('Charge did not succeed');

      const cardDetail = cardBrand && cardLast4
        ? `${cardBrand[0].toUpperCase()}${cardBrand.slice(1)} ${cardLast4}`
        : 'Card';

      // For packages: create the package_purchase row AFTER charge
      // succeeds so a failed charge doesn't leave an orphan row.
      let packageRow = null;
      if (isPackage) {
        packageRow = await createPackagePurchaseRow();
      }

      // Step 5: session_payments row, payment_method = stripe_card_new
      // since this is the 'entered fresh at checkout' code path even
      // though the card was also saved for future use.
      // Phase 15.2: capture id, fire payment_received notification.
      // HK May 31 2026: same audit-gap fix. If insert fails after the
      // Stripe charge already succeeded, surface that clearly so the
      // therapist can reconcile manually with the Stripe payment intent.
      const stripePaymentIntentId = chargeData.payment_intent_id || null;
      const { data: insertedPayment, error: insertErr } = await supabase
        .from('session_payments')
        .insert({
          ...buildPaymentContext(packageRow?.id || null),
          therapist_id: therapist.id,
          client_id: client.id,
          amount_cents: amountCents,
          tip_cents: tipCents,
          payment_method: 'stripe_card_new',
          payment_method_detail: cardDetail,
          stripe_payment_intent_id: stripePaymentIntentId,
          status: 'succeeded',
          paid_at: new Date().toISOString(),
          created_by_therapist_id: therapist.id,
        })
        .select('id')
        .single();

      if (insertErr || !insertedPayment?.id) {
        // eslint-disable-next-line no-console
        console.error('[CheckoutModal] session_payments INSERT failed after Stripe charge succeeded.', {
          stripePaymentIntentId,
          insertErr,
          therapist_id: therapist.id,
          client_id: client.id,
          booking_id: appt?.id,
          amount_cents: amountCents,
        });
        const msg = insertErr?.message || 'unknown';
        const ref = stripePaymentIntentId ? ` Stripe payment intent: ${stripePaymentIntentId}.` : '';
        throw new Error(
          `Card was charged but the payment record could not be saved (${msg}).${ref} Please contact support.`
        );
      }

      firePaymentNotification(insertedPayment.id);
      await resolveRenewalAsPaid(insertedPayment.id);
      if (packageRow && onPackageCreated) {
        onPackageCreated(packageRow);
      }

      // HK May 31 2026: save-card-for-later. The SetupIntent flow above
      // already attached the card to the Stripe customer, so the card is
      // "in the vault" regardless of this checkbox. Persisting the IDs
      // to the booking + client row is what makes future "Charge saved
      // card" work without re-entering. Non-blocking; if these updates
      // fail the charge still succeeded and the card is still in Stripe.
      if (saveCardForLater && paymentMethodId && customer_id) {
        try {
          if (appt?.id) {
            await supabase.from('bookings').update({
              card_on_file_payment_method_id: paymentMethodId,
              card_on_file_customer_id: customer_id,
            }).eq('id', appt.id);
          }
          if (client?.id) {
            await supabase.from('clients').update({
              stripe_customer_id: customer_id,
              payment_method_id: paymentMethodId,
            }).eq('id', client.id);
          }
        } catch (saveErr) {
          // eslint-disable-next-line no-console
          console.warn('[CheckoutModal] save-card-for-later update failed (non-blocking)', saveErr);
        }
      }

      setSuccessDetail({
        method: 'Card entered',
        detail: cardDetail,
        total: (totalCents / 100).toFixed(2),
      });
      setStep('success');
      onPaid?.();
    } catch (e) {
      setErrorMsg(e?.message || 'Charge failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  }

  // HK May 31 2026: when therapist taps "Enter new card" and we don't
  // already have a card_setup secret, fetch one from init-card-setup.
  // The edge fn auto-routes to Stripe or Square based on what's
  // connected. We render the right form below in NewCardForm.
  useEffect(() => {
    if (step !== 'card_new') return;
    if (cardSetupProcessor) return; // already initialized
    if (cardSetupLoading) return;
    if (!therapist?.id) return;
    // Stripe-only therapists keep the existing Stripe Elements path
    // (which boots its own SetupIntent inside chargeNewCard). Skip
    // init-card-setup for them so we don't double-call.
    const stripeOnly = !!therapist.stripe_account_id && !therapist.square_connected;
    if (stripeOnly) {
      setCardSetupProcessor('stripe');
      return;
    }
    // Square-only OR both connected -> use init-card-setup orchestrator
    let cancelled = false;
    (async () => {
      setCardSetupLoading(true);
      try {
        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
        const res = await fetch(`${supabaseUrl}/functions/v1/init-card-setup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
          },
          body: JSON.stringify({
            therapist_id: therapist.id,
            client_name: client?.name || appt?.client || '',
            client_email: client?.email || appt?.email || '',
            client_phone: client?.phone || appt?.phone || '',
            mandate_text: 'Therapist checkout charge',
            // preferred_processor stays unset so the function uses
            // payment_routing / auto-pick. Stripe wins if both connected
            // for card-on-file (matches BILLING_STRATEGY.md).
          }),
        });
        const data = res.ok ? await res.json() : await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || data.error) {
          setErrorMsg(data.error || `Card setup failed (HTTP ${res.status})`);
          setCardSetupLoading(false);
          return;
        }
        setCardSetupProcessor(data.processor);
        setSquareCardSecret(data.client_secret);
        setSquareCustomerId(data.customer_id);
        setSquareClientId(data.client_id);
      } catch (e) {
        if (!cancelled) setErrorMsg(`Card setup failed: ${e?.message || e}`);
      } finally {
        if (!cancelled) setCardSetupLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, therapist?.id]);

  // ── Action: Charge a fresh card via Square (one-shot, no save first) ──
  //
  // Square Web Payments SDK tokenizes the card client-side; the
  // resulting nonce is a valid source_id for POST /v2/payments. So
  // we pass it straight to square-charge-card. No save-then-charge
  // dance. If we ever want to save the card too, we'd call
  // save-card-on-booking-token in parallel; not needed for HK's
  // immediate "charge $1 to test" use case.
  async function chargeNewCardSquare(sourceToken, details) {
    if (!validAmount) { setErrorMsg('Enter a valid amount.'); return; }
    if (!sourceToken) { setErrorMsg('Card was not tokenized.'); return; }
    setProcessing(true);
    setErrorMsg(null);
    try {
      if (!client?.id) throw new Error('Client record missing on this booking.');
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      const chargeDescription = isPackage
        ? `${packagePurchase.name} - ${packagePurchase.sessions} sessions`
        : `Session with ${therapist.business_name || therapist.full_name || 'your therapist'}`;

      // HK Jun 3 2026: card-on-file for Square. When "save for next time"
      // is on, vault the card first via square-save-card (creates a Square
      // customer if needed, runs Square CreateCard, persists square_card_id
      // + square_customer_id on the client), then charge the vaulted card,
      // exactly like the card-on-file path. Mirrors the Stripe save-then-
      // charge flow. WORKAROUND FLAGGED: if vaulting fails we do NOT block
      // the charge. We fall back to the one-time nonce so the client is
      // still charged, and warn that the card was not saved. A save hiccup
      // must never cost the therapist the payment.
      let chargeSourceId = sourceToken;        // one-time nonce by default
      let chargeCustomerId = squareCustomerId;  // may be null for a new client
      let cardWasSaved = false;
      let saveCardWarning = null;
      if (saveCardForLater) {
        try {
          const saveRes = await fetch(`${supabaseUrl}/functions/v1/square-save-card`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
            },
            body: JSON.stringify({
              therapist_id: therapist.id,
              client_id: client.id,
              client_email: client.email || appt?.email,
              client_name: client.name || appt?.client,
              card_nonce: sourceToken,
            }),
          });
          const saveData = await saveRes.json().catch(() => null);
          if (saveData?.success && saveData?.card_id) {
            chargeSourceId = saveData.card_id; // durable vaulted card
            // square-save-card persisted square_customer_id on the client;
            // reload it so the charge attaches to the saved card.
            const { data: savedClient } = await supabase
              .from('clients').select('square_customer_id').eq('id', client.id).single();
            chargeCustomerId = savedClient?.square_customer_id || chargeCustomerId;
            cardWasSaved = true;
          } else {
            saveCardWarning = saveData?.error || 'Card could not be saved for next time.';
          }
        } catch (saveErr) {
          saveCardWarning = saveErr?.message || 'Card could not be saved for next time.';
        }
      }

      const chargeRes = await fetch(`${supabaseUrl}/functions/v1/square-charge-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          therapist_id: therapist.id,
          square_card_id: chargeSourceId,
          square_customer_id: chargeCustomerId,
          amount_cents: amountCents,
          tip_cents: tipCents,
          description: chargeDescription,
          client_email: client.email || appt?.email,
          send_receipt: true,
        }),
      });
      const chargeData = await chargeRes.json();
      if (chargeData.error) throw new Error(chargeData.error);
      if (!chargeData.success) throw new Error('Charge did not succeed');

      const cardLast4 = details?.card?.last4 || null;
      const cardBrand = details?.card?.brand || null;
      const cardDetail = cardBrand && cardLast4
        ? `${cardBrand} ${cardLast4}`
        : 'Card';

      let packageRow = null;
      if (isPackage) {
        packageRow = await createPackagePurchaseRow();
      }

      // Insert the session_payments record. Critical: if this fails
      // after Square already charged, we have an audit gap: money out
      // of the client, no local record. We must surface that clearly
      // so the therapist can manually reconcile. The Square payment_id
      // is included in the toast and console for evidence.
      // HK May 31 2026: previously this code destructured `{ data }`
      // only and silently ignored `error`. Result: when insert failed
      // for ANY reason (RLS, FK, column mismatch), the user saw the
      // success state but no record existed. Customer-blocking audit
      // bug. Now we destructure both and act on errors explicitly.
      // HK May 31 2026 (Square Parity v1): persist square_payment_id +
      // square_order_id alongside the row. Refunds via /v2/refunds need
      // the payment id; reconciliation against Square's dashboard uses
      // the order id. Without these the refund path has nothing to call.
      const squarePaymentId = chargeData.payment_id || null;
      const squareOrderId = chargeData.order_id || null;
      const { data: insertedPayment, error: insertErr } = await supabase
        .from('session_payments')
        .insert({
          ...buildPaymentContext(packageRow?.id || null),
          therapist_id: therapist.id,
          client_id: client.id,
          amount_cents: amountCents,
          tip_cents: tipCents,
          payment_method: 'square_card_new',
          payment_method_detail: cardDetail,
          square_payment_id: squarePaymentId,
          square_order_id: squareOrderId,
          status: 'succeeded',
          paid_at: new Date().toISOString(),
          created_by_therapist_id: therapist.id,
        })
        .select('id')
        .single();

      if (insertErr || !insertedPayment?.id) {
        // eslint-disable-next-line no-console
        console.error('[CheckoutModal] session_payments INSERT failed after Square charge succeeded.', {
          squarePaymentId,
          insertErr,
          therapist_id: therapist.id,
          client_id: client.id,
          booking_id: appt?.id,
          amount_cents: amountCents,
          payment_method: 'square_card_new',
        });
        const msg = insertErr?.message || 'unknown';
        const ref = squarePaymentId ? ` Square payment ID: ${squarePaymentId}.` : '';
        // Throw so we land in the catch and show error to user, NOT
        // success. The Square charge stands; the therapist can manually
        // record via Mark as paid using the Square payment ID.
        throw new Error(
          `Card was charged but the payment record could not be saved (${msg}).${ref} Please contact support.`
        );
      }

      firePaymentNotification(insertedPayment.id);
      await resolveRenewalAsPaid(insertedPayment.id);
      if (packageRow && onPackageCreated) {
        onPackageCreated(packageRow);
      }

      setSuccessDetail({
        method: cardWasSaved ? 'Card entered and saved' : 'Card entered',
        detail: cardDetail + (saveCardWarning ? ' (charged, but not saved for next time)' : ''),
        total: (totalCents / 100).toFixed(2),
      });
      setStep('success');
      onPaid?.();
    } catch (e) {
      setErrorMsg(e?.message || 'Charge failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  }

  // ── Action: Send pay link ───────────────────────────────────────
  async function sendPayLink() {
    if (!validAmount) { setErrorMsg('Enter a valid amount.'); return; }
    setProcessing(true);
    setErrorMsg(null);
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      // For packages: create the package_purchase row first so the
      // pay link can reference it. The row starts 'active' (sessions
      // already on the client's balance) - if the link is never paid,
      // the therapist can manually cancel it. Same forgiving approach
      // as a session that's marked as paid but pending in reality.
      let packageRow = null;
      if (isPackage) {
        packageRow = await createPackagePurchaseRow();
      }

      // Phase 19.4: build payload for booking, subscription, or package mode.
      const payload: any = {
        therapist_id: therapist.id,
        amount_cents: amountCents,
        tip_cents: tipCents,
        client_email: client?.email || appt?.email,
        client_name: client?.name || appt?.client || null,
        delivery: linkDelivery,
      };
      if (isSubscription) {
        payload.member_subscription_id = subscription.id;
        if (renewal?.id) payload.member_subscription_renewal_id = renewal.id;
        payload.service_name = 'Membership renewal';
      } else if (isPackage) {
        payload.package_purchase_id = packageRow?.id;
        payload.service_name = `${packagePurchase.name} - ${packagePurchase.sessions} sessions`;
      } else {
        payload.booking_id = appt.id;
        payload.service_name = appt?.service || 'Massage session';
      }
      const res = await fetch(`${supabaseUrl}/functions/v1/create-payment-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const url = data.payment_link_url;
      setLinkUrl(url);

      if (packageRow && onPackageCreated) {
        onPackageCreated(packageRow);
      }

      setSuccessDetail({
        method: 'Payment link',
        detail: url,
        total: (totalCents / 100).toFixed(2),
        deliveryHint: linkDelivery,
        emailed: !!data.emailed,
        emailedTo: data.emailed_to || null,
      });
      setStep('success');
      onPaid?.();
    } catch (e) {
      setErrorMsg(e?.message || 'Failed to create payment link.');
    } finally {
      setProcessing(false);
    }
  }

  // Detect mobile so we can take over the full screen.
  // Below 600px = mobile = full takeover. Above = centered bottom sheet.
  const [isMobileViewport, setIsMobileViewport] = useState(typeof window !== 'undefined' && window.innerWidth < 600);
  useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 600);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Lock body scroll while modal is open so the page underneath
  // can't scroll behind the sheet. Restore on unmount.
  useEffect(() => {
    const prev = document.body.style.overflow;
    // Note: per HK's iOS Safari rule, avoid setting body.overflow=hidden
    // directly. Use position:fixed lock pattern instead, but for this
    // modal we can rely on the overlay catching scroll. Skipping lock.
    return () => { document.body.style.overflow = prev; };
  }, []);

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    height: '100dvh',
    background: 'rgba(15, 30, 25, 0.55)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: isMobileViewport ? 'stretch' : 'center',
    justifyContent: 'center',
    // Phase 13.8.1 (HK May 17 2026): above MobileBottomNav (z=1000).
    zIndex: 1100,
    padding: 0,
  };

  const sheetStyle = isMobileViewport
    ? {
        // Full-screen takeover on mobile. No rounded corners because
        // it's edge-to-edge. Flex column with fixed header, scrollable
        // middle, fixed footer.
        // Phase 13.8.2 (HK May 17 2026): 100dvh for iOS Safari, which
        // measures plain '100%' against the layout viewport and pushes
        // the footer below the visible area. dvh tracks visible viewport.
        background: '#fff',
        width: '100%',
        height: '100dvh',
        maxHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'none',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }
    : {
        // Centered card on tablet/desktop, capped width.
        background: '#fff',
        borderRadius: 20,
        width: '100%',
        maxWidth: 540,
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        margin: 16,
      };

  // Fixed header at top: title + close. Doesn't scroll.
  const headerStyle = {
    flex: '0 0 auto',
    padding: isMobileViewport ? '18px 20px 14px' : '20px 24px 14px',
    borderBottom: `1px solid ${C.border}`,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    background: '#fff',
    // Safe-area padding for iOS notch
    paddingTop: isMobileViewport ? 'max(18px, env(safe-area-inset-top))' : 20,
  };

  // Scrollable middle: form content.
  const bodyStyle = {
    flex: '1 1 auto',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    padding: isMobileViewport ? '20px 20px 24px' : '20px 24px 24px',
  };

  // Phase 2 May 24 2026 (HK): wrap the modal return in createPortal so
  // it mounts at document.body. Without this, the modal inherits the
  // containing block of whatever ancestor has transform/filter/animation
  // applied. ProfileSection has a 'bm-cp-rise' animation with translateY
  // that creates a containing block, which constrained the modal to
  // the ProfileSection card rather than the viewport. Result: modal
  // looked cut off because page content above and below was visible.
  return createPortal(
    <div style={overlayStyle}>
      {/* HK May 30 2026: backdrop click-to-close removed for same
          reason as DetailPanel + CancellationChargeModal: miss-taps
          on action buttons inside the sheet dismissed the whole
          checkout flow, which felt like crashes to our 70yo persona.
          Close requires the explicit X / Done / Close button in the
          header (CloseButton at lines 1095 and 1165). The sheetStyle
          div retains its own stopPropagation in case anything else
          depends on it. */}
      <div style={sheetStyle} onClick={e => e.stopPropagation()}>
        {step === 'success' ? (
          <>
            <div style={headerStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400, color: C.forestDeep, letterSpacing: '-0.01em' }}>
                  Payment
                </div>
                <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {client?.name || appt?.client}
                </div>
              </div>
              <CloseButton onClick={onClose} label="Done" />
            </div>
            <div style={bodyStyle}>
              <SuccessView
                detail={successDetail}
                onClose={onClose}
                linkUrl={linkUrl}
                linkDelivery={linkDelivery}
                clientPhone={client?.phone || appt?.phone}
                clientEmail={client?.email || appt?.email}
                therapistName={therapist?.business_name || therapist?.full_name}
                isSubscription={isSubscription}
                isPackage={isPackage}
                contextName={
                  isPackage ? packagePurchase?.name :
                  isSubscription ? (subscription?.membership?.name || 'Membership') :
                  null
                }
                contextDetail={
                  isPackage ? `${packagePurchase?.sessions} sessions ready to use` :
                  isSubscription ? renewalPeriodLabel(renewal) :
                  null
                }
              />
            </div>
          </>
        ) : (
          <>
            {/* Fixed header: title + subtitle + back (in sub-steps) + close. */}
            <div style={headerStyle}>
              {/* Back affordance: only render when in a sub-step (not
                  the picker). Tap returns to picker. Always visible
                  at top so user doesn't have to scroll to find it. */}
              {step !== 'method' && (
                <button
                  type="button"
                  onClick={() => setStep('method')}
                  aria-label="Back to payment options"
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    padding: '8px 14px',
                    marginRight: 4,
                    background: '#fff',
                    border: `1.5px solid ${C.border}`,
                    borderRadius: 999,
                    color: C.inkSoft,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    WebkitTapHighlightColor: 'transparent',
                    flexShrink: 0,
                  }}
                >
                  ← Back
                </button>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 400, color: C.forestDeep, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
                  Checkout
                </div>
                <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {client?.name || appt?.client} · {
                    isPackage ? `${packagePurchase.name} (${packagePurchase.sessions} sessions)` :
                    isSubscription ? (subscription.membership?.name || 'Membership') :
                    (appt?.service || 'Session')
                  }
                </div>
              </div>
              <CloseButton onClick={onClose} label="Close" />
            </div>

            {/* Scrollable body */}
            <div style={bodyStyle}>
              {/* Amount input hidden during the inline client-picker
                  prelude step. There is no point asking how much to
                  charge before we have a client to charge against. */}
              {step !== 'select_client' && (
                <AmountRow amount={amount} setAmount={setAmount} tip={tip} setTip={setTip} totalCents={totalCents} therapist={therapist} />
              )}

              {step === 'select_client' && (
                <SelectClientStep
                  therapist={therapist}
                  appt={appt}
                  onPicked={async (picked) => {
                    // Link the booking AND overwrite the legacy text
                    // columns so the schedule grid and slide-over
                    // immediately reflect the picked client on refresh.
                    // Before this, we only wrote client_id and the
                    // therapist still saw the old client_name (e.g.
                    // 'Test Picker Client') in the schedule. HK May 24
                    // 2026: 'once I picked it up, it did not update
                    // the Test Picker Client name to my name.'
                    if (appt?.id && picked?.id) {
                      await supabase
                        .from('bookings')
                        .update({
                          client_id: picked.id,
                          client_name: picked.name || appt.client || null,
                          client_email: picked.email || appt.email || null,
                          client_phone: picked.phone || appt.phone || null,
                        })
                        .eq('id', appt.id);
                    }
                    setClient(picked);
                    // Tell the parent (slide-over) so it can patch
                    // its own appt mirror state, making the header
                    // re-render with the picked client's name
                    // immediately, without waiting for a schedule
                    // refetch. Phase 13.12b, HK May 24 2026.
                    if (typeof onClientLinked === 'function') onClientLinked(picked);
                    // Fire onPaid to nudge the parent slide-over to
                    // refresh its payment list (existing wiring). This
                    // also triggers the schedule grid refresh on its
                    // next render cycle.
                    if (typeof onPaid === 'function') onPaid();
                    setStep('method');
                  }}
                  onCancel={onClose}
                />
              )}

              {step === 'method' && (
                <MethodPicker
                  cardOnFile={cardOnFile}
                  onCardOnFile={() => setStep('card_on_file')}
                  onCardNew={() => setStep('card_new')}
                  onSendLink={() => setStep('send_link')}
                  onMarkPaid={() => setStep('offline')}
                  redeemablePackage={redeemablePackage}
                  onRedeemPackage={chargeFromPackage}
                  redeeming={redeeming}
                  isSubscription={isSubscription}
                  isPackage={isPackage}
                  validAmount={validAmount}
                  stripeConnected={!!therapist?.stripe_account_id}
                  squareConnected={!!therapist?.square_access_token}
                  onClose={onClose}
                />
              )}

              {step === 'card_on_file' && (
                <ConfirmCardOnFile
                  cardOnFile={cardOnFile}
                  totalCents={totalCents}
                  onConfirm={chargeCardOnFile}
                  onBack={() => setStep('method')}
                  processing={processing}
                />
              )}

              {step === 'card_new' && (
                <NewCardForm
                  cardDivRef={cardDivRef}
                  ready={stripeReady}
                  totalCents={totalCents}
                  onConfirm={chargeNewCard}
                  onBack={() => setStep('method')}
                  processing={processing}
                  processor={cardSetupProcessor}
                  cardSetupLoading={cardSetupLoading}
                  squareCardSecret={squareCardSecret}
                  onSquareTokenized={chargeNewCardSquare}
                  errorMsg={errorMsg}
                  saveCardForLater={saveCardForLater}
                  setSaveCardForLater={setSaveCardForLater}
                  clientName={client?.name || appt?.client || 'this client'}
                />
              )}

              {step === 'send_link' && (
                <SendLinkForm
                  client={client}
                  appt={appt}
                  therapist={therapist}
                  linkDelivery={linkDelivery}
                  setLinkDelivery={setLinkDelivery}
                  totalCents={totalCents}
                  onConfirm={sendPayLink}
                  onBack={() => setStep('method')}
                  processing={processing}
                />
              )}

              {step === 'offline' && (
                <OfflineForm
                  method={offlineMethod}
                  setMethod={setOfflineMethod}
                  note={offlineNote}
                  setNote={setOfflineNote}
                  totalCents={totalCents}
                  onConfirm={chargeOffline}
                  onBack={() => setStep('method')}
                  processing={processing}
                />
              )}

              {errorMsg && (
                <div style={{
                  marginTop: 14,
                  background: C.redSoft,
                  border: `1.5px solid #FCA5A5`,
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 13,
                  color: '#991B1B',
                  fontStyle: 'italic',
                  fontFamily: 'Georgia, serif',
                }}>
                  {errorMsg}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function AmountRow({ amount, setAmount, tip, setTip, totalCents, therapist }) {
  // Phase 13.7 (HK May 17 2026): respect therapist.accept_tips toggle.
  // When false, the tip field + chips are hidden entirely. The amount
  // field expands to fill the row.
  const acceptTips = therapist?.accept_tips !== false;
  const tipPresets = [
    Number(therapist?.tip_preset_1 ?? 15),
    Number(therapist?.tip_preset_2 ?? 18),
    Number(therapist?.tip_preset_3 ?? 20),
  ];

  const amountNum = parseFloat(amount) || 0;
  const tipNum = parseFloat(tip) || 0;
  const currentPercent = amountNum > 0 ? Math.round((tipNum / amountNum) * 100) : null;
  // Phase 13.8 (HK May 17 2026): Custom chip focuses the tip field.
  // Custom is "active" when there's a tip > 0 that doesn't match any
  // preset percent, so the visual selection matches the actual state.
  const isCustomActive = tipNum > 0 && !tipPresets.includes(currentPercent);
  const tipInputRef = useRef(null);
  const customPercentRef = useRef(null);
  // Phase 13.8.3 (HK May 17 2026): Custom chip becomes an inline percent
  // input on tap. customEditing controls whether the chip shows just
  // "Custom" label or the editable percent field. While editing, the
  // chip is always treated as active (even if the percent is 0). Other
  // chip taps exit edit mode.
  const [customEditing, setCustomEditing] = useState(false);
  const customDisplay = isCustomActive ? currentPercent : (customEditing ? 0 : null);

  return (
    <div style={{ background: C.cream, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px', marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
        <Field label="Amount" value={amount} setValue={setAmount} prefix="$" />
        {acceptTips && (
          <Field label="Tip (optional)" value={tip} setValue={setTip} prefix="$" inputRef={tipInputRef} />
        )}
      </div>

      {acceptTips && amountNum > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {tipPresets.map((pct) => {
            const isActive = currentPercent === pct && !customEditing;
            const tipAmount = (amountNum * pct / 100).toFixed(2);
            return (
              <button
                key={pct}
                type="button"
                onClick={() => {
                  setCustomEditing(false);
                  setTip(tipAmount);
                }}
                style={{
                  flex: 1,
                  minWidth: 64,
                  background: isActive ? `linear-gradient(135deg, ${C.forestDeep}, ${C.forest})` : '#fff',
                  color: isActive ? '#fff' : C.forestDeep,
                  border: isActive ? 'none' : `1.5px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '8px 10px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 2px 8px rgba(42,87,65,0.18)' : 'none',
                }}>
                {pct}%
                <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.8, marginTop: 2 }}>
                  ${tipAmount}
                </div>
              </button>
            );
          })}

          {/* Phase 13.8.3 (HK May 17 2026): Custom chip toggles between
              a 'Custom' label and an inline percent input. Tapping the
              label switches to edit mode with the input focused.
              Typing a percent updates the tip dollars via setTip.
              Tip $ field stays editable too; both stay in sync because
              the chip's displayed percent is derived from tip/amount.

              Phase 19.5 hotfix (HK May 18 2026): on iOS Safari the
              keyboard wouldn't open on first tap because the focus()
              call was inside a setTimeout (outside the user-gesture
              event loop). iOS only opens the keyboard for focus()
              calls inside the original tap event AND on focusable
              elements. Fix: switch from <div onClick> to <button>
              and focus the input synchronously. */}
          <button
            type="button"
            onClick={() => {
              if (!customEditing) {
                setCustomEditing(true);
                // Clear tip if currently on a preset; keep tip if user
                // already had a custom amount from typing in $ field.
                if (!isCustomActive) setTip('');
                // Synchronous focus inside the gesture event; iOS
                // requires this to open the keyboard on first tap.
                // The input element is conditionally rendered though,
                // so we use rAF inside the handler so React commits
                // the customEditing=true state before we focus.
                requestAnimationFrame(() => {
                  customPercentRef.current?.focus();
                });
              } else {
                // Already in edit mode; still focus to re-open keypad
                // if user tapped the chip again.
                customPercentRef.current?.focus();
              }
            }}
            style={{
              flex: 1,
              minWidth: 64,
              background: (isCustomActive || customEditing) ? `linear-gradient(135deg, ${C.forestDeep}, ${C.forest})` : '#fff',
              color: (isCustomActive || customEditing) ? '#fff' : C.forestDeep,
              border: (isCustomActive || customEditing) ? 'none' : `1.5px solid ${C.border}`,
              borderRadius: 10,
              padding: '8px 10px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: (isCustomActive || customEditing) ? '0 2px 8px rgba(42,87,65,0.18)' : 'none',
              textAlign: 'center',
            }}>
            {customEditing ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
                  <input
                    ref={customPercentRef}
                    type="text"
                    inputMode="numeric"
                    value={customDisplay === null ? '' : String(customDisplay)}
                    onChange={(e) => {
                      const pct = parseInt(e.target.value.replace(/\D/g, ''), 10);
                      if (isNaN(pct) || pct < 0) { setTip(''); return; }
                      const cappedPct = Math.min(pct, 999);
                      setTip((amountNum * cappedPct / 100).toFixed(2));
                    }}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => {
                      // Keep edit mode if a value is present; exit if
                      // user blurred without entering anything.
                      if (!isCustomActive) setCustomEditing(false);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="0"
                    style={{
                      width: 32,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      color: 'inherit',
                      fontSize: 13,
                      fontWeight: 700,
                      textAlign: 'right',
                      padding: 0,
                    }}
                  />
                  <span>%</span>
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.8, marginTop: 2 }}>
                  ${tipNum.toFixed(2)}
                </div>
              </>
            ) : isCustomActive ? (
              <>
                {currentPercent}%
                <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.8, marginTop: 2 }}>
                  ${tipNum.toFixed(2)}
                </div>
              </>
            ) : (
              'Custom'
            )}
          </button>
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: `1px dashed ${C.border}`, paddingTop: 10 }}>
        <div style={{ fontSize: 12, color: C.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>Total</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.forestDeep }}>${(totalCents / 100).toFixed(2)}</div>
      </div>
    </div>
  );
}

function Field({ label, value, setValue, prefix, inputRef }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '8px 12px' }}>
        {prefix && <span style={{ color: C.inkSoft, fontSize: 16, marginRight: 4 }}>{prefix}</span>}
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={e => setValue(e.target.value.replace(/[^\d.]/g, ''))}
          onFocus={e => e.target.select()}
          placeholder="0.00"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, fontWeight: 600, color: C.ink, background: 'transparent', width: '100%', minWidth: 0 }}
        />
      </div>
    </div>
  );
}

function MethodPicker({ cardOnFile, onCardOnFile, onCardNew, onSendLink, onMarkPaid, redeemablePackage, onRedeemPackage, redeeming, isSubscription, isPackage, validAmount, stripeConnected, squareConnected, onClose }) {
  // Either processor unlocks the card-based methods. HK May 22 2026:
  // we support Stripe AND Square as equally first-class processors;
  // the therapist picks whichever they already use, or connects both
  // (Square is sometimes preferred by therapists who already have a
  // Square POS for retail products at the front desk).
  const hasProcessor = stripeConnected || squareConnected;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
        How is the client paying?
      </div>

      {/* HK May 27 2026 Phase Pkg-C: redeem from existing package.
          Shown FIRST so it lands as the default expected action.
          Jacquie's case: session 3 of a 4-pack should be one tap
          'use existing package', not 'enter $300 again'.
          70yo persona: sage green primary, plain English, prominent. */}
      {redeemablePackage && (
        <MethodButton
          onClick={onRedeemPackage}
          disabled={redeeming || redeemablePackage.sessions_remaining <= 0}
          icon="📦"
          title={redeeming ? 'Redeeming...' : `Use existing package · ${redeemablePackage.sessions_remaining} left`}
          subtitle={`${redeemablePackage.name}. This session draws from the pack, no new charge.`}
          primary
        />
      )}

      {/* Mark as paid: always available. Cash, check, Venmo, Zelle,
          trade, or paid-before-switching-over scenarios. This is the
          critical path for therapists who don't take card payments,
          OR who haven't connected Stripe or Square yet but still need
          to record a session as paid. HK May 22 2026: must NEVER be
          hidden by processor connection state. */}
      <MethodButton
        onClick={onMarkPaid}
        icon="💵"
        title="Mark as paid"
        subtitle="Cash, check, Venmo, Zelle, trade, or other offline payment"
        primary={!redeemablePackage && (!hasProcessor || (isSubscription && !cardOnFile))}
      />

      {/* Card-based methods: shown only when EITHER Stripe or Square
          is connected. When neither is connected, we surface a clear
          dual-CTA below so the therapist understands WHY card options
          aren't here and how to unlock them. HK May 22 2026:
          acknowledges both processors as equally valid. */}
      {hasProcessor ? (
        <>
          {cardOnFile && (
            <MethodButton
              onClick={onCardOnFile}
              disabled={!validAmount}
              icon="💳"
              title="Card on file"
              subtitle={`${cardOnFile.brand} ending in ${cardOnFile.last4}`}
              primary={!redeemablePackage}
            />
          )}
          {/* HK May 24 2026: removed !isSubscription gate. All three
              checkout contexts (session, membership, package) now
              support Enter new card. The chargeNewCard handler is
              context-aware: it saves the card to the client, charges
              it, and records the right linking row. Identical UI
              across all three. */}
          <MethodButton
            onClick={onCardNew}
            disabled={!validAmount}
            icon="🪪"
            title="Enter new card"
            subtitle="Type card number now"
            primary={!cardOnFile && !redeemablePackage}
          />
          {/* Send pay link (Phase 19.4): supports bookings AND
              subscriptions. For packages, the create-payment-link
              edge function doesn't yet accept package_purchase_id -
              extending it is item 28b in BLOCK_PLAN, will land in a
              follow-up. Until then, hide this option for package
              checkout. The other three methods (Mark as paid, Card
              on file, Enter new card) work identically across all
              three contexts. */}
          {!isPackage && (
            <MethodButton
              onClick={onSendLink}
              disabled={!validAmount}
              icon="📲"
              title="Send pay link"
              subtitle="Text or email a one-time link"
            />
          )}
        </>
      ) : (
        <div style={{
          marginTop: 4,
          padding: '14px 16px',
          background: '#FEF7E8',
          border: '1.5px dashed #F0D89C',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 18 }}>💳</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#7A4F0D' }}>
              Want to take card payments too?
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: '#78350F', lineHeight: 1.5 }}>
            Connect Stripe or Square to charge cards on file, accept new cards in person, and send SMS or email pay links. Pick whichever you already use, or connect both. We do not charge any platform fee.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            <a
              href="/dashboard/settings"
              onClick={() => { if (onClose) onClose(); }}
              style={{
                background: '#fff',
                color: '#7A4F0D',
                border: '1px solid #F0D89C',
                padding: '7px 14px',
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 700,
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 14 }}>🟣</span> Connect Stripe
            </a>
            <a
              href="/dashboard/settings"
              onClick={() => { if (onClose) onClose(); }}
              style={{
                background: '#fff',
                color: '#7A4F0D',
                border: '1px solid #F0D89C',
                padding: '7px 14px',
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 700,
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 14 }}>⬛</span> Connect Square
            </a>
          </div>
          <div style={{ fontSize: 11, color: '#92400E', fontStyle: 'italic', marginTop: 2 }}>
            Settings opens in this tab.
          </div>
        </div>
      )}
    </div>
  );
}

function MethodButton({ onClick, disabled, icon, title, subtitle, primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: primary ? `linear-gradient(135deg, ${C.forestDeep}, ${C.forest})` : '#fff',
        color: primary ? '#fff' : C.forestDeep,
        border: primary ? 'none' : `1.5px solid ${C.border}`,
        borderRadius: 14,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        textAlign: 'left',
        fontFamily: 'system-ui, sans-serif',
        boxShadow: primary ? '0 2px 12px rgba(42,87,65,0.18)' : 'none',
        transition: 'transform 0.1s',
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.98)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ fontSize: 16, opacity: 0.6 }}>→</div>
    </button>
  );
}

function ConfirmCardOnFile({ cardOnFile, totalCents, onConfirm, onBack, processing }) {
  return (
    <div>
      <div style={{ background: C.greenSoft, border: `1.5px solid #86EFAC`, borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#15803D', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>Charging card on file</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#14532D' }}>{cardOnFile.brand} •••• {cardOnFile.last4}</div>
        <div style={{ fontSize: 13, color: '#15803D', marginTop: 6 }}>${(totalCents / 100).toFixed(2)} will be charged immediately. A receipt will be emailed to the client.</div>
      </div>
      <ActionRow onBack={onBack} onConfirm={onConfirm} processing={processing} confirmLabel={`Charge $${(totalCents / 100).toFixed(2)}`} />
    </div>
  );
}

function NewCardForm({
  cardDivRef, ready, totalCents, onConfirm, onBack, processing,
  // HK May 31 2026: Square dispatch props
  processor, cardSetupLoading, squareCardSecret, onSquareTokenized, errorMsg,
  // HK May 31 2026: save-card-for-future checkbox (Stripe path only).
  saveCardForLater, setSaveCardForLater, clientName,
}) {
  // Loading state while init-card-setup picks a processor for
  // Square / both-connected therapists.
  if (cardSetupLoading || (!processor && !ready)) {
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>Card details</div>
          <div style={{
            padding: '16px 14px',
            border: `1.5px solid ${C.border}`,
            borderRadius: 12,
            background: '#fff',
            minHeight: 52,
          }} />
          <div style={{ fontSize: 12, color: C.inkFade, fontStyle: 'italic', fontFamily: 'Georgia, serif', marginTop: 8 }}>
            Loading secure card form
          </div>
        </div>
        <ActionRow onBack={onBack} onConfirm={() => {}} processing={false} confirmLabel={`Charge $${(totalCents / 100).toFixed(2)}`} disabled={true} />
      </div>
    );
  }

  // Square path: render the shared SquareCardForm which handles the
  // Web Payments SDK lifecycle. On tokenize success it calls
  // onSquareTokenized(token) which routes through chargeNewCardSquare
  // in the parent (one-shot charge via square-charge-card edge fn).
  if (processor === 'square') {
    return (
      <div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>Card details</div>
        </div>
        {/* HK Jun 3 2026: Square now supports saving the card on file.
            Same default-on checkbox as the Stripe path. When checked,
            chargeNewCardSquare vaults the card via square-save-card before
            charging it. */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', marginBottom: 14,
          background: '#FAFAF7',
          border: `1px solid ${C.border}`, borderRadius: 10,
          cursor: 'pointer', userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={!!saveCardForLater}
            onChange={(e) => setSaveCardForLater && setSaveCardForLater(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: C.forest, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, color: C.ink, lineHeight: 1.45 }}>
            Save this card for {clientName || 'this client'} so you can charge it next time without re-entering.
          </span>
        </label>
        <SquareCardForm
          clientSecret={squareCardSecret}
          buttonLabel={processing ? 'Processing…' : `Charge $${(totalCents / 100).toFixed(2)}`}
          buttonDisabled={processing}
          onTokenized={onSquareTokenized}
          onError={(msg) => { /* parent picks up errorMsg state via setErrorMsg already wired in chargeNewCardSquare */ }}
          showSecurityLine={true}
        />
        <button
          onClick={onBack}
          disabled={processing}
          style={{
            marginTop: 12, width: '100%', background: 'transparent',
            border: `1.5px solid ${C.border}`, color: C.inkSoft,
            borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 600,
            cursor: processing ? 'default' : 'pointer',
          }}
        >
          Back
        </button>
      </div>
    );
  }

  // Stripe path (default): existing Stripe Elements form unchanged.
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>Card details</div>
        <div ref={cardDivRef} style={{
          padding: '16px 14px',
          border: `1.5px solid ${C.border}`,
          borderRadius: 12,
          background: '#fff',
          minHeight: 52,
        }} />
        {!ready && (
          <div style={{ fontSize: 12, color: C.inkFade, fontStyle: 'italic', fontFamily: 'Georgia, serif', marginTop: 8 }}>
            Loading secure card form
          </div>
        )}
      </div>
      {/* HK May 31 2026: save-card-for-future checkbox. Default checked
          so most therapists get the card-on-file benefit without thinking
          about it. Unchecking is one tap. HK Jun 3 2026: the Square path
          now shows the same checkbox and vaults via square-save-card. */}
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', marginBottom: 16,
        background: '#FAFAF7',
        border: `1px solid ${C.border}`, borderRadius: 10,
        cursor: 'pointer', userSelect: 'none',
      }}>
        <input
          type="checkbox"
          checked={!!saveCardForLater}
          onChange={(e) => setSaveCardForLater && setSaveCardForLater(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: C.forest, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 13, color: C.ink, lineHeight: 1.45 }}>
          Save this card for {clientName || 'this client'} so you can charge it next time without re-entering.
        </span>
      </label>
      <ActionRow onBack={onBack} onConfirm={onConfirm} processing={processing} confirmLabel={`Charge $${(totalCents / 100).toFixed(2)}`} disabled={!ready} />
    </div>
  );
}

function SendLinkForm({ client, appt, therapist, linkDelivery, setLinkDelivery, totalCents, onConfirm, onBack, processing }) {
  const phone = client?.phone || appt?.phone;
  const email = client?.email || appt?.email;
  const hasTwilio = !!(therapist?.twilio_account_sid && therapist?.twilio_phone_number);
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>Delivery</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <DeliveryOption active={linkDelivery === 'sms'} onClick={() => setLinkDelivery('sms')} icon="💬" label="SMS" detail={phone || 'no phone on file'} disabled={!phone} />
          <DeliveryOption active={linkDelivery === 'email'} onClick={() => setLinkDelivery('email')} icon="📧" label="Email" detail={email || 'no email on file'} disabled={!email} />
        </div>
        {linkDelivery === 'sms' && !hasTwilio && (
          <div style={{ marginTop: 10, fontSize: 12, color: C.amber, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
            Heads up: SMS delivery requires your Twilio to be configured. Email is the safer default for now.
          </div>
        )}
      </div>
      <ActionRow onBack={onBack} onConfirm={onConfirm} processing={processing} confirmLabel={`Create $${(totalCents / 100).toFixed(2)} link`} />
    </div>
  );
}

function DeliveryOption({ active, onClick, icon, label, detail, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        background: active ? C.greenSoft : '#fff',
        border: `1.5px solid ${active ? '#86EFAC' : C.border}`,
        borderRadius: 12,
        padding: '12px 14px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        textAlign: 'left',
      }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#14532D' : C.ink }}>{label}</div>
      <div style={{ fontSize: 11, color: active ? '#15803D' : C.inkFade, marginTop: 2, fontFamily: 'Georgia, serif', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</div>
    </button>
  );
}

function ActionRow({ onBack, onConfirm, processing, confirmLabel, disabled }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
      <button
        type="button"
        onClick={onBack}
        disabled={processing}
        style={{
          flex: '0 0 96px',
          minHeight: 48,
          background: '#fff',
          color: C.inkSoft,
          border: `1.5px solid ${C.border}`,
          borderRadius: 14,
          padding: '12px 16px',
          fontSize: 14,
          fontWeight: 600,
          cursor: processing ? 'wait' : 'pointer',
          letterSpacing: '0.01em',
        }}>
        Back
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={processing || disabled}
        style={{
          flex: 1,
          minHeight: 48,
          background: (processing || disabled) ? '#A3B0A0' : `linear-gradient(135deg, ${C.forestDeep} 0%, ${C.forest} 100%)`,
          color: '#fff',
          border: 'none',
          borderRadius: 14,
          padding: '12px 18px',
          fontSize: 15,
          fontWeight: 600,
          cursor: (processing || disabled) ? 'wait' : 'pointer',
          boxShadow: (processing || disabled) ? 'none' : '0 4px 14px rgba(31,64,48,0.25), 0 1px 0 rgba(255,255,255,0.15) inset',
          letterSpacing: '0.01em',
        }}>
        {processing ? 'Processing' : confirmLabel}
      </button>
    </div>
  );
}

function SuccessView({ detail, onClose, linkUrl, linkDelivery, clientPhone, clientEmail, therapistName, isSubscription, isPackage, contextName, contextDetail }) {
  const isLink = detail?.method === 'Payment link';
  const smsBody = `Hi from ${therapistName || 'your therapist'}. Here's your payment link for $${detail?.total}: ${linkUrl}`;
  const emailSubject = `Payment for your session with ${therapistName || 'your therapist'}`;
  const emailBody = `Hi,%0D%0A%0D%0AHere's your payment link for $${detail?.total}:%0D%0A%0D%0A${linkUrl}%0D%0A%0D%0AThank you!`;

  // HK May 24 2026: context-aware success copy. Tells the therapist
  // exactly what just happened in their business terms.
  //   - Session: 'Charged $X' / 'Session recorded as paid'
  //   - Membership: '[Plan name] paid for June 2026' or similar
  //   - Package: '[Plan name] active' + '[N] sessions ready to use'
  //   - Package redemption (HK May 27 2026 Phase Pkg-C): one credit
  //     drawn from existing package, no charge.
  let headline;
  let subline;
  const isPackageRedemption = detail?.method === 'Redeemed from package';
  if (isLink) {
    headline = 'Payment link ready';
    subline = 'Send it to your client through their preferred channel.';
  } else if (isPackageRedemption) {
    headline = 'Session drawn from package';
    subline = `${detail?.package_name || 'Package'}. ${detail?.sessions_left} session${detail?.sessions_left === 1 ? '' : 's'} left in this package.`;
  } else if (isPackage) {
    headline = `${contextName || 'Package'} active`;
    subline = `${detail?.method} · ${(detail?.detail ? detail.detail + ' · ' : '')}${contextDetail || 'Sessions ready to use'}.`;
  } else if (isSubscription) {
    headline = parseFloat(detail?.total) > 0
      ? `Charged $${detail?.total}`
      : `${contextName || 'Membership'} marked paid`;
    subline = `${contextName || 'Membership'} ${contextDetail || 'paid for this cycle'}. ${detail?.method}${detail?.detail ? ' · ' + detail.detail : ''}.`;
  } else {
    headline = parseFloat(detail?.total) > 0
      ? `Charged $${detail?.total}`
      : 'Session recorded as paid';
    subline = parseFloat(detail?.total) > 0
      ? `${detail?.method} · ${detail?.detail}. Receipt emailed to client.`
      : `${detail?.method}${detail?.detail ? ` · ${detail?.detail}` : ''}. No money exchanged.`;
  }

  // The full checkout success now uses the standardized ResultScreen.
  // Group A (session charge / no-money and the payment link) returns here;
  // Group B (package redemption, package active, membership) returns below.
  const isSessionResult = !isLink && !isPackageRedemption && !isPackage && !isSubscription;
  if (isSessionResult) {
    const isMoney = parseFloat(detail?.total) > 0;
    return (
      <ResultScreen
        variant={isMoney ? 'money' : 'success'}
        amount={isMoney ? `$${detail?.total}` : undefined}
        headline={isMoney ? 'Payment received' : 'Session recorded as paid'}
        subline={subline}
        primary={{ label: 'Done', onClick: onClose }}
      />
    );
  }
  if (isLink) {
    return (
      <ResultScreen
        variant="share"
        headline="Payment link ready"
        subline={subline}
        linkUrl={linkUrl}
        banner={detail?.emailed ? `Payment link emailed to ${detail.emailedTo || clientEmail}` : null}
        primary={{ label: 'Done', onClick: onClose }}
      >
        <div style={{ display: 'flex', gap: 10 }}>
          {clientPhone && (
            <a href={`sms:${clientPhone}?body=${encodeURIComponent(smsBody)}`} style={{ flex: 1, display: 'block', background: linkDelivery === 'sms' ? `linear-gradient(135deg, ${C.forestDeep}, ${C.forest})` : '#fff', color: linkDelivery === 'sms' ? '#fff' : C.forestDeep, border: linkDelivery === 'sms' ? 'none' : `1.5px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, fontWeight: 700, textDecoration: 'none', textAlign: 'center', boxShadow: linkDelivery === 'sms' ? '0 2px 10px rgba(42,87,65,0.2)' : 'none' }}>
              💬 Open SMS
            </a>
          )}
          {clientEmail && !detail?.emailed && (
            <a href={`mailto:${clientEmail}?subject=${encodeURIComponent(emailSubject)}&body=${emailBody}`} style={{ flex: 1, display: 'block', background: linkDelivery === 'email' ? `linear-gradient(135deg, ${C.forestDeep}, ${C.forest})` : '#fff', color: linkDelivery === 'email' ? '#fff' : C.forestDeep, border: linkDelivery === 'email' ? 'none' : `1.5px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, fontWeight: 700, textDecoration: 'none', textAlign: 'center', boxShadow: linkDelivery === 'email' ? '0 2px 10px rgba(42,87,65,0.2)' : 'none' }}>
              📧 Open Email
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(linkUrl); }}
          style={{ marginTop: 10, background: 'transparent', border: 'none', color: C.sage, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontStyle: 'italic', fontFamily: 'Georgia, serif', textDecoration: 'underline' }}>
          Copy link instead
        </button>
      </ResultScreen>
    );
  }

  // Group B (approved Jun 3 2026): package redemption, package active, and
  // membership now use the standardized ResultScreen too, unifying the whole
  // checkout success. Reuses the headline/subline computed above. The only
  // override is the membership money case, where the amount becomes the hero
  // and the headline reads "Payment received" instead of "Charged $X".
  const bMoney = parseFloat(detail?.total) > 0 && !isPackageRedemption;
  return (
    <ResultScreen
      variant={bMoney ? 'money' : 'success'}
      amount={bMoney ? `$${detail?.total}` : undefined}
      headline={(isSubscription && bMoney) ? 'Payment received' : headline}
      subline={subline}
      primary={{ label: 'Done', onClick: onClose }}
    />
  );
}

// Offline payment form. Folded in from the prior MarkAsPaidModal in
// Phase 19. UI mirrors the original modal's method picker + optional
// note field, but reuses the parent CheckoutModal's amount and tip
// inputs (no duplicate amount field).
function OfflineForm({ method, setMethod, note, setNote, totalCents, onConfirm, onBack, processing }) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>How was the money received?</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {OFFLINE_METHODS.map(m => {
            const active = method === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                style={{
                  background: active ? C.greenSoft : '#fff',
                  color: active ? '#15803D' : C.ink,
                  border: `1.5px solid ${active ? '#86EFAC' : C.border}`,
                  borderRadius: 10,
                  padding: '10px 6px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>Note (optional)</div>
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. Venmo @sarah-r, paid in advance"
          style={{
            width: '100%',
            padding: '10px 12px',
            border: `1.5px solid ${C.border}`,
            borderRadius: 10,
            fontSize: 14,
            boxSizing: 'border-box',
            outline: 'none',
            background: '#fff',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        />
      </div>
      <ActionRow onBack={onBack} onConfirm={onConfirm} processing={processing} confirmLabel={
        totalCents === 0
          ? 'Record session as paid ($0)'
          : `Record $${(totalCents / 100).toFixed(2)} as paid`
      } />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SelectClientStep (HK May 24 2026, Phase 13.12)
//
// Inline recovery surface for the "Client record missing on this
// charge" case. When a therapist opens checkout on a booking whose
// underlying row has client_id = NULL, render this step BEFORE the
// method picker so they can self-serve a fix.
//
// Two paths from here:
//   1. Pick from existing clients. Search by name / email / phone.
//      Confirm. We UPDATE bookings.client_id and advance.
//   2. Add a new client inline. Name + email + phone (all optional
//      individually; we just need one identifying field). Uses
//      findOrCreateClient under the hood so existing clients with
//      a matching email or phone+name get reused (no duplicate).
//
// Why this matters: this is the platform-level fix for the bug
// Terra hit. Before, the only way to recover an orphan booking was
// for an operator to run SQL. Now any therapist can do it
// themselves in 10 seconds. See FOUNDER_RUNBOOK Procedure 10.
// ─────────────────────────────────────────────────────────────────
function SelectClientStep({ therapist, appt, onPicked, onCancel }) {
  const [allClients, setAllClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // Inline add-new state
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState(appt?.client || '');
  const [newEmail, setNewEmail] = useState(appt?.email || '');
  const [newPhone, setNewPhone] = useState(appt?.phone || '');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!therapist?.id) { setLoading(false); return; }
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('therapist_id', therapist.id)
        .order('name', { ascending: true });
      if (cancelled) return;
      setAllClients(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [therapist?.id]);

  const q = query.trim().toLowerCase();
  const queryDigits = q.replace(/\D/g, '');
  const filtered = q
    ? allClients.filter(c => {
        // Name + email substring match (always evaluated).
        if ((c.name || '').toLowerCase().includes(q)) return true;
        if ((c.email || '').toLowerCase().includes(q)) return true;
        // Phone-digit match ONLY when the query has at least one
        // digit. Otherwise "".includes("") returns true for every
        // row and the whole filter collapses. Real bug: typing
        // "Joy" returned every client because q.replace(/\D/,'')
        // was '' and every phone "includes" ''. HK May 24 2026.
        if (queryDigits && (c.phone || '').replace(/\D/g, '').includes(queryDigits)) return true;
        return false;
      })
    : allClients;

  async function handleCreate() {
    setCreateError(null);
    if (!newName.trim() && !newEmail.trim() && !newPhone.trim()) {
      setCreateError('Add a name, email, or phone to continue.');
      return;
    }
    setCreating(true);
    try {
      const clientId = await findOrCreateClient({
        supabase,
        therapist_id: therapist.id,
        name: newName.trim() || (appt?.client || 'Client'),
        email: newEmail.trim(),
        phone: newPhone.trim(),
      });
      if (!clientId) {
        setCreateError('Could not save the client. Try again or pick from your list.');
        return;
      }
      const { data: row } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
      if (row) {
        onPicked(row);
      } else {
        setCreateError('Saved, but could not load the new client. Refresh and try again.');
      }
    } catch (err) {
      console.error('SelectClientStep.handleCreate failed', err);
      setCreateError(err?.message || 'Could not save the client.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      {/* Banner explaining what happened and what to do. Sage tint
          keeps it friendly rather than alarming; this is a recovery
          flow, not an error. */}
      <div style={{
        background: '#E8F0E8',
        border: '1px solid #B8D4B8',
        borderRadius: 12,
        padding: '12px 14px',
        marginBottom: 16,
      }}>
        <div style={{ fontWeight: 700, color: C.forestDeep, fontSize: 14, marginBottom: 4 }}>
          This booking isn't connected to a client yet
        </div>
        <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.45 }}>
          {appt?.client
            ? `The booking shows "${appt.client}". Pick the matching client from your list, or add them as a new client.`
            : 'Pick a client from your list, or add a new one to continue with this charge.'}
        </div>
      </div>

      {!adding && (
        <>
          {/* Search */}
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, email, or phone"
            style={{
              width: '100%',
              padding: '12px 14px',
              border: `1.5px solid ${C.border}`,
              borderRadius: 10,
              fontSize: 14,
              boxSizing: 'border-box',
              outline: 'none',
              background: '#fff',
              marginBottom: 12,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          />

          {/* List */}
          <div style={{
            maxHeight: 280,
            overflowY: 'auto',
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            background: '#fff',
            marginBottom: 12,
          }}>
            {loading && (
              <div style={{ padding: 16, fontSize: 13, color: C.inkSoft, textAlign: 'center' }}>Loading clients...</div>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ padding: 16, fontSize: 13, color: C.inkSoft, textAlign: 'center' }}>
                {q ? `No clients match "${query}".` : 'No clients in your list yet.'}
              </div>
            )}
            {!loading && filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => onPicked(c)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 14px',
                  border: 'none',
                  borderBottom: `1px solid ${C.border}`,
                  background: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F5F0E8'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: C.forestDeep }}>{c.name || 'Unnamed client'}</div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                  {[c.email, c.phone].filter(Boolean).join(' · ') || 'No contact info'}
                </div>
              </button>
            ))}
          </div>

          {/* Add new + Cancel */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setAdding(true)}
              style={{
                flex: 1,
                background: '#fff',
                color: C.forestDeep,
                border: `1.5px solid ${C.forestDeep}`,
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              + Add new client
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                background: 'transparent',
                color: C.inkSoft,
                border: 'none',
                padding: '12px 14px',
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {adding && (
        <div>
          <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
            Add a new client
          </div>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Full name"
            style={inputStyle}
          />
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="Email (optional)"
            style={inputStyle}
          />
          <input
            type="tel"
            value={newPhone}
            onChange={e => setNewPhone(e.target.value)}
            placeholder="Phone (optional)"
            style={inputStyle}
          />
          {createError && (
            <div style={{ fontSize: 13, color: '#DC2626', marginTop: 4, marginBottom: 8 }}>
              {createError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              style={{
                flex: 1,
                background: creating ? '#9CA3AF' : `linear-gradient(135deg, ${C.forestDeep}, ${C.forest})`,
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: 14,
                fontWeight: 700,
                cursor: creating ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 2px 10px rgba(42,87,65,0.2)',
              }}
            >
              {creating ? 'Saving...' : 'Save and continue'}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setCreateError(null); }}
              disabled={creating}
              style={{
                background: 'transparent',
                color: C.inkSoft,
                border: 'none',
                padding: '12px 14px',
                fontSize: 14,
                cursor: creating ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable input style for the add-new form. Matches the rest of
// CheckoutModal's input fields.
const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1.5px solid #E5DDD2',
  borderRadius: 10,
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
  background: '#fff',
  marginBottom: 8,
  fontFamily: 'system-ui, -apple-system, sans-serif',
};
