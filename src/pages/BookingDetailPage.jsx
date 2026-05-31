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

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { DetailPanel } from '../components/ScheduleDashboard';

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
    if (!b) {
      setNotFound(true);
      setLoaded(true);
      return;
    }

    const sessionInfo = sessionRes.data;
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

  const handleBack = () => navigate('/dashboard/schedule');

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

  return (
    <div style={{ minHeight: '100vh', background: C.beige, padding: '20px 16px 60px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={handleBack}
          style={{
            background: C.white, border: `1px solid ${C.line}`,
            borderRadius: 999, padding: '8px 16px',
            fontSize: 13, fontWeight: 600, color: C.ink,
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
          ← Schedule
        </button>
        <div style={{ fontSize: 12, color: C.inkMute }}>
          Full booking view
        </div>
      </div>

      <DetailPanel
        appt={appt}
        therapist={therapist}
        mode="page"
        onClose={handleBack}
        onReschedule={loadBooking}
        onCancelled={loadBooking}
        showToast={(msg) => setToast(msg)}
        onRequestCheckout={() => { /* CheckoutModal opens via DetailPanel internals */ }}
        paymentsRefreshTick={paymentsRefreshTick}
      />

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
