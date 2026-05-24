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
import CloseButton from './CloseButton';

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
// HK May 19 2026: added Trade and 'Paid before switchover' per
// Candice ask. A $0 trade session (massage in exchange for hair)
// or a session paid weeks ago before the therapist joined MBM
// both record as legitimate offline payments.
const OFFLINE_METHODS = [
  { value: 'cash',           label: 'Cash' },
  { value: 'venmo',          label: 'Venmo' },
  { value: 'zelle',          label: 'Zelle' },
  { value: 'cashapp',        label: 'Cash App' },
  { value: 'check',          label: 'Check' },
  { value: 'trade',          label: 'Trade or barter' },
  { value: 'paid_elsewhere', label: 'Paid before switchover' },
  { value: 'comped',         label: 'Comped' },
  { value: 'other',          label: 'Other' },
];

export default function CheckoutModal({
  appt,
  subscription,         // NEW Phase 19: { id, monthly_price, membership: {name, ...}, ... } when charging a renewal
  renewal,              // NEW Phase 19: an optional member_subscription_renewals row to link this payment to
  packagePurchase,      // NEW May 24 2026: { name, sessions, price, expiresAt, planId, oneoffPlanData } when adding/charging a package
  onPackageCreated,     // NEW May 24 2026: called with the created package_purchase row on success
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

  // Stripe Elements refs for new-card path
  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const cardElRef = useRef(null);
  const cardDivRef = useRef(null);
  const [stripeReady, setStripeReady] = useState(false);

  // Send-link state
  const [linkDelivery, setLinkDelivery] = useState('sms'); // 'sms' | 'email' | 'both'
  const [linkUrl, setLinkUrl] = useState(null);

  // Load card on file
  useEffect(() => {
    if (!client?.id) return;
    supabase
      .from('clients')
      .select('payment_method_id, card_last4, card_brand, stripe_customer_id')
      .eq('id', client.id)
      .single()
      .then(async ({ data }) => {
        if (!data?.payment_method_id) return;

        // Phase 13.5 followup (HK May 17 2026): self-heal rows where
        // payment_method_id is set but card_last4 is null (a bug in
        // earlier card-save flows where the publishable-key fetch
        // silently failed). Call get-payment-method edge function,
        // populate the missing fields, then show card-on-file.
        if (!data.card_last4 && therapist?.stripe_account_id) {
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
            // Silent fail: show 'Enter new card' instead of card-on-file.
            // Not a user-blocking error.
          }
        }

        if (data.payment_method_id && data.card_last4) {
          setCardOnFile({
            payment_method_id: data.payment_method_id,
            last4: data.card_last4,
            brand: data.card_brand || 'Card',
            stripe_customer_id: data.stripe_customer_id,
          });
        }
      });
  }, [client?.id, therapist?.stripe_account_id]);

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
      const res = await fetch(`${supabaseUrl}/functions/v1/charge-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          therapist_id: therapist.id,
          customer_id: cardOnFile.stripe_customer_id,
          payment_method_id: cardOnFile.payment_method_id,
          amount_cents: amountCents,
          tip_cents: tipCents,
          description: chargeDescription,
          client_email: client.email || appt?.email,
          send_receipt: true,
        }),
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
      const { data: insertedPayment } = await supabase.from('session_payments').insert({
        ...buildPaymentContext(packageRow?.id || null),
        therapist_id: therapist.id,
        client_id: client.id,
        amount_cents: amountCents,
        tip_cents: tipCents,
        payment_method: 'stripe_card_on_file',
        payment_method_detail: `${cardOnFile.brand} ${cardOnFile.last4}`,
        stripe_payment_intent_id: data.payment_intent_id || null,
        status: 'succeeded',
        paid_at: new Date().toISOString(),
        created_by_therapist_id: therapist.id,
      }).select('id').single();

      if (insertedPayment?.id) {
        firePaymentNotification(insertedPayment.id);
        await resolveRenewalAsPaid(insertedPayment.id);
      }
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
      const { data: insertedPayment } = await supabase.from('session_payments').insert({
        ...buildPaymentContext(packageRow?.id || null),
        therapist_id: therapist.id,
        client_id: client.id,
        amount_cents: amountCents,
        tip_cents: tipCents,
        payment_method: 'stripe_card_new',
        payment_method_detail: cardDetail,
        stripe_payment_intent_id: chargeData.payment_intent_id || null,
        status: 'succeeded',
        paid_at: new Date().toISOString(),
        created_by_therapist_id: therapist.id,
      }).select('id').single();

      if (insertedPayment?.id) {
        firePaymentNotification(insertedPayment.id);
        await resolveRenewalAsPaid(insertedPayment.id);
      }
      if (packageRow && onPackageCreated) {
        onPackageCreated(packageRow);
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
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={e => e.stopPropagation()}>
        {step === 'success' ? (
          <>
            <div style={headerStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400, color: C.forestDeep, letterSpacing: '-0.01em' }}>
                  Payment
                </div>
                <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {appt?.client || client?.name}
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
                  {appt?.client || client?.name} · {
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
                    // Fire onPaid to nudge the parent slide-over to
                    // refresh its payment list (existing wiring). This
                    // also triggers the schedule grid refresh on its
                    // next render cycle. The therapist may also need
                    // to close the slide-over and re-open to see the
                    // updated name in the header, depending on how
                    // the parent caches appt prop; the underlying DB
                    // row is now correct either way.
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

function MethodPicker({ cardOnFile, onCardOnFile, onCardNew, onSendLink, onMarkPaid, isSubscription, isPackage, validAmount, stripeConnected, squareConnected, onClose }) {
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
        primary={!hasProcessor || (isSubscription && !cardOnFile)}
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
              primary
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
            primary={!cardOnFile}
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

function NewCardForm({ cardDivRef, ready, totalCents, onConfirm, onBack, processing }) {
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
          // Stripe Elements iframe is inserted here. We give it room
          // to render naturally without compression artifacts.
        }} />
        {!ready && (
          <div style={{ fontSize: 12, color: C.inkFade, fontStyle: 'italic', fontFamily: 'Georgia, serif', marginTop: 8 }}>
            Loading secure card form
          </div>
        )}
      </div>
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
  let headline;
  let subline;
  if (isLink) {
    headline = 'Payment link ready';
    subline = 'Send it to your client through their preferred channel.';
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

  return (
    <div style={{ textAlign: 'center', padding: '12px 8px 8px' }}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>{isLink ? '📲' : '✓'}</div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400, color: C.forestDeep, marginBottom: 8 }}>
        {headline}
      </div>
      <div style={{ fontSize: 14, color: C.inkSoft, marginBottom: 20 }}>
        {subline}
      </div>
      {isLink && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 11, fontFamily: 'monospace', color: C.inkSoft, wordBreak: 'break-all', textAlign: 'left' }}>
            {linkUrl}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {clientPhone && (
              <a href={`sms:${clientPhone}?body=${encodeURIComponent(smsBody)}`} style={{ flex: 1, display: 'block', background: linkDelivery === 'sms' ? `linear-gradient(135deg, ${C.forestDeep}, ${C.forest})` : '#fff', color: linkDelivery === 'sms' ? '#fff' : C.forestDeep, border: linkDelivery === 'sms' ? 'none' : `1.5px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, fontWeight: 700, textDecoration: 'none', textAlign: 'center', boxShadow: linkDelivery === 'sms' ? '0 2px 10px rgba(42,87,65,0.2)' : 'none' }}>
                💬 Open SMS
              </a>
            )}
            {clientEmail && (
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
        </div>
      )}
      <button
        type="button"
        onClick={onClose}
        style={{
          width: '100%',
          background: `linear-gradient(135deg, ${C.forestDeep}, ${C.forest})`,
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          padding: '14px 18px',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 2px 10px rgba(42,87,65,0.2)',
          fontFamily: 'inherit',
        }}>
        Done
      </button>
    </div>
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
