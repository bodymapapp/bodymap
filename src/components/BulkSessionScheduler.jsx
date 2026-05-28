// src/components/BulkSessionScheduler.jsx
//
// HK May 27 2026 Ship 3 (Q1=b): schedule all N package sessions on
// ONE page. N mini date+time rows, each with its own date and time
// picker. Caps at 6 visible rows (HK: 7+ would crowd the page; those
// fall back to booking one at a time). On confirm, creates N bookings
// all linked to the package, writes the redemption rows, decrements
// the balance once per session.
//
// Self-contained: carries its own slot generation so it does not
// couple to BookingPage internals. Reused by the client-facing
// post-purchase flow and (later) the therapist client card.

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { findOrCreateClient } from '../lib/findOrCreateClient';

const C = { forest: '#2A5741', sage: '#6B9E80', beige: '#F5F0E8', white: '#FFFFFF', dark: '#1A1A2E', gray: '#6B7280', light: '#E8E4DC' };

const fmt12 = t => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDateLabel = iso => {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// Slot generation. Same overlap math as BookingPage.generateSlots,
// kept local so this component does not depend on that module.
function genSlots(start, end, dur, booked, bufferMins = 0) {
  const slots = [];
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let cur = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (cur + dur <= endMin) {
    const hh = String(Math.floor(cur / 60)).padStart(2, '0');
    const mm = String(cur % 60).padStart(2, '0');
    const slotEndMins = cur + dur;
    const se = `${String(Math.floor(slotEndMins / 60)).padStart(2, '0')}:${String(slotEndMins % 60).padStart(2, '0')}`;
    const slotStartMins = cur;
    const conflict = booked.some(b => {
      if (!b.start_time) return false;
      const bs = parseInt(b.start_time.slice(0, 2)) * 60 + parseInt(b.start_time.slice(3, 5));
      const be = b.end_time ? (parseInt(b.end_time.slice(0, 2)) * 60 + parseInt(b.end_time.slice(3, 5))) : (bs + dur);
      const blockStart = bs - bufferMins;
      const blockEnd = be + bufferMins;
      return !(slotEndMins <= blockStart || slotStartMins >= blockEnd);
    });
    if (!conflict) slots.push({ start: `${hh}:${mm}`, end: se, display: fmt12(`${hh}:${mm}`) });
    cur += 30;
  }
  return slots;
}

export default function BulkSessionScheduler({
  therapist,
  services,
  availability,
  redeemContext,    // { purchaseId, sessionsRemaining, packageName, clientEmail, clientName, clientId }
  applicableServiceIds, // array or null/empty for all
  onComplete,       // (createdCount) => void
  onCancel,
}) {
  // Cap visible rows at 6 per HK. If they bought more, they schedule
  // the first 6 here and book the rest one at a time afterward.
  const maxRows = Math.min(redeemContext?.sessionsRemaining || 1, 6);

  // Eligible services: package may restrict to specific ones.
  const eligibleServices = useMemo(() => {
    const apply = applicableServiceIds;
    if (!apply || (Array.isArray(apply) && apply.length === 0)) return services;
    return services.filter(s => apply.includes(s.id));
  }, [services, applicableServiceIds]);

  const [serviceId, setServiceId] = useState(eligibleServices[0]?.id || null);
  const svc = eligibleServices.find(s => s.id === serviceId) || eligibleServices[0];

  // One row per session: { date, time }
  const [rows, setRows] = useState(() => Array.from({ length: maxRows }, () => ({ date: '', time: '' })));
  const [slotsByDate, setSlotsByDate] = useState({}); // iso -> [{start,end,display}]
  const [loadingDate, setLoadingDate] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [doneCount, setDoneCount] = useState(0);

  // Build the list of pickable dates: next 60 days that fall on an
  // available weekday.
  const availableDows = useMemo(() => new Set((availability || []).map(a => a.day_of_week)), [availability]);
  const pickableDates = useMemo(() => {
    const out = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 1; i <= 60 && out.length < 45; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      if (availableDows.has(d.getDay())) out.push(isoDate(d));
    }
    return out;
  }, [availableDows]);

  // Fetch availability + existing bookings for a date, compute open
  // slots. Also subtract slots already picked in OTHER rows for the
  // same date so the client cannot double-book themselves.
  async function loadSlotsForDate(iso, exceptRowIdx) {
    if (!svc) return;
    setLoadingDate(iso);
    try {
      const d = new Date(iso + 'T12:00:00');
      const dow = d.getDay();
      const dayAvail = (availability || []).filter(a => a.day_of_week === dow);
      const { data: existing } = await supabase
        .from('bookings')
        .select('start_time, end_time, status')
        .eq('therapist_id', therapist.id)
        .eq('booking_date', iso)
        .neq('status', 'cancelled');
      const dur = svc.duration || 60;
      const buffer = therapist?.buffer_enabled ? (therapist?.buffer_minutes || 0) : 0;
      let all = [];
      dayAvail.forEach(a => {
        all = all.concat(genSlots(a.start_time, a.end_time, dur, existing || [], buffer));
      });
      // Subtract slots taken by other rows on the same date.
      const takenSameDate = rows
        .filter((r, idx) => idx !== exceptRowIdx && r.date === iso && r.time)
        .map(r => r.time);
      all = all.filter(s => !takenSameDate.includes(s.start));
      // Dedup by start.
      const seen = new Set();
      const dedup = all.filter(s => { if (seen.has(s.start)) return false; seen.add(s.start); return true; })
        .sort((a, b) => a.start.localeCompare(b.start));
      setSlotsByDate(prev => ({ ...prev, [iso]: dedup }));
    } catch (e) {
      console.error('[bulk] loadSlotsForDate failed:', e);
    } finally {
      setLoadingDate(null);
    }
  }

  function setRowDate(idx, iso) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, date: iso, time: '' } : r));
    if (iso && !slotsByDate[iso]) loadSlotsForDate(iso, idx);
  }
  function setRowTime(idx, time) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, time } : r));
  }

  const filledRows = rows.filter(r => r.date && r.time);
  const canSubmit = filledRows.length > 0 && !submitting && svc;

  async function submitAll() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setDoneCount(0);
    try {
      // Resolve client id once.
      let clientId = redeemContext.clientId;
      if (!clientId) {
        clientId = await findOrCreateClient({
          supabase,
          therapist_id: therapist.id,
          name: redeemContext.clientName || '',
          email: redeemContext.clientEmail || '',
          phone: '',
        });
      }

      // Re-read the package balance so we never create more bookings
      // than sessions remaining (guards against the client opening two
      // tabs, or a stale sessionsRemaining).
      const { data: pkg } = await supabase
        .from('package_purchases')
        .select('sessions_remaining')
        .eq('id', redeemContext.purchaseId)
        .single();
      let remaining = pkg?.sessions_remaining ?? redeemContext.sessionsRemaining ?? filledRows.length;

      let created = 0;
      for (const row of filledRows) {
        if (remaining <= 0) break;
        const dur = svc.duration || 60;
        const [sh, sm] = row.time.split(':').map(Number);
        const endMins = sh * 60 + sm + dur;
        const endTime = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;

        const { data: nb, error: insErr } = await supabase.from('bookings').insert({
          therapist_id: therapist.id,
          service_id: svc.id,
          client_id: clientId,
          client_name: redeemContext.clientName || '',
          client_email: (redeemContext.clientEmail || '').toLowerCase(),
          booking_date: row.date,
          start_time: row.time,
          end_time: endTime,
          status: 'confirmed',
          deposit_required: false,
          package_purchase_id: redeemContext.purchaseId,
        }).select('id').single();
        if (insErr) { console.error('[bulk] insert failed:', insErr); continue; }

        const bid = nb.id;
        // $0 payment + redemption audit.
        await supabase.from('session_payments').insert({
          booking_id: bid,
          package_purchase_id: redeemContext.purchaseId,
          therapist_id: therapist.id,
          client_id: clientId,
          amount_cents: 0,
          tip_cents: 0,
          payment_method: 'package_redemption',
          payment_method_detail: redeemContext.packageName || 'Package',
          status: 'succeeded',
          paid_at: new Date().toISOString(),
        });
        await supabase.from('package_redemptions').insert({
          package_purchase_id: redeemContext.purchaseId,
          booking_id: bid,
          notes: `Session redeemed: ${svc.name || 'Session'}`,
        });
        remaining -= 1;
        created += 1;
        setDoneCount(created);
      }

      // One final decrement write reflecting how many we actually made.
      const newRemaining = Math.max(0, remaining);
      const pkgUpdate = { sessions_remaining: newRemaining };
      if (newRemaining === 0) pkgUpdate.status = 'exhausted';
      await supabase.from('package_purchases').update(pkgUpdate).eq('id', redeemContext.purchaseId);

      onComplete?.(created);
    } catch (e) {
      console.error('[bulk] submitAll failed:', e);
      setError(e.message || 'Something went wrong scheduling your sessions. Some may have been created.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!svc) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: C.gray, fontSize: 14 }}>
        No services available to schedule against this package.
      </div>
    );
  }

  return (
    <div>
      {/* Service picker (only if more than one eligible) */}
      {eligibleServices.length > 1 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Service for all sessions
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {eligibleServices.map(s => (
              <button key={s.id}
                onClick={() => { setServiceId(s.id); setSlotsByDate({}); setRows(rows.map(r => ({ ...r, time: '' }))); }}
                style={{
                  padding: '8px 14px',
                  border: `1.5px solid ${serviceId === s.id ? C.forest : C.light}`,
                  background: serviceId === s.id ? '#F0FDF4' : '#fff',
                  color: serviceId === s.id ? C.forest : C.dark,
                  borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                {s.name} ({s.duration} min)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Session rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows.map((row, idx) => (
          <div key={idx} style={{
            background: '#fff',
            border: `1.5px solid ${row.date && row.time ? '#86EFAC' : C.light}`,
            borderRadius: 14, padding: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 10 }}>
              Session {idx + 1}
              {row.date && row.time && <span style={{ color: '#16A34A', marginLeft: 8 }}>✓ {fmtDateLabel(row.date)} at {fmt12(row.time)}</span>}
            </div>

            {/* Date chips */}
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Date</div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: row.date ? 12 : 0, WebkitOverflowScrolling: 'touch' }}>
              {pickableDates.slice(0, 14).map(iso => (
                <button key={iso}
                  onClick={() => setRowDate(idx, iso)}
                  style={{
                    flexShrink: 0,
                    padding: '8px 12px',
                    border: `1.5px solid ${row.date === iso ? C.forest : C.light}`,
                    background: row.date === iso ? '#F0FDF4' : '#fff',
                    color: row.date === iso ? C.forest : C.dark,
                    borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>
                  {fmtDateLabel(iso)}
                </button>
              ))}
            </div>

            {/* Time chips for selected date */}
            {row.date && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Time</div>
                {loadingDate === row.date && !slotsByDate[row.date] ? (
                  <div style={{ fontSize: 13, color: C.gray, padding: '8px 0' }}>Loading times...</div>
                ) : (slotsByDate[row.date]?.length || 0) === 0 ? (
                  <div style={{ fontSize: 13, color: C.gray, padding: '8px 0' }}>No open times that day. Pick another date.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {slotsByDate[row.date].map(s => (
                      <button key={s.start}
                        onClick={() => setRowTime(idx, s.start)}
                        style={{
                          padding: '8px 12px',
                          border: `1.5px solid ${row.time === s.start ? C.forest : C.light}`,
                          background: row.time === s.start ? '#F0FDF4' : '#fff',
                          color: row.time === s.start ? C.forest : C.dark,
                          borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                        }}>
                        {s.display}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {(redeemContext?.sessionsRemaining || 0) > maxRows && (
        <p style={{ fontSize: 12, color: C.gray, marginTop: 12, lineHeight: 1.5 }}>
          You have {redeemContext.sessionsRemaining} sessions. Schedule up to {maxRows} here now; you can book the rest anytime from your package.
        </p>
      )}

      {error && (
        <div style={{ marginTop: 14, background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 10, padding: 14, fontSize: 13, color: '#991B1B', lineHeight: 1.5 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button onClick={onCancel} disabled={submitting}
          style={{ flex: 1, background: '#fff', border: `1.5px solid ${C.light}`, borderRadius: 12, padding: '14px', fontSize: 14, fontWeight: 600, color: C.gray, cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={submitAll} disabled={!canSubmit}
          style={{
            flex: 2,
            background: canSubmit ? C.forest : '#9CA3AF',
            color: '#fff', border: 'none', borderRadius: 12, padding: '14px',
            fontSize: 14, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed',
            boxShadow: canSubmit ? '0 4px 14px rgba(42,87,65,0.25)' : 'none',
          }}>
          {submitting
            ? `Booking ${doneCount}/${filledRows.length}...`
            : filledRows.length === 0
              ? 'Pick dates and times'
              : `Book ${filledRows.length} session${filledRows.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
