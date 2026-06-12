// src/pages/BookingDetailPage.jsx
//
// HK May 31 2026 (Side panel A): full-page route for a single booking.
// The slide-over (DetailPanel mode='slide') is still the primary
// surface from the schedule; this page is the full-page alternative
// for deep edits, refunds, complex sequences. Back button navigates
// to /dashboard/schedule.
//
// Loads booking, session, payments by booking id and maps them to
// the appt shape DetailPanel expects. Realtime subscription keeps
// the page fresh while open.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CLIENT_FIELDS, CLIENT_COCKPIT_FIELDS } from '../lib/clientFields';
import { DetailPanel } from '../components/ScheduleDashboard';
import CheckoutModal from '../components/CheckoutModal';
import BookingModal from '../components/BookingModal';
import CancellationChargeModal from '../components/CancellationChargeModal';
import SetupCard from '../components/SetupCard';

const C = {
  beige: '#F5F0E8',
  forest: '#2A5741',
  ink: '#1F2937',
  inkSoft: '#4B5563',
  inkMute: '#9CA3AF',
  line: '#E5E7EB',
  white: '#FFFFFF',
};

export default function BookingDetailPage({ therapist }) {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [appt, setAppt] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [paymentsRefreshTick, setPaymentsRefreshTick] = useState(0);
  const [toast, setToast] = useState(null);
  // HK Jun 1 2026: checkout + reschedule now work on the full page (they
  // previously only worked from the schedule slide-over). Mirrors the
  // ScheduleDashboard root pattern: hold a context/snapshot and render
  // the modal at the page level so it survives DetailPanel re-renders.
  const [checkoutContext, setCheckoutContext] = useState(null);
  const [rescheduleAppt, setRescheduleAppt] = useState(null);
  const [rebookAppt, setRebookAppt] = useState(null);
  const checkoutFnRef = useRef(null);
  const refundFnRef = useRef(null);
  const sessionEditRef = useRef(null);
  const [sessionEditorSlot, setSessionEditorSlot] = useState(null);
  const [packageSlot, setPackageSlot] = useState(null);
  // HK Jun 1 2026: the left-rail no-show/cancel buttons open the same
  // full-screen CancellationChargeModal used elsewhere, rendered at this
  // page level so a refresh cannot tear it down.
  const [cancelContext, setCancelContext] = useState(null);
  const [bookingRow, setBookingRow] = useState(null);
  // HK Jun 1 2026: full client row for the richer left panel (birthday,
  // gender, referral source, customer since, alt phone, notes).
  const [clientRow, setClientRow] = useState(null);
  const [insight, setInsight] = useState(null);

  const fmt12 = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  const loadBooking = useCallback(async () => {
    if (!bookingId || !therapist?.id) return;
    const [bookingRes, sessionRes, paymentsRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('*, services(name, duration, price, is_couples), location:therapist_locations(name)')
        .eq('id', bookingId)
        .eq('therapist_id', therapist.id)
        .maybeSingle(),
      supabase
        .from('sessions')
        .select('id, client_id')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('session_payments')
        .select('amount_cents, tip_cents, status')
        .eq('booking_id', bookingId),
    ]);

    const b = bookingRes.data;
    if (b) setBookingRow(b);
    if (!b) {
      setNotFound(true);
      setLoaded(true);
      return;
    }

    const sessionInfo = sessionRes.data;

    // HK Jun 1 2026: load the full client row for the left panel.
    const resolvedClientId = b.client_id || sessionInfo?.client_id || null;
    if (resolvedClientId) {
      const { data: cr } = await supabase
        .from('clients')
        .select('id, name, email, phone, alt_phone, birthday, gender, referral_source, customer_since, notes, square_customer_id, square_card_id, stripe_customer_id, payment_method_id, card_last4, card_brand')
        .eq('id', resolvedClientId)
        .eq('therapist_id', therapist.id)
        .maybeSingle();
      if (cr) setClientRow(cr);
    } else {
      setClientRow(null);
    }

    const payments = paymentsRes.data || [];
    const paidCents = payments
      .filter(p => p.status === 'succeeded')
      .reduce((s, p) => s + (p.amount_cents || 0) + (p.tip_cents || 0), 0);
    const refundedCents = payments
      .filter(p => p.status === 'refunded')
      .reduce((s, p) => s + (p.amount_cents || 0) + (p.tip_cents || 0), 0);

    let status;
    if (b.status === 'cancelled') status = 'cancelled';
    else if (b.status === 'no_show') status = 'no_show';
    else if (b.status === 'rescheduled') status = 'rescheduled';
    else if (refundedCents > 0) status = 'refunded';
    else if (paidCents > 0) status = 'paid';
    else if (b.status === 'completed') status = 'complete';
    else if (sessionInfo) status = 'intake-done';
    else status = 'pending-intake';

    const bd = new Date(b.booking_date + 'T12:00:00');
    bd.setHours(0, 0, 0, 0);
    const [h, m] = (b.start_time || '00:00').slice(0, 5).split(':').map(Number);

    // HK May 31 2026: same fix as ScheduleDashboard.durationFromBooking.
    // Read duration from the booking's own end_time-start_time so custom
    // durations (60→90 edits) display correctly. services.duration is
    // only the default; the booking row is the source of truth.
    let computedDuration = b.services?.duration || 60;
    if (b.start_time && b.end_time) {
      const [eh, em] = String(b.end_time).slice(0, 5).split(':').map(Number);
      let mins = (eh * 60 + em) - (h * 60 + m);
      if (mins < 0) mins += 24 * 60;
      if (mins > 0) computedDuration = mins;
    }

    setAppt({
      id: b.id,
      client: b.client_name,
      email: (b.client_email || '').toLowerCase().trim(),
      time: fmt12(`${h}:${m}`),
      duration: computedDuration,
      date: bd,
      status,
      sessionId: sessionInfo?.id || null,
      clientId: b.client_id || sessionInfo?.client_id || null,
      sessions: 0,
      service: b.services?.name || 'Session',
      notes: b.notes || '',
      price: b.services?.price || 85,
      service_price_cents: Math.round((b.services?.price || 85) * 100),
      focus: [],
      preview: false,
      reminder_sent: !!b.reminder_sent_at,
      deposit_required: b.deposit_required || false,
      deposit_paid: b.deposit_paid || false,
      deposit_amount: b.deposit_amount || 0,
      is_couples: b.services?.is_couples || false,
      partner_name: b.partner_name || null,
      partner_email: b.partner_email || null,
      endTime: (b.end_time || '').slice(0, 5),
      startTime: (b.start_time || '').slice(0, 5),
      start_time: b.start_time || null,
      service_id: b.service_id || null,
      location_id: b.location_id || null,
      addon_ids: b.addon_ids || [],
      addon_total_price: b.addon_total_price || 0,
      addon_extra_minutes: b.addon_extra_minutes || 0,
      booking_date: b.booking_date,
      // HK May 31 2026: same fix as ScheduleDashboard. Without
      // package_purchase_id on the appt object, the package detection
      // effect never recognizes a linked booking and the green
      // "Session N of M" badge never appears in page mode either.
      package_purchase_id: b.package_purchase_id || null,
      paid: paidCents > 0,
      paid_cents: paidCents,
      paidCents,
      refundedCents,
      locationName: b.location?.name || null,
      rawStatus: b.status,
    });
    setLoaded(true);
  }, [bookingId, therapist?.id]);

  useEffect(() => {
    loadBooking();

    // HK May 31 2026: subscribe to realtime updates for THIS booking
    // and its payments only. Refetches the full shape on any change.
    const channel = supabase
      .channel(`booking-page-${bookingId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bookings',
        filter: `id=eq.${bookingId}`,
      }, loadBooking)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'session_payments',
        filter: `booking_id=eq.${bookingId}`,
      }, loadBooking)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [bookingId, loadBooking]);

  // HK Jun 1 2026: Amazon-style back. Use browser history so the
  // schedule returns to exactly where the therapist was (same day,
  // scroll, view). Fall back to the schedule root on a cold deep-link.
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/dashboard/schedule');
  };

  if (!loaded) {
    return (
      <div style={{
        minHeight: '60vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: C.inkMute, fontSize: 14,
      }}>
        Loading booking…
      </div>
    );
  }

  if (notFound || !appt) {
    return (
      <div style={{ maxWidth: 560, margin: '40px auto', padding: '32px 24px', background: C.white, borderRadius: 14, border: `1px solid ${C.line}`, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.inkMute, marginBottom: 6 }}>Booking not found</div>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: C.forest, margin: '0 0 10px' }}>This booking is gone or not yours</h2>
        <p style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.6, margin: '0 0 20px' }}>
          It may have been cancelled or belongs to a different account. Head back to the schedule and pick another one.
        </p>
        <button onClick={handleBack} style={{ background: C.forest, color: '#fff', border: 'none', borderRadius: 999, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          ← Back to schedule
        </button>
      </div>
    );
  }

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
  const initials = (n) => (n || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const statusLabel = {
    'pending-intake': 'Awaiting intake', 'intake-done': 'Intake done',
    paid: 'Paid', complete: 'Completed', cancelled: 'Cancelled',
    no_show: 'No-show', refunded: 'Refunded', rescheduled: 'Rescheduled',
  }[appt.status] || 'Confirmed';
  const niceDate = appt.date instanceof Date
    ? appt.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '';
  const canAct = !['cancelled', 'no_show', 'refunded'].includes(appt.status);

  // HK Jun 1 2026: formatters for the richer left panel.
  const fmtLongDate = (d) => {
    if (!d) return null;
    const dt = new Date(d + 'T12:00:00');
    if (isNaN(dt)) return null;
    return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };
  const fmtBirthday = (d) => {
    if (!d) return null;
    const dt = new Date(d + 'T12:00:00');
    if (isNaN(dt)) return null;
    const age = Math.floor((Date.now() - dt.getTime()) / (365.25 * 24 * 3600 * 1000));
    const md = dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    return age > 0 && age < 120 ? `${md} (${age})` : md;
  };
  const genderLabel = (g) => {
    if (!g) return null;
    const map = { female: 'Female', male: 'Male', non_binary: 'Non-binary', nonbinary: 'Non-binary', prefer_not_to_say: 'Prefer not to say' };
    const key = String(g).toLowerCase().replace(/[\s-]+/g, '_');
    if (map[key]) return map[key];
    if (key.startsWith('other')) return g.replace(/^other:?\s*/i, '').trim() || 'Other';
    return g;
  };
  const referralLabel = (r) => {
    if (!r) return null;
    const map = { referred_by_someone: 'Referred by someone', found_online: 'Found online', social_media: 'Social media', returning_client: 'Returning client', walk_in: 'Walk-in' };
    const key = String(r).toLowerCase().replace(/[\s-]+/g, '_');
    if (map[key]) return map[key];
    if (key.startsWith('other')) return r.replace(/^other:?\s*/i, '').trim() || 'Other';
    return r;
  };
  const fieldDisplay = {
    email: clientRow?.email || null,
    phone: clientRow?.phone || null,
    alt_phone: clientRow?.alt_phone || null,
    birthday: fmtBirthday(clientRow?.birthday),
    gender: genderLabel(clientRow?.gender),
    referral_source: referralLabel(clientRow?.referral_source),
    customer_since: fmtLongDate(clientRow?.customer_since),
  };
  const detailRows = clientRow
    ? CLIENT_COCKPIT_FIELDS.map((k) => [CLIENT_FIELDS[k].label, fieldDisplay[k]])
    : [];

  const _sqCard = !!(clientRow && clientRow.square_customer_id && clientRow.square_card_id);
  const _stCard = !!(clientRow && clientRow.stripe_customer_id && clientRow.payment_method_id && clientRow.card_last4);
  const hasCardOnFile = _sqCard || _stCard;
  const cardChipText = hasCardOnFile
    ? (() => {
        const b = String(clientRow.card_brand || '').toLowerCase();
        const brand = b.includes('amer') || b === 'amex' ? 'Amex' : b.includes('visa') ? 'Visa' : b.includes('master') ? 'Mastercard' : b.includes('disc') ? 'Discover' : (clientRow.card_brand ? clientRow.card_brand.charAt(0).toUpperCase() + clientRow.card_brand.slice(1).toLowerCase() : 'Card');
        return `💳 ${brand}${clientRow.card_last4 ? ' ••' + clientRow.card_last4 : ''}`;
      })()
    : null;

  return (
    <div style={isDesktop
      ? { padding: '20px 32px 48px', maxWidth: 1320, margin: '0 auto' }
      : { padding: '4px 0 24px', maxWidth: '100%', margin: 0 }}>
      {/* HK Jun 2 2026: desktop and mobile wrappers are now fully separate
          style objects. The booking page lives inside the dashboard shell
          (which already adds 12px gutter + a 16px card pad on mobile), so
          this wrapper adds ZERO side padding on mobile (was 32px, which
          stacked to ~60px per side and crushed the content to a narrow
          strip). Desktop keeps its centered, padded column. Because the two
          are independent, tuning one viewport can no longer break the other.*/}
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={handleBack}
          style={{
            background: '#fff', border: `1px solid ${C.line}`,
            borderRadius: 999, padding: '8px 16px 8px 12px',
            fontSize: 13, fontWeight: 600, color: C.ink,
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 5,
            boxShadow: '0 1px 2px rgba(31,65,49,0.06)',
          }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Schedule
        </button>
      </div>

      {/* HK Jun 1 2026: two-column desktop layout. Left rail = summary +
          quick actions (always in reach). Right = the existing
          DetailPanel content (session journey, brief, SOAP, full
          checkout). On mobile (<768) the rail is hidden and the page
          falls back to the single-column DetailPanel flow that works
          today, so phone behaviour is unchanged. The rail's buttons
          call the same handlers the page already wires up. */}
      <div style={isDesktop
        ? { display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 18, alignItems: 'start' }
        : { display: 'block' }}>

        {isDesktop && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Booking</div>
            <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.forest, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>{initials(appt.client)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: C.forest, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.client}</div>
                  {appt.clientId && <a href={`/dashboard/clients/${appt.clientId}`} style={{ display: 'inline-block', marginTop: 2, fontSize: 12, fontWeight: 600, color: C.forest, textDecoration: 'none' }}>View profile ›</a>}
                </div>
              </div>
              {(appt.status === 'pending-intake' || appt.status === 'intake-done' || appt.status === 'complete' || (appt.deposit_required && appt.deposit_paid) || appt.reminder_sent || appt.paid_cents > 0 || appt.refundedCents > 0 || hasCardOnFile) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {hasCardOnFile && <span style={{ background: '#EAF6EE', color: '#15803D', border: '1px solid #BBE7C9', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>{cardChipText}</span>}
                  {appt.status === 'pending-intake' && <span style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>No Intake</span>}
                  {(appt.status === 'intake-done' || appt.status === 'complete') && <span style={{ background: '#EAF6EE', color: '#15803D', border: '1px solid #BBE7C9', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>✓ Intake received</span>}
                  {appt.deposit_required && appt.deposit_paid && <span style={{ background: '#EAF6EE', color: '#15803D', border: '1px solid #BBE7C9', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>✓ Deposit paid</span>}
                  {appt.paid_cents > 0 && !(appt.refundedCents > 0) && <span style={{ background: '#EAF6EE', color: '#15803D', border: '1px solid #BBE7C9', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>✓ Paid ${(appt.paid_cents / 100).toFixed(2)}</span>}
                  {appt.refundedCents > 0 && <span style={{ background: '#EDE9FE', color: '#6D28D9', border: '1px solid #DDD0F7', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>↩ Refunded ${(appt.refundedCents / 100).toFixed(2)}</span>}
                  {appt.reminder_sent && <span style={{ background: '#EAF6EE', color: '#15803D', border: '1px solid #BBE7C9', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>🔔 Reminded</span>}
                </div>
              )}
              {insight && (
                <div style={{ background: insight.tone === 'warn' ? '#FEF3C7' : '#F1F6F1', border: insight.tone === 'warn' ? '1px solid #FDE68A' : '1px solid #DDE8DD', borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 14 }}>
                  <span style={{ fontSize: 14, lineHeight: 1.3 }}>{insight.icon}</span>
                  <span style={{ fontSize: 13, color: insight.tone === 'warn' ? '#78350F' : '#41514A', lineHeight: 1.45, fontWeight: insight.tone === 'warn' ? 700 : 500 }}>{insight.text}</span>
                </div>
              )}
              <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12, fontSize: 13 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.inkMute, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Session</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}><span style={{ color: C.inkMute }}>When</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ color: C.ink, textAlign: 'right' }}>{niceDate} · {appt.time}</span>{canAct && <button onClick={() => sessionEditRef.current && sessionEditRef.current.toggleTime()} title="Edit time" style={{ background: 'transparent', border: `1px solid ${C.line}`, borderRadius: 7, padding: '2px 6px', fontSize: 11, lineHeight: 1, cursor: 'pointer' }}>✏️</button>}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}><span style={{ color: C.inkMute }}>Service</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ color: C.ink, textAlign: 'right' }}>{appt.service} · {appt.duration} min</span>{canAct && <button onClick={() => sessionEditRef.current && sessionEditRef.current.toggleService()} title="Edit service, location, add-ons" style={{ background: 'transparent', border: `1px solid ${C.line}`, borderRadius: 7, padding: '2px 6px', fontSize: 11, lineHeight: 1, cursor: 'pointer' }}>✏️</button>}</span></div>
                {appt.locationName && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span style={{ color: C.inkMute }}>Where</span><span style={{ color: C.ink, textAlign: 'right' }}>{appt.locationName}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span style={{ color: C.inkMute }}>Status</span><span style={{ color: C.forest, fontWeight: 600 }}>{statusLabel}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span style={{ color: C.inkMute }}>Price</span><span style={{ color: C.ink }}>${(appt.price || 0).toFixed(2)}</span></div>
              </div>
            </div>

            <div ref={setSessionEditorSlot} />

            {detailRows.length > 0 && (
              <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: '14px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.inkMute, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Client details</div>
                <div style={{ fontSize: 13 }}>
                  {detailRows.map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderTop: label === detailRows[0][0] ? 'none' : `1px solid ${C.line}` }}>
                      <span style={{ color: C.inkMute, flexShrink: 0 }}>{label}</span>
                      <span style={{ color: value ? C.ink : C.inkMute, textAlign: 'right', wordBreak: 'break-word', opacity: value ? 1 : 0.65 }}>{value || 'Not on file'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(clientRow?.notes || appt.notes) && (
              <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: '14px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.inkMute, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Notes</div>
                {clientRow?.notes && (
                  <div style={{ marginBottom: appt.notes ? 12 : 0 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#5E7A52', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}><span>🌿</span>Client preferences</div>
                    <div style={{ fontSize: 13, color: '#3F4A39', lineHeight: 1.6, fontFamily: 'Georgia, serif', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{clientRow.notes}</div>
                  </div>
                )}
                {appt.notes && (
                  <div style={{ borderTop: clientRow?.notes ? `1px solid ${C.line}` : 'none', paddingTop: clientRow?.notes ? 12 : 0 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#A97D3C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}><span>📌</span>This booking</div>
                    <div style={{ fontSize: 13, color: '#3F4A39', lineHeight: 1.6, fontFamily: 'Georgia, serif', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{appt.notes}</div>
                  </div>
                )}
              </div>
            )}

            <SetupCard
              appt={appt}
              therapist={therapist}
              clientRow={clientRow}
              notify={(msg) => setToast(msg)}
              showLabel
              wrapperStyle={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: '14px 18px' }}
            />

            {/* HK Jun 2 2026: package card (Session N of M + Manage link)
                portals in here on desktop, from DetailPanel. */}
            <div ref={setPackageSlot} />
          </div>
        )}

        <div style={{ minWidth: 0 }}>
        {isDesktop && canAct && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.inkMute, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Actions</div>
            <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => { if (checkoutFnRef.current) checkoutFnRef.current(); }}
                style={{ width: '100%', background: 'linear-gradient(135deg, #2A5741 0%, #1F4030 100%)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 18px', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(31,64,48,0.28), 0 1px 0 rgba(255,255,255,0.15) inset', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>💳</span> {appt.paid_cents > 0 ? 'Add payment' : 'Checkout'}
              </button>
              {appt.paid_cents > 0 && (
                <button onClick={() => { if (refundFnRef.current) refundFnRef.current(); }}
                  style={{ width: '100%', background: '#fff', color: '#B91C1C', border: '1.5px solid #FCA5A5', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span>↩</span> Refund
                </button>
              )}
              <button onClick={() => setRebookAppt(appt)}
                style={{ width: '100%', background: '#fff', color: C.ink, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span>📅</span> Book next session
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setRescheduleAppt(appt)}
                  style={{ flex: 1, background: '#fff', color: C.ink, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span>↻</span> Reschedule
                </button>
                <button onClick={() => setCancelContext({ appt, isNoShow: true })}
                  style={{ flex: 1, background: '#fff', color: '#B45309', border: '1.5px solid #FCD34D', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span>🚫</span> No-show
                </button>
              </div>
              <button onClick={() => setCancelContext({ appt, isNoShow: false })}
                style={{ width: '100%', background: 'transparent', color: '#B91C1C', border: 'none', borderRadius: 10, padding: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Cancel appointment
              </button>
            </div>
          </div>
        )}
      <DetailPanel
        appt={appt}
        therapist={therapist}
        mode="page"
        onClose={handleBack}
        onReschedule={(a) => setRescheduleAppt(a)}
        onCancelled={loadBooking}
        onRequestCancel={(payload) => setCancelContext(payload)}
        railPresent={isDesktop}
        onInsight={setInsight}
        checkoutFnRef={checkoutFnRef}
        refundFnRef={refundFnRef}
        sessionEditRef={sessionEditRef}
        sessionEditorSlot={sessionEditorSlot}
        packageSlot={packageSlot}
        showToast={(msg) => setToast(msg)}
        onRequestCheckout={(payload) => setCheckoutContext(payload)}
        paymentsRefreshTick={paymentsRefreshTick}
      />
        </div>
      </div>

      {checkoutContext && (
        <CheckoutModal
          appt={checkoutContext.appt}
          therapist={therapist}
          client={checkoutContext.client}
          defaultAmountCents={checkoutContext.defaultAmountCents}
          onClose={() => setCheckoutContext(null)}
          onPaid={(paidCents) => {
            const amount = typeof paidCents === 'number' ? ` $${(paidCents / 100).toFixed(2)}` : '';
            setToast(`Payment recorded${amount}`);
            setPaymentsRefreshTick((n) => n + 1);
            loadBooking();
          }}
          onClientLinked={(picked) => {
            setCheckoutContext((prev) => prev ? ({
              ...prev,
              appt: {
                ...prev.appt,
                clientId: picked.id,
                client: picked.name || prev.appt.client,
                email: picked.email || prev.appt.email,
                phone: picked.phone || prev.appt.phone,
              },
            }) : null);
          }}
        />
      )}

      {rescheduleAppt && (
        <BookingModal
          therapist={therapist}
          mode="reschedule"
          existingBooking={rescheduleAppt}
          onClose={() => setRescheduleAppt(null)}
          onSuccess={() => {
            setToast('Session rescheduled');
            setRescheduleAppt(null);
            loadBooking();
          }}
        />
      )}

      {rebookAppt && (
        <BookingModal
          therapist={therapist}
          mode="rebook"
          existingBooking={rebookAppt}
          onClose={() => setRebookAppt(null)}
          onSuccess={() => {
            setToast('Next session booked');
            setRebookAppt(null);
            loadBooking();
          }}
        />
      )}

      {cancelContext && bookingRow && (
        <CancellationChargeModal
          booking={bookingRow}
          client={clientRow || { id: appt.clientId, name: appt.client, email: appt.email, phone: bookingRow.client_phone || null }}
          therapist={therapist}
          sessionPriceCents={appt.service_price_cents || Math.round((appt.price || 0) * 100)}
          isNoShow={!!cancelContext.isNoShow}
          onClose={() => setCancelContext(null)}
          onCancelled={() => {
            setToast(cancelContext.isNoShow ? 'Marked as no-show' : 'Appointment cancelled');
            loadBooking();
          }}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%',
          transform: 'translateX(-50%)',
          background: C.ink, color: C.white,
          padding: '10px 16px', borderRadius: 999,
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          zIndex: 1000,
        }}>
          {typeof toast === 'string' ? toast : toast?.message || ''}
        </div>
      )}
    </div>
  );
}
