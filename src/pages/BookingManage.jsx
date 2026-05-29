// src/pages/BookingManage.jsx
//
// HK May 29 2026: public booking-management page. Client lands here
// from any of their booking emails via /book/<slug>/manage?b=<uuid>.
// Shows the booking details and lets the client cancel without having
// to text or call the therapist.
//
// Auth: the booking_id is a UUID v4 (~122 bits of entropy). The link
// IS the auth, same pattern as Cal.com / Calendly magic links.
//
// Future: reschedule action (opens BookingPage with reschedule param).

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const C = {
  beige: '#F5F0E8',
  cream: '#FAF6EE',
  forest: '#2A5741',
  forestSoft: '#3D6B54',
  sage: '#6B9E80',
  ink: '#1F2937',
  inkSoft: '#4B5563',
  inkMute: '#9CA3AF',
  line: '#E5E7EB',
  rose: '#DC2626',
  roseBg: '#FEF2F2',
  roseBorder: '#FCA5A5',
  amber: '#92400E',
  amberBg: '#FFFBEB',
  amberBorder: '#FCD34D',
};

function fmtWhen(dateStr, timeStr) {
  if (!dateStr || !timeStr) return '';
  try {
    const d = new Date(`${dateStr}T${timeStr}`);
    const day = d.toLocaleDateString('en-US', { weekday: 'long' });
    const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${day}, ${date} at ${time}`;
  } catch (_e) { return `${dateStr} ${timeStr}`; }
}

export default function BookingManage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const bookingId = params.get('b');

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [err, setErr] = useState('');

  const [confirming, setConfirming] = useState(false);  // shows the reason form
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [doneState, setDoneState] = useState(null);     // { fee_applies, fee_amount_cents }

  // Pull the minimal booking data we need to render the page.
  useEffect(() => {
    if (!bookingId) { setErr('This link is missing the booking reference. Please use the link from your confirmation email.'); setLoading(false); return; }
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            id, status, booking_date, start_time, client_name,
            services(name, duration),
            therapists(full_name, business_name, custom_url, cancellation_policy, cancellation_policy_text, cancellation_fee_hours, cancellation_fee_amount_cents, cancellation_policy_enabled)
          `)
          .eq('id', bookingId)
          .maybeSingle();
        if (!alive) return;
        if (error) { setErr('Could not load this booking. The link may be expired or invalid.'); setLoading(false); return; }
        if (!data) { setErr("We couldn't find this booking. Please use the link from your confirmation email."); setLoading(false); return; }
        setBooking(data);
        setLoading(false);
      } catch (e) {
        if (!alive) return;
        setErr('Something went wrong loading this booking. Please try again or contact your therapist.');
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [bookingId]);

  async function doCancel() {
    setSubmitting(true);
    setErr('');
    try {
      const { data, error } = await supabase.functions.invoke('client-cancel-booking', {
        body: { booking_id: bookingId, reason: reason.trim() || null },
      });
      if (error) throw new Error(error.message || 'Could not cancel. Try again.');
      if (data?.error) throw new Error(data.error === 'already_cancelled' ? 'This booking is already cancelled.' : (data.detail || data.error));
      setDoneState({
        fee_applies: !!data?.fee_applies,
        fee_amount_cents: data?.fee_amount_cents || 0,
      });
    } catch (e) {
      setErr(e.message || 'Could not cancel. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render states ─────────────────────────────────────────────────

  if (loading) return <Shell><Centered><div style={{ color: C.inkSoft }}>Loading your booking…</div></Centered></Shell>;
  if (err && !booking) return <Shell><ErrorCard message={err} /></Shell>;

  const therapist = booking?.therapists;
  const therapistFirst = (therapist?.full_name || therapist?.business_name || 'Your therapist').split(' ')[0];
  const businessName = therapist?.business_name || therapist?.full_name || 'Your therapist';
  const serviceName = booking?.services?.name || 'Session';
  const whenStr = fmtWhen(booking?.booking_date, booking?.start_time);

  // Already-terminated state
  if (booking?.status === 'cancelled' || booking?.status === 'no_show') {
    return (
      <Shell>
        <Card>
          <Eyebrow tone="amber">Booking already cancelled</Eyebrow>
          <H1>This booking is already cancelled</H1>
          <P>Your {serviceName} on {whenStr} has already been cancelled. If this is unexpected, please contact {therapistFirst} directly.</P>
          <FactBox rows={[
            { label: 'Service', value: serviceName },
            { label: 'When', value: whenStr },
            { label: 'With', value: businessName },
          ]} />
        </Card>
      </Shell>
    );
  }

  // Just-cancelled success state
  if (doneState) {
    return (
      <Shell>
        <Card>
          <Eyebrow tone="sage">Cancellation confirmed</Eyebrow>
          <H1>Your cancellation is confirmed</H1>
          <P>Your {serviceName} on {whenStr} has been cancelled. {therapistFirst} has been notified.</P>
          <FactBox rows={[
            { label: 'Service', value: serviceName },
            { label: 'When', value: whenStr },
          ]} />
          {doneState.fee_applies && doneState.fee_amount_cents > 0 ? (
            <Callout tone="amber">
              <strong>A note about the fee.</strong> Because this cancellation came in close to the appointment, a fee of ${(doneState.fee_amount_cents / 100).toFixed(2)} applies per the cancellation policy. {therapistFirst} will reach out about how to take care of it.
            </Callout>
          ) : (
            <Callout tone="sage">No fee was charged for this cancellation.</Callout>
          )}
          <P style={{ color: C.inkSoft, marginTop: 16 }}>
            Whenever you'd like to book another session, you can reach {businessName} at{' '}
            <a href={`https://mybodymap.app/book/${therapist?.custom_url || slug}`} style={{ color: C.forest, fontWeight: 700 }}>
              mybodymap.app/book/{therapist?.custom_url || slug}
            </a>.
          </P>
        </Card>
      </Shell>
    );
  }

  // Default: show booking + cancel affordance
  const policyEnabled = !!therapist?.cancellation_policy_enabled;
  const feeHours = Number(therapist?.cancellation_fee_hours || 24);
  const feeAmountCents = Number(therapist?.cancellation_fee_amount_cents || 0);
  const apptStart = booking?.booking_date && booking?.start_time
    ? new Date(`${booking.booking_date}T${booking.start_time}`)
    : null;
  const hoursUntil = apptStart ? (apptStart.getTime() - Date.now()) / 3_600_000 : 999;
  const willFee = policyEnabled && feeAmountCents > 0 && hoursUntil < feeHours;

  return (
    <Shell>
      <Card>
        <Eyebrow tone="sage">Manage your booking</Eyebrow>
        <H1>Hi {(booking?.client_name || '').split(' ')[0] || 'there'}</H1>
        <P>Here are the details for your upcoming session with {businessName}.</P>
        <FactBox rows={[
          { label: 'Service', value: serviceName },
          { label: 'When', value: whenStr },
          ...(booking?.services?.duration ? [{ label: 'Duration', value: `${booking.services.duration} min` }] : []),
          { label: 'With', value: businessName },
        ]} />

        {!confirming && (
          <>
            <P style={{ marginTop: 16 }}>
              Need to cancel? Tap below. To reschedule instead, please reply to your confirmation email and {therapistFirst} will help you find a new time.
            </P>
            <button
              onClick={() => setConfirming(true)}
              style={{
                marginTop: 14,
                width: '100%',
                padding: '14px',
                background: '#fff',
                color: C.rose,
                border: `1.5px solid ${C.roseBorder}`,
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
              Cancel this booking
            </button>
          </>
        )}

        {confirming && (
          <div style={{ marginTop: 16 }}>
            {willFee && (
              <Callout tone="amber">
                <strong>Heads-up about the fee.</strong> Because your session is within {feeHours} hours, the cancellation policy applies a fee of ${(feeAmountCents / 100).toFixed(2)}. {therapistFirst} will reach out about how to take care of it. You're not being charged automatically.
              </Callout>
            )}
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, marginTop: 12 }}>
              Anything you'd like {therapistFirst} to know? (optional)
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Optional. A short note for the therapist."
              style={{
                width: '100%', boxSizing: 'border-box',
                border: `1.5px solid ${C.line}`, borderRadius: 10,
                padding: '10px 12px', fontSize: 14, color: C.ink,
                fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            {err && (
              <div style={{ background: C.roseBg, border: `1px solid ${C.roseBorder}`, color: C.rose, borderRadius: 8, padding: '8px 12px', fontSize: 13, marginTop: 12 }}>
                {err}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={() => { setConfirming(false); setReason(''); setErr(''); }}
                disabled={submitting}
                style={{
                  flex: 1, background: '#F3F4F6', color: C.inkSoft, border: 'none',
                  padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}>
                Keep my booking
              </button>
              <button
                onClick={doCancel}
                disabled={submitting}
                style={{
                  flex: 1, background: C.rose, color: '#fff', border: 'none',
                  padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit',
                  opacity: submitting ? 0.7 : 1,
                }}>
                {submitting ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        )}

        {policyEnabled && (therapist?.cancellation_policy_text || therapist?.cancellation_policy) && (
          <div style={{
            marginTop: 22, padding: '14px 16px',
            background: C.cream, border: `1px solid ${C.line}`,
            borderRadius: 10, fontSize: 13, color: C.inkSoft, lineHeight: 1.55,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.inkSoft, marginBottom: 6 }}>
              Cancellation policy
            </div>
            {therapist.cancellation_policy_text || therapist.cancellation_policy}
          </div>
        )}
      </Card>
    </Shell>
  );
}

// ─── Layout primitives ───────────────────────────────────────────────

function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: C.beige,
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      color: C.ink,
      padding: 16,
    }}>
      <div style={{ maxWidth: 520, margin: '24px auto' }}>
        {children}
        <p style={{ textAlign: 'center', fontSize: 11, color: C.inkMute, marginTop: 20 }}>
          Sent via <a href="https://mybodymap.app" style={{ color: C.inkMute, textDecoration: 'none' }}>MyBodyMap</a>
        </p>
      </div>
    </div>
  );
}

function Card({ children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      padding: '32px 28px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
    }}>
      {children}
    </div>
  );
}

function Centered({ children }) {
  return <div style={{ textAlign: 'center', padding: '48px 16px' }}>{children}</div>;
}

function Eyebrow({ children, tone }) {
  const color = tone === 'amber' ? C.amber : tone === 'rose' ? C.rose : C.forest;
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
      color, marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function H1({ children }) {
  return (
    <h1 style={{
      fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700,
      color: C.forest, margin: '0 0 10px', lineHeight: 1.25,
    }}>
      {children}
    </h1>
  );
}

function P({ children, style }) {
  return (
    <p style={{
      fontSize: 15, color: C.ink, lineHeight: 1.65, margin: '0 0 12px', ...style,
    }}>
      {children}
    </p>
  );
}

function FactBox({ rows }) {
  return (
    <table style={{
      width: '100%', borderCollapse: 'collapse', margin: '14px 0',
      background: C.cream, border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden',
    }}>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.label} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${C.line}` : 'none' }}>
            <td style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.04em', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
              {r.label}
            </td>
            <td style={{ padding: '10px 14px', fontSize: 14, color: C.ink, textAlign: 'right' }}>
              {r.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Callout({ children, tone }) {
  const bg = tone === 'amber' ? C.amberBg : C.cream;
  const border = tone === 'amber' ? C.amberBorder : C.line;
  const color = tone === 'amber' ? C.amber : C.ink;
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 10,
      padding: '12px 14px', margin: '12px 0', fontSize: 14, color, lineHeight: 1.55,
    }}>
      {children}
    </div>
  );
}

function ErrorCard({ message }) {
  return (
    <Card>
      <Eyebrow tone="rose">We hit a snag</Eyebrow>
      <H1>This link doesn't seem to work</H1>
      <P>{message}</P>
    </Card>
  );
}
