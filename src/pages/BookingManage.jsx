// src/pages/BookingManage.jsx
//
// HK May 31 2026: this page is a PLACEHOLDER. The live
// self-service reschedule/cancel page is not yet wired, and
// every email/SMS that pointed here has been updated to
// remove the link. But old emails clients already have in
// their inbox may still navigate here. Instead of showing a
// broken cancel form (which silently fails), this page tells
// them how to actually change their booking right now (reply
// to their email or text the therapist).
//
// When the real self-service page is built, this file will
// be replaced. Until then, this is the friendly fallback.

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const C = {
  beige: '#F5F0E8',
  forest: '#2A5741',
  ink: '#1F2937',
  inkSoft: '#4B5563',
  inkMute: '#9CA3AF',
  line: '#E5E7EB',
  white: '#FFFFFF',
};

export default function BookingManage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const bookingId = params.get('b');
  const [therapist, setTherapist] = useState(null);
  const [booking, setBooking] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!slug) { setLoaded(true); return; }
      const { data: t } = await supabase
        .from('therapists')
        .select('full_name, business_name, email, phone, custom_url')
        .eq('custom_url', slug)
        .maybeSingle();
      if (!alive) return;
      setTherapist(t || null);
      if (bookingId) {
        // Read the booking's display fields through the gated lookup so
        // contact details are not pulled with the public key. Fall back
        // to the direct read during the transition.
        let b = null;
        try {
          const res = await supabase.functions.invoke('booking-lookup', { body: { op: 'manage', bookingId } });
          if (res?.data?.ok && res.data.booking) {
            const bk = res.data.booking;
            b = { booking_date: bk.booking_date, start_time: bk.start_time, client_name: bk.client_name, services: { name: bk.service_name } };
          }
        } catch (_e) { /* fall through */ }
        if (!b) {
          const { data: bd } = await supabase
            .from('bookings')
            .select('booking_date, start_time, client_name, services(name)')
            .eq('id', bookingId)
            .maybeSingle();
          b = bd || null;
        }
        if (!alive) return;
        setBooking(b || null);
      }
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [slug, bookingId]);

  const therapistName = therapist?.business_name || therapist?.full_name || 'your therapist';
  const therapistFirst = (therapist?.full_name || '').split(' ')[0] || 'them';

  let whenLine = '';
  if (booking?.booking_date && booking?.start_time) {
    try {
      const dt = new Date(`${booking.booking_date}T${booking.start_time}`);
      whenLine = dt.toLocaleString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      });
    } catch (e) { /* swallow */ }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: C.beige,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: C.white,
        borderRadius: 24,
        padding: '40px 32px',
        maxWidth: 480,
        width: '100%',
        boxShadow: '0 8px 48px rgba(0,0,0,0.08)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#F0F9FF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px', fontSize: 26,
        }}>💬</div>

        <h1 style={{
          fontFamily: 'Georgia, serif',
          fontSize: 24,
          fontWeight: 700,
          color: C.ink,
          margin: '0 0 10px',
          textAlign: 'center',
        }}>
          Need to change this booking?
        </h1>

        {!loaded ? (
          <p style={{ color: C.inkMute, fontSize: 14, textAlign: 'center' }}>Loading…</p>
        ) : (
          <>
            <p style={{ color: C.inkSoft, fontSize: 15, lineHeight: 1.7, margin: '0 0 20px', textAlign: 'center' }}>
              Self-service rescheduling is on its way. Until it's ready, the fastest way to change anything is to message {therapistFirst} directly.
            </p>

            {(whenLine || booking?.services?.name) && (
              <div style={{
                background: '#FAFAF7',
                border: `1px solid ${C.line}`,
                borderRadius: 12,
                padding: '14px 16px',
                marginBottom: 20,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.inkMute, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Your booking
                </div>
                {booking?.services?.name && (
                  <div style={{ fontSize: 14, color: C.ink, fontWeight: 600 }}>{booking.services.name}</div>
                )}
                {whenLine && (
                  <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>{whenLine}</div>
                )}
                {booking?.client_name && (
                  <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>For {booking.client_name}</div>
                )}
              </div>
            )}

            <div style={{
              background: '#F0F7F4',
              border: '1px solid #BFD8C9',
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 20,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.forest, marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Two ways to reach {therapistFirst}
              </div>
              {therapist?.email && (
                <a href={`mailto:${therapist.email}?subject=Need%20to%20change%20my%20booking`}
                  style={{
                    display: 'block', padding: '10px 14px',
                    background: C.white, border: `1px solid ${C.line}`,
                    borderRadius: 8, color: C.ink, textDecoration: 'none',
                    fontSize: 14, fontWeight: 600, marginBottom: 8,
                  }}>
                  Email {therapist.email}
                </a>
              )}
              {therapist?.phone && (
                <a href={`tel:${therapist.phone}`}
                  style={{
                    display: 'block', padding: '10px 14px',
                    background: C.white, border: `1px solid ${C.line}`,
                    borderRadius: 8, color: C.ink, textDecoration: 'none',
                    fontSize: 14, fontWeight: 600,
                  }}>
                  Call {therapist.phone}
                </a>
              )}
              {!therapist?.email && !therapist?.phone && (
                <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>
                  Reply to the email or text you received from {therapistName}.
                </p>
              )}
            </div>

            {slug && (
              <a href={`/book/${slug}`}
                style={{
                  display: 'block', textAlign: 'center',
                  fontSize: 13, color: C.inkMute,
                  textDecoration: 'underline',
                }}>
                Or book a new session
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
