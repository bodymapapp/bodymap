// src/components/BillingDashboard.js
import React, { useState, useEffect, useMemo } from 'react';
import RefundModal from './RefundModal';
import BillingDashboardV2 from './BillingDashboardV2';

const TODAY = new Date();
TODAY.setHours(0,0,0,0);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const DEFAULT_RATE = 85;

const SAMPLE_SESSIONS = [
  { id:1,  client:'Sarah M.',     date:addDays(TODAY,0),   time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:2,  client:'Jennifer K.',  date:addDays(TODAY,0),   time:'10:30 AM', duration:90, rate:110,          actual:null,         status:'pending' },
  { id:3,  client:'Maria L.',     date:addDays(TODAY,0),   time:'12:00 PM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:4,  client:'Rachel T.',    date:addDays(TODAY,0),   time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:null,         status:'pending' },
  { id:5,  client:'Amy W.',       date:addDays(TODAY,0),   time:'3:30 PM',  duration:90, rate:110,          actual:null,         status:'pending' },
  { id:6,  client:'Dana P.',      date:addDays(TODAY,-1),  time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:7,  client:'Christine B.', date:addDays(TODAY,-1),  time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:8,  client:'Monica G.',    date:addDays(TODAY,-1),  time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:9,  client:'Tanya R.',     date:addDays(TODAY,-2),  time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:10, client:'Lisa N.',      date:addDays(TODAY,-2),  time:'1:00 PM',  duration:90, rate:110,          actual:100,          status:'paid' },
  { id:11, client:'Sarah M.',     date:addDays(TODAY,-2),  time:'3:00 PM',  duration:60, rate:DEFAULT_RATE, actual:0,            status:'waived' },
  { id:12, client:'Jennifer K.',  date:addDays(TODAY,-3),  time:'9:30 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:13, client:'Maria L.',     date:addDays(TODAY,-3),  time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:14, client:'Amy W.',       date:addDays(TODAY,-4),  time:'10:00 AM', duration:90, rate:110,          actual:110,          status:'paid' },
  { id:15, client:'Rachel T.',    date:addDays(TODAY,-4),  time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:null,         status:'outstanding' },
  { id:16, client:'Monica G.',    date:addDays(TODAY,-5),  time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:17, client:'Dana P.',      date:addDays(TODAY,-6),  time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:18, client:'Christine B.', date:addDays(TODAY,-7),  time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:19, client:'Sarah M.',     date:addDays(TODAY,-8),  time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:20, client:'Tanya R.',     date:addDays(TODAY,-9),  time:'1:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:21, client:'Lisa N.',      date:addDays(TODAY,-10), time:'3:00 PM',  duration:90, rate:110,          actual:110,          status:'paid' },
  { id:22, client:'Monica G.',    date:addDays(TODAY,-11), time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:23, client:'Maria L.',     date:addDays(TODAY,-12), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:24, client:'Jennifer K.',  date:addDays(TODAY,-13), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:25, client:'Amy W.',       date:addDays(TODAY,-14), time:'9:00 AM',  duration:90, rate:110,          actual:110,          status:'paid' },
  { id:26, client:'Sarah M.',     date:addDays(TODAY,-16), time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:27, client:'Dana P.',      date:addDays(TODAY,-17), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:28, client:'Christine B.', date:addDays(TODAY,-18), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:29, client:'Monica G.',    date:addDays(TODAY,-20), time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:30, client:'Tanya R.',     date:addDays(TODAY,-21), time:'3:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:31, client:'Sarah M.',     date:addDays(TODAY,-25), time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:32, client:'Maria L.',     date:addDays(TODAY,-26), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:33, client:'Jennifer K.',  date:addDays(TODAY,-28), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:34, client:'Amy W.',       date:addDays(TODAY,-30), time:'9:00 AM',  duration:90, rate:110,          actual:110,          status:'paid' },
  { id:35, client:'Monica G.',    date:addDays(TODAY,-35), time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:36, client:'Dana P.',      date:addDays(TODAY,-40), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:37, client:'Christine B.', date:addDays(TODAY,-45), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:38, client:'Tanya R.',     date:addDays(TODAY,-50), time:'3:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:39, client:'Sarah M.',     date:addDays(TODAY,-55), time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:40, client:'Maria L.',     date:addDays(TODAY,-60), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:41, client:'Monica G.',    date:addDays(TODAY,-65), time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:42, client:'Lisa N.',      date:addDays(TODAY,-70), time:'1:00 PM',  duration:90, rate:110,          actual:110,          status:'paid' },
  { id:43, client:'Jennifer K.',  date:addDays(TODAY,-75), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:44, client:'Amy W.',       date:addDays(TODAY,-80), time:'9:00 AM',  duration:90, rate:110,          actual:110,          status:'paid' },
  { id:45, client:'Sarah M.',     date:addDays(TODAY,-85), time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:46, client:'Dana P.',      date:addDays(TODAY,-90), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:47, client:'Christine B.', date:addDays(TODAY,-95), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:48, client:'Tanya R.',     date:addDays(TODAY,-100),time:'3:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:49, client:'Monica G.',    date:addDays(TODAY,-110),time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:50, client:'Sarah M.',     date:addDays(TODAY,-120),time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
];

// Sample-data banner shown above V2 when no payment processor is
// connected. Uses V2 palette (cream + sage) so it blends rather than
// shouting in V1's orange.
function SampleDataBanner() {
  return (
    <div style={{
      background: '#F0F6EE',
      border: '1px solid #B7D1AB',
      borderRadius: 14,
      padding: '12px 16px',
      marginBottom: 16,
      fontSize: 13,
      color: '#1F4131',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <span style={{ fontSize: 16 }}>👁️</span>
      <div>
        <strong>Sample data, preview only.</strong> Connect Stripe in Settings to track your real payments. Your actual revenue will replace this preview automatically.
      </div>
    </div>
  );
}


export default function BillingDashboard({ therapist }) {
  // Per-processor connection flags. Either one being connected counts
  // as "the therapist has a real payment processor and we should
  // pull live data."
  const [stripeConnected, setStripeConnected] = useState(null);
  const [squareConnected, setSquareConnected] = useState(null);
  const [sessionRate, setSessionRate] = useState(DEFAULT_RATE);
  const [realTransactions, setRealTransactions] = useState(null); // null = loading, [] = connected but empty, [...] = has data
  // Phase 14.3b (HK May 17 2026): in-app refund. refundTarget holds the
  // session row to be refunded. reloadTick increments after a refund
  // succeeds to trigger the useEffect to re-pull data.
  const [refundTarget, setRefundTarget] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!therapist?.id) return;
    import('../lib/supabase').then(async ({ supabase }) => {
      // Step 1: therapist config (processor connection flags, session rate)
      const { data } = await supabase
        .from('therapists')
        .select('stripe_account_id, stripe_account_connected, square_access_token, square_connected, session_rate')
        .eq('id', therapist.id)
        .single();
      const stripeOk = !!(data?.stripe_account_id && data?.stripe_account_connected);
      const squareOk = !!(data?.square_access_token && data?.square_connected);
      setStripeConnected(stripeOk);
      setSquareConnected(squareOk);
      if (data?.session_rate && data.session_rate > 0) setSessionRate(data.session_rate);

      if (!stripeOk && !squareOk) {
        // Neither connected. Leave realTransactions null so the
        // sample-data banner shows.
        return;
      }

      // Phase 14.1 (HK May 17 2026): primary data source is session_payments,
      // not Stripe Connect API. session_payments is BodyMap's own table,
      // one row per real payment (Stripe or offline cash/Venmo/Zelle).
      // Includes refunds, tips, payment_method breakdown. Joined with
      // bookings for service name and completed-but-unpaid leakage view.
      //
      // We deliberately exclude bookings with imported=true from the
      // "expected revenue" calc, because CSV imports are historical
      // backfill data, not real money in the pipeline.
      const { data: payments } = await supabase
        .from('session_payments')
        .select('id, booking_id, client_id, amount_cents, tip_cents, payment_method, payment_method_detail, status, paid_at, created_at')
        .eq('therapist_id', therapist.id)
        .order('paid_at', { ascending: false })
        .limit(500);

      // Bookings for the same therapist, recent + upcoming. Joined to
      // services for price + duration. Filtered to exclude imports.
      // We need both completed (to compute expected) and unpaid-but-
      // completed (leakage), so we fetch all confirmed/completed in
      // the recent window.
      const horizonStart = new Date();
      horizonStart.setDate(horizonStart.getDate() - 400);
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, client_id, client_name, client_email, booking_date, start_time, end_time, status, imported, services(name, price, duration)')
        .eq('therapist_id', therapist.id)
        .gte('booking_date', horizonStart.toISOString().slice(0, 10))
        .neq('imported', true)
        .order('booking_date', { ascending: false })
        .limit(500);

      // Phase 14.3 (HK May 17 2026): pull cancellation_charges too.
      // Captures cancel + reschedule + no-show fees. We surface these
      // as a separate revenue stream from session payments because the
      // therapist's mental model is "session revenue + cancellation
      // revenue" not one combined number.
      const { data: cancellationCharges } = await supabase
        .from('cancellation_charges')
        .select('id, booking_id, client_id, amount_cents, trigger_event, status, payment_intent_id, fired_at, succeeded_at, refunded_at, refund_amount_cents')
        .eq('therapist_id', therapist.id)
        .gte('fired_at', horizonStart.toISOString())
        .order('fired_at', { ascending: false })
        .limit(200);

      // Map payments + bookings into the session shape the existing
      // tab views expect. Each session_payments row becomes a session.
      // Bookings with no payment row become 'outstanding' / 'pending'.
      const bookingsById = {};
      (bookings || []).forEach(b => { bookingsById[b.id] = b; });

      const paidBookingIds = new Set();
      // Phase 14.3: session payments split by status. 'succeeded' becomes
      // paid sessions (counted toward collected). 'refunded' becomes a
      // separate row tagged source='refund' so the hero can show a
      // 'refunds: $X' line without including them in the big number.
      const paymentSessions = [];
      const refundSessions = [];
      (payments || []).forEach((p) => {
        const b = bookingsById[p.booking_id];
        // Phase 14.3l (HK May 17 2026 late): bucket payments by the
        // booking's session date, not by when the money was collected.
        // Therapist's mental model is 'X sessions tomorrow, Y of them
        // paid.' If we used paid_at, an advance-paid Tuesday booking
        // would show in Monday's bucket (when the card was charged),
        // confusing the therapist.
        //
        // If there is no booking attached to this payment (e.g. a tip
        // adjustment), fall back to paid_at so the row still appears
        // somewhere.
        const dateObj = b?.booking_date
          ? new Date((b.booking_date || '') + 'T' + (b.start_time || '12:00:00'))
          : (p.paid_at ? new Date(p.paid_at) : new Date(p.created_at));
        const expected = b?.services?.price || data?.session_rate || DEFAULT_RATE;
        const actualCents = (p.amount_cents || 0) + (p.tip_cents || 0);
        const base = {
          id: `pay-${p.id}`,
          client: b?.client_name || 'Client',
          date: dateObj,
          time: dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          duration: b?.services?.duration || 60,
          rate: expected,
          actual: actualCents / 100,
          base: (p.amount_cents || 0) / 100,
          tip: (p.tip_cents || 0) / 100,
          method: p.payment_method,
          methodDetail: p.payment_method_detail,
          service: b?.services?.name || null,
          bookingId: p.booking_id,
          paymentId: p.id,
        };
        if (p.status === 'succeeded') {
          if (p.booking_id) paidBookingIds.add(p.booking_id);
          paymentSessions.push({ ...base, status: 'paid', source: 'payment' });
        } else if (p.status === 'refunded') {
          refundSessions.push({ ...base, status: 'refunded', source: 'refund' });
        }
        // 'pending', 'voided', 'failed' are not counted in either bucket.
      });

      // Cancellation charge sessions. status='succeeded' rows are real
      // money in the therapist's pocket. Tagged source='cancellation_fee'
      // so the hero can show them as a separate number.
      const cancellationSessions = (cancellationCharges || [])
        .filter(c => c.status === 'succeeded')
        .map((c) => {
          const b = bookingsById[c.booking_id];
          const dateObj = c.succeeded_at ? new Date(c.succeeded_at) : new Date(c.fired_at);
          const TRIGGER_LABEL = { cancel: 'Cancellation fee', reschedule: 'Reschedule fee', no_show: 'No-show fee' };
          return {
            id: `cancel-${c.id}`,
            client: b?.client_name || 'Client',
            date: dateObj,
            time: dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            duration: b?.services?.duration || 60,
            rate: (c.amount_cents || 0) / 100,
            actual: (c.amount_cents || 0) / 100,
            base: (c.amount_cents || 0) / 100,
            tip: 0,
            status: 'paid', // it IS paid, just a different source
            method: 'card', // cancellation charges always go through Stripe
            methodDetail: TRIGGER_LABEL[c.trigger_event] || 'Fee',
            service: TRIGGER_LABEL[c.trigger_event] || 'Fee',
            bookingId: c.booking_id,
            paymentId: null,
            cancellationId: c.id,
            triggerEvent: c.trigger_event,
            source: 'cancellation_fee',
          };
        });

      // Phase 14.3: no-show bookings surfaced as count-only rows. Tagged
      // source='no_show' so the hero can show a 'No-shows: N' line. They
      // don't count toward collected or expected revenue.
      const noShowSessions = (bookings || [])
        .filter(b => b.status === 'no_show')
        .map((b) => {
          const dateObj = new Date((b.booking_date || '') + 'T' + (b.start_time || '12:00:00'));
          const expected = b?.services?.price || data?.session_rate || DEFAULT_RATE;
          return {
            id: `noshow-${b.id}`,
            client: b.client_name || 'Client',
            date: dateObj,
            time: dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            duration: b?.services?.duration || 60,
            rate: expected,
            actual: 0,
            base: 0,
            tip: 0,
            status: 'no_show',
            method: null,
            methodDetail: null,
            service: b?.services?.name || null,
            bookingId: b.id,
            paymentId: null,
            source: 'no_show',
          };
        });

      // Add 'outstanding' / 'pending' synthetic sessions for completed
      // bookings with no corresponding session_payments row. This is
      // the leakage view: services rendered, money not yet captured.
      // Phase 14.3i (HK May 17 2026 late): include confirmed bookings,
      // not just completed ones. Real therapist starting tomorrow has
      // 5 confirmed bookings for the day and no payments yet. Before
      // this fix, Billing showed 0 sessions for that day because the
      // filter only included status='completed'. Now: any booking
      // that's confirmed-or-completed (and not paid through the
      // platform) shows up as an outstanding/scheduled session in
      // the Billing dashboard at its booking date, with expected
      // revenue from the service price.
      const leakageSessions = (bookings || [])
        .filter(b => (b.status === 'completed' || b.status === 'confirmed') && !paidBookingIds.has(b.id))
        .map(b => {
          const dateObj = new Date((b.booking_date || '') + 'T' + (b.start_time || '12:00:00'));
          const expected = b?.services?.price || data?.session_rate || DEFAULT_RATE;
          // Past sessions without payment = outstanding (real money issue).
          // Future sessions without payment = pending (scheduled, payment
          // will come at checkout). Different mental model, different
          // status colors.
          const isPast = dateObj < new Date();
          return {
            id: `unpaid-${b.id}`,
            client: b.client_name || 'Client',
            date: dateObj,
            time: dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            duration: b?.services?.duration || 60,
            rate: expected,
            actual: 0,
            base: 0,
            tip: 0,
            status: isPast ? 'outstanding' : 'pending',
            method: null,
            methodDetail: null,
            service: b?.services?.name || null,
            bookingId: b.id,
            paymentId: null,
            source: 'booking_no_payment',
          };
        });

      const combined = [
        ...paymentSessions,
        ...cancellationSessions,
        ...refundSessions,
        ...noShowSessions,
        ...leakageSessions,
      ];
      combined.sort((a, b) => b.date.getTime() - a.date.getTime());
      setRealTransactions(combined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapist, reloadTick]);

  // "Has live data" if either processor is connected. Drives sample
  // data fallback and banner copy below.
  const anyConnected = !!stripeConnected || !!squareConnected;
  const isLoading = stripeConnected === null && squareConnected === null;

  const sessions = useMemo(() => {
    if (anyConnected && realTransactions && realTransactions.length > 0) {
      // Phase 14.1: realTransactions is already in session shape, mapped
      // from session_payments + bookings in the effect above. No further
      // transformation needed.
      return realTransactions;
    }
    // Not connected - show sample data with live session rate applied
    return SAMPLE_SESSIONS.map(s => ({
      ...s,
      rate:   s.rate   === DEFAULT_RATE ? sessionRate : s.rate,
      actual: s.actual === DEFAULT_RATE ? sessionRate : s.actual,
    }));
  }, [anyConnected, realTransactions, sessionRate]);

  if (isLoading) {
    return (
      <div style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:64 }}>
        <div style={{ fontSize:14, color:'#9CA3AF' }}>Loading billing data…</div>
      </div>
    );
  }

  // Phase 16.5 (HK May 18 2026): V2 Billing dashboard is the only
  // Billing dashboard. V1 ripped after HK validated all 5 tabs in
  // bodymapdemo account through phases 16.1 - 16.4 + 16.5a polish.
  // Per BENCHMARKS.md, V2 hides comparisons it can't source rather
  // than fabricate numbers.
  const handleRefundClickV2 = (s) => {
    setRefundTarget({
      id: s.paymentId,
      amount_cents: Math.round((s.base || s.actual || 0) * 100),
      tip_cents: Math.round((s.tip || 0) * 100),
      payment_method: s.method,
      client_name: s.client,
    });
  };
  return (
    <div style={{
      width: '100%',
      paddingBottom: typeof window !== 'undefined' && window.innerWidth < 768
        ? 'calc(74px + env(safe-area-inset-bottom, 0px) + 24px)' : 0,
    }}>
      {/* Banner: no processor connected. Inline above V2. */}
      {!anyConnected && <SampleDataBanner />}

      {/* Banner: processor connected, no real data yet. */}
      {anyConnected && realTransactions !== null && realTransactions.length === 0 && (
        <div style={{
          background: '#EFF6FF', border: '1.5px dashed #93C5FD',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
          fontSize: 13, color: '#1D4ED8',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>👁️</span>
          <div><strong>Sample data, preview only.</strong> Your payment processor is connected. Real payments will replace this preview automatically after your first session.</div>
        </div>
      )}

      <BillingDashboardV2
        sessions={sessions}
        therapist={therapist}
        onRefundClick={handleRefundClickV2}
      />
      {refundTarget && (
        <RefundModal
          payment={refundTarget}
          therapist={therapist}
          onClose={() => setRefundTarget(null)}
          onRefunded={() => { setReloadTick(t => t + 1); }}
        />
      )}
    </div>
  );
}
