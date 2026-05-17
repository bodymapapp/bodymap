// src/components/CheckoutModal.jsx
//
// Phase 12: Therapist Checkout flow on the calendar slide-over.
//
// Candice request (May 17 2026): 'how do I check someone out /
// collect payments... lets say they did not (pay online)... how
// would they pay the therapist... this link is gone once the
// massage is booked.'
//
// GlossGenius-inspired UX: one prominent Checkout button on the
// calendar slide-over opens this modal. Three payment paths
// inside, chosen by the therapist after the client says how
// they want to pay:
//
//   1. Card on file (existing saved card, fastest)
//   2. Enter new card now (Stripe Elements inline)
//   3. Send pay link (Stripe Payment Links + SMS or email)
//
// Cash / Venmo / Zelle / Other are NOT here. Those go through
// the separate 'Mark as paid' button below this one, because
// they are 'payment already happened, just record it' rather than
// 'collect payment now.'

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getStripePublishableKey } from '../lib/paymentMode';
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

export default function CheckoutModal({ appt, therapist, client, defaultAmountCents, onClose, onPaid }) {
  const [step, setStep] = useState('method'); // 'method' | 'card_on_file' | 'card_new' | 'send_link' | 'success'
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
          description: `Session with ${therapist.business_name || therapist.full_name || 'your therapist'}`,
          client_email: client.email || appt?.email,
          send_receipt: true,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.success) throw new Error('Charge did not succeed');

      // Record in session_payments
      await supabase.from('session_payments').insert({
        booking_id: appt.id,
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
      });

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
          description: `Session with ${therapist.business_name || therapist.full_name || 'your therapist'}`,
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

      // Step 5: session_payments row, payment_method = stripe_card_new
      // since this is the 'entered fresh at checkout' code path even
      // though the card was also saved for future use.
      await supabase.from('session_payments').insert({
        booking_id: appt.id,
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
      });

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
      const res = await fetch(`${supabaseUrl}/functions/v1/create-payment-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          therapist_id: therapist.id,
          booking_id: appt.id,
          amount_cents: amountCents,
          tip_cents: tipCents,
          service_name: appt?.service || 'Massage session',
          client_email: client?.email || appt?.email,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const url = data.payment_link_url;
      setLinkUrl(url);

      // Deliver the link via the chosen channel(s). For SMS we use
      // the existing notify-booking-event path with a custom event
      // type, but to keep this simple in v1 we fire a direct insert
      // into a one-shot communication record OR call notifyClient.
      // Simplest path that works today: just SMS or email directly
      // through Twilio / Resend via the same fan-out the notification
      // system uses. Since we don't yet have a dedicated edge function
      // for 'send arbitrary message,' fall back to the manual approach:
      // we surface the link to the therapist, they tap a button on
      // their phone (sms: or mailto:) to send it. This is intentional:
      // first delivery is therapist-mediated so the therapist owns the
      // exact words. A later phase wires direct platform delivery.
      // For now, just show the link + a 'Send via SMS' or 'Send via Email'
      // button which uses sms: / mailto: URL handlers.

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
    background: 'rgba(15, 30, 25, 0.55)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: isMobileViewport ? 'stretch' : 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 0,
  };

  const sheetStyle = isMobileViewport
    ? {
        // Full-screen takeover on mobile. No rounded corners because
        // it's edge-to-edge. Flex column with fixed header, scrollable
        // middle, fixed footer.
        background: '#fff',
        width: '100%',
        height: '100%',
        maxHeight: '100%',
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

  return (
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
              <SuccessView detail={successDetail} onClose={onClose} linkUrl={linkUrl} linkDelivery={linkDelivery} clientPhone={client?.phone || appt?.phone} clientEmail={client?.email || appt?.email} therapistName={therapist?.business_name || therapist?.full_name} />
            </div>
          </>
        ) : (
          <>
            {/* Fixed header: title + subtitle + close. */}
            <div style={headerStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 400, color: C.forestDeep, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
                  Checkout
                </div>
                <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {appt?.client || client?.name} · {appt?.service || 'Session'}
                </div>
              </div>
              <CloseButton onClick={onClose} label="Close" />
            </div>

            {/* Scrollable body */}
            <div style={bodyStyle}>
              <AmountRow amount={amount} setAmount={setAmount} tip={tip} setTip={setTip} totalCents={totalCents} />

              {step === 'method' && (
                <MethodPicker
                  cardOnFile={cardOnFile}
                  onCardOnFile={() => setStep('card_on_file')}
                  onCardNew={() => setStep('card_new')}
                  onSendLink={() => setStep('send_link')}
                  validAmount={validAmount}
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
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function AmountRow({ amount, setAmount, tip, setTip, totalCents }) {
  return (
    <div style={{ background: C.cream, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px', marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
        <Field label="Amount" value={amount} setValue={setAmount} prefix="$" />
        <Field label="Tip (optional)" value={tip} setValue={setTip} prefix="$" />
      </div>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: `1px dashed ${C.border}`, paddingTop: 10 }}>
        <div style={{ fontSize: 12, color: C.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>Total</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.forestDeep }}>${(totalCents / 100).toFixed(2)}</div>
      </div>
    </div>
  );
}

function Field({ label, value, setValue, prefix }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '8px 12px' }}>
        {prefix && <span style={{ color: C.inkSoft, fontSize: 16, marginRight: 4 }}>{prefix}</span>}
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={e => setValue(e.target.value.replace(/[^\d.]/g, ''))}
          placeholder="0.00"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, fontWeight: 600, color: C.ink, background: 'transparent', width: '100%', minWidth: 0 }}
        />
      </div>
    </div>
  );
}

function MethodPicker({ cardOnFile, onCardOnFile, onCardNew, onSendLink, validAmount }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
        How is the client paying?
      </div>
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
      <MethodButton
        onClick={onCardNew}
        disabled={!validAmount}
        icon="🪪"
        title="Enter new card"
        subtitle="Type card number now"
        primary={!cardOnFile}
      />
      <MethodButton
        onClick={onSendLink}
        disabled={!validAmount}
        icon="📲"
        title="Send pay link"
        subtitle="Text or email a one-time link"
      />
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

function SuccessView({ detail, onClose, linkUrl, linkDelivery, clientPhone, clientEmail, therapistName }) {
  const isLink = detail?.method === 'Payment link';
  const smsBody = `Hi from ${therapistName || 'your therapist'}. Here's your payment link for $${detail?.total}: ${linkUrl}`;
  const emailSubject = `Payment for your session with ${therapistName || 'your therapist'}`;
  const emailBody = `Hi,%0D%0A%0D%0AHere's your payment link for $${detail?.total}:%0D%0A%0D%0A${linkUrl}%0D%0A%0D%0AThank you!`;

  return (
    <div style={{ textAlign: 'center', padding: '12px 8px 8px' }}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>{isLink ? '📲' : '✓'}</div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400, color: C.forestDeep, marginBottom: 8 }}>
        {isLink ? 'Payment link ready' : `Charged $${detail?.total}`}
      </div>
      <div style={{ fontSize: 14, color: C.inkSoft, marginBottom: 20 }}>
        {isLink
          ? 'Send it to your client through their preferred channel.'
          : `${detail?.method} · ${detail?.detail}. Receipt emailed to client.`}
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
        style={{ width: '100%', background: '#fff', color: C.forestDeep, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '12px 18px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
        Done
      </button>
    </div>
  );
}
