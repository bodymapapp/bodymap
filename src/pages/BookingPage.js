import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { applyCycleFilter, phaseFromDate } from '../lib/cycleScheduling';
import { isTestMode, getStripePublishableKey } from '../lib/paymentMode';
import CloseButton from '../components/CloseButton';
import { PolicyDisplay } from '../components/BookingPolicies';
import ClientPushCTA from '../components/booking/ClientPushCTA';

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280', light:'#E8E4DC', danger:'#EF4444', amber:'#F59E0B' };

const fmt12 = t => { const [h,m]=t.split(':').map(Number); return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
const fmtDate = s => new Date(s+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
const fmtShort = s => new Date(s+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});

function generateSlots(start, end, dur, booked, bufferMins = 0) {
  const slots=[], [sh,sm]=start.split(':').map(Number), [eh,em]=end.split(':').map(Number);
  let cur=sh*60+sm; const endMin=eh*60+em;
  while(cur+dur<=endMin){
    const hh=String(Math.floor(cur/60)).padStart(2,'0'), mm=String(cur%60).padStart(2,'0');
    const se=`${String(Math.floor((cur+dur)/60)).padStart(2,'0')}:${String((cur+dur)%60).padStart(2,'0')}`;
    // Check conflict including buffer: a slot conflicts if it overlaps with any booked slot + their buffer
    const conflict=booked.some(b=>{
      const bookedStart = b.start_time.slice(0,5);
      const bookedEndMins = b.end_time ? 
        (parseInt(b.end_time.slice(0,2))*60 + parseInt(b.end_time.slice(3,5))) :
        (parseInt(b.start_time.slice(0,2))*60 + parseInt(b.start_time.slice(3,5)) + dur);
      const bookedEndWithBuffer = bookedEndMins + bufferMins;
      const bookedEndStr = `${String(Math.floor(bookedEndWithBuffer/60)).padStart(2,'0')}:${String(bookedEndWithBuffer%60).padStart(2,'0')}`;
      return !(se <= bookedStart || `${hh}:${mm}` >= bookedEndStr);
    });
    if(!conflict) slots.push({start:`${hh}:${mm}`,end:se,display:fmt12(`${hh}:${mm}`),minutes:cur});
    cur+=30;
  }
  return slots;
}

function scoreSlots(slots, existingBooked, dur, schedulingMode = 'normal', efficientStrictness = 'soft') {
  // Adjacency to existing bookings is always a tiebreaker. In
  // 'efficient + soft' mode the boost is much stronger so adjacent
  // slots rise visibly to the top.
  const adjacentBoost = (schedulingMode === 'efficient' && efficientStrictness === 'soft') ? 12 : 3;
  return slots.map(slot => {
    let score = 0;
    const slotEnd = slot.minutes + dur;
    const adjacentBefore = existingBooked.some(b => {
      const be = b.end_time ? parseInt(b.end_time.split(':')[0])*60+parseInt(b.end_time.split(':')[1]) : 0;
      return Math.abs(be - slot.minutes) <= 30;
    });
    const adjacentAfter = existingBooked.some(b => {
      const bs = b.start_time ? parseInt(b.start_time.split(':')[0])*60+parseInt(b.start_time.split(':')[1]) : 0;
      return Math.abs(bs - slotEnd) <= 30;
    });
    if(adjacentBefore || adjacentAfter) score += adjacentBoost;
    if(slot.minutes < 720) score += 1;
    return {...slot, score, recommended: adjacentBefore || adjacentAfter};
  }).sort((a,b) => b.score - a.score);
}

function Cal({availability, service, selected, onSelect, blockedDates=new Set(), maxDate=null, minDate=null}) {
  const today=new Date(); today.setHours(0,0,0,0);
  const [yr,setYr]=useState(today.getFullYear());
  const [mo,setMo]=useState(today.getMonth());
  const avDows=availability.map(a=>a.day_of_week);
  const days=new Date(yr,mo+1,0).getDate();
  const offset=(()=>{const d=new Date(yr,mo,1).getDay();return d===0?6:d-1;})();
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const cells=[...Array(offset).fill(null),...Array.from({length:days},(_,i)=>i+1)];
  // Service availability helper note (Lindsey #4 follow-up).
  // When this service has a custom day filter (only some days), tell
  // the client which days that service is offered so they understand
  // why other days are greyed out. Triggers ONLY when avDows is a
  // strict subset of [0..6] AND has fewer than 7 days.
  const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dayLabelsLong = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const offeredDows = [...new Set(avDows)].sort((a,b) => a - b);
  const isPartialSchedule = offeredDows.length > 0 && offeredDows.length < 7;
  const offeredLabel = (() => {
    if (offeredDows.length === 1) return dayLabelsLong[offeredDows[0]];
    if (offeredDows.length === 2) return `${dayLabelsLong[offeredDows[0]]} and ${dayLabelsLong[offeredDows[1]]}`;
    return offeredDows.map(d => dayLabels[d]).join(', ');
  })();
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <button onClick={()=>mo===0?[setMo(11),setYr(y=>y-1)]:setMo(m=>m-1)} style={{background:'none',border:`1px solid ${C.light}`,borderRadius:8,padding:'7px 14px',cursor:'pointer',fontSize:15,color:C.dark}}>‹</button>
        <span style={{fontSize:15,fontWeight:600,color:C.dark}}>{MONTHS[mo]} {yr}</span>
        <button onClick={()=>mo===11?[setMo(0),setYr(y=>y+1)]:setMo(m=>m+1)} style={{background:'none',border:`1px solid ${C.light}`,borderRadius:8,padding:'7px 14px',cursor:'pointer',fontSize:15,color:C.dark}}>›</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:6}}>
        {['M','T','W','T','F','S','S'].map((d,i)=><div key={i} style={{textAlign:'center',fontSize:11,fontWeight:700,color:C.gray,padding:'4px 0'}}>{d}</div>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3}}>
        {cells.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const dt=new Date(yr,mo,d); dt.setHours(0,0,0,0);
          const ds=`${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const nowTime = new Date();
          const isToday2 = dt.toDateString() === today.toDateString();
          const pastLastSlot = isToday2 && nowTime.getHours() >= 17;
          // Booking horizon: if therapist set a max-days-out limit, dates
          // beyond that are disabled. Used by cycle-aligned therapists to
          // bound how far ahead bookings can drift from her current phase.
          const beyondHorizon = maxDate && dt > maxDate;
          // Lead-time minimum (Lindsey #5): if therapist set a minimum
          // booking advance window, dates entirely before the earliest
          // bookable instant are disabled. The intra-day filter still
          // runs in the slot generator.
          const beforeMinimum = minDate && dt < minDate;
          const dowExcluded = !avDows.includes(dt.getDay());
          const disabled=dowExcluded||dt<today||pastLastSlot||blockedDates.has(ds)||beyondHorizon||beforeMinimum;
          const isSel=selected===ds, isToday=dt.toDateString()===today.toDateString();
          // Visual: disabled days fade significantly so the available
          // days clearly stand out. Excluded days (service not offered
          // that day-of-week) get extra subtle treatment with a strike-
          // through line so the reason is obvious.
          return <button key={i} disabled={disabled} onClick={()=>onSelect(ds)}
            style={{
              padding:'9px 2px',
              borderRadius:8,
              border:`1.5px solid ${isSel?C.forest:isToday?C.sage:'transparent'}`,
              background:isSel?C.forest:'transparent',
              color: isSel ? C.white
                : disabled ? '#C7CACF'
                : isToday ? C.forest
                : C.dark,
              opacity: disabled ? 0.55 : 1,
              fontSize:13,
              fontWeight:isSel||isToday?700:400,
              cursor:disabled?'not-allowed':'pointer',
              textDecoration: dowExcluded ? 'line-through' : 'none',
              transition:'all 0.1s',
            }}>
            {d}
          </button>;
        })}
      </div>
      {/* Service-day helper note (only when the service has a partial
          schedule, e.g. Hot Stone Tue/Thu only). Tells the client which
          days the selected service is offered, so greyed-out days on
          the calendar make sense. */}
      {isPartialSchedule && service && (
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          background: '#F0FDF4',
          border: '1px solid #C9DCC2',
          borderRadius: 8,
          fontSize: 11,
          color: '#2A5741',
          lineHeight: 1.5,
        }}>
          <strong>{service.name}</strong> is offered on {offeredLabel} only.
        </div>
      )}
    </div>
  );
}

// Stripe Payment Element on the connected account. Modern unified element
// that handles cards plus every payment method enabled at the platform
// level: Apple Pay, Google Pay, Cash App Pay, Link, Amazon Pay, Klarna,
// Pix, and so on. The element auto-surfaces methods that work for the
// visitor's device and region; methods not available silently disappear.
//
// Migration history:
//   v1 (April 2026): legacy Card Element only (cards only)
//   v2 (May 7 2026 evening): Card Element with Payment Request Button
//                            bolted on top for wallets. SHORTCUT, removed.
//   v3 (May 7 2026 night, this version): unified Payment Element. The
//      right way. Single mounted element, single confirmPayment call,
//      automatic support for any new method Stripe enables at the
//      platform level without any code change here.
//
// Implementation notes:
//   - elements() is initialized with clientSecret so the Payment Element
//     can fetch the intent's enabled methods and configure itself.
//   - confirmPayment (NOT confirmCardPayment) is the modern API. It
//     handles the entire submission flow including 3DS and redirect-
//     based methods.
//   - return_url is required for redirect methods (Klarna, BLIK, some
//     bank methods). We point it back at the booking page with a query
//     flag so the page knows to re-check the booking status on return.
//   - The element handles its own loading and ready states. Our outer
//     UI just shows a spinner until the elements report ready.
function StripePaymentForm({ clientSecret, depositAmount, stripeAccountId, therapistName, bookingId, onSuccess, onError }) {
  const containerRef = useRef(null);
  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const paymentElementRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!clientSecret || !containerRef.current) return;
    let alive = true;

    const init = async () => {
      // Load Stripe.js v3 if not already loaded
      if (!window.Stripe) {
        await new Promise(resolve => {
          const s = document.createElement('script');
          s.src = 'https://js.stripe.com/v3/';
          s.onload = resolve;
          document.head.appendChild(s);
        });
      }
      if (!alive || !containerRef.current) return;

      // Initialize Stripe with the connected account so the Payment
      // Element fetches the intent (created on the connected account)
      // correctly and any wallet payments confirm against the right
      // merchant identity.
      stripeRef.current = window.Stripe(
        getStripePublishableKey(),
        stripeAccountId ? { stripeAccount: stripeAccountId } : {}
      );

      // The Elements instance MUST be created with clientSecret for
      // the Payment Element to know which intent it is collecting for.
      // appearance applies to all sub-elements consistently.
      elementsRef.current = stripeRef.current.elements({
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#2A5741',
            colorBackground: '#FAFAFA',
            colorText: '#1A1A2E',
            colorDanger: '#EF4444',
            fontFamily: 'system-ui, sans-serif',
            fontSizeBase: '16px',
            borderRadius: '10px',
          },
        },
      });

      // The Payment Element is the unified card + wallet + alternative
      // method UI. layout: 'tabs' shows methods as tabs at the top with
      // wallets prominent. layout: 'accordion' is more compact. We use
      // 'tabs' on this booking page because the wallet-prominent layout
      // matches the payment-evolution mockup direction.
      paymentElementRef.current = elementsRef.current.create('payment', {
        layout: { type: 'tabs', defaultCollapsed: false },
        wallets: {
          applePay: 'auto',
          googlePay: 'auto',
        },
        // Reduce defaultValues friction; the booking page already
        // collected name, email, phone in step 1.
        defaultValues: {
          billingDetails: {
            // Leave empty; Stripe will collect what it needs per method.
          },
        },
      });

      paymentElementRef.current.on('ready', () => {
        if (alive) setReady(true);
      });
      paymentElementRef.current.mount(containerRef.current);
    };

    init();
    return () => {
      alive = false;
      try { if (paymentElementRef.current) paymentElementRef.current.destroy(); } catch(e) {}
    };
  }, []);

  const pay = async () => {
    if (!stripeRef.current || !elementsRef.current) return;
    setProcessing(true);

    // confirmPayment is the modern unified submit for Payment Element.
    // For redirect-based methods (Klarna, etc) Stripe will redirect the
    // browser to the bank/method; for card and wallet methods that do
    // not redirect, control returns here with paymentIntent in result.
    // return_url is required even for non-redirect methods because
    // Stripe defaults to redirect mode unless we set redirect: 'if_required'.
    // return_url is required for redirect methods. We embed the
    // booking_id so the booking page can resume confirmation after
    // a redirect-based method (Klarna, etc) sends the visitor back.
    // For non-redirect methods (cards, Apple Pay, Google Pay, Link),
    // redirect: 'if_required' means we never actually navigate.
    const returnUrl = `${window.location.origin}${window.location.pathname}?deposit_return=1${bookingId ? `&booking_id=${bookingId}` : ''}`;

    const { error, paymentIntent } = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    });

    if (error) {
      // error.type is 'card_error' or 'validation_error' for showable
      // problems. Other errors (network, unexpected) we surface as-is.
      onError(error.message || 'Payment failed. Please try again.');
      setProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      onSuccess();
    } else if (paymentIntent?.status === 'processing') {
      // Some methods (Cash App Pay, certain bank flows) report processing
      // and confirm asynchronously via webhook. Treat as success for the
      // booking flow; the webhook will mark the deposit paid.
      onSuccess();
    } else {
      onError(`Unexpected payment status: ${paymentIntent?.status || 'unknown'}`);
    }
    setProcessing(false);
  };

  return (
    <div>
      <div style={{
        background: C.white,
        borderRadius: 14,
        padding: '20px',
        marginBottom: 14,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: C.gray,
          marginBottom: 12,
        }}>
          PAYMENT
        </div>
        <div ref={containerRef} style={{ minHeight: 80 }} />
        {!ready && (
          <div style={{
            textAlign: 'center',
            padding: '20px 0 4px',
            color: C.gray,
            fontSize: 13,
          }}>
            Loading payment options…
          </div>
        )}
      </div>
      <button
        onClick={pay}
        disabled={!ready || processing}
        style={{
          width: '100%',
          background: !ready || processing ? C.sage : C.forest,
          color: C.white,
          border: 'none',
          borderRadius: 14,
          padding: '17px',
          fontSize: 16,
          fontWeight: 700,
          cursor: !ready || processing ? 'default' : 'pointer',
          transition: 'background 0.2s',
          boxShadow: '0 4px 20px rgba(42,87,65,0.25)',
        }}
      >
        {processing ? 'Processing…' : ready ? `Pay $${(depositAmount/100).toFixed(2)}` : 'Loading…'}
      </button>
      <p style={{
        fontSize: 11,
        color: C.gray,
        textAlign: 'center',
        marginTop: 10,
      }}>
        🔒 Secured by Stripe. Card details never stored by us.
        {therapistName ? ` Paying ${therapistName}.` : ''}
      </p>
    </div>
  );
}

// Stripe Card Element for SAVING a card on file (no charge now). Uses
// confirmCardSetup against a SetupIntent client_secret. Used by the
// cancellation policy flow when a therapist requires a card on file
// at booking time. The card is later charged off_session if a
// cancellation/reschedule/no-show triggers a fee.
function StripeCardSetupForm({ clientSecret, stripeAccountId, mandateAgreed, onSuccess, onError }) {
  const divRef = useRef(null);
  const stripeRef = useRef(null);
  const cardRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!clientSecret || !divRef.current) return;
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
      if (!alive || !divRef.current) return;

      stripeRef.current = window.Stripe(
        getStripePublishableKey(),
        stripeAccountId ? { stripeAccount: stripeAccountId } : {}
      );
      const elements = stripeRef.current.elements();
      cardRef.current = elements.create('card', {
        style: {
          base: {
            fontSize: '16px',
            fontFamily: 'system-ui, sans-serif',
            color: '#1A1A2E',
            '::placeholder': { color: '#9CA3AF' },
          },
          invalid: { color: '#EF4444' },
        },
      });
      cardRef.current.on('ready', () => { if (alive) setReady(true); });
      cardRef.current.mount(divRef.current);
    };

    init();
    return () => {
      alive = false;
      try { if (cardRef.current) cardRef.current.destroy(); } catch(e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!stripeRef.current || !cardRef.current) return;
    if (!mandateAgreed) {
      onError('Please confirm you agree to the policy above before saving your card.');
      return;
    }
    setProcessing(true);
    const { error, setupIntent } = await stripeRef.current.confirmCardSetup(clientSecret, {
      payment_method: { card: cardRef.current },
    });
    if (error) {
      onError(error.message);
      setProcessing(false);
      return;
    }
    if (setupIntent?.status === 'succeeded') {
      onSuccess({ payment_method_id: setupIntent.payment_method });
    } else {
      onError('Card setup did not complete. Please try again.');
    }
    setProcessing(false);
  };

  return (
    <div>
      <div style={{background:C.white,borderRadius:14,padding:'20px',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
        <div style={{fontSize:12,fontWeight:700,color:C.gray,marginBottom:12}}>CARD ON FILE</div>
        <div ref={divRef} style={{padding:'14px',border:`1.5px solid ${C.light}`,borderRadius:10,background:'#FAFAFA'}}/>
        {!ready && <div style={{textAlign:'center',padding:'12px 0 4px',color:C.gray,fontSize:13}}>Loading…</div>}
      </div>
      <button onClick={save} disabled={!ready||processing||!mandateAgreed}
        style={{width:'100%',background:!ready||processing||!mandateAgreed?C.sage:C.forest,color:C.white,border:'none',borderRadius:14,padding:'17px',fontSize:16,fontWeight:700,cursor:!ready||processing||!mandateAgreed?'default':'pointer',transition:'background 0.2s',boxShadow:'0 4px 20px rgba(42,87,65,0.25)'}}>
        {processing?'Saving card…':(mandateAgreed?'Save card':'Agree to authorization above to continue')}
      </button>
      <p style={{fontSize:11,color:C.gray,textAlign:'center',marginTop:10}}>🔒 Secured by Stripe. Your card is not charged now. We only charge if the cancellation policy above triggers a fee.</p>
    </div>
  );
}

// Square Web Payments SDK card form. Parallels StripeCardSetupForm
// for therapists who use Square instead of Stripe.
//
// The clientSecret arg here is NOT a Stripe-style client_secret; it
// is a JSON string the SquareV1 strategy returns containing
// applicationId + locationId + customerId. We parse it and use those
// to mount the Square card form. This keeps the BookingPage props
// surface uniform across processors.
//
// Capability note: Square Web Payments SDK has narrower browser
// support than Stripe Elements. Older Safari + some embedded
// webviews can fail to mount. If mount fails, we surface a clear
// error and the therapist can fall back to a different processor.
function SquareCardSetupForm({ clientSecret, mandateAgreed, onSuccess, onError, clientId, customerId, therapistId }) {
  const cardRef = useRef(null);
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [parseError, setParseError] = useState(null);

  // Parse the JSON-encoded identity bundle from the Square strategy.
  // applicationId is Square's OAuth app id, locationId is the
  // therapist's Square location, customerId is the Square Customer
  // we created server-side.
  let parsed = null;
  try {
    parsed = clientSecret ? JSON.parse(clientSecret) : null;
  } catch (e) {
    if (!parseError) setParseError(String(e));
  }

  useEffect(() => {
    if (!parsed?.applicationId || !parsed?.locationId || !containerRef.current) {
      console.log('[SquareCardSetupForm] init skipped:', {
        hasAppId: !!parsed?.applicationId,
        hasLocationId: !!parsed?.locationId,
        hasContainer: !!containerRef.current,
        parsed,
      });
      return;
    }
    let alive = true;

    const init = async () => {
      console.log('[SquareCardSetupForm] init starting', {
        applicationId: parsed.applicationId,
        locationId: parsed.locationId,
        customerId: parsed.customerId,
      });
      // Load Square Web Payments SDK if not already loaded.
      // Sandbox uses sandbox.web.squarecdn.com; production uses
      // web.squarecdn.com. Auto-detect from the application id prefix.
      if (!window.Square) {
        const isSandbox = (parsed.applicationId || '').startsWith('sandbox-');
        const sdkUrl = isSandbox
          ? 'https://sandbox.web.squarecdn.com/v1/square.js'
          : 'https://web.squarecdn.com/v1/square.js';
        console.log('[SquareCardSetupForm] loading SDK from', sdkUrl);
        try {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = sdkUrl;
            s.onload = () => { console.log('[SquareCardSetupForm] SDK script loaded'); resolve(); };
            s.onerror = (err) => { console.error('[SquareCardSetupForm] SDK script load error', err); reject(new Error('Failed to load Square SDK from ' + sdkUrl)); };
            document.head.appendChild(s);
          });
        } catch (e) {
          console.error('[SquareCardSetupForm] SDK load promise rejected', e);
          if (alive) onError(`Could not load Square card form. ${e.message}`);
          return;
        }
      } else {
        console.log('[SquareCardSetupForm] window.Square already loaded, reusing');
      }
      if (!alive) return;
      if (!window.Square) {
        console.error('[SquareCardSetupForm] window.Square is still missing after load');
        onError('Square SDK loaded but window.Square is undefined.');
        return;
      }
      if (!containerRef.current) {
        console.error('[SquareCardSetupForm] container ref is missing after async load');
        return;
      }

      try {
        console.log('[SquareCardSetupForm] calling Square.payments(applicationId, locationId)');
        const payments = window.Square.payments(parsed.applicationId, parsed.locationId);
        console.log('[SquareCardSetupForm] payments instance created, calling .card()');
        const card = await payments.card({
          style: {
            input: {
              fontSize: '16px',
              // Note: fontFamily intentionally NOT set on the Square card
              // form. Square Web Payments SDK rejects generic CSS keywords
              // ('system-ui', 'sans-serif') AND quoted real-font lists with
              // an 'Invalid style value for property fontFamily' error.
              // Tested both patterns against production Square SDK,
              // May 7-8 2026.
              //
              // Square's documented style API has a narrow validation that
              // does not accept arbitrary CSS-style font-family strings.
              // Rather than continue guessing at the accepted format,
              // we let Square use its own default font for the card input.
              // The card form is a small embedded iframe, so the slight
              // typography mismatch with the rest of the page is acceptable
              // and barely noticeable to clients.
              //
              // If we ever want to match the page typography precisely,
              // the right approach is to use Square's customFontUrl support
              // to load a specific webfont and reference it by exact name,
              // rather than a fallback list.
              color: '#1A1A2E',
            },
            '.input-container': {
              borderRadius: '10px',
              borderColor: '#E5E5E5',
            },
          },
        });
        console.log('[SquareCardSetupForm] card created, attaching to container');
        await card.attach(containerRef.current);
        console.log('[SquareCardSetupForm] card attached successfully');
        cardRef.current = card;
        if (alive) setReady(true);
      } catch (e) {
        console.error('[SquareCardSetupForm] mount failed', e);
        // Surface the actual underlying error message instead of a
        // generic 'browser may not be supported' so we can debug.
        const detail = e?.message || e?.toString() || 'unknown error';
        if (alive) onError(`Could not load card form: ${detail}`);
      }
    };

    init();
    return () => {
      alive = false;
      try { if (cardRef.current) cardRef.current.destroy(); } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed?.applicationId, parsed?.locationId]);

  const save = async () => {
    if (!cardRef.current) return;
    if (!mandateAgreed) {
      onError('Please confirm you agree to the policy above before saving your card.');
      return;
    }
    setProcessing(true);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== 'OK') {
        const msg = result.errors?.[0]?.message || 'Card tokenization failed';
        onError(msg);
        setProcessing(false);
        return;
      }
      // Send the token to our save-card edge function, which uses
      // the PaymentProvider abstraction to attach the card to the
      // Square customer.
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/save-card-on-booking-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          therapist_id: therapistId,
          client_id: clientId,
          customer_id: customerId,
          payment_token: result.token,
          processor: 'square',
        }),
      });
      const data = await res.json();
      if (data.error) {
        onError(data.error);
        setProcessing(false);
        return;
      }
      onSuccess({ payment_method_id: data.card_id || data.providerCardId });
    } catch (e) {
      onError(String(e));
    } finally {
      setProcessing(false);
    }
  };

  if (parseError) {
    return (
      <div style={{ padding: 14, background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 10, color: '#991B1B', fontSize: 13 }}>
        Could not initialize Square card form. Please refresh and try again.
      </div>
    );
  }

  return (
    <div>
      <div style={{background:C.white,borderRadius:14,padding:'20px',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
        <div style={{fontSize:12,fontWeight:700,color:C.gray,marginBottom:12}}>CARD ON FILE</div>
        <div ref={containerRef} style={{minHeight:60,padding:'14px',border:`1.5px solid ${C.light}`,borderRadius:10,background:'#FAFAFA'}}/>
        {!ready && <div style={{textAlign:'center',padding:'12px 0 4px',color:C.gray,fontSize:13}}>Loading…</div>}
      </div>
      <button onClick={save} disabled={!ready||processing||!mandateAgreed}
        style={{width:'100%',background:!ready||processing||!mandateAgreed?C.sage:C.forest,color:C.white,border:'none',borderRadius:14,padding:'17px',fontSize:16,fontWeight:700,cursor:!ready||processing||!mandateAgreed?'default':'pointer',transition:'background 0.2s',boxShadow:'0 4px 20px rgba(42,87,65,0.25)'}}>
        {processing?'Saving card…':(mandateAgreed?'Save card':'Agree to authorization above to continue')}
      </button>
      <p style={{fontSize:11,color:C.gray,textAlign:'center',marginTop:10}}>🔒 Secured by Square. Your card is not charged now. We only charge if the cancellation policy above triggers a fee.</p>
    </div>
  );
}

export default function BookingPage() {
  const {slug}=useParams();
  const [therapist,setTherapist]=useState(null);
  const [services,setServices]=useState([]);
  // Available add-ons for this therapist + the set the client has selected.
  // Each entry in availableAddons is a row from service_addons.
  const [availableAddons,setAvailableAddons]=useState([]);
  const [selectedAddonIds,setSelectedAddonIds]=useState([]);
  // Packages and memberships that the therapist has defined and made
  // active. These show up as a horizontal "Offers" section above the
  // service list. Clicking one opens an offer purchase modal where the
  // client enters name + email + (optional) phone, then is sent to
  // hosted Stripe Checkout or Square Payment Link.
  const [packagesList,setPackagesList]=useState([]);
  const [membershipsList,setMembershipsList]=useState([]);
  // Offers section starts collapsed by default. Most clients are
  // booking single sessions, so the package and membership cards
  // should not push the service list below the fold on mobile. The
  // header summarizes what is inside (count + price hint) so therapists
  // who want to highlight the offers can rename their package well
  // and the value still reads at a glance.
  const [offersExpanded,setOffersExpanded]=useState(false);
  const [offerModal,setOfferModal]=useState(null);
  const [offerForm,setOfferForm]=useState({ name: '', email: '', phone: '' });
  const [offerLoading,setOfferLoading]=useState(false);
  const [offerError,setOfferError]=useState(null);
  const [purchaseSuccess,setPurchaseSuccess]=useState(null); // { kind: 'package'|'membership'|'cart', count? }
  // Cart for packages. Memberships are NOT cart-eligible because Stripe
  // Checkout does not allow mixing subscription and one-time line items
  // in one session. Cart stores full package row objects (not just ids)
  // so the cart drawer can render names and prices without re-querying.
  const [cart,setCart]=useState([]);
  const [cartOpen,setCartOpen]=useState(false);
  const [cartCheckoutModal,setCartCheckoutModal]=useState(false);
  const [cartCheckoutLoading,setCartCheckoutLoading]=useState(false);
  const [cartCheckoutError,setCartCheckoutError]=useState(null);
  const [cartFlash,setCartFlash]=useState(null); // brief 'Added to cart' confirmation
  const [availability,setAvailability]=useState([]);
  const [loading,setLoading]=useState(true);
  const [notFound,setNotFound]=useState(false);
  const [step,setStep]=useState(1);
  const [svc,setSvc]=useState(null);
  const [date,setDate]=useState('');
  const [slots,setSlots]=useState([]);
  const [existingBooked,setExistingBooked]=useState([]);
  const [slot,setSlot]=useState(null);
  const [loadingSlots,setLoadingSlots]=useState(false);
  const [form,setForm]=useState(() => {
    // Prefill from URL params after intake-before-booking redirect.
    const sp = new URLSearchParams(window.location.search);
    return {
      name: sp.get('name') || '',
      email: sp.get('email') || '',
      phone: sp.get('phone') || '',
      sms_opted_in: false,
    };
  });
  const [partner,setPartner]=useState({name:'',email:''});
  const [partnerErrors,setPartnerErrors]=useState({});
  const [errors,setErrors]=useState({});
  const [submitting,setSubmitting]=useState(false);

  // Booking-policies gate (Ashley Scalzulli May 2026). When therapist
  // has booking_policies_enabled, client must check this box before
  // the Confirm button fires. Captured into booking row for audit.
  const [bookingPoliciesAgreed, setBookingPoliciesAgreed] = useState(false);

  // Cancellation-policy explicit agreement (HK May 14). Both gates now
  // use the same compact 1-row design with a checkbox on the right and
  // optional expansion to read full text. Required to tick when the
  // cancellation policy is enabled.
  const [cancellationAgreed, setCancellationAgreed] = useState(false);

  // Expanded state for each gate's read-the-text panel. Default both
  // collapsed so the booking page stays compact; client clicks the row
  // header to expand and read before agreeing.
  const [bookingPoliciesExpanded, setBookingPoliciesExpanded] = useState(false);
  const [cancellationExpanded, setCancellationExpanded] = useState(false);
  const [depositRequired,setDepositRequired]=useState(false);
  const [depositAmount,setDepositAmount]=useState(0);
  // Pay-in-full + tips at booking (Lindsey #2, May 10 2026).
  // paymentMode: 'deposit' | 'full'  (only 'full' available if therapist has pay_in_full_enabled)
  // tipCents: tip amount in cents to add to the charge if paying full
  const [paymentMode, setPaymentMode] = useState('deposit');
  const [tipCents, setTipCents] = useState(0);
  const [giftCode,setGiftCode]=useState('');
  const [giftCert,setGiftCert]=useState(null);
  const [giftError,setGiftError]=useState('');
  const [giftChecking,setGiftChecking]=useState(false);
  const [depositClientSecret,setDepositClientSecret]=useState(null);
  const [depositAccountId,setDepositAccountId]=useState(null);
  // PaymentIntent id and resolved client id captured from the
  // create-deposit edge function response. Used by onDepositSuccess
  // to call capture-saved-card after Stripe confirms the charge so
  // the auto-saved card_on_file_id and stripe_customer_id are
  // persisted to the clients row. Without this, returning clients
  // would not see "Welcome back" and therapists would not see card
  // on file indicators.
  const [depositPaymentIntentId,setDepositPaymentIntentId]=useState(null);
  const [depositResolvedClientId,setDepositResolvedClientId]=useState(null);
  const [depositLoading,setDepositLoading]=useState(false);
  const [paymentError,setPaymentError]=useState(null);
  const [isRepeatClient,setIsRepeatClient]=useState(false);
  const [confirmed,setConfirmed]=useState(false);
  const [bookingId,setBookingId]=useState(null);
  const [blockedDates,setBlockedDates]=useState(new Set());
  // Phase 9.1: partial-day blocks keyed by date string. Each value is
  // an array of {start_time, end_time}. Treated as pseudo-bookings
  // when generating bookable slots for that date.
  const [partialBlocksByDate, setPartialBlocksByDate] = useState({});
  // Approval flow: when therapist.require_approval is on AND this is a new
  // client (no prior booking match), the booking is created as
  // 'pending-approval' instead of 'confirmed'. Deposits are skipped at
  // request time, the therapist sends a payment link after approving.
  const [requiresApproval,setRequiresApproval]=useState(false);
  const [pendingApproval,setPendingApproval]=useState(false);

  // Cancellation policy Phase 2: card on file. When the therapist's policy
  // has card_required_first_timers (and this is a new client) OR
  // card_required_regulars (and this is a returning client) on, the
  // client must save a card before they can confirm the booking. The
  // card is captured via a SetupIntent on the therapist's connected
  // Stripe account, then stored as payment_method_id on the clients
  // table. The booking row gets a snapshot of the payment_method_id
  // and customer_id at insert time.
  const [cardOnFileRequired,setCardOnFileRequired]=useState(false);
  const [cardSavedPaymentMethodId,setCardSavedPaymentMethodId]=useState(null);
  const [cardSavedCustomerId,setCardSavedCustomerId]=useState(null);
  const [cardSavedClientId,setCardSavedClientId]=useState(null);
  const [cardSavedLast4,setCardSavedLast4]=useState(null);
  const [cardSavedBrand,setCardSavedBrand]=useState(null);
  const [cardSetupClientSecret,setCardSetupClientSecret]=useState(null);
  const [cardSetupAccountId,setCardSetupAccountId]=useState(null);
  // Which processor handles card-on-file for this booking. Decided
  // when the card setup is initiated (see startCardSetup) based on
  // the therapist's payment_routing + connected processors. Drives
  // which card form renders below: Stripe Elements or Square Web
  // Payments SDK.
  const [cardSetupProcessor,setCardSetupProcessor]=useState(null);
  const [cardCapturing,setCardCapturing]=useState(false);
  const [cardError,setCardError]=useState(null);
  const [cardMandateAgreed,setCardMandateAgreed]=useState(false);

  // Pay-in-full recompute (Lindsey #2). When client switches to
  // 'pay full' or adjusts tip, the actual charge amount changes.
  // depositAmount is the variable we pass to create-deposit /
  // square-create-deposit, so we recompute it here whenever any
  // input changes. When mode is 'deposit' this is the deposit
  // percent of service price; when 'full' this is full price + tip.
  useEffect(() => {
    if (!svc || !therapist) return;
    if (requiresApproval) return; // Approval flow has no charge at booking
    if (paymentMode === 'full') {
      const fullCents = Math.round(svc.price * 100);
      setDepositAmount(fullCents + (tipCents || 0));
    } else if (depositRequired) {
      // Deposit-only: percent of base service price (existing logic)
      const depositCents = Math.round((svc.price * (therapist.deposit_percent || 20) / 100) * 100);
      setDepositAmount(depositCents);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMode, tipCents, svc?.price, therapist?.deposit_percent, depositRequired, requiresApproval]);

  // Allow forcing a hard service-worker reset via ?fresh=1 in the URL.
  // For therapists who installed the PWA at v3 and are stuck seeing
  // stale content even after deploys: visit /yourSlug?fresh=1 once and
  // the page unregisters the existing SW, clears caches, and reloads.
  // After one round-trip the new v4 SW takes over.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('fresh') === '1' && 'serviceWorker' in navigator) {
      (async () => {
        console.log('[MyBodyMap] ?fresh=1 detected - resetting service worker + caches');
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) await reg.unregister();
          if ('caches' in window) {
            const keys = await caches.keys();
            for (const k of keys) await caches.delete(k);
          }
        } catch (e) { console.warn('[MyBodyMap] sw reset failed', e); }
        // Strip fresh param and hard-reload
        const url = new URL(window.location.href);
        url.searchParams.delete('fresh');
        window.location.replace(url.toString());
      })();
    }
  }, []);

  useEffect(()=>{load();},[slug]);

  // Redirect handlers for payment flows. Three distinct return paths:
  //
  //   1) Square deposit: ?deposit_complete=1&booking_id=...
  //      Marks booking confirmed + deposit_paid. DB trigger fires the
  //      confirmation email automatically when status flips.
  //
  //   2) Package purchase: ?purchase_complete=1&processor=stripe|square
  //      &session_id=... (stripe) OR &package_id=...&order_id=... (square,
  //      we receive the order id back via Square's redirect).
  //      Calls confirm-package-purchase to verify with the processor and
  //      create the package_purchases row.
  //
  //   3) Membership purchase: ?membership_complete=1&processor=stripe
  //      &session_id=...
  //      Calls confirm-membership-purchase to verify and create the
  //      member_subscriptions row + grant first month's credits.
  //
  // Each branch cleans the URL via replaceState so a refresh does not
  // re-run the verification.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // ----- Branch 0: Stripe Payment Element redirect return -----
    // Triggered when a redirect-based method (Klarna, certain bank
    // methods) sends the visitor back. URL contains:
    //   ?deposit_return=1&booking_id=<id>&payment_intent=pi_xxx
    //   &payment_intent_client_secret=...&redirect_status=succeeded
    // We trust redirect_status from Stripe and confirm the booking on
    // success. For non-redirect methods (cards, wallets, Link), this
    // branch never fires because confirmPayment returns inline.
    if (params.get('deposit_return') === '1') {
      const bid = params.get('booking_id');
      const status = params.get('redirect_status');
      if (bid && status === 'succeeded') {
        (async () => {
          await supabase.from('bookings').update({
            status: 'confirmed',
            deposit_paid: true,
          }).eq('id', bid);
          fireBookingConfirmation(bid);
          setConfirmed(true);
          setBookingId(bid);
          window.history.replaceState({}, '', window.location.pathname);
        })();
      } else if (bid && status === 'failed') {
        // Redirect method failed (Klarna declined, bank flow cancelled).
        // Surface a friendly error rather than confirming the booking.
        // The therapist sees the booking still in pending_deposit state.
        setPaymentError && setPaymentError('Payment was not completed. You can try a different method below.');
        window.history.replaceState({}, '', window.location.pathname + window.location.search.replace(/[?&]deposit_return=[^&]*/, '').replace(/[?&]redirect_status=[^&]*/, '').replace(/[?&]payment_intent[^=]*=[^&]*/g, ''));
      }
      return;
    }

    // ----- Branch 1: Square deposit return -----
    if (params.get('deposit_complete') === '1') {
      const bid = params.get('booking_id');
      if (bid) {
        (async () => {
          await supabase.from('bookings').update({
            status: 'confirmed',
            deposit_paid: true,
            square_deposit_paid_at: new Date().toISOString(),
          }).eq('id', bid);
          setConfirmed(true);
          setBookingId(bid);
          window.history.replaceState({}, '', window.location.pathname);
        })();
      }
      return;
    }

    // ----- Branch 2: Package purchase return -----
    // Frontend now embeds purchase_complete=1 directly in redirect_url
    // so both Stripe and Square round-trip it cleanly. session_id
    // (Stripe) or order_id (Square) arrives alongside.
    if (params.get('purchase_complete') === '1') {
      const processor = params.get('processor');
      const sessionId = params.get('session_id');
      const orderId = params.get('order_id') || params.get('reference_id');
      const pkgId = params.get('package_id');
      (async () => {
        const res = await fetch(
          `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/confirm-package-purchase`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              processor,
              session_id: sessionId,
              order_id: orderId,
              package_id: pkgId,
              therapist_id: null,
            }),
          }
        );
        const data = res.ok ? await res.json() : await res.json().catch(() => ({}));
        if (data.ok) {
          setPurchaseSuccess({ kind: 'package' });
        }
        window.history.replaceState({}, '', window.location.pathname);
      })();
      return;
    }

    // ----- Branch 3: Membership purchase return -----
    // Frontend embeds membership_complete=1 directly in redirect_url so
    // both Stripe and Square round-trip it. Square's createSubscription
    // also appends mode=subscription + plan_variation_id + customer_id
    // + start_date which the confirm endpoint uses to set up the
    // subscription server-side.
    if (params.get('membership_complete') === '1') {
      const processor = params.get('processor') || 'stripe';
      const sessionId = params.get('session_id');
      const orderId = params.get('order_id') || params.get('reference_id');
      const planVariationId = params.get('plan_variation_id');
      const customerId = params.get('customer_id');
      const startDate = params.get('start_date');
      (async () => {
        const res = await fetch(
          `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/confirm-membership-purchase`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              processor,
              session_id: sessionId,
              order_id: orderId,
              plan_variation_id: planVariationId,
              customer_id: customerId,
              start_date: startDate,
              membership_id: params.get('membership_id'),
              therapist_id: null,
            }),
          }
        );
        const data = res.ok ? await res.json() : await res.json().catch(() => ({}));
        if (data.ok) {
          setPurchaseSuccess({ kind: 'membership', processor: data.processor });
        }
        window.history.replaceState({}, '', window.location.pathname);
      })();
      return;
    }

    // ----- Branch 4: Cart (multi-package) purchase return -----
    // Comes back from Stripe Checkout (mode=payment, multi-line) or
    // Square Order checkout link. confirm-cart-purchase verifies the
    // payment, then creates one package_purchases row per line item
    // and returns the count.
    if (params.get('cart_complete') === '1') {
      const processor = params.get('processor');
      const sessionId = params.get('session_id');
      const orderId = params.get('order_id') || params.get('reference_id');
      (async () => {
        // We need therapist_id for the confirm function. The slug
        // determines therapist client-side, so we resolve it via the
        // load() call that runs in parallel. If load() has not finished
        // yet (race), we read therapist directly here.
        let tid = null;
        try {
          const { data: t } = await supabase.from('therapists').select('id').eq('custom_url', slug).single();
          tid = t?.id || null;
        } catch (e) {}
        const res = await fetch(
          `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/confirm-cart-purchase`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              processor,
              session_id: sessionId,
              order_id: orderId,
              therapist_id: tid,
            }),
          }
        );
        const data = res.ok ? await res.json() : await res.json().catch(() => ({}));
        if (data.ok) {
          setPurchaseSuccess({ kind: 'cart', count: data.purchases?.length || 0 });
          setCart([]); // clear cart after successful checkout
        }
        window.history.replaceState({}, '', window.location.pathname);
      })();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Compute effective service duration including any selected add-ons.
  // Recalculated whenever the selection changes.
  const effectiveDuration = svc
    ? svc.duration + selectedAddonIds.reduce((sum,id)=>sum+(availableAddons.find(a=>a.id===id)?.extra_minutes||0), 0)
    : 0;

  useEffect(()=>{if(date&&svc)loadSlots();},[date,svc,effectiveDuration]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const {data:t}=await supabase.from('therapists').select('*,deposit_enabled,deposit_percent').eq('custom_url',slug).single();
    if(!t){setNotFound(true);setLoading(false);return;}
    setTherapist(t);

    // ─── INTAKE SCHEMA DIAGNOSTIC LOGGING ───
    // Surfaces exactly what was loaded for this therapist's intake_schema.
    // Lets HK (or any therapist) open DevTools console on phone or web,
    // reload the booking page, and see whether the schema being applied
    // matches their editor edits. Eliminates the guessing game when a
    // therapist reports 'my edits aren't showing'.
    //
    // What to look for:
    //   - 'intake_schema is NULL' → editor never wrote anything, save path
    //     broken on the editor side (or therapist edited a different
    //     account than the one whose URL this is)
    //   - 'fields: [...]' with custom labels matching what you set → schema
    //     IS reaching the booking page; if it still doesn't render, the
    //     issue is the SchemaField render or service worker cache
    //   - schema present but with default labels → the schema you saved
    //     was the default, not what you intended to save
    try {
      const schema = t.intake_schema;
      const summary = !schema ? 'NULL (no custom edits saved)' :
        `fields=${(schema.fields || []).length}, ` +
        `medical_checklist=${schema.medical_checklist_enabled !== false}, ` +
        `hipaa=${!!schema.hipaa_mode}, ` +
        `version=${schema.version || 'unset'}`;
      console.log(
        `%c[MyBodyMap] Loaded therapist ${t.custom_url} (${t.business_name || t.full_name})`,
        'color: #2A5741; font-weight: bold;'
      );
      console.log(`[MyBodyMap]   intake_schema: ${summary}`);
      if (schema && schema.fields) {
        console.log('[MyBodyMap]   field labels:', schema.fields.map((f) => `${f.id}=${JSON.stringify(f.label)}${f.hidden ? ' [HIDDEN]' : ''}`).join(', '));
        // If pressure has been customized, log the option set so we can
        // confirm whether chips or slider should render.
        const pressure = schema.fields.find((f) => f.id === 'pressure');
        if (pressure?.options) {
          console.log('[MyBodyMap]   pressure options:', pressure.options.map((o) => o.v).join(', '));
        }
      }
    } catch (e) {
      console.warn('[MyBodyMap] schema log failed', e);
    }

    const [{data:s},{data:a},{data:bd},{data:addons},pkgRes,memRes]=await Promise.all([
      supabase.from('services').select('*').eq('therapist_id',t.id).eq('active',true).is('archived_at', null).neq('visibility','private').order('price'),
      supabase.from('availability').select('*').eq('therapist_id',t.id).eq('active',true),
      // Phase 9.1 (May 16 2026): fetch start_time and end_time so we
      // can support partial-day blocks. Rows with both NULL are
      // full-day blocks and land in blockedDates Set (today's
      // behavior). Rows with both set are partial blocks and feed
      // a separate map keyed by date.
      supabase.from('blocked_days').select('date, start_time, end_time').eq('therapist_id',t.id),
      // Service add-ons. May fail silently with empty array if the schema
      // has not been applied yet — that is intentional, the booking flow
      // continues to work without add-ons.
      supabase.from('service_addons').select('*').eq('therapist_id',t.id).eq('active',true).order('display_order').order('created_at'),
      // Packages and memberships. Same fault-tolerance: empty array if
      // tables not yet present, public-readable per RLS policy on
      // active=true rows.
      supabase.from('packages').select('*').eq('therapist_id',t.id).eq('active',true).order('display_order').order('created_at'),
      supabase.from('memberships').select('*').eq('therapist_id',t.id).eq('active',true).order('display_order').order('created_at'),
    ]);
    setServices(s||[]);
    setAvailability(a||[]);
    // Split blocked_days into full-day (no times) and partial (both
    // times set). Full-day continues to drive the calendar's disabled-
    // date logic. Partial gets bucketed by date and turned into
    // pseudo-bookings in the slot-generation step below so those
    // hours simply don't show up as bookable.
    const fullDayBlocks = [];
    const partialByDate = {};
    for (const b of (bd || [])) {
      if (b.start_time && b.end_time) {
        if (!partialByDate[b.date]) partialByDate[b.date] = [];
        partialByDate[b.date].push({ start_time: b.start_time.slice(0,5), end_time: b.end_time.slice(0,5) });
      } else {
        fullDayBlocks.push(b.date);
      }
    }
    setBlockedDates(new Set(fullDayBlocks));
    setPartialBlocksByDate(partialByDate);
    setAvailableAddons(addons||[]);
    setPackagesList(pkgRes?.data || []);
    // Memberships render for therapists with EITHER processor connected.
    // Stripe is fully supported. Square is supported for the first month
    // checkout flow with a documented limitation: recurring monthly
    // renewal requires manual follow-up by the therapist (see capability
    // matrix and billing strategy doc). The hide-when-no-processor rule
    // remains so clients do not click into a broken state when the
    // therapist has no processor at all.
    const therapistHasAnyProcessor = !!(t.stripe_account_id || t.square_access_token);
    setMembershipsList(therapistHasAnyProcessor ? (memRes?.data || []) : []);
    setLoading(false);
  }

  async function loadSlots() {
    setLoadingSlots(true); setSlots([]); setSlot(null);
    const dow=new Date(date+'T12:00:00').getDay();
    // Per-service availability (Lindsey #4, May 10 2026).
    // Three-step lookup:
    //   1. If this service has ANY service-specific availability rows
    //      (any day with service_id == svc.id), that means the service
    //      has its own schedule. Use the row matching this day if any;
    //      if none exists for this day, the service is closed today.
    //   2. Otherwise (no service-specific rows at all), fall back to
    //      the master schedule (service_id IS NULL).
    // Existing therapists are unaffected: all their existing rows have
    // service_id NULL and behave as the master schedule for every
    // service.
    const serviceSpecificRows = availability.filter(a => a.service_id === svc.id);
    const hasServiceSchedule = serviceSpecificRows.length > 0;
    let av;
    if (hasServiceSchedule) {
      av = serviceSpecificRows.find(a => a.day_of_week === dow);
    } else {
      av = availability.find(a => a.day_of_week === dow && !a.service_id);
    }
    if(!av){setLoadingSlots(false);return;}
    const {data:existing}=await supabase.from('bookings').select('start_time,end_time').eq('therapist_id',therapist.id).eq('booking_date',date).neq('status','cancelled');

    // Reverse-sync block (Lindsey #10): also pull confirmed external
    // calendar events (Google personal events: lunch, dentist, etc)
    // so they block booking slots. Anonymous clients call the
    // get_blocked_ranges RPC which returns ONLY start/end times,
    // never event titles. The therapist sees titles on her own
    // dashboard via direct table read with RLS.
    const dateStart = new Date(`${date}T00:00:00`);
    const dateEnd = new Date(`${date}T23:59:59`);
    const { data: externalRanges } = await supabase.rpc('get_blocked_ranges', {
      p_therapist_id: therapist.id,
      p_from: dateStart.toISOString(),
      p_to: dateEnd.toISOString(),
    });
    // Convert each range to {start_time: 'HH:MM', end_time: 'HH:MM'}
    // local-time strings to match the booking shape generateSlots expects.
    const externalBlocked = (externalRanges || []).map(r => {
      const s = new Date(r.start_at);
      const e = new Date(r.end_at);
      const fmt = (d) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      // Clamp to the date in question so all-day events become 00:00-23:59 etc.
      const sameDay = (a, b) => a.toDateString() === b.toDateString();
      const dt = new Date(`${date}T12:00:00`);
      const startStr = sameDay(s, dt) ? fmt(s) : '00:00';
      const endStr = sameDay(e, dt) ? fmt(e) : '23:59';
      return { start_time: startStr, end_time: endStr };
    });
    // Phase 9.1: partial-day blocks the therapist set up in Schedule.
    // Same shape as externalBlocked: each becomes a pseudo-booking that
    // generateSlots treats as occupied, so no bookable slot lands
    // inside the blocked window.
    const partialBlocks = (partialBlocksByDate[date] || []).map(b => ({
      start_time: b.start_time,
      end_time: b.end_time,
    }));
    const booked=[...(existing||[]), ...externalBlocked, ...partialBlocks];
    setExistingBooked(booked);

    // Use time_blocks if available, else fall back to start/end
    const blocks = (av.time_blocks && av.time_blocks.length > 0)
      ? av.time_blocks
      : [{ start: (av.start_time||'09:00').slice(0,5), end: (av.end_time||'17:00').slice(0,5) }];

    let raw = [];
    for (const block of blocks) {
      const blockSlots = generateSlots(block.start, block.end, effectiveDuration, booked, therapist.buffer_enabled ? (therapist.buffer_minutes || 15) : 0);
      raw = [...raw, ...blockSlots];
    }

    // Apply booking lead-time minimum (Lindsey #5, May 9, 2026).
    // Therapist sets minimum_advance_hours in Settings; clients
    // cannot book slots closer than that to "now". Default 0 = no
    // restriction, behaves like the old 30-min today-only filter.
    //
    // Inclusive at the boundary: if minimum is 24h and now is 9 AM,
    // tomorrow's 9 AM slot is bookable but tomorrow's 8:59 AM is not.
    const minLeadHours = Number(therapist.minimum_advance_hours) || 0;
    const maxLeadDays = Number(therapist.maximum_advance_days) || 0; // 0 = no max
    const now = new Date();
    const earliestAllowed = new Date(now.getTime() + minLeadHours * 60 * 60 * 1000);
    const latestAllowed = maxLeadDays > 0
      ? new Date(now.getTime() + maxLeadDays * 24 * 60 * 60 * 1000)
      : null;

    raw = raw.filter(s => {
      // Compose the slot's actual datetime by combining the date being
      // viewed (`date` is YYYY-MM-DD string) with slot's HH:MM start.
      const [yy, mm, dd] = date.split('-').map(Number);
      const slotDateTime = new Date(yy, mm - 1, dd,
        Math.floor(s.minutes / 60),
        s.minutes % 60);
      if (slotDateTime < earliestAllowed) return false;
      if (latestAllowed && slotDateTime > latestAllowed) return false;
      return true;
    });

    // Efficient scheduling (Lindsey #7, May 10 2026).
    //
    // When a therapist enables 'efficient' mode, slots are clustered
    // around existing bookings. Two strictness levels:
    //
    //   hard: only offer slots that are immediately adjacent to an
    //         existing booking (start time = some booking's end +
    //         buffer, OR end time = some booking's start - buffer)
    //         OR that are at the very start/end of the working block.
    //         Other slots are filtered out entirely.
    //
    //   soft: keep all slots, but the existing scoreSlots adjacency
    //         boost is amplified so adjacent slots rank visibly higher.
    //         Implemented inside scoreSlots; nothing to do here.
    //
    // Hard mode only applies if there is at least one booking on the
    // day. An empty day has no anchor edges, so we offer all slots
    // (otherwise the client could never book the first appointment
    // of a day).
    const schedulingMode = therapist.scheduling_mode || 'normal';
    const efficientStrictness = therapist.efficient_strictness || 'soft';
    if (schedulingMode === 'efficient' && efficientStrictness === 'hard' && booked.length > 0) {
      const buffer = therapist.buffer_enabled ? (therapist.buffer_minutes || 15) : 0;
      // Compute set of anchor minutes-of-day from existing bookings:
      // each booking contributes its start (an anchor for slots ending
      // there minus buffer) and its end (an anchor for slots starting
      // there plus buffer).
      const ANCHOR_TOLERANCE = 5; // accept slot starts/ends within 5 min of anchor
      const startAnchors = []; // booking.start_time in minutes
      const endAnchors   = []; // booking.end_time in minutes
      for (const b of booked) {
        if (b.start_time) {
          const [h, m] = b.start_time.split(':').map(Number);
          startAnchors.push(h * 60 + m);
        }
        if (b.end_time) {
          const [h, m] = b.end_time.split(':').map(Number);
          endAnchors.push(h * 60 + m);
        }
      }
      // Block edges: the working day's first slot start and last slot
      // end are also valid (so therapists can still take the first
      // morning or last evening appointment of the day).
      const allMinutes = raw.map(s => s.minutes).sort((a,b) => a - b);
      const blockStart = allMinutes[0];
      const blockEnd   = allMinutes.length > 0 ? allMinutes[allMinutes.length - 1] + effectiveDuration : null;

      raw = raw.filter(s => {
        const slotEnd = s.minutes + effectiveDuration;
        // Adjacent to a booking's end (= slot start fits right after, including buffer)
        const fitsAfter = endAnchors.some(e => Math.abs((e + buffer) - s.minutes) <= ANCHOR_TOLERANCE);
        // Adjacent to a booking's start (= slot end fits right before, including buffer)
        const fitsBefore = startAnchors.some(a => Math.abs(a - (slotEnd + buffer)) <= ANCHOR_TOLERANCE);
        // At the working block's edges
        const atBlockStart = s.minutes === blockStart;
        const atBlockEnd = blockEnd !== null && slotEnd === blockEnd;
        return fitsAfter || fitsBefore || atBlockStart || atBlockEnd;
      });
    }

    setSlots(scoreSlots(raw, booked, effectiveDuration, schedulingMode, efficientStrictness));
    setLoadingSlots(false);
  }

  // Cancellation policy Phase 2: kicks off the card-on-file capture flow.
  // Calls the unified init-card-setup endpoint which routes to whichever
  // processor the therapist uses (Stripe or Square) per their
  // payment_routing settings, and returns the right shape for either
  // Stripe Elements or Square Web Payments SDK.
  async function initCardSetup() {
    const hasStripe = !!therapist?.stripe_account_id;
    const hasSquare = !!therapist?.square_access_token;
    if (!hasStripe && !hasSquare) {
      setCardError('This therapist has not connected a payment processor yet, so a card on file cannot be saved. Please contact them directly.');
      return;
    }
    if (!cardMandateAgreed) {
      setCardError('Please confirm you agree to the policy and authorization above.');
      return;
    }
    setCardCapturing(true);
    setCardError(null);
    try {
      const res = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/init-card-setup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
            'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            therapist_id: therapist.id,
            client_name: form.name.trim(),
            client_email: form.email.trim().toLowerCase(),
            client_phone: form.phone,
            mandate_text: cardMandateText(),
            // Frontend can pass preferred_processor to override the
            // auto-pick (e.g. if the therapist UI later lets clients
            // pick). Today we don't pass it, so the edge function
            // uses payment_routing or auto-picks.
          }),
        }
      );
      const data = res.ok ? await res.json() : await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setCardError(data.error || `HTTP ${res.status}`);
        setCardCapturing(false);
        return;
      }
      setCardSetupClientSecret(data.client_secret);
      setCardSetupAccountId(data.account_id);
      setCardSetupProcessor(data.processor);
      setCardSavedCustomerId(data.customer_id);
      setCardSavedClientId(data.client_id);
      // If capability is 'limited', surface a soft warning under the
      // card form so the client knows what they're signing up for.
      if (data.capability?.status === 'limited' && data.capability.limitations?.length) {
        console.log('[card-setup] limited capability:', data.capability.limitations);
      }
    } catch (e) {
      setCardError(String(e));
    }
    setCardCapturing(false);
  }

  // The mandate text is what the client agrees to when checking the box.
  // Captured at agreement time and snapshotted on the clients record
  // (card_mandate_text + card_mandate_agreed_at + card_mandate_ip_hash).
  // Plain English on purpose, the policy details are above this in the
  // UI so we do not repeat numbers here, just the authorization frame.
  function cardMandateText() {
    const therapistName = therapist?.business_name || therapist?.full_name || 'the therapist';
    return [
      `By saving my card and confirming this booking, I authorize ${therapistName} to charge this card per the cancellation policy shown above if I cancel late, reschedule late, or do not show up to my appointment.`,
      ``,
      `My card is not charged at booking. It is only charged if the policy triggers a fee.`,
      ``,
      `I can update or remove my card on file by contacting ${therapistName} directly.`,
    ].join('\n');
  }

  function onCardSaveSuccess({ payment_method_id }) {
    setCardSavedPaymentMethodId(payment_method_id);
    setCardSetupClientSecret(null); // clear so the form unmounts
    setCardError(null);
    // Persist the payment_method_id on the clients record. The edge
    // function already created the Stripe Customer and recorded the
    // mandate; this last step links the actual saved card back to the
    // client row so future bookings recognize them as a returning
    // client with a card already on file.
    if (cardSavedClientId) {
      supabase.from('clients').update({
        payment_method_id,
        card_saved_at: new Date().toISOString(),
      }).eq('id', cardSavedClientId).then(() => {});
    }
  }

  // Open the offer purchase modal. Pre-fills the form with whatever
  // we already know about the client (from URL params or prior step
  // data) so they do not have to retype.
  function openOffer(type, item) {
    setOfferModal({ type, item });
    setOfferForm({
      name: form.name || '',
      email: form.email || '',
      phone: form.phone || '',
    });
    setOfferError(null);
  }

  // Send the client to Stripe Checkout / Square Payment Link for the
  // selected package or membership. The redirect URL comes back to
  // this same page with ?purchase_complete=1 (or membership_complete=1)
  // and the redirect handler verifies + grants credits.
  async function buyOffer() {
    if (!offerModal) return;
    if (!offerForm.name.trim() || !offerForm.email.trim()) {
      setOfferError('Please enter your name and email.');
      return;
    }
    setOfferLoading(true);
    setOfferError(null);

    const isPackage = offerModal.type === 'package';
    const fnName = isPackage ? 'purchase-package' : 'purchase-membership';
    const redirectBase = `${window.location.origin}/${therapist.custom_url}?_=${Date.now()}`;
    const idKey = isPackage ? 'package_id' : 'membership_id';
    // Embed the purchase-kind trigger in the redirect_url so both
    // Stripe and Square preserve it through their respective checkout
    // appends. Stripe appends ?session_id=...; Square appends
    // &checkout_complete=1&processor=square. Either way, the trigger
    // we control (purchase_complete or membership_complete) survives
    // the round-trip.
    const triggerParam = isPackage ? 'purchase_complete=1' : 'membership_complete=1';
    const redirectUrl = `${redirectBase}&${triggerParam}&${idKey}=${offerModal.item.id}`;

    try {
      const res = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/${fnName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            therapist_id: therapist.id,
            [idKey]: offerModal.item.id,
            client_name: offerForm.name.trim(),
            client_email: offerForm.email.trim().toLowerCase(),
            client_phone: offerForm.phone.trim() || null,
            redirect_url: redirectUrl,
          }),
        }
      );
      const data = res.ok ? await res.json() : await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setOfferError(data.error || `Could not open checkout (HTTP ${res.status}).`);
    } catch (e) {
      setOfferError(String(e));
    }
    setOfferLoading(false);
  }

  // ─────────────────────────────────────────────────────────────────
  // Cart for packages
  // ─────────────────────────────────────────────────────────────────
  // Memberships are NOT cart-eligible: Stripe Checkout cannot mix
  // subscription and one-time line items. Memberships keep their
  // direct-subscribe modal flow via openOffer('membership', m).
  function addToCart(pkg) {
    setCart((prev) => [...prev, pkg]);
    setCartFlash(`Added "${pkg.name}" to cart`);
    // Auto-clear the flash after 2.5s. Cart drawer auto-opens for the
    // first item to make the cart discoverable; subsequent adds do not
    // open it again so the client can keep browsing.
    setTimeout(() => setCartFlash(null), 2500);
  }

  function removeFromCart(idx) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  function cartCount() { return cart.length; }
  function cartTotalCents() {
    return cart.reduce((s, p) => s + Math.round(Number(p.price) * 100), 0);
  }

  // Open the checkout modal where the client enters name/email/phone
  // ONCE for the whole cart instead of per-item. Pre-fills from the
  // booking form if they already filled it earlier.
  function openCartCheckout() {
    setOfferForm({
      name: form.name || '',
      email: form.email || '',
      phone: form.phone || '',
    });
    setCartCheckoutError(null);
    setCartCheckoutModal(true);
  }

  async function checkoutCart() {
    if (!offerForm.name.trim() || !offerForm.email.trim()) {
      setCartCheckoutError('Please enter your name and email.');
      return;
    }
    if (cart.length === 0) {
      setCartCheckoutError('Cart is empty.');
      return;
    }
    setCartCheckoutLoading(true);
    setCartCheckoutError(null);

    // Embed cart_complete=1 in redirect URL so it survives the round-
    // trip through either Stripe or Square checkout (each processor
    // appends their own checkout_complete or session_id; our trigger
    // is preserved either way).
    const redirectBase = `${window.location.origin}/${therapist.custom_url}?_=${Date.now()}&cart_complete=1`;
    try {
      const res = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/purchase-cart`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            therapist_id: therapist.id,
            cart_items: cart.map((p) => ({ package_id: p.id })),
            client_name: offerForm.name.trim(),
            client_email: offerForm.email.trim().toLowerCase(),
            client_phone: offerForm.phone.trim() || null,
            redirect_url: redirectBase,
          }),
        }
      );
      const data = res.ok ? await res.json() : await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setCartCheckoutError(data.error || `Could not open checkout (HTTP ${res.status}).`);
    } catch (e) {
      setCartCheckoutError(String(e));
    }
    setCartCheckoutLoading(false);
  }

  async function submit() {
    setSubmitting(true);
    // Snapshot add-on data for the booking. This is captured at booking time
    // so future changes to add-on prices do not retroactively change what the
    // client agreed to. Stored as JSONB for easy read.
    const chosenAddons = availableAddons.filter(a => selectedAddonIds.includes(a.id));
    const addonTotalPrice = chosenAddons.reduce((s,a)=>s+Number(a.price||0), 0);
    const addonExtraMinutes = chosenAddons.reduce((s,a)=>s+Number(a.extra_minutes||0), 0);

    const {data:newBooking,error}=await supabase.from('bookings').insert({
      therapist_id:therapist.id, service_id:svc.id,
      client_name:form.name.trim(), client_email:form.email.trim().toLowerCase(),
      client_phone:form.phone, booking_date:date,
      sms_opted_in: !!form.sms_opted_in && !!form.phone,
      partner_name: svc?.is_couples ? partner.name.trim() : null,
      partner_email: svc?.is_couples ? partner.email.trim().toLowerCase() : null,
      start_time:slot.start, end_time:slot.end,
      addon_ids: chosenAddons.map(a => a.id),
      addon_total_price: addonTotalPrice,
      addon_extra_minutes: addonExtraMinutes,
      notes: giftCert ? `🎁 Gift certificate applied: ${giftCert.code} ($${giftCert.remaining?.toFixed(0)} credit)` : '',
      status: requiresApproval ? 'pending-approval' : ((depositRequired || paymentMode === 'full') ? 'pending-deposit' : 'confirmed'),
      deposit_required: requiresApproval ? false : depositRequired,
      deposit_amount: requiresApproval ? 0 : ((depositRequired || paymentMode === 'full') ? depositAmount : 0),
      deposit_paid: false,
      // Pay-in-full + tip persistence (Lindsey #2). pay_in_full is
      // true when client chose to pay the full session price upfront
      // instead of deposit-only. tip_cents is the tip amount that
      // will be charged together with the full payment. Both default
      // to 0/false when client picks the standard deposit flow.
      pay_in_full: paymentMode === 'full',
      tip_cents: paymentMode === 'full' ? tipCents : 0,
      // Cancellation policy Phase 2: snapshot the card on file at booking
      // time. Even if the client later changes their card, we charge what
      // they agreed to at this booking.
      card_on_file_payment_method_id: cardSavedPaymentMethodId || null,
      card_on_file_customer_id: cardSavedCustomerId || null,
      // Booking-policies audit trail (Ashley Scalzulli May 2026). When
      // the therapist has booking_policies enabled, snapshot the exact
      // text the client agreed to plus the agree timestamp. Protects
      // the therapist if policy text is later edited.
      booking_policies_agreed_at: (therapist?.booking_policies_enabled && bookingPoliciesAgreed)
        ? new Date().toISOString()
        : null,
      booking_policies_text_snapshot: (therapist?.booking_policies_enabled && bookingPoliciesAgreed)
        ? (therapist.booking_policies || null)
        : null,
    }).select().single();
    setSubmitting(false);
    if(error){alert('Something went wrong. Please try again.');return;}
    const bid=newBooking?.id||null;
    setBookingId(bid);

    // Forward sync to Google Calendar (Lindsey #10). Fire and forget.
    // Only confirmed bookings sync immediately. Pending-approval and
    // pending-deposit bookings sync after they become confirmed via
    // the appropriate flow (approval, deposit capture).
    //
    // HK May 14 2026: verbose logging added to console. Edge function
    // logs showed no invocations at all on the May 14 test, meaning
    // either this guard short-circuited, or the fetch never reached
    // the network. Console.log each branch so we can see which.
    console.log('[Booking] post-create google sync check:', {
      bid,
      bookingStatus: newBooking?.status,
      therapistConnected: therapist?.google_calendar_connected,
      hasUrl: !!process.env.REACT_APP_SUPABASE_URL,
      hasKey: !!process.env.REACT_APP_SUPABASE_ANON_KEY,
    });
    if (bid && newBooking?.status === 'confirmed' && therapist?.google_calendar_connected) {
      try {
        const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
        const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
        console.log('[Booking] firing google-calendar-push for booking', bid);
        fetch(`${SUPABASE_URL}/functions/v1/google-calendar-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ booking_id: bid, action: 'create' }),
        })
          .then(r => r.json())
          .then(j => console.log('[Booking] google-calendar-push response:', j))
          .catch(e => console.error('[Booking] google-calendar-push failed:', e));
      } catch (e) {
        console.error('[Booking] google-calendar-push threw before fetch:', e);
      }
    } else {
      console.warn('[Booking] google-calendar-push SKIPPED. Reason:',
        !bid ? 'no booking id' :
        newBooking?.status !== 'confirmed' ? `status=${newBooking?.status}` :
        !therapist?.google_calendar_connected ? 'therapist not connected' :
        'unknown'
      );
    }

    // Apply gift certificate if present
    if (giftCert) {
      const newRemaining = Math.max(0, giftCert.remaining - svc.price);
      await supabase.from('gift_certificates').update({
        remaining: newRemaining,
        status: newRemaining <= 0 ? 'redeemed' : 'active',
        redeemed_at: new Date().toISOString(),
        redeemed_by_booking_id: bid,
      }).eq('id', giftCert.id);
    }

    // Ping therapist with a push notification about the new booking (best-effort)
    try {
      const bookingDateFmt = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-push`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            therapist_id: therapist.id,
            title: requiresApproval
              ? `New booking REQUEST · ${form.name.trim().split(' ')[0]} 🌿`
              : `New booking · ${form.name.trim().split(' ')[0]} 🌿`,
            body: requiresApproval
              ? `Tap to approve or decline · ${bookingDateFmt} at ${slot.start} · ${svc.name}`
              : `${bookingDateFmt} at ${slot.start} · ${svc.name} (${svc.duration} min)`,
            url: '/dashboard/schedule',
            tag: `new-booking-${bid}`,
          }),
        }
      ).catch(() => {}); // fire-and-forget
    } catch (e) { /* never block booking on push failure */ }

    // Approval-required path: short-circuit the deposit + couples-partner flow.
    // Therapist will approve from the dashboard, payment link is sent then.
    if (requiresApproval) {
      // Fire booking confirmation emails (request-received variant — the
      // edge function detects status='pending-approval' and adjusts copy).
      // Non-blocking; UI confirms immediately even if email send is slow.
      fireBookingConfirmation(bid);
      setPendingApproval(true);
      setConfirmed(true);
      return;
    }

    // Trigger the at-booking payment flow when EITHER:
    //   - therapist requires a deposit (existing flow), OR
    //   - client chose pay-in-full (Lindsey #2)
    // Both paths route through the same create-deposit /
    // square-create-deposit edge functions; depositAmount has
    // already been recomputed by the useEffect to reflect the
    // chosen mode (deposit cents OR full+tip cents).
    const needsCharge = depositRequired || paymentMode === 'full';

    if(needsCharge && therapist.stripe_account_id) {
      console.log('PAYMENT DEBUG: invoking create-deposit', {paymentMode, tipCents, depositRequired, stripe_account_id: therapist.stripe_account_id, depositAmount});
      setDepositLoading(true);
      // Call edge function directly via fetch, supabase.functions.invoke()
      // was failing at the gateway level before the function ran (no invocation logs)
      const fnRes = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/create-deposit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            stripe_account_id: therapist.stripe_account_id,
            therapist_id: therapist.id,
            booking_id: bid,
            amount_cents: depositAmount,
            // Client identity sent so create-deposit can find-or-create
            // the Stripe Customer and link the PaymentIntent for
            // automatic card-on-file save (setup_future_usage). HK
            // QA May 8 confirmed cards were not saving without this.
            // For new clients, client_id is null and the edge function
            // looks up the row by email + therapist_id.
            client_id: cardSavedClientId || null,
            client_email: form.email.trim().toLowerCase(),
            client_name: form.name?.trim() || null,
            client_phone: form.phone?.trim() || null,
            service_name: svc.name,
            therapist_name: therapist.business_name || therapist.full_name,
            // Pay-in-full + tip metadata (Lindsey #2). amount_cents
            // already reflects the full price + tip when paymentMode
            // is 'full'; these fields exist so the edge function can
            // attach them to PaymentIntent metadata for accounting.
            payment_mode: paymentMode,
            tip_cents: paymentMode === 'full' ? tipCents : 0,
          }),
        }
      );
      const res = { data: fnRes.ok ? await fnRes.json() : null, error: fnRes.ok ? null : { message: `HTTP ${fnRes.status}` } };
      if (!fnRes.ok) {
        try { const errBody = await fnRes.clone().json(); res.data = errBody; } catch(e) {}
      }
      setDepositLoading(false);
      console.log('EDGE FUNCTION RESPONSE:', JSON.stringify(res.data), 'error:', res.error);
      if(res.data?.client_secret){
        setDepositClientSecret(res.data.client_secret);
        setDepositAccountId(res.data.account_id || null);
        // Capture the PaymentIntent id and resolved client id so
        // onDepositSuccess can call capture-saved-card with them
        // after the charge confirms.
        setDepositPaymentIntentId(res.data.payment_intent_id || null);
        setDepositResolvedClientId(res.data.client_id || null);
        return;
      }
      // Edge function failed, show the error, DO NOT confirm
      const errMsg = res.data?.error || res.error?.message || 'Payment setup failed. Please try again.';
      setPaymentError(errMsg);
      // Stay on step 4 so the error is visible
      return;
    }

    // Square deposit branch. Therapist has Square connected (and not
    // Stripe). We use Square's hosted Payment Link API instead of
    // embedding their Web Payments SDK so the client gets a clean
    // Square checkout page (Apple Pay, Google Pay, card all included)
    // and Square redirects them back to a thank-you URL after pay.
    // Trade-off: client briefly leaves our domain. For deposits, the
    // simpler hosted flow is the right call for the persona.
    if (needsCharge && !therapist.stripe_account_id && therapist.square_access_token) {
      console.log('PAYMENT DEBUG: invoking square-create-deposit', { paymentMode, booking_id: bid, amount_cents: depositAmount });
      setDepositLoading(true);
      // After Square redirects back, this URL re-opens the booking
      // page in confirmed state. The booking row already exists with
      // status pending-deposit; the redirect will trigger the
      // deposit-paid mark-as-confirmed flow. Webhook is the durable
      // source of truth (TODO Phase 2) but for now the redirect is
      // good enough for Ashley's use case.
      const redirectUrl = `${window.location.origin}/${therapist.custom_url}?deposit_complete=1&booking_id=${bid}`;
      const fnRes = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/square-create-deposit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            therapist_id: therapist.id,
            booking_id: bid,
            amount_cents: depositAmount,
            service_name: svc.name,
            therapist_name: therapist.business_name || therapist.full_name,
            client_email: form.email.trim().toLowerCase(),
            redirect_url: redirectUrl,
            // Pay-in-full + tip metadata (Lindsey #2)
            payment_mode: paymentMode,
            tip_cents: paymentMode === 'full' ? tipCents : 0,
          }),
        }
      );
      const data = fnRes.ok ? await fnRes.json() : await fnRes.json().catch(() => ({}));
      setDepositLoading(false);
      console.log('SQUARE DEPOSIT RESPONSE:', data);
      if (data?.url) {
        // Send the client to Square's hosted checkout. They pay there,
        // Square redirects them back with deposit_complete=1.
        window.location.href = data.url;
        return;
      }
      const errMsg = data?.error || `HTTP ${fnRes.status}`;
      setPaymentError(`Square deposit setup failed: ${errMsg}`);
      return;
    }

    // Neither Stripe nor Square deposit branch available, but deposit
    // was required. This means the therapist enabled deposits in
    // Settings but has no payment processor connected, OR the
    // processor disconnected. Fail visibly rather than silently
    // confirming a booking that should have collected money.
    if (needsCharge && !therapist.stripe_account_id && !therapist.square_access_token) {
      setPaymentError('This therapist has not connected a payment processor. Please contact them directly to book.');
      return;
    }
    // No deposit required, confirm directly
    // If couples booking, send partner their intake link
    if (svc?.is_couples && partner.email && partner.name && bookingId) {
      const intakeUrl = `${window.location.origin}/${therapist.custom_url}?name=${encodeURIComponent(partner.name)}&email=${encodeURIComponent(partner.email)}&booking_id=${bookingId}`;
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-outreach`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
          body: JSON.stringify({
            to: partner.email,
            subject: `${form.name.split(' ')[0]} booked a couples massage - please fill your intake form`,
            html: `<div style="font-family:system-ui;max-width:480px;padding:24px;">
              <h2 style="color:#2A5741;font-family:Georgia,serif;">Hi ${partner.name.split(' ')[0]},</h2>
              <p style="color:#4B5563;line-height:1.7;">${form.name.split(' ')[0]} has booked a couples massage session. Please fill out your personal preferences so your therapist can prepare for your visit.</p>
              <p style="text-align:center;margin:28px 0;">
                <a href="${intakeUrl}" style="background:#2A5741;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">Fill My Intake Form</a>
              </p>
              <p style="color:#9CA3AF;font-size:12px;">Takes about 2 minutes. Your preferences stay private.</p>
            </div>`,
          }),
        });
      } catch(e) { /* non-blocking */ }
    }
    // Fire booking confirmation emails (client + therapist) for the
    // no-deposit instant-confirm path. Non-blocking; UI confirms
    // immediately even if email send is slow. Triggered by Lindsey
    // Thomas reporting practice bookings produced no confirmation
    // email — root cause was that this send was never wired.
    fireBookingConfirmation(bid);
    setConfirmed(true);
  }

  // Fire-and-forget helper that calls the send-booking-confirmation
  // edge function. Errors are logged but never block the UI confirm.
  // Used by all three booking confirmation paths (no-deposit, deposit-
  // paid, and request-approval).
  async function fireBookingConfirmation(theBookingId) {
    if (!theBookingId) return;
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      await fetch(`${supabaseUrl}/functions/v1/send-booking-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({ booking_id: theBookingId }),
      });
    } catch (e) {
      console.warn('send-booking-confirmation invocation failed:', e);
    }
  }

  async function checkGiftCode() {
    if (!giftCode.trim()) return;
    setGiftChecking(true); setGiftError(''); setGiftCert(null);
    const code = giftCode.trim().toUpperCase();
    const { data } = await supabase.from('gift_certificates')
      .select('*').eq('code', code).eq('therapist_id', therapist.id).eq('status','active').maybeSingle();
    setGiftChecking(false);
    if (!data) { setGiftError('Code not found or already used.'); return; }
    setGiftCert(data);
  }

  async function onDepositSuccess() {
    await supabase.from('bookings').update({deposit_paid:true,status:'confirmed'}).eq('id',bookingId);

    // Capture the auto-saved card from the PaymentIntent so the
    // client gets card-on-file going forward. Best-effort: a failure
    // here does not block booking confirmation, but it does mean the
    // returning-customer flow on the next booking would not recognize
    // them. We log the failure for observability.
    if (depositPaymentIntentId && depositAccountId && depositResolvedClientId) {
      try {
        const captureRes = await fetch(
          `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/capture-saved-card`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              payment_intent_id: depositPaymentIntentId,
              stripe_account_id: depositAccountId,
              client_id: depositResolvedClientId,
              therapist_id: therapist.id,
              booking_id: bookingId,
            }),
          }
        );
        if (!captureRes.ok) {
          const err = await captureRes.json().catch(() => ({}));
          console.warn('[onDepositSuccess] capture-saved-card failed:', err);
        }
      } catch (e) {
        console.warn('[onDepositSuccess] capture-saved-card threw:', e);
      }
    }

    // Now that deposit is paid and status flipped to confirmed, fire
    // the confirmation emails. This is the deposit-required path.
    fireBookingConfirmation(bookingId);
    setConfirmed(true);
  }

  if(loading) return <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui'}}><div style={{color:C.gray,fontSize:14}}>Loading...</div></div>;
  if(notFound) return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui'}}>
      <div style={{textAlign:'center'}}><div style={{fontSize:48,marginBottom:16}}>🌿</div><h2 style={{fontFamily:'Georgia,serif',color:C.dark,margin:'0 0 8px'}}>Page not found</h2><p style={{color:C.gray}}>This booking link doesn't exist.</p></div>
    </div>
  );

  if(confirmed && pendingApproval) return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:24,fontFamily:'system-ui'}}>
      <div style={{background:C.white,borderRadius:24,padding:'40px 32px',maxWidth:440,width:'100%',boxShadow:'0 8px 48px rgba(0,0,0,0.1)'}}>
        <div style={{width:72,height:72,borderRadius:'50%',background:'#FFFBEB',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:36}}>🌿</div>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:26,fontWeight:700,color:C.dark,margin:'0 0 8px',textAlign:'center'}}>Request submitted</h2>
        <p style={{color:C.gray,fontSize:14,lineHeight:1.7,textAlign:'center',margin:'0 0 20px'}}>
          Your request for <strong>{svc.name}</strong> on <strong>{fmtShort(date)}</strong> at <strong>{slot.display}</strong> has been sent to {therapist.business_name||therapist.full_name}.
        </p>
        <div style={{background:'linear-gradient(135deg,#FFFBEB,#FEF3C7)',border:'1.5px solid #FDE68A',borderRadius:14,padding:'18px 20px',marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:'#92400E',marginBottom:6}}>What happens next</div>
          <div style={{fontSize:13,color:'#78350F',lineHeight:1.6}}>
            {therapist.full_name?.split(' ')[0]||'Your therapist'} will review your request and reply by email. Most replies come within 24 hours.
          </div>
        </div>
        <div style={{background:'linear-gradient(135deg,#F0FDF4,#DCFCE7)',border:'1.5px solid #86EFAC',borderRadius:14,padding:'20px',marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:'#2A5741',marginBottom:6}}>📋 Save time, fill your intake now</div>
          <div style={{fontSize:13,color:'#374151',marginBottom:14,lineHeight:1.5}}>
            Filling your body map now means you are ready to go the moment your request is approved.
          </div>
          <a href={`/${therapist.custom_url}?name=${encodeURIComponent(form.name)}&email=${encodeURIComponent(form.email)}&phone=${encodeURIComponent(form.phone)}${bookingId?'&booking_id='+bookingId:''}`}
            style={{display:'block',background:C.forest,color:'#fff',borderRadius:10,padding:'13px 20px',fontSize:14,fontWeight:700,textDecoration:'none',textAlign:'center'}}>
            Fill My Intake Form →
          </a>
        </div>
        <p style={{fontSize:11,color:C.gray,textAlign:'center',margin:0}}>Confirmation will be sent to {form.email}</p>
      </div>
    </div>
  );

  if(confirmed) return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:24,fontFamily:'system-ui'}}>
      <div style={{background:C.white,borderRadius:24,padding:'40px 32px',maxWidth:440,width:'100%',boxShadow:'0 8px 48px rgba(0,0,0,0.1)'}}>
        <div style={{width:72,height:72,borderRadius:'50%',background:'#DCFCE7',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:36}}>✅</div>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:26,fontWeight:700,color:C.dark,margin:'0 0 8px',textAlign:'center'}}>You're booked!</h2>
        <p style={{color:C.gray,fontSize:14,lineHeight:1.7,textAlign:'center',margin:'0 0 24px'}}>
          <strong>{svc.name}</strong> on <strong>{fmtShort(date)}</strong> at <strong>{slot.display}</strong> with {therapist.business_name||therapist.full_name}.
        </p>
        {giftCert && (
          <div style={{background:'#F0FDF4',border:'1.5px solid #86EFAC',borderRadius:12,padding:'12px 16px',marginBottom:16,textAlign:'center'}}>
            <div style={{fontSize:13,fontWeight:700,color:'#16A34A'}}>🎁 Gift certificate confirmed</div>
            <div style={{fontSize:12,color:'#374151',marginTop:2}}>Your ${giftCert.remaining?.toFixed(0)} credit has been reserved. Mention code {giftCert.code} to your therapist at the session.</div>
          </div>
        )}
        <div style={{background:'linear-gradient(135deg,#F0FDF4,#DCFCE7)',border:'1.5px solid #86EFAC',borderRadius:14,padding:'20px',marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:'#2A5741',marginBottom:6}}>📋 One more thing, takes 60 seconds</div>
          <div style={{fontSize:13,color:'#374151',marginBottom:14,lineHeight:1.5}}>
            Fill your body map so {therapist.full_name?.split(' ')[0]||'your therapist'} knows exactly where to focus before you arrive.
          </div>
          <a href={`/${therapist.custom_url}?name=${encodeURIComponent(form.name)}&email=${encodeURIComponent(form.email)}&phone=${encodeURIComponent(form.phone)}${bookingId?'&booking_id='+bookingId:''}`}
            style={{display:'block',background:C.forest,color:'#fff',borderRadius:10,padding:'13px 20px',fontSize:14,fontWeight:700,textDecoration:'none',textAlign:'center'}}>
            Fill My Intake Form →
          </a>
        </div>
        <ClientPushCTA
          therapistId={therapist?.id}
          clientEmail={form.email}
          therapistFirstName={therapist?.full_name?.split(' ')[0]}
        />
        <p style={{fontSize:11,color:C.gray,textAlign:'center',margin:0}}>Confirmation sent to {form.email}</p>
      </div>
    </div>
  );

  const pct=step===1?16:step===2?40:step===3?64:depositClientSecret?90:100;
  const steps=[{n:1,l:'Service'},{n:2,l:'Date & Time'},{n:3,l:'Your Info'},{n:4,l:'Confirm'}];

  return (
    <div style={{minHeight:'100vh',background:C.beige,fontFamily:'system-ui,sans-serif'}}>
      <div style={{background:C.white,borderBottom:`1px solid ${C.light}`,padding:'max(14px, env(safe-area-inset-top, 14px)) 20px 14px',position:'sticky',top:0,zIndex:10}}>
        <div style={{maxWidth:560,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {therapist.photo_url
              ?<img src={therapist.photo_url} alt="" style={{width:40,height:40,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
              :<div style={{width:40,height:40,borderRadius:'50%',background:C.forest,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700,flexShrink:0}}>{(therapist.full_name||'T')[0]}</div>
            }
            <div>
              <div style={{fontSize:14,fontWeight:700,color:C.dark,lineHeight:1.2}}>{therapist.business_name||therapist.full_name}</div>
              <div style={{fontSize:11,color:C.gray}}>Online booking · No account needed</div>
            </div>
          </div>
          <div style={{display:'flex',gap:4}}>
            {steps.map(s=>(<div key={s.n} style={{width:8,height:8,borderRadius:'50%',background:s.n<=step?C.forest:C.light,transition:'background 0.3s'}}/>))}
          </div>
        </div>
        <div style={{maxWidth:560,margin:'10px auto 0',height:2,background:C.light,borderRadius:2}}>
          <div style={{height:2,background:C.forest,width:`${pct}%`,borderRadius:2,transition:'width 0.4s ease'}}/>
        </div>
      </div>

      <div style={{maxWidth:560,margin:'0 auto',padding:'24px 16px calc(100px + env(safe-area-inset-bottom, 0px))'}}>

        {/* STEP 1 */}
        {step===1&&(
          <div>
            {/* WELCOME hero: surfaces therapist photo bigger and frames the
                booking experience as personal, not transactional. Below the
                sticky nav (which has the small avatar). This is the first
                thing the client reads after tapping the booking link. */}
            <div style={{
              background: C.white,
              border: `1px solid ${C.light}`,
              borderRadius: 16,
              padding: '20px 18px',
              marginBottom: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}>
              {therapist.photo_url
                ? <img src={therapist.photo_url} alt="" style={{
                    width: 64, height: 64, borderRadius: 16,
                    objectFit: 'cover', flexShrink: 0,
                  }}/>
                : <div style={{
                    width: 64, height: 64, borderRadius: 16,
                    background: C.forest, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, fontWeight: 700, flexShrink: 0,
                    fontFamily: 'Georgia, serif',
                  }}>{(therapist.full_name || 'T')[0]}</div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: C.sage,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: 2,
                }}>
                  Welcome
                </div>
                <h2 style={{
                  fontFamily: 'Georgia, serif', fontSize: 19, fontWeight: 700,
                  color: C.dark, margin: '0 0 2px', lineHeight: 1.2,
                }}>
                  {therapist.business_name || therapist.full_name}
                </h2>
                {therapist.business_name && therapist.full_name && therapist.business_name !== therapist.full_name && (
                  <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.4 }}>
                    with {therapist.full_name}
                  </div>
                )}
              </div>
            </div>

            <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:C.dark,margin:'0 0 4px'}}>Book a service</h2>
            <p style={{fontSize:13,color:C.gray,margin:'0 0 14px'}}>Pick what you'd like. Single sessions, packages, or memberships.</p>

            {/* WHAT TO EXPECT: collapsible preview so clients know what
                comes after picking a service (intake form, cancellation
                policy if set). Not pushed up front; for clients who want
                to know what they are signing up for. */}
            <details style={{
              background: '#FAFAF7',
              border: `1px solid ${C.light}`,
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 18,
              fontSize: 13,
            }}>
              <summary style={{
                cursor: 'pointer',
                color: C.dark,
                fontWeight: 600,
                listStyle: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{ color: C.sage, fontSize: 14 }}>▸</span>
                What to expect after you book
              </summary>
              <div style={{ paddingTop: 10, paddingLeft: 22, color: C.gray, lineHeight: 1.6 }}>
                <div style={{ marginBottom: 6 }}>
                  <strong style={{ color: C.dark }}>1. A confirmation</strong> arrives by email within minutes.
                </div>
                <div style={{ marginBottom: 6 }}>
                  <strong style={{ color: C.dark }}>2. A short intake form</strong> asks where your body needs attention. About five minutes on your phone. Returning clients only see what changed.
                </div>
                <div style={{ marginBottom: 6 }}>
                  <strong style={{ color: C.dark }}>3. A reminder</strong> arrives the day before your session.
                </div>
                {therapist.cancellation_policy_active && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.light}` }}>
                    <strong style={{ color: C.dark }}>Cancellation policy:</strong> {therapist.full_name?.split(' ')[0] || 'The therapist'} has a cancellation policy in place. You will see the exact terms before confirming your booking.
                  </div>
                )}
              </div>
            </details>

            {/* OFFERS: packages + memberships. Collapsed by default
                so the booking flow stays short on mobile. The header
                row is tappable; tapping toggles offersExpanded. The
                count and lowest-price hint give clients a reason to
                tap without forcing them to scroll a long list. */}
            {(() => {
              // Memberships are Stripe-only by capability. Square cannot
              // do auto-renewing subscriptions reliably (per
              // BILLING_STRATEGY.md capability matrix). Hide memberships
              // from the booking page if therapist has no Stripe so
              // clients never hit a Square membership error path.
              const hasStripeForMembership = !!therapist?.stripe_account_id;
              // Always show memberships if the therapist has defined any,
              // even when Stripe is not connected. In that case the cards
              // render in a disabled state with a 'Stripe required' badge,
              // so the therapist (looking at their own booking page) sees
              // exactly what is missing instead of having memberships
              // silently disappear. Ashley Scalzulli May 2026: her booking
              // page hid memberships because she only had Square, and she
              // assumed Square itself was broken.
              const visibleMemberships = membershipsList;
              const showOffers = packagesList.length > 0 || visibleMemberships.length > 0;
              if (!showOffers) return null;
              return (
              <div style={{ marginBottom: 24 }}>
                {(() => {
                  // Only count PURCHASABLE memberships toward the price
                  // shown on the collapsed offers card, so 'from $X' is
                  // never quoting a disabled item.
                  const purchasableMemberships = hasStripeForMembership ? visibleMemberships : [];
                  const totalCount = packagesList.length + purchasableMemberships.length;
                  const allPrices = [
                    ...packagesList.map(p => Number(p.price)),
                    ...purchasableMemberships.map(m => Number(m.monthly_price)),
                  ].filter(p => !isNaN(p) && p > 0);
                  const lowestPrice = allPrices.length > 0 ? Math.min(...allPrices) : null;
                  return (
                    <button
                      onClick={() => setOffersExpanded(!offersExpanded)}
                      style={{
                        width: '100%',
                        background: '#FAF5EE',
                        border: `1.5px solid ${offersExpanded ? C.forest : (C.beige || '#E8DCC4')}`,
                        borderRadius: 14,
                        padding: '14px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        textAlign: 'left',
                        transition: 'all 0.15s',
                      }}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>🎁</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 2 }}>
                          Save with a package or membership
                        </div>
                        <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.4 }}>
                          {totalCount} option{totalCount !== 1 ? 's' : ''}
                          {lowestPrice !== null ? ` · from $${lowestPrice.toFixed(0)}` : ''}
                          {' · tap to '}{offersExpanded ? 'hide' : 'see'}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 18,
                        color: C.forest,
                        transform: offersExpanded ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                        flexShrink: 0,
                      }}>⌄</span>
                    </button>
                  );
                })()}

                {offersExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    {packagesList.length > 0 && (
                      <div style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        color: C.forest,
                        textTransform: 'uppercase',
                        marginTop: 2,
                        marginBottom: 2,
                      }}>
                        Packages · pay once, use over time
                      </div>
                    )}
                    {packagesList.map((p) => {
                      // How many of this package are already in the cart?
                      // Reflected on the button so the client can see they
                      // queued one before adding another.
                      const inCart = cart.filter((c) => c.id === p.id).length;
                      return (
                        <div
                          key={p.id}
                          style={{
                            background: '#FAF5EE',
                            border: `1.5px solid ${C.beige || '#E8DCC4'}`,
                            borderRadius: 14,
                            padding: '14px 16px',
                            transition: 'all 0.15s',
                          }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
                                📦 {p.name}
                              </div>
                              <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.5 }}>
                                {p.session_count} sessions
                                {p.expires_in_days ? ` · expires ${p.expires_in_days} days from purchase` : ''}
                              </div>
                              {p.description && (
                                <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.5, marginTop: 4 }}>
                                  {p.description}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 18, fontWeight: 700, color: C.forest }}>${Number(p.price).toFixed(0)}</div>
                              <div style={{ fontSize: 10, color: C.gray }}>upfront</div>
                            </div>
                          </div>
                          <button
                            onClick={() => addToCart(p)}
                            style={{
                              width: '100%',
                              background: inCart > 0 ? '#fff' : C.forest,
                              color: inCart > 0 ? C.forest : '#fff',
                              border: `2px solid ${C.forest}`,
                              borderRadius: 12,
                              padding: '13px 16px',
                              fontSize: 15,
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              boxShadow: inCart > 0 ? '0 1px 3px rgba(42,87,65,0.12)' : '0 2px 6px rgba(42,87,65,0.18)',
                            }}>
                            {inCart > 0 ? `✓ In cart (${inCart}) · Add another` : '+ Add to cart'}
                          </button>
                        </div>
                      );
                    })}
                    {visibleMemberships.length > 0 && (
                      <div style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        color: C.forest,
                        textTransform: 'uppercase',
                        marginTop: packagesList.length > 0 ? 12 : 2,
                        marginBottom: 2,
                      }}>
                        Memberships · monthly recurring
                      </div>
                    )}
                    {visibleMemberships.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => hasStripeForMembership ? openOffer('membership', m) : null}
                        disabled={!hasStripeForMembership}
                        style={{
                          background: hasStripeForMembership ? '#F0F9F4' : '#F5F5F0',
                          border: `1.5px solid ${hasStripeForMembership ? '#B5D4BE' : '#D9D5C9'}`,
                          borderRadius: 14,
                          padding: '14px 16px',
                          textAlign: 'left',
                          cursor: hasStripeForMembership ? 'pointer' : 'not-allowed',
                          width: '100%',
                          transition: 'all 0.15s',
                          opacity: hasStripeForMembership ? 1 : 0.72,
                        }}
                        onMouseEnter={(e) => {
                          if (!hasStripeForMembership) return;
                          e.currentTarget.style.borderColor = C.forest;
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          if (!hasStripeForMembership) return;
                          e.currentTarget.style.borderColor = '#B5D4BE';
                          e.currentTarget.style.transform = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
                              💚 {m.name}
                            </div>
                            <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.5 }}>
                              {m.monthly_session_credits} session{m.monthly_session_credits !== 1 ? 's' : ''} per month
                              {m.addon_discount_percent > 0 ? ` · ${m.addon_discount_percent}% off add-ons` : ''}
                            </div>
                            {m.description && (
                              <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.5, marginTop: 4 }}>
                                {m.description}
                              </div>
                            )}
                            {hasStripeForMembership ? (
                              <div style={{ fontSize: 10, color: C.gray, fontStyle: 'italic', marginTop: 6 }}>
                                Memberships subscribe directly · not cart-eligible
                              </div>
                            ) : (
                              <div style={{
                                marginTop: 8,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                background: '#FEF3C7',
                                border: '1px solid #FCD34D',
                                borderRadius: 999,
                                padding: '3px 10px',
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: '#92400E',
                                letterSpacing: '0.04em',
                              }}>
                                <span>🔒</span>
                                <span>Stripe required for monthly auto-renew</span>
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: hasStripeForMembership ? C.forest : C.gray }}>${Number(m.monthly_price).toFixed(0)}</div>
                            <div style={{ fontSize: 10, color: C.gray }}>per month</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              );
            })()}

            {/* "Single sessions" divider only renders when offers are
                expanded. Uses the same hasStripeForMembership logic so
                the divider does not appear when there is nothing to
                divide. */}
            {(packagesList.length > 0 || (membershipsList.length > 0)) && offersExpanded && (
              <div style={{
                fontSize: 13, fontWeight: 700, color: C.dark, textTransform: 'uppercase', letterSpacing: '0.5px',
                margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ flex: 1, height: 1, background: C.light }} />
                <span style={{ color: C.gray, fontWeight: 600, letterSpacing: '0.08em' }}>Or a single session</span>
                <span style={{ flex: 1, height: 1, background: C.light }} />
              </div>
            )}

            {services.length===0
              ?<div style={{background:C.white,borderRadius:14,padding:32,textAlign:'center',color:C.gray,fontSize:14}}>No services available yet. Check back soon.</div>
              :<div style={{display:'flex',flexDirection:'column',gap:10}}>
                {(() => {
                  // Apply cycle scheduling filter if therapist has it on.
                  // Returns the original services array unchanged otherwise.
                  // Filter is by TODAY's phase — meaning the menu reflects
                  // what she's offering this week. Future-dated bookings still
                  // pick from today's available menu (V1 simplification).
                  const visibleServices = applyCycleFilter(therapist, services);
                  if (visibleServices.length === 0 && services.length > 0) {
                    return <div style={{background:C.white,borderRadius:14,padding:32,textAlign:'center',color:C.gray,fontSize:14}}>No services available right now. Check back in a few days.</div>;
                  }
                  return visibleServices.map(s=>(
                  <button key={s.id} onClick={()=>{setSvc(s);setStep(2);}}
                    style={{background:C.white,border:`2px solid ${C.light}`,borderRadius:16,padding:'18px 20px',textAlign:'left',cursor:'pointer',width:'100%',transition:'all 0.15s',outline:'none'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.forest;e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 4px 16px rgba(42,87,65,0.12)';}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.light;e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:16,fontWeight:700,color:C.dark,marginBottom:6}}>{s.name}</div>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:s.description?8:0}}>
                          <span style={{background:'#F0FDF4',color:'#16A34A',borderRadius:20,padding:'3px 10px',fontSize:12,fontWeight:600}}>⏱ {s.duration} min</span>
                        </div>
                        {s.description&&<div style={{fontSize:13,color:C.gray,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{s.description}</div>}
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontSize:22,fontWeight:700,color:C.forest}}>${s.price}</div>
                        <div style={{fontSize:11,color:C.gray}}>pay at session</div>
                      </div>
                    </div>
                  </button>
                ));
                })()}
              </div>
            }
          </div>
        )}

        {/* STEP 2 */}
        {step===2&&(
          <div>
            <button onClick={()=>setStep(1)} style={{background:'none',border:'none',color:C.gray,fontSize:13,cursor:'pointer',padding:'0 0 12px',display:'flex',alignItems:'center',gap:4}}>‹ Back</button>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:C.dark,margin:'0 0 4px'}}>Pick your time</h2>
            <p style={{fontSize:13,color:C.gray,margin:'0 0 20px'}}>{svc.name} · {svc.duration + selectedAddonIds.reduce((s,id)=>s+(availableAddons.find(a=>a.id===id)?.extra_minutes||0),0)} min · ${(Number(svc.price)+selectedAddonIds.reduce((s,id)=>s+Number(availableAddons.find(a=>a.id===id)?.price||0),0)).toFixed(0)}</p>

            {availableAddons.length > 0 && (
              <div style={{background:C.white,borderRadius:16,padding:20,marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:700,color:C.gray,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Enhance your session</div>
                <p style={{fontSize:12,color:C.gray,margin:'0 0 14px',lineHeight:1.5}}>Optional. Tap to add or remove.</p>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {availableAddons.map(a => {
                    const selected = selectedAddonIds.includes(a.id);
                    return (
                      <button key={a.id}
                        onClick={() => setSelectedAddonIds(ids => selected ? ids.filter(x=>x!==a.id) : [...ids, a.id])}
                        style={{
                          display:'flex',alignItems:'center',gap:12,
                          background:selected ? '#F0FDF4' : '#fff',
                          border:`2px solid ${selected ? C.forest : C.light}`,
                          borderRadius:12, padding:'12px 14px', textAlign:'left', cursor:'pointer',
                          fontFamily:'inherit', fontSize:14, transition:'all 0.15s',
                        }}>
                        <div style={{
                          width:22,height:22,borderRadius:6,
                          background:selected ? C.forest : '#fff',
                          border:`2px solid ${selected ? C.forest : '#D1D5DB'}`,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          color:'#fff',fontSize:14,fontWeight:700,flexShrink:0,
                        }}>{selected ? '✓' : ''}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:600,color:C.dark}}>{a.name}</div>
                          {a.description && <div style={{fontSize:12,color:C.gray,lineHeight:1.5,marginTop:3,whiteSpace:'pre-wrap'}}>{a.description}</div>}
                        </div>
                        <div style={{textAlign:'right',flexShrink:0,fontSize:13,fontWeight:600,color:C.forest}}>
                          +${Number(a.price).toFixed(0)}
                          {a.extra_minutes > 0 && <div style={{fontSize:10,color:C.gray,fontWeight:500}}>+{a.extra_minutes} min</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{background:C.white,borderRadius:16,padding:20,marginBottom:14}}>
              <Cal
                availability={(() => {
                  // Per-service availability filter (Lindsey #4):
                  //   - If selected service has its own per-service rows,
                  //     pass only those rows (so calendar greys out days
                  //     the service is not offered).
                  //   - Otherwise pass master rows (service_id IS NULL),
                  //     which is the normal case for services that
                  //     inherit the master schedule.
                  if (!svc || !availability) return availability || [];
                  const svcRows = availability.filter(a => a.service_id === svc.id);
                  if (svcRows.length > 0) return svcRows;
                  return availability.filter(a => !a.service_id);
                })()}
                service={svc}
                selected={date}
                onSelect={setDate}
                blockedDates={blockedDates}
                maxDate={(() => {
                  // If therapist has set a booking horizon (e.g. 30 days for
                  // cycle-aligned scheduling), compute the cutoff date here.
                  // Returns a Date, or null for unlimited.
                  const days = therapist?.booking_horizon_days;
                  // Maximum advance booking window (Lindsey-adjacent
                  // feature, May 9 2026): therapist can cap how far
                  // ahead bookings go via maximum_advance_days.
                  // Use whichever is more restrictive.
                  const maxAdvance = therapist?.maximum_advance_days;
                  const effective = (days && days > 0) ? days : maxAdvance;
                  if (!effective || effective < 1) return null;
                  const max = new Date();
                  max.setHours(0, 0, 0, 0);
                  max.setDate(max.getDate() + effective);
                  return max;
                })()}
                minDate={(() => {
                  // Booking lead-time minimum (Lindsey #5, May 9, 2026):
                  // disable date cells entirely before earliest bookable
                  // day. Slot generator does the intra-day filter.
                  const hours = Number(therapist?.minimum_advance_hours) || 0;
                  if (hours <= 0) return null;
                  const earliestInstant = new Date(Date.now() + hours * 60 * 60 * 1000);
                  // Round DOWN to start of the day so the day itself is
                  // navigable; the slot generator will hide too-soon
                  // slots within that day.
                  const earliestDay = new Date(earliestInstant);
                  earliestDay.setHours(0, 0, 0, 0);
                  return earliestDay;
                })()}
              />
            </div>
            {date&&(
              <div style={{background:C.white,borderRadius:16,padding:20}}>
                <div style={{fontSize:12,fontWeight:700,color:C.gray,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:16}}>{fmtDate(date)}</div>
                {loadingSlots
                  ?<div style={{textAlign:'center',padding:'20px 0',color:C.gray,fontSize:13}}>Finding best times for you...</div>
                  :slots.length===0
                    ?<div style={{textAlign:'center',padding:'20px 0',color:C.gray,fontSize:13}}>No availability on this day. Try another date.</div>
                    :<div>
                      {slots.some(s=>s.recommended)&&(
                        <div style={{marginBottom:12}}>
                          <div style={{fontSize:11,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>⚡ Works best</div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
                            {slots.filter(s=>s.recommended).slice(0,3).map(s=>(
                              <button key={s.start} onClick={()=>setSlot(s)}
                                style={{padding:'13px 8px',borderRadius:12,border:`2px solid ${slot?.start===s.start?C.forest:C.amber}`,
                                  background:slot?.start===s.start?C.forest:'#FFFBEB',
                                  color:slot?.start===s.start?C.white:'#92400E',
                                  fontSize:13,fontWeight:700,cursor:'pointer',transition:'all 0.15s'}}>
                                {s.display}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{fontSize:11,fontWeight:700,color:C.gray,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>All available times</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                        {slots.filter(s=>!s.recommended).map(s=>(
                          <button key={s.start} onClick={()=>setSlot(s)}
                            style={{padding:'12px 8px',borderRadius:10,border:`2px solid ${slot?.start===s.start?C.forest:C.light}`,
                              background:slot?.start===s.start?C.forest:C.white,
                              color:slot?.start===s.start?C.white:C.dark,
                              fontSize:13,fontWeight:600,cursor:'pointer',transition:'all 0.15s'}}>
                            {s.display}
                          </button>
                        ))}
                      </div>
                    </div>
                }
              </div>
            )}
            {slot&&<button onClick={()=>setStep(3)} style={{width:'100%',background:C.forest,color:C.white,border:'none',borderRadius:14,padding:'15px',fontSize:15,fontWeight:700,cursor:'pointer',marginTop:14}}>Continue →</button>}
          </div>
        )}

        {/* STEP 3 */}
        {step===3&&(
          <div>
            <button onClick={()=>setStep(2)} style={{background:'none',border:'none',color:C.gray,fontSize:13,cursor:'pointer',padding:'0 0 12px',display:'flex',alignItems:'center',gap:4}}>‹ Back</button>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:C.dark,margin:'0 0 4px'}}>Your details</h2>
            <p style={{fontSize:13,color:C.gray,margin:'0 0 20px'}}>{fmtShort(date)} · {slot.display} · {svc.name}</p>
            <div style={{background:C.white,borderRadius:16,padding:22,display:'flex',flexDirection:'column',gap:14}}>
              {[
                {k:'name',l:'Full name',p:'Jane Smith',t:'text'},
                {k:'email',l:'Email address',p:'jane@example.com',t:'email'},
                {k:'phone',l:'Phone number',p:'(512) 555-1234',t:'tel'},
              ].map(({k,l,p,t})=>(
                <div key={k}>
                  <label style={{fontSize:12,fontWeight:700,color:C.gray,display:'block',marginBottom:6}}>
                    {l} <span style={{color:C.danger}}>*</span>
                  </label>
                  <input type={t} value={form[k]} placeholder={p} autoComplete={k==='name'?'name':k==='email'?'email':'tel'}
                    onChange={e=>{
                      let val=e.target.value;
                      if(k==='phone'){
                        // Strip non-digits, then handle the case where
                        // the user (or autofill, or an iPhone Contacts
                        // suggestion) includes a leading '1' country
                        // code. We treat 11 digits starting with 1 as
                        // a US number with the country code, and use
                        // the trailing 10 digits. This fixes a bug
                        // where the formatter sliced the first 10
                        // digits and treated the country code as the
                        // first digit of the area code (HK QA May 8).
                        let d=val.replace(/\D/g,'');
                        if (d.length === 11 && d.startsWith('1')) {
                          d = d.slice(1);
                        } else {
                          d = d.slice(0, 10);
                        }
                        val=d.length<=3?d:d.length<=6?`(${d.slice(0,3)}) ${d.slice(3)}`:`(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
                      }
                      setForm(f=>({...f,[k]:val}));setErrors(er=>({...er,[k]:''}));
                    }}
                    style={{width:'100%',padding:'13px 14px',border:`1.5px solid ${errors[k]?C.danger:C.light}`,borderRadius:10,fontSize:15,boxSizing:'border-box',outline:'none',fontFamily:'system-ui'}}/>
                  {errors[k]&&<div style={{fontSize:11,color:C.danger,marginTop:4}}>{errors[k]}</div>}
                </div>
              ))}
              {/* SMS consent (TCPA + Twilio 10DLC compliance).
                  Names MyBodyMap as the platform sender, includes HELP/STOP language,
                  and links Privacy Policy + Terms inline at the consent moment. */}
              {form.phone && form.phone.replace(/\D/g,'').length >= 10 && (
                <label style={{display:'flex',alignItems:'flex-start',gap:10,padding:'12px 14px',background:'#F9FAF9',border:`1px solid ${C.light}`,borderRadius:10,cursor:'pointer'}}>
                  <input type="checkbox" checked={!!form.sms_opted_in}
                    onChange={e=>setForm(f=>({...f,sms_opted_in:e.target.checked}))}
                    style={{marginTop:2,accentColor:'#2A5741',width:16,height:16,flexShrink:0,cursor:'pointer'}}/>
                  <div style={{fontSize:12,color:C.gray,lineHeight:1.5}}>
                    Yes, I agree to receive appointment reminders, confirmations, and follow-up messages from my therapist via the MyBodyMap platform at this number. Message frequency varies. Message and data rates may apply. Reply HELP for help, reply STOP anytime to opt out. See <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{color:'#2A5741',textDecoration:'underline'}} onClick={e=>e.stopPropagation()}>Privacy Policy</a> and <a href="/terms" target="_blank" rel="noopener noreferrer" style={{color:'#2A5741',textDecoration:'underline'}} onClick={e=>e.stopPropagation()}>Terms</a>.
                  </div>
                </label>
              )}
            </div>
            {svc?.is_couples && (
              <div style={{background:'#F0FDF4',border:'1.5px solid #86EFAC',borderRadius:12,padding:'16px',marginBottom:8}}>
                <div style={{fontSize:12,fontWeight:700,color:'#2A5741',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>
                  💑 Partner's Info
                </div>
                {[{k:'name',l:'Partner full name',p:'Alex Smith',t:'text'},{k:'email',l:'Partner email',p:'alex@example.com',t:'email'}].map(({k,l,p,t})=>(
                  <div key={k} style={{marginBottom:10}}>
                    <label style={{fontSize:12,fontWeight:700,color:C.gray,display:'block',marginBottom:6}}>{l} <span style={{color:C.danger}}>*</span></label>
                    <input type={t} value={partner[k]} placeholder={p}
                      onChange={e=>{setPartner(f=>({...f,[k]:e.target.value}));setPartnerErrors(er=>({...er,[k]:''}));}}
                      style={{width:'100%',padding:'13px 14px',border:`1.5px solid ${partnerErrors[k]?C.danger:C.light}`,borderRadius:10,fontSize:15,boxSizing:'border-box',outline:'none',fontFamily:'system-ui'}}/>
                    {partnerErrors[k]&&<div style={{fontSize:11,color:C.danger,marginTop:4}}>{partnerErrors[k]}</div>}
                  </div>
                ))}
                <div style={{fontSize:12,color:'#6B7280',marginTop:4}}>Your partner will receive their own intake link to fill out their preferences.</div>
              </div>
            )}
            <button onClick={async ()=>{
              const errs={};
              if(!form.name.trim()) errs.name='Required';
              if(!form.email.trim()||!/\S+@\S+\.\S+/.test(form.email)) errs.email='Valid email required';
              if(!form.phone.trim()) errs.phone='Required';
              if(Object.keys(errs).length){setErrors(errs);return;}
              if(svc?.is_couples){
                const perrs={};
                if(!partner.name.trim()) perrs.name='Required';
                if(!partner.email.trim()||!/\S+@\S+\.\S+/.test(partner.email)) perrs.email='Valid email required';
                if(Object.keys(perrs).length){setPartnerErrors(perrs);return;}
              }              // Check repeat client by email OR phone OR name, any match = returning client
              const email = form.email.trim().toLowerCase();
              const phone = form.phone.replace(/\D/g,'').slice(-10);

              let isRepeat = false;

              // Returning-customer detection. We check email and phone,
              // both of which are reasonable identity signals. We do NOT
              // check name alone — common names create constant false
              // positives. If you booked with this email or this phone
              // before, you are a returning client. Otherwise you are
              // new, regardless of what name you typed. (Bug history:
              // a previous name-match check via ilike() was treating
              // every test client named 'Test' or 'Joy' as a returning
              // client, even with fresh email and phone. Removed
              // 2026-05-05 after HK reported the false-positive.)

              // 1. Email match (exact, case-insensitive — both sides lowercased)
              if (email) {
                const {data:byEmail} = await supabase.from('bookings')
                  .select('id').eq('therapist_id',therapist.id)
                  .eq('client_email',email).neq('status','cancelled').limit(1);
                if (byEmail?.length) isRepeat = true;
              }

              // 2. Phone match — last 10 digits, ignoring formatting.
              // A phone number reuse across bookings is very rarely
              // a coincidence (unlike names).
              if (!isRepeat && phone.length >= 7) {
                const {data:allPhones} = await supabase.from('bookings')
                  .select('client_phone').eq('therapist_id',therapist.id)
                  .neq('status','cancelled').not('client_phone','is',null);
                if ((allPhones||[]).some(b => b.client_phone?.replace(/\D/g,'').slice(-10) === phone))
                  isRepeat = true;
              }

              setIsRepeatClient(isRepeat);
              console.log(
                `%c[Booking] returning-customer check: ${isRepeat ? 'RETURNING' : 'NEW'}`,
                `color: ${isRepeat ? '#B87840' : '#2A5741'}; font-weight: bold;`
              );
              console.log(`[Booking]   email=${email}, phone=${phone}`);

              // For returning customers, look up the saved card on the
              // clients row so the payment step can skip the card form
              // and use the existing card_on_file. Two earlier bugs HK
              // caught in May 2026 are addressed here:
              //
              // 1. The previous SELECT named 'card_on_file_id', a column
              //    that has never existed on the clients table. Supabase
              //    silently returned undefined for it, so the Square
              //    fallback never fired. Fixed: select the real columns
              //    that exist (payment_method_id for Stripe-saved cards,
              //    square_card_id + square_customer_id for Square-saved
              //    cards, plus card_last4 / card_brand for display).
              //
              // 2. With duplicate client rows for the same therapist +
              //    email (4 rows for bodymap01@gmail.com on demo), the
              //    earlier maybeSingle() returned null because more than
              //    one row matched, which made detection fail entirely
              //    and triggered yet another row insert downstream. New
              //    behavior: order by card_saved_at desc + most-recent
              //    created_at, pick the freshest row, console.warn loudly
              //    when duplicates are seen so HK can clean them up
              //    later. Real audit-friendly fix would be a dedupe job;
              //    this is the watchpoint until then.
              if (isRepeat && email) {
                const { data: clientRows, error: lookupErr } = await supabase
                  .from('clients')
                  .select('id, payment_method_id, stripe_customer_id, square_card_id, square_customer_id, card_last4, card_brand, card_saved_at, created_at')
                  .eq('therapist_id', therapist.id)
                  .ilike('email', email)
                  .order('card_saved_at', { ascending: false, nullsFirst: false })
                  .order('created_at', { ascending: false });
                if (lookupErr) {
                  console.error('[Booking] returning-client lookup failed', lookupErr);
                }
                if (Array.isArray(clientRows) && clientRows.length > 1) {
                  console.warn(
                    `[Booking] %cDuplicate client rows detected: ${clientRows.length} for therapist=${therapist.id} email=${email}. Picking row with most bookings (then most recent card). Cleanup TODO.`,
                    'color:#92400E;font-weight:bold;',
                    clientRows.map(r => ({ id: r.id, saved: r.card_saved_at, created: r.created_at }))
                  );
                }
                // Pick the right row. When duplicates exist, prefer the
                // one with the most booking history. HK May 14: in the
                // demo dataset, the most-recent-card-saved row had 0
                // bookings while an older sibling had 13. Always tying
                // the new booking onto the dead row would have orphaned
                // future history. Priority order:
                //   1. Most bookings (the active row, where history lives)
                //   2. Most recent card_saved_at (freshest card data)
                //   3. Most recent created_at (final tiebreaker)
                let clientRow = null;
                if (Array.isArray(clientRows) && clientRows.length > 0) {
                  if (clientRows.length === 1) {
                    clientRow = clientRows[0];
                  } else {
                    // Count bookings per candidate. Run in parallel to
                    // keep the booking page snappy on big duplicate sets.
                    const counts = await Promise.all(
                      clientRows.map(async (r) => {
                        const { count } = await supabase
                          .from('bookings').select('id', { count: 'exact', head: true })
                          .eq('client_id', r.id);
                        return { row: r, bookingCount: count || 0 };
                      })
                    );
                    counts.sort((a, b) => {
                      if (b.bookingCount !== a.bookingCount) return b.bookingCount - a.bookingCount;
                      const aSaved = a.row.card_saved_at ? new Date(a.row.card_saved_at).getTime() : 0;
                      const bSaved = b.row.card_saved_at ? new Date(b.row.card_saved_at).getTime() : 0;
                      if (bSaved !== aSaved) return bSaved - aSaved;
                      return new Date(b.row.created_at).getTime() - new Date(a.row.created_at).getTime();
                    });
                    clientRow = counts[0].row;
                    console.warn(`[Booking] Picked row ${clientRow.id} with ${counts[0].bookingCount} bookings.`);
                  }
                }
                if (clientRow?.id) {
                  setCardSavedClientId(clientRow.id);
                  // Order of preference for the saved-card identifier:
                  //   1. Stripe payment_method_id (legacy save-card path)
                  //   2. Square square_card_id (newer save-card-on-booking-token path)
                  // Either one means 'this client has a card on file and
                  // we can skip the card form'. The provider gets
                  // resolved downstream from which one is populated +
                  // therapist's payment_routing.
                  const savedPm = clientRow.payment_method_id || clientRow.square_card_id;
                  if (savedPm) {
                    setCardSavedPaymentMethodId(savedPm);
                  }
                  // Surface a processor-agnostic customer id so the
                  // cancellation charge later has the right provider
                  // customer reference. Stripe wins when both exist
                  // (matches the savedPm tiebreaker above).
                  if (clientRow.stripe_customer_id) {
                    setCardSavedCustomerId(clientRow.stripe_customer_id);
                  } else if (clientRow.square_customer_id) {
                    setCardSavedCustomerId(clientRow.square_customer_id);
                  }
                }
              }

              // Intake-before-booking gate. If the therapist has this on AND
              // approval is OFF AND the client is new AND they have not just
              // completed intake (signaled by intake_completed=1 URL param
              // after redirect), bounce them to the intake form first. After
              // intake submit, ClientIntake redirects back here with
              // intake_completed=1 and their info prefilled.
              //
              // When require_approval is also ON, the gate is bypassed: the
              // therapist may decline the request, so collecting intake first
              // would waste the client's effort. Intake is requested after
              // approval via the confirmation email. This keeps a single
              // submit step in the most-common combined-toggle case.
              const urlIntakeDone = new URLSearchParams(window.location.search).get('intake_completed') === '1';
              // Preview mode bypass (HK May 10 2026): when therapist
              // clicks 'Preview booking page' from Settings, the URL
              // includes ?preview=1. Skip the intake-first redirect
              // so the therapist can walk the full booking flow
              // without being yanked into the intake form.
              const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';
              if (therapist.require_intake_before_booking && !therapist.require_approval && !isRepeat && !urlIntakeDone && !isPreview) {
                const params = new URLSearchParams({
                  return_to_book: slug,
                  name: form.name,
                  email: form.email,
                  phone: form.phone,
                });
                window.location.href = `/${therapist.custom_url}?${params.toString()}`;
                return;
              }

              // Approval-required gate. New clients submit a request, returning
              // clients book directly. When approval is on, deposits are
              // skipped at request time, the therapist sends a payment link
              // after approving.
              const needsApproval = !!therapist.require_approval && !isRepeat;
              setRequiresApproval(needsApproval);

              const needsDeposit = !needsApproval && therapist.deposit_enabled && !isRepeat && !giftCert;
              setDepositRequired(needsDeposit);
              // Reset payment mode to 'deposit' default whenever the
              // booking context changes. The pay-in-full chooser will
              // re-show if therapist has it enabled.
              setPaymentMode('deposit');
              setTipCents(0);
              if(needsDeposit){
                const amt=Math.round((svc.price*(therapist.deposit_percent||20)/100)*100);
                setDepositAmount(amt);
              }

              // Cancellation policy Phase 2: card on file gating.
              // The card capture flow is engaged when:
              //   1. Therapist has the cancellation policy enabled
              //   2. Therapist has Stripe connected
              //   3. The relevant card_required toggle is on for this client class
              //   4. We are not in approval-required mode (in that case, the
              //      booking is pending-approval and the cancellation charge
              //      cannot fire yet anyway; therapist can request the card
              //      via payment link after she approves)
              const policy = therapist.cancellation_policy || {};
              const policyEnabled = !!therapist.cancellation_policy_enabled;
              const stripeReady = !!therapist.stripe_account_id;
              const squareReady = !!therapist.square_access_token;
              const policyRequiresFirstTimers = !!policy.card_required_first_timers;
              const policyRequiresRegulars = !!policy.card_required_regulars;
              const wantsCard = policyEnabled && !needsApproval &&
                ((isRepeat && policyRequiresRegulars) || (!isRepeat && policyRequiresFirstTimers));
              // Card capture now works with EITHER processor. The gate
              // fires whenever the therapist policy wants a card AND
              // any payment processor is connected. The init-card-setup
              // edge function picks the right one based on
              // payment_routing or auto-pick (Stripe wins ties).
              const cardNeeded = wantsCard && (stripeReady || squareReady);
              setCardOnFileRequired(cardNeeded);

              // Diagnostic logging so HK / therapists can see exactly why
              // the card-on-file gate did or did not fire.
              console.log(
                `%c[card-on-file] decision: ${cardNeeded ? 'WILL ASK' : 'WILL NOT ASK'}`,
                `color: ${cardNeeded ? '#2A5741' : '#B87840'}; font-weight: bold;`
              );
              console.log('[card-on-file]   inputs:', {
                policyEnabled, stripeReady, squareReady, isRepeat,
                policyRequiresFirstTimers, policyRequiresRegulars,
                needsApproval,
              });
              if (!cardNeeded && wantsCard && !stripeReady && !squareReady) {
                console.warn(
                  '[card-on-file] Card capture is wanted but no payment ' +
                  'processor is connected. The therapist needs to connect ' +
                  'either Stripe or Square in Settings → Payments.'
                );
              }

              setStep(4);
            }} style={{width:'100%',background:C.forest,color:C.white,border:'none',borderRadius:14,padding:'15px',fontSize:15,fontWeight:700,cursor:'pointer',marginTop:14}}>
              Review Booking →
            </button>

            {/* Gift certificate */}
            <div style={{marginTop:12}}>
              {!giftCert ? (
                <div>
                  <div style={{display:'flex',gap:8,marginTop:4}}>
                    <input
                      type="text"
                      value={giftCode}
                      onChange={e=>{setGiftCode(e.target.value.toUpperCase());setGiftError('');}}
                      placeholder="Have a gift certificate? Enter your code here"
                      style={{flex:1,padding:'10px 12px',border:`1.5px solid ${giftError?C.danger:C.light}`,borderRadius:10,fontSize:14,boxSizing:'border-box',outline:'none',fontFamily:'system-ui',letterSpacing:'0.05em'}}
                    />
                    <button onClick={checkGiftCode} disabled={giftChecking||!giftCode.trim()}
                      style={{background:C.sage,color:'#fff',border:'none',borderRadius:10,padding:'10px 16px',fontSize:13,fontWeight:700,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}>
                      {giftChecking?'…':'Apply'}
                    </button>
                  </div>
                  {giftError && <div style={{fontSize:12,color:C.danger,marginTop:4}}>{giftError}</div>}
                </div>
              ) : (
                <div style={{background:'#F0FDF4',border:'1.5px solid #86EFAC',borderRadius:10,padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:'#16A34A'}}>🎁 Gift certificate applied!</div>
                    <div style={{fontSize:12,color:'#374151'}}>${giftCert.remaining?.toFixed(0)} credit · Code: {giftCert.code}</div>
                  </div>
                  <button onClick={()=>{setGiftCert(null);setGiftCode('');}} aria-label="Remove gift certificate" style={{background:'transparent',border:'1px solid transparent',color:C.gray,cursor:'pointer',fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:999,transition:'all 0.15s'}} onMouseEnter={(e)=>{e.currentTarget.style.background='#FEF2F2';e.currentTarget.style.color='#DC2626';e.currentTarget.style.borderColor='#FCA5A5';}} onMouseLeave={(e)=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=C.gray;e.currentTarget.style.borderColor='transparent';}}>Remove</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4, Confirm */}
        {step===4&&!depositClientSecret&&!depositLoading&&(
          <div>
            <button onClick={()=>setStep(3)} style={{background:'none',border:'none',color:C.gray,fontSize:13,cursor:'pointer',padding:'0 0 12px',display:'flex',alignItems:'center',gap:4}}>‹ Back</button>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:C.dark,margin:'0 0 4px'}}>{requiresApproval ? 'Submit your request' : 'Confirm your booking'}</h2>
            <p style={{fontSize:13,color:C.gray,margin:'0 0 20px'}}>{requiresApproval ? `${therapist.full_name?.split(' ')[0] || 'Your therapist'} reviews each new client before confirming. You will hear back soon.` : 'Everything look right? Tap confirm to lock it in.'}</p>
            <div style={{background:C.white,borderRadius:16,padding:22,marginBottom:14}}>
              {[
                ['Service',svc.name],['Duration',`${svc.duration} min`],['Date',fmtDate(date)],
                ['Time',slot.display],['Therapist',therapist.business_name||therapist.full_name],
                ['Price',`$${svc.price}, pay at session`],['Name',form.name],['Email',form.email],
                ...(form.phone?[['Phone',form.phone]]:[]),
              ].map(([l,v],i,arr)=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,padding:'10px 0',borderBottom:i<arr.length-1?`1px solid ${C.light}`:'none'}}>
                  <span style={{fontSize:13,color:C.gray,flexShrink:0,minWidth:70}}>{l}</span>
                  <span style={{fontSize:13,fontWeight:600,color:C.dark,textAlign:'right'}}>{v}</span>
                </div>
              ))}
            </div>
            {requiresApproval&&(
              <div style={{marginBottom:14,background:'#FFFBEB',border:'1.5px solid #FDE68A',borderRadius:12,padding:'14px 16px',display:'flex',gap:10,alignItems:'flex-start'}}>
                <span style={{fontSize:18,flexShrink:0}}>🌿</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:'#92400E',marginBottom:3}}>This is a request, not a confirmed booking</div>
                  <div style={{fontSize:12,color:'#78350F',lineHeight:1.5}}>{therapist.full_name?.split(' ')[0] || 'Your therapist'} reviews each new client. You will get an email when your request is approved or declined. No payment is taken right now.</div>
                </div>
              </div>
            )}
            {!requiresApproval&&depositRequired&&!giftCert&&(
              <div style={{marginBottom:14,background:'#FEF3C7',border:'1.5px solid #FCD34D',borderRadius:12,padding:'16px',display:'flex',gap:12,alignItems:'flex-start'}}>
                <span style={{fontSize:22,flexShrink:0}}>💳</span>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:'#92400E',marginBottom:4}}>A deposit of ${(depositAmount/100).toFixed(0)} is required to confirm your spot</div>
                  <div style={{fontSize:12,color:'#92400E',lineHeight:1.5}}>
                    As a new client, {therapist.deposit_percent||20}% of the ${svc.price} session fee is collected now to reserve your appointment. The remaining ${svc.price - Math.round(svc.price*(therapist.deposit_percent||20)/100)} is paid directly to your therapist at the session.
                  </div>
                </div>
              </div>
            )}

            {/* Pay-in-full chooser + tip selector (Lindsey #2, May 10 2026).
                Shown when:
                  - therapist has pay_in_full_enabled
                  - not in approval mode
                  - no gift cert (it covers the full price already)
                  - has a connected payment processor
                Default selection is 'deposit' (or no charge if deposit
                also disabled). Selecting 'full' reveals tip chips. */}
            {!requiresApproval && !giftCert && therapist.pay_in_full_enabled &&
             (therapist.stripe_account_id || therapist.square_access_token) && (
              <div style={{
                marginBottom: 14, background: '#FFFFFF', border: '1.5px solid #DDD4C2',
                borderRadius: 14, padding: '16px',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Payment
                </div>

                {/* Option chips: deposit/no-charge vs pay-in-full */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: paymentMode === 'full' ? 14 : 0 }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    border: `1.5px solid ${paymentMode === 'deposit' ? C.forest : '#E8E4DC'}`,
                    background: paymentMode === 'deposit' ? '#F0FDF4' : '#FAFAF6',
                    borderRadius: 10, cursor: 'pointer',
                  }}>
                    <input
                      type="radio"
                      name="paymentMode"
                      value="deposit"
                      checked={paymentMode === 'deposit'}
                      onChange={() => setPaymentMode('deposit')}
                      style={{ accentColor: C.forest }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.dark }}>
                        {depositRequired ? `Pay deposit ($${(Math.round((svc.price * (therapist.deposit_percent || 20) / 100) * 100) / 100).toFixed(0)})` : 'Pay at session'}
                      </div>
                      <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
                        {depositRequired
                          ? `Remainder paid in person on ${fmtDate(date)}`
                          : 'Bring cash, card, or Venmo to the session'}
                      </div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    border: `1.5px solid ${paymentMode === 'full' ? C.forest : '#E8E4DC'}`,
                    background: paymentMode === 'full' ? '#F0FDF4' : '#FAFAF6',
                    borderRadius: 10, cursor: 'pointer',
                  }}>
                    <input
                      type="radio"
                      name="paymentMode"
                      value="full"
                      checked={paymentMode === 'full'}
                      onChange={() => setPaymentMode('full')}
                      style={{ accentColor: C.forest }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.dark }}>
                        Pay in full now (${svc.price})
                      </div>
                      <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
                        Skip the at-session payment.{therapist.accept_tips !== false ? ' Add a tip if you like.' : ''}
                      </div>
                    </div>
                  </label>
                </div>

                {/* Tip chips, only when paying in full + therapist accepts tips */}
                {paymentMode === 'full' && therapist.accept_tips !== false && (
                  <div style={{
                    paddingTop: 14, borderTop: `1px dashed ${C.light}`,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                      Add a tip
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[
                        { label: 'Skip', value: 0, kind: 'fixed' },
                        { label: `${therapist.tip_preset_1 ?? 15}%`, value: therapist.tip_preset_1 ?? 15, kind: 'percent' },
                        { label: `${therapist.tip_preset_2 ?? 18}%`, value: therapist.tip_preset_2 ?? 18, kind: 'percent' },
                        { label: `${therapist.tip_preset_3 ?? 20}%`, value: therapist.tip_preset_3 ?? 20, kind: 'percent' },
                      ].map((chip, idx) => {
                        const computedCents = chip.kind === 'percent'
                          ? Math.round(svc.price * 100 * chip.value / 100)
                          : 0;
                        const isActive = tipCents === computedCents;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setTipCents(computedCents)}
                            style={{
                              padding: '8px 16px', borderRadius: 999,
                              border: `1.5px solid ${isActive ? C.forest : '#DDD4C2'}`,
                              background: isActive ? C.forest : '#fff',
                              color: isActive ? '#fff' : C.dark,
                              fontSize: 13, fontWeight: 600, cursor: 'pointer',
                              fontFamily: 'system-ui',
                            }}>
                            {chip.label}
                            {chip.kind === 'percent' && (
                              <span style={{ marginLeft: 6, opacity: 0.75, fontSize: 12 }}>
                                ${(computedCents / 100).toFixed(0)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Total preview */}
                    <div style={{
                      marginTop: 14, padding: '10px 12px',
                      background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>You'll be charged today</span>
                      <span style={{ fontSize: 16, color: '#166534', fontWeight: 700 }}>
                        ${((svc.price * 100 + tipCents) / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {giftCert&&(
              <div style={{marginBottom:14,background:'#F0FDF4',border:'1.5px solid #86EFAC',borderRadius:12,padding:'12px 16px',display:'flex',gap:8,alignItems:'center'}}>
                <span style={{fontSize:18}}>🎁</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:'#16A34A'}}>Gift certificate applied, no deposit required</div>
                  <div style={{fontSize:12,color:'#374151',marginTop:2}}>${giftCert.remaining?.toFixed(0)} credit · Code: {giftCert.code}</div>
                </div>
              </div>
            )}
            {isRepeatClient&&!giftCert&&(
              <div style={{marginBottom:14,background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:12,padding:'12px 16px',display:'flex',gap:8,alignItems:'center'}}>
                <span>✅</span>
                <span style={{fontSize:13,color:'#16A34A',fontWeight:600}}>Welcome back! As a returning client, no deposit is required, your booking is confirmed instantly.</span>
              </div>
            )}
            {/* Booking policies gate (Ashley Scalzulli May 2026).
                Shows therapist's practice policies in a scrollable box,
                requires explicit checkbox before Confirm fires.
                Returning clients still see this; agreement is recorded
                per-booking so the audit trail is per-session, not
                lifetime per-client. */}
            {therapist?.booking_policies_enabled && therapist?.booking_policies && (
              <div style={{
                marginBottom: 12,
                background: '#FFFBEB',
                border: '1px solid #FCD34D',
                borderRadius: 12,
                overflow: 'hidden',
              }}>
                {/* Compact 1-row header: chevron + label + checkbox.
                    Click the chevron / label area to expand the policy
                    text below. Click the checkbox to agree without
                    expanding. Two separate click surfaces so checking
                    does not jiggle expansion. */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 14px',
                }}>
                  <button
                    onClick={() => setBookingPoliciesExpanded(v => !v)}
                    aria-label={bookingPoliciesExpanded ? 'Collapse practice policies' : 'Expand practice policies'}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 18, height: 18,
                      flexShrink: 0,
                      color: '#92400E',
                      transform: bookingPoliciesExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.18s',
                    }}>
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                        <polyline points="5 3 11 8 5 13" />
                      </svg>
                    </span>
                    <span style={{ fontSize: 14, color: '#1F2937', lineHeight: 1.35, flex: 1 }}>
                      <span style={{ fontWeight: 600 }}>📋 Practice policies.</span>{' '}
                      <span style={{ color: '#7C2D12' }}>{bookingPoliciesExpanded ? 'Tap to hide.' : 'Tap to read.'}</span>
                    </span>
                  </button>
                  <label
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      flexShrink: 0,
                      padding: '4px 10px 4px 6px',
                      borderRadius: 999,
                      background: bookingPoliciesAgreed ? '#ECFDF5' : 'transparent',
                      border: `1px solid ${bookingPoliciesAgreed ? '#86EFAC' : 'transparent'}`,
                      transition: 'background 0.15s, border 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={bookingPoliciesAgreed}
                      onChange={(e) => setBookingPoliciesAgreed(e.target.checked)}
                      style={{ flexShrink: 0, width: 16, height: 16, cursor: 'pointer', accentColor: '#16A34A' }}
                    />
                    <span style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: bookingPoliciesAgreed ? '#166534' : '#92400E',
                      whiteSpace: 'nowrap',
                    }}>
                      Agree
                    </span>
                  </label>
                </div>
                {bookingPoliciesExpanded && (
                  <div style={{
                    background: '#FFFFFF',
                    borderTop: '1px solid #FCD34D',
                    padding: '12px 16px',
                  }}>
                    <PolicyDisplay text={therapist.booking_policies} />
                  </div>
                )}
              </div>
            )}
            {/* Cancellation policy display — sleek compact version.
                Shows the headline rules at a glance via colored tier
                rows. Full prose available on tap-to-expand. */}
            {therapist?.cancellation_policy_enabled && therapist?.cancellation_policy && (() => {
              const p = therapist.cancellation_policy;
              const c1 = p.cancel_24h_plus_percent ?? 0;
              const c2 = p.cancel_2_to_24h_percent ?? 0;
              const c3 = p.cancel_under_2h_percent ?? 0;
              const r1 = p.reschedule_24h_plus_percent ?? 0;
              const r2 = p.reschedule_under_24h_percent ?? 0;
              const ns = p.no_show_percent ?? 0;
              const tierRow = (label, percent, tone) => {
                const palette = {
                  green: { bg: '#DCFCE7', fg: '#14532D', dot: '#16A34A' },
                  amber: { bg: '#FEF3C7', fg: '#78350F', dot: '#D97706' },
                  red:   { bg: '#FEE2E2', fg: '#991B1B', dot: '#DC2626' },
                  gray:  { bg: '#F3F4F6', fg: '#374151', dot: '#6B7280' },
                }[tone];
                const display = percent === 0 ? 'No charge' : `${percent}% of session`;
                return (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 10px', borderRadius: 8,
                    background: palette.bg, marginBottom: 4,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: palette.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: palette.fg, flex: 1 }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: palette.fg }}>{display}</span>
                  </div>
                );
              };
              return (
                <div style={{
                  marginBottom: 12,
                  background: '#FAF6EE',
                  border: '1px solid #E5D5C8',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}>
                  {/* Compact 1-row header matching the booking-policies
                      gate above: chevron + label + Agree checkbox.
                      Click chevron / label to expand the tier breakdown.
                      Click checkbox to agree. */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 14px',
                  }}>
                    <button
                      onClick={() => setCancellationExpanded(v => !v)}
                      aria-label={cancellationExpanded ? 'Collapse cancellation policy' : 'Expand cancellation policy'}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 18, height: 18,
                        flexShrink: 0,
                        color: '#5C2E27',
                        transform: cancellationExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.18s',
                      }}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                          <polyline points="5 3 11 8 5 13" />
                        </svg>
                      </span>
                      <span style={{ fontSize: 14, color: '#1F2937', lineHeight: 1.35, flex: 1 }}>
                        <span style={{ fontWeight: 600 }}>🕐 Cancellation policy.</span>{' '}
                        <span style={{ color: '#7A5C53' }}>{cancellationExpanded ? 'Tap to hide.' : 'Tap to read.'}</span>
                      </span>
                    </button>
                    <label
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        flexShrink: 0,
                        padding: '4px 10px 4px 6px',
                        borderRadius: 999,
                        background: cancellationAgreed ? '#ECFDF5' : 'transparent',
                        border: `1px solid ${cancellationAgreed ? '#86EFAC' : 'transparent'}`,
                        transition: 'background 0.15s, border 0.15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={cancellationAgreed}
                        onChange={(e) => setCancellationAgreed(e.target.checked)}
                        style={{ flexShrink: 0, width: 16, height: 16, cursor: 'pointer', accentColor: '#16A34A' }}
                      />
                      <span style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: cancellationAgreed ? '#166534' : '#5C2E27',
                        whiteSpace: 'nowrap',
                      }}>
                        Agree
                      </span>
                    </label>
                  </div>
                  {cancellationExpanded && (
                    <div style={{
                      background: '#FFFFFF',
                      borderTop: '1px solid #E5D5C8',
                      padding: '12px 14px',
                    }}>
                      {/* Headline cancel tiers */}
                      {(c1 > 0 || c2 > 0 || c3 > 0) && (
                        <div style={{ marginBottom: 6 }}>
                          {tierRow('More than 24h ahead', c1, c1 === 0 ? 'green' : 'amber')}
                          {c2 > 0 && tierRow('Within 24h', c2, 'amber')}
                          {c3 > 0 && tierRow('Within 2h', c3, 'red')}
                        </div>
                      )}

                      {(r1 > 0 || r2 > 0 || ns > 0) && (
                        <div style={{
                          fontSize: 11, color: '#5C2E27', lineHeight: 1.6,
                          paddingTop: 6, borderTop: '1px dashed #E5D5C8',
                        }}>
                          {(r1 > 0 || r2 > 0) && (
                            <div>
                              <strong>Reschedule:</strong> {r1 === 0 ? 'free if 24h+ ahead' : `${r1}% if 24h+ ahead`}
                              {r2 > 0 && `, ${r2}% within 24h`}
                            </div>
                          )}
                          {ns > 0 && (
                            <div><strong>No-show:</strong> {ns}% of session.</div>
                          )}
                        </div>
                      )}

                      {p.custom_text && p.custom_text.trim().length > 0 && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ fontSize: 11, color: '#7A5C53', cursor: 'pointer' }}>Read therapist's full policy</summary>
                          <pre style={{
                            margin: '6px 0 0', fontSize: 11, fontFamily: 'inherit',
                            whiteSpace: 'pre-wrap', color: '#1F2937', lineHeight: 1.6,
                          }}>{p.custom_text}</pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* CANCELLATION POLICY PHASE 2: card on file capture.
                Three sub-states governed by cardOnFileRequired,
                cardSavedPaymentMethodId, and cardSetupClientSecret:

                  STATE A: required, not yet started
                    Show mandate text + agreement checkbox + "Authorize" button.
                    Clicking Authorize calls save-card-on-booking edge function.

                  STATE B: required, edge function called, card form mounted
                    cardSetupClientSecret is non-null. Show StripeCardSetupForm.
                    On success, payment_method_id is saved on the clients record
                    and we move to STATE C.

                  STATE C: required, card saved
                    Show green ✓ "Card saved on file" badge.
                    Confirm button below is now enabled. */}
            {cardOnFileRequired && !cardSavedPaymentMethodId && !cardSetupClientSecret && (
              <div style={{
                marginBottom: 14,
                background: '#FFFBEB',
                border: '1.5px solid #FCD34D',
                borderRadius: 12,
                padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>💳</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#78350F', letterSpacing: 0.3, textTransform: 'uppercase' }}>Card on file required</span>
                </div>

                {/* Compact one-liner. Full authorization text available
                    on tap. Keeps the legal teeth without the wall of
                    text. */}
                <div style={{ fontSize: 12, color: '#1F2937', lineHeight: 1.5, marginBottom: 10 }}>
                  Save a card to confirm. Only charged if a fee triggers per the policy above.
                </div>

                <details style={{ marginBottom: 10 }}>
                  <summary style={{ fontSize: 11, color: '#7A5C53', cursor: 'pointer', userSelect: 'none' }}>
                    Read full authorization
                  </summary>
                  <div style={{
                    fontSize: 11, color: '#1F2937', lineHeight: 1.6,
                    whiteSpace: 'pre-wrap', marginTop: 6,
                    padding: '8px 10px', background: '#FFFEF7',
                    border: '1px dashed #FCD34D', borderRadius: 6,
                  }}>
                    {cardMandateText()}
                  </div>
                </details>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cardMandateAgreed}
                    onChange={e => { setCardMandateAgreed(e.target.checked); setCardError(null); }}
                    style={{ marginTop: 3, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 12, color: '#1F2937', lineHeight: 1.5 }}>
                    I agree and authorize this card if a fee triggers.
                  </span>
                </label>
                <button
                  onClick={initCardSetup}
                  disabled={!cardMandateAgreed || cardCapturing}
                  style={{
                    width: '100%',
                    background: !cardMandateAgreed || cardCapturing ? C.sage : C.forest,
                    color: C.white,
                    border: 'none',
                    borderRadius: 12,
                    padding: '14px',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: !cardMandateAgreed || cardCapturing ? 'default' : 'pointer',
                  }}>
                  {cardCapturing ? 'Setting up…' : 'Authorize and enter card'}
                </button>
              </div>
            )}

            {cardOnFileRequired && cardSetupClientSecret && !cardSavedPaymentMethodId && (
              <div style={{ marginBottom: 14 }}>
                <div style={{
                  background: '#FFFBEB',
                  border: '1.5px solid #FCD34D',
                  borderRadius: 12,
                  padding: '12px 16px',
                  marginBottom: 12,
                  fontSize: 11,
                  color: '#78350F',
                  lineHeight: 1.5,
                }}>
                  By saving your card you authorize charges per the cancellation policy above. Card is not charged now.
                </div>
                {cardSetupProcessor === 'square' ? (
                  <SquareCardSetupForm
                    clientSecret={cardSetupClientSecret}
                    customerId={cardSavedCustomerId}
                    clientId={cardSavedClientId}
                    therapistId={therapist?.id}
                    mandateAgreed={cardMandateAgreed}
                    onSuccess={onCardSaveSuccess}
                    onError={msg => setCardError(msg)}
                  />
                ) : (
                  <StripeCardSetupForm
                    clientSecret={cardSetupClientSecret}
                    stripeAccountId={cardSetupAccountId}
                    mandateAgreed={cardMandateAgreed}
                    onSuccess={onCardSaveSuccess}
                    onError={msg => setCardError(msg)}
                  />
                )}
              </div>
            )}

            {cardOnFileRequired && cardSavedPaymentMethodId && (
              <div style={{
                marginBottom: 14,
                background: '#F0FDF4',
                border: '1.5px solid #86EFAC',
                borderRadius: 12,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: '#16A34A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0,
                }}>✓</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#14532D' }}>Card saved on file</div>
                  <div style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>Only charged if the policy above triggers a fee.</div>
                </div>
              </div>
            )}

            {cardError && (
              <div style={{
                marginBottom: 12,
                background: '#FEF2F2',
                border: '1.5px solid #FECACA',
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: 13,
                color: '#991B1B',
                lineHeight: 1.5,
              }}>
                ⚠️ <strong>Card error:</strong> {cardError}
              </div>
            )}

            {/* While card-on-file capture is in progress (mandate panel
                showing or Stripe form mounted but card not yet saved),
                hide the bottom Confirm button. The card-on-file box is
                the sole primary action until a card is saved. Replacing
                with a small hint preserves the user's mental model that
                booking confirmation comes after the card step. Once the
                card is saved, the green ✓ badge appears above and the
                full Confirm Booking button reappears here. */}
            {cardOnFileRequired && !cardSavedPaymentMethodId ? (
              <p style={{
                fontSize: 12,
                color: C.gray,
                textAlign: 'center',
                marginTop: 4,
                lineHeight: 1.6,
                padding: '12px 16px',
                background: '#FAFAF7',
                border: `1px dashed ${C.light}`,
                borderRadius: 10,
              }}>
                After saving your card above, the Confirm Booking button will appear here.
              </p>
            ) : (
              <>
                {(() => {
                  // Both policies gate: if a therapist has either or
                  // both enabled, the client must tick the matching
                  // Agree checkbox(es) before Confirm fires. Message
                  // names the specific outstanding agreement so the
                  // client knows which row to look at.
                  const bkRequired = !!(therapist?.booking_policies_enabled && therapist?.booking_policies);
                  const cxRequired = !!(therapist?.cancellation_policy_enabled && therapist?.cancellation_policy);
                  const bkBlocked = bkRequired && !bookingPoliciesAgreed;
                  const cxBlocked = cxRequired && !cancellationAgreed;
                  const policiesBlocked = bkBlocked || cxBlocked;
                  const blockedLabel = (bkBlocked && cxBlocked)
                    ? 'Please agree to the policies above'
                    : bkBlocked
                      ? 'Please agree to the practice policies above'
                      : cxBlocked
                        ? 'Please agree to the cancellation policy above'
                        : '';
                  const isBlocked = submitting || policiesBlocked;
                  return (
                <button onClick={submit} disabled={isBlocked}
                  style={{width:'100%',background:isBlocked?'#9CA3AF':C.forest,color:C.white,border:'none',borderRadius:14,padding:'17px',fontSize:16,fontWeight:700,cursor:isBlocked?'not-allowed':'pointer',transition:'background 0.2s',boxShadow:`0 4px 20px rgba(42,87,65,${isBlocked?0.05:0.3})`,opacity:policiesBlocked?0.85:1}}>
                  {policiesBlocked
                    ? blockedLabel
                    : (submitting
                    ? (requiresApproval?'Sending…':'Confirming…')
                    : (requiresApproval
                        ? 'Send Request'
                        : (paymentMode === 'full'
                            ? `✓ Confirm & Pay $${((svc.price*100 + tipCents)/100).toFixed(0)}`
                            : (depositRequired
                                ? `✓ Confirm & Pay $${(depositAmount/100).toFixed(0)} Deposit`
                                : '✓ Confirm Booking'))))}
                </button>
                  );
                })()}
                {!requiresApproval&&!depositRequired&&!isRepeatClient&&!cardOnFileRequired&&(
                  <p style={{fontSize:11,color:C.gray,textAlign:'center',marginTop:10,lineHeight:1.5}}>
                    No payment now. You'll fill your intake form right after booking.
                  </p>
                )}
              </>
            )}
            {paymentError&&(
              <div style={{marginTop:12,background:'#FEF2F2',border:'1.5px solid #FECACA',borderRadius:10,padding:'14px',fontSize:13,color:'#991B1B',lineHeight:1.5}}>
                ⚠️ <strong>Deposit error:</strong> {paymentError}
              </div>
            )}
          </div>
        )}

        {/* DEPOSIT LOADING */}
        {depositLoading&&(
          <div style={{textAlign:'center',padding:'60px 20px'}}>
            <div style={{fontSize:32,marginBottom:12}}>💳</div>
            <div style={{fontSize:15,fontWeight:600,color:C.dark,marginBottom:6}}>Setting up payment…</div>
          </div>
        )}

        {/* DEPOSIT PAYMENT FORM, embedded, no redirect */}
        {depositClientSecret&&!confirmed&&(
          <div>
            <button onClick={()=>{setDepositClientSecret(null);setDepositAccountId(null);setStep(4);}}
              style={{background:'none',border:'none',color:C.gray,fontSize:13,cursor:'pointer',padding:'0 0 12px',display:'flex',alignItems:'center',gap:4}}>
              ‹ Back
            </button>
            <div style={{background:C.white,borderRadius:16,padding:20,marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                <div style={{width:44,height:44,borderRadius:'50%',background:'#FEF3C7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>💳</div>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:C.dark}}>Pay deposit</div>
                  <div style={{fontSize:13,color:C.gray}}>${(depositAmount/100).toFixed(0)} · {svc?.name}</div>
                </div>
              </div>
              <p style={{fontSize:12,color:C.gray,margin:'0 0 4px',lineHeight:1.5}}>
                This secures your appointment. The remaining ${svc.price - (depositAmount/100)} session fee is paid directly to your therapist when you arrive.
              </p>
            </div>
            {paymentError&&(
              <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,padding:'12px 14px',marginBottom:14,fontSize:13,color:'#991B1B'}}>
                ⚠️ {paymentError}
              </div>
            )}
            <StripePaymentForm
              clientSecret={depositClientSecret}
              depositAmount={depositAmount}
              stripeAccountId={depositAccountId}
              therapistName={therapist?.business_name || therapist?.full_name}
              bookingId={bookingId}
              onSuccess={onDepositSuccess}
              onError={msg=>setPaymentError(msg)}
            />
          </div>
        )}

      </div>

      {/* OFFER PURCHASE MODAL.
          Opens when client taps a package or membership card. Collects
          name + email + phone, then sends them to hosted Stripe Checkout
          or Square Payment Link. Memberships are Stripe-only (membership
          cards only render for Stripe-connected therapists).

          DESIGN NOTE: backdrop tap does NOT close the modal. Once the
          client has started typing, an accidental tap outside should
          not lose their work. Only the explicit × button or Cancel
          button dismisses. This rule applies to all input-bearing
          modals on the booking page. */}
      {offerModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, zIndex: 9999,
          }}>
          <div
            style={{
              background: '#fff', borderRadius: 18,
              maxWidth: 440, width: '100%',
              padding: 24,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              position: 'relative',
            }}>
            {/* Explicit close button. Sits in the top-right corner.
                Disabled while the request is in flight to prevent
                race conditions. */}
            <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 2 }}>
              <CloseButton onClick={() => !offerLoading && setOfferModal(null)} label="Close" disabled={offerLoading} />
            </div>

            <div style={{ marginBottom: 16, paddingRight: 36 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                {offerModal.type === 'package' ? 'Buy a package' : 'Start a membership'}
              </div>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
                {offerModal.item.name}
              </div>
              <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.5 }}>
                {offerModal.type === 'package'
                  ? <>${Number(offerModal.item.price).toFixed(0)} for {offerModal.item.session_count} sessions{offerModal.item.expires_in_days ? ` (use within ${offerModal.item.expires_in_days} days)` : ''}</>
                  : <>${Number(offerModal.item.monthly_price).toFixed(0)} per month, {offerModal.item.monthly_session_credits} session{offerModal.item.monthly_session_credits !== 1 ? 's' : ''} included</>
                }
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              <input
                placeholder="Your name"
                value={offerForm.name}
                onChange={(e) => setOfferForm({ ...offerForm, name: e.target.value })}
                style={{ background: '#FAFAF7', border: `1.5px solid ${C.light}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, outline: 'none', width: '100%' }}
              />
              <input
                placeholder="Email"
                type="email"
                value={offerForm.email}
                onChange={(e) => setOfferForm({ ...offerForm, email: e.target.value })}
                style={{ background: '#FAFAF7', border: `1.5px solid ${C.light}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, outline: 'none', width: '100%' }}
              />
              <input
                placeholder="Phone (optional)"
                value={offerForm.phone}
                onChange={(e) => setOfferForm({ ...offerForm, phone: e.target.value })}
                style={{ background: '#FAFAF7', border: `1.5px solid ${C.light}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, outline: 'none', width: '100%' }}
              />
            </div>

            {offerError && (
              <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#991B1B', marginBottom: 14, lineHeight: 1.5 }}>
                ⚠️ {offerError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setOfferModal(null)}
                disabled={offerLoading}
                style={{ flex: 1, background: '#fff', border: `1.5px solid ${C.light}`, borderRadius: 12, padding: '14px', fontSize: 14, fontWeight: 600, color: C.gray, cursor: offerLoading ? 'default' : 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={buyOffer}
                disabled={offerLoading}
                style={{ flex: 2, background: offerLoading ? C.sage : C.forest, color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 14, fontWeight: 700, cursor: offerLoading ? 'default' : 'pointer', boxShadow: '0 4px 14px rgba(42,87,65,0.25)' }}>
                {offerLoading ? 'Opening checkout…' : 'Continue to payment'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: C.gray, textAlign: 'center', margin: '12px 0 0', lineHeight: 1.5 }}>
              You'll be sent to a secure {therapist?.stripe_account_id && offerModal.type === 'membership' ? 'Stripe' : (therapist?.stripe_account_id ? 'Stripe' : 'Square')} checkout to enter your card and complete the purchase.
            </p>
          </div>
        </div>
      )}

      {/* CART FLOATING BUTTON.
          Bottom-right of viewport. Visible whenever cart has items.
          Tap → opens cart drawer. Acts as a persistent reminder so
          clients who add a package and keep browsing know what's
          waiting in their cart. */}
      {cart.length > 0 && !cartCheckoutModal && (
        <button
          onClick={() => setCartOpen(true)}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            background: C.forest,
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '14px 20px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 8px 24px rgba(42,87,65,0.35)',
            zIndex: 9990,
          }}>
          <span style={{ fontSize: 18 }}>🛒</span>
          <span>{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
          <span style={{ opacity: 0.85 }}>·</span>
          <span>${(cartTotalCents() / 100).toFixed(0)}</span>
        </button>
      )}

      {/* CART DRAWER (modal-style).
          Opens when cart button is tapped. Lists each cart item with
          a remove button, shows the running total, and offers
          'Continue to checkout'. Backdrop tap is ALLOWED to close
          (no input fields here, no work to lose). */}
      {cartOpen && (
        <div
          onClick={() => setCartOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, zIndex: 9995,
          }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 18,
              maxWidth: 480, width: '100%', maxHeight: '85vh', overflowY: 'auto',
              padding: 24,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              position: 'relative',
            }}>
            <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 2 }}>
              <CloseButton onClick={() => setCartOpen(false)} label="Close" />
            </div>

            <div style={{ marginBottom: 16, paddingRight: 36 }}>
              <h3 style={{ fontFamily: 'Georgia,serif', fontSize: 20, fontWeight: 700, color: C.dark, margin: '0 0 4px' }}>
                🛒 Your cart
              </h3>
              <p style={{ fontSize: 13, color: C.gray, margin: 0 }}>
                {cart.length} package{cart.length !== 1 ? 's' : ''} ready to check out.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {cart.map((p, idx) => (
                <div key={`${p.id}-${idx}`} style={{
                  background: '#FAF5EE',
                  border: `1.5px solid ${C.beige || '#E8DCC4'}`,
                  borderRadius: 12,
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>📦 {p.name}</div>
                    <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                      {p.session_count} sessions · ${Number(p.price).toFixed(0)}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCart(idx)}
                    aria-label="Remove from cart"
                    style={{
                      background: 'transparent', border: '1px solid transparent',
                      color: '#DC2626', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', padding: '4px 10px',
                      borderRadius: 999, transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e)=>{e.currentTarget.style.background='#FEF2F2';e.currentTarget.style.borderColor='#FCA5A5';}}
                    onMouseLeave={(e)=>{e.currentTarget.style.background='transparent';e.currentTarget.style.borderColor='transparent';}}>Remove</button>
                </div>
              ))}
            </div>

            <div style={{
              borderTop: `1.5px solid ${C.light}`,
              paddingTop: 14,
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}>
              <span style={{ fontSize: 14, color: C.gray }}>Total</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: C.forest }}>
                ${(cartTotalCents() / 100).toFixed(0)}
              </span>
            </div>

            <button
              onClick={() => {
                setCartOpen(false);
                openCartCheckout();
              }}
              style={{
                width: '100%',
                background: C.forest,
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '14px',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(42,87,65,0.25)',
                marginBottom: 8,
              }}>
              Continue to checkout →
            </button>
            <button
              onClick={() => setCartOpen(false)}
              style={{
                width: '100%',
                background: '#fff',
                color: C.gray,
                border: `1.5px solid ${C.light}`,
                borderRadius: 12,
                padding: '12px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}>
              Keep browsing
            </button>
          </div>
        </div>
      )}

      {/* CART CHECKOUT MODAL.
          Opens after the client taps Continue to checkout. Collects
          name, email, phone ONCE for the whole cart (not per item).
          Tap-outside does NOT dismiss because the client may have
          typed; explicit × is the only close affordance. */}
      {cartCheckoutModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, zIndex: 9999,
          }}>
          <div
            style={{
              background: '#fff', borderRadius: 18,
              maxWidth: 440, width: '100%',
              padding: 24,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              position: 'relative',
            }}>
            <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 2 }}>
              <CloseButton onClick={() => !cartCheckoutLoading && setCartCheckoutModal(false)} label="Cancel" disabled={cartCheckoutLoading} />
            </div>
            <div style={{ marginBottom: 16, paddingRight: 36 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Checkout
              </div>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
                {cart.length} package{cart.length !== 1 ? 's' : ''} · ${(cartTotalCents() / 100).toFixed(0)}
              </div>
              <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.5 }}>
                Tell us who you are, then we'll send you to checkout.
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              <input
                placeholder="Your name"
                value={offerForm.name}
                onChange={(e) => setOfferForm({ ...offerForm, name: e.target.value })}
                style={{ background: '#FAFAF7', border: `1.5px solid ${C.light}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, outline: 'none', width: '100%' }}
              />
              <input
                placeholder="Email"
                type="email"
                value={offerForm.email}
                onChange={(e) => setOfferForm({ ...offerForm, email: e.target.value })}
                style={{ background: '#FAFAF7', border: `1.5px solid ${C.light}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, outline: 'none', width: '100%' }}
              />
              <input
                placeholder="Phone (optional)"
                value={offerForm.phone}
                onChange={(e) => setOfferForm({ ...offerForm, phone: e.target.value })}
                style={{ background: '#FAFAF7', border: `1.5px solid ${C.light}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, outline: 'none', width: '100%' }}
              />
            </div>
            {cartCheckoutError && (
              <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#991B1B', marginBottom: 14, lineHeight: 1.5 }}>
                ⚠️ {cartCheckoutError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setCartCheckoutModal(false)}
                disabled={cartCheckoutLoading}
                style={{ flex: 1, background: '#fff', border: `1.5px solid ${C.light}`, borderRadius: 12, padding: '14px', fontSize: 14, fontWeight: 600, color: C.gray, cursor: cartCheckoutLoading ? 'default' : 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={checkoutCart}
                disabled={cartCheckoutLoading}
                style={{ flex: 2, background: cartCheckoutLoading ? C.sage : C.forest, color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 14, fontWeight: 700, cursor: cartCheckoutLoading ? 'default' : 'pointer', boxShadow: '0 4px 14px rgba(42,87,65,0.25)' }}>
                {cartCheckoutLoading ? 'Opening checkout…' : `Pay $${(cartTotalCents() / 100).toFixed(0)}`}
              </button>
            </div>
            <p style={{ fontSize: 11, color: C.gray, textAlign: 'center', margin: '12px 0 0', lineHeight: 1.5 }}>
              You'll be sent to a secure {therapist?.stripe_account_id ? 'Stripe' : 'Square'} checkout to enter your card.
            </p>
          </div>
        </div>
      )}

      {/* CART FLASH.
          Brief 'Added to cart' confirmation that auto-fades after
          2.5 seconds. Top-center floating, doesn't block any UI. */}
      {cartFlash && (
        <div style={{
          position: 'fixed', top: 70, left: '50%',
          transform: 'translateX(-50%)',
          background: '#1F3A2C',
          color: '#fff',
          padding: '10px 18px',
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 8px 24px rgba(31,58,44,0.35)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          animation: 'cartFlashFade 2.5s ease forwards',
        }}>
          <span>✓</span>
          <span>{cartFlash}</span>
        </div>
      )}

      {/* PURCHASE SUCCESS BANNER.
          Shown briefly after the redirect handler creates the
          package_purchases or member_subscriptions row. Floats at the
          top of the page, auto-clears on next interaction. */}
      {purchaseSuccess && (
        <div
          onClick={() => setPurchaseSuccess(null)}
          style={{
            position: 'fixed', top: 16, left: 16, right: 16,
            background: '#F0FDF4', border: '1.5px solid #86EFAC',
            borderRadius: 14, padding: '14px 18px',
            fontSize: 14, color: '#14532D', lineHeight: 1.5,
            boxShadow: '0 8px 28px rgba(20,83,45,0.2)',
            zIndex: 9998, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10,
            maxWidth: 560, margin: '0 auto',
          }}>
          <span style={{ fontSize: 20 }}>🎉</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>
              {purchaseSuccess.kind === 'package' ? 'Package activated' : 'Membership active'}
            </div>
            <div style={{ fontSize: 12, marginTop: 2 }}>
              {purchaseSuccess.kind === 'package'
                ? 'Your sessions are ready to book. Pick a service below.'
                : 'Your monthly credits are loaded. Pick a service below.'}
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#14532D', letterSpacing: '0.04em' }}>Dismiss</span>
        </div>
      )}

    </div>
  );
}
