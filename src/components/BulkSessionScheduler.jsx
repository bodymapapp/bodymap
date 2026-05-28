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
import MonthCalendar from './MonthCalendar';

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

  // Default service: first eligible. Each row carries its OWN
  // serviceId so the client can pick a different service per session
  // (HK May 27 2026: 'doesn't allow different service by session').
  const defaultServiceId = eligibleServices[0]?.id || null;

  // One row per session: { serviceId, date, time, pickerOpen, dateOpen }.
  // serviceId defaults to the first eligible service; the row's
  // compact service picker (no dropdown, per house rules) lets the
  // client change it per session. dateOpen toggles the month calendar.
  //
  // HK May 27 2026: save progress. Rows are persisted to sessionStorage
  // keyed by the package purchase id, so if the client (or therapist)
  // accidentally closes the modal mid-scheduling, reopening restores
  // their picks instead of starting over. Cleared on successful submit.
  const draftKey = `bulk_sched_draft_${redeemContext?.purchaseId || 'none'}`;
  const [rows, setRows] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' && window.sessionStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Re-normalise length to maxRows and ensure transient flags reset.
          return Array.from({ length: maxRows }, (_, i) => ({
            serviceId: parsed[i]?.serviceId || defaultServiceId,
            date: parsed[i]?.date || '',
            time: parsed[i]?.time || '',
            pickerOpen: false,
            dateOpen: false,
          }));
        }
      }
    } catch (e) { /* ignore corrupt draft */ }
    return Array.from({ length: maxRows }, () => ({ serviceId: defaultServiceId, date: '', time: '', pickerOpen: false, dateOpen: false }));
  });

  // Persist the draft (serviceId/date/time only, not transient UI flags)
  // whenever rows change. Wrapped in try/catch since sessionStorage can
  // throw in private mode.
  useEffect(() => {
    try {
      const slim = rows.map(r => ({ serviceId: r.serviceId, date: r.date, time: r.time }));
      window.sessionStorage.setItem(draftKey, JSON.stringify(slim));
    } catch (e) { /* ignore */ }
  }, [rows, draftKey]);
  // Slots keyed by `${iso}|${duration}` since different services have
  // different durations and therefore different open slots.
  const [slotsByKey, setSlotsByKey] = useState({});
  const [loadingKey, setLoadingKey] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [doneCount, setDoneCount] = useState(0);

  const svcById = useMemo(() => {
    const m = {};
    eligibleServices.forEach(s => { m[s.id] = s; });
    return m;
  }, [eligibleServices]);
  const slotKey = (iso, dur) => `${iso}|${dur}`;

  // MonthCalendar handles which dates are pickable (it greys out
  // weekdays the therapist is not available and past dates), so the
  // old precomputed pickableDates list is no longer needed.

  // Fetch availability + existing bookings for a date, compute open
  // slots for a given duration. Keyed by date+duration. Also subtract
  // slots already picked in OTHER rows for the same date so the client
  // cannot double-book themselves.
  async function loadSlotsForDate(iso, dur, exceptRowIdx) {
    const key = slotKey(iso, dur);
    setLoadingKey(key);
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
      const seen = new Set();
      const dedup = all.filter(s => { if (seen.has(s.start)) return false; seen.add(s.start); return true; })
        .sort((a, b) => a.start.localeCompare(b.start));
      setSlotsByKey(prev => ({ ...prev, [key]: dedup }));
    } catch (e) {
      console.error('[bulk] loadSlotsForDate failed:', e);
    } finally {
      setLoadingKey(null);
    }
  }

  function setRowService(idx, sid) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, serviceId: sid, time: '', pickerOpen: false } : r));
    // Reload slots for the new duration if a date is already chosen.
    const row = rows[idx];
    const dur = svcById[sid]?.duration || 60;
    if (row?.date && !slotsByKey[slotKey(row.date, dur)]) loadSlotsForDate(row.date, dur, idx);
  }
  function toggleRowPicker(idx) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, pickerOpen: !r.pickerOpen, dateOpen: false } : r));
  }
  function toggleRowDate(idx) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, dateOpen: !r.dateOpen, pickerOpen: false } : r));
  }
  function setRowDate(idx, iso) {
    const dur = svcById[rows[idx]?.serviceId]?.duration || 60;
    // Close the calendar once a date is picked so the time chips show.
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, date: iso, time: '', dateOpen: false } : r));
    if (iso && !slotsByKey[slotKey(iso, dur)]) loadSlotsForDate(iso, dur, idx);
  }
  function setRowTime(idx, time) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, time } : r));
  }

  const filledRows = rows.filter(r => r.serviceId && r.date && r.time);
  const canSubmit = filledRows.length > 0 && !submitting;

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
        const rowSvc = svcById[row.serviceId];
        if (!rowSvc) { console.error('[bulk] row has no service, skipping'); continue; }
        const dur = rowSvc.duration || 60;
        const [sh, sm] = row.time.split(':').map(Number);
        const endMins = sh * 60 + sm + dur;
        const endTime = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;

        const { data: nb, error: insErr } = await supabase.from('bookings').insert({
          therapist_id: therapist.id,
          service_id: rowSvc.id,
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
          notes: `Session redeemed: ${rowSvc.name || 'Session'}`,
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

      // Scheduling succeeded: clear the saved draft so a future visit
      // starts fresh.
      try { window.sessionStorage.removeItem(draftKey); } catch (e) { /* ignore */ }

      onComplete?.(created);
    } catch (e) {
      console.error('[bulk] submitAll failed:', e);
      setError(e.message || 'Something went wrong scheduling your sessions. Some may have been created.');
    } finally {
      setSubmitting(false);
    }
  }

  if (eligibleServices.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: C.gray, fontSize: 14 }}>
        No services available to schedule against this package.
      </div>
    );
  }

  return (
    <div>
      {/* HK May 27 2026: service is now picked PER session, not once for
          all. Each row shows the chosen service as a compact pill with
          a 'Change' affordance that expands an inline chip list for
          that row only. No dropdown (house rule), no giant always-on
          chip wall. Different sessions can use different services. */}

      {/* Session rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows.map((row, idx) => {
          const rowSvc = svcById[row.serviceId];
          const dur = rowSvc?.duration || 60;
          const key = slotKey(row.date, dur);
          const slots = slotsByKey[key] || [];
          const complete = row.serviceId && row.date && row.time;
          return (
          <div key={idx} style={{
            background: '#fff',
            border: `1.5px solid ${complete ? '#86EFAC' : C.light}`,
            borderRadius: 14, padding: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 10 }}>
              Session {idx + 1}
              {complete && <span style={{ color: '#16A34A', marginLeft: 8, fontWeight: 600 }}>✓ {fmtDateLabel(row.date)} at {fmt12(row.time)}</span>}
            </div>

            {/* Per-session service picker */}
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Service</div>
            {eligibleServices.length === 1 ? (
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.dark, marginBottom: 12 }}>
                {rowSvc?.name} ({dur} min)
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                {/* Compact current-selection row + Change toggle */}
                <button
                  onClick={() => toggleRowPicker(idx)}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 10,
                    padding: '11px 14px',
                    border: `1.5px solid ${C.light}`,
                    background: '#FAFAF7',
                    borderRadius: 10,
                    fontSize: 14, fontWeight: 600, color: C.dark,
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}>
                  <span>{rowSvc ? `${rowSvc.name} (${dur} min)` : 'Pick a service'}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.forest, whiteSpace: 'nowrap' }}>
                    {row.pickerOpen ? 'Close' : 'Change'}
                  </span>
                </button>
                {row.pickerOpen && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {eligibleServices.map(s => (
                      <button key={s.id}
                        onClick={() => setRowService(idx, s.id)}
                        style={{
                          padding: '8px 12px',
                          border: `1.5px solid ${row.serviceId === s.id ? C.forest : C.light}`,
                          background: row.serviceId === s.id ? '#F0FDF4' : '#fff',
                          color: row.serviceId === s.id ? C.forest : C.dark,
                          borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                        {s.name} ({s.duration} min)
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Date: compact pill that expands a monthly calendar.
                HK May 27 2026: replaced the horizontal scrolling date
                strip (bad experience) with the same monthly grid the
                rest of the booking flow uses. */}
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Date</div>
            <button
              onClick={() => toggleRowDate(idx)}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                padding: '11px 14px',
                border: `1.5px solid ${C.light}`,
                background: '#FAFAF7',
                borderRadius: 10,
                fontSize: 14, fontWeight: 600, color: row.date ? C.dark : C.gray,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                marginBottom: row.dateOpen || row.date ? 10 : 0,
              }}>
              <span>{row.date ? fmtDateLabel(row.date) : 'Pick a date'}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.forest, whiteSpace: 'nowrap' }}>
                {row.dateOpen ? 'Close' : (row.date ? 'Change' : 'Choose')}
              </span>
            </button>
            {row.dateOpen && (
              <div style={{ border: `1px solid ${C.light}`, borderRadius: 12, padding: 14, marginBottom: 12, background: '#fff' }}>
                <MonthCalendar
                  availability={availability}
                  service={rowSvc}
                  selected={row.date}
                  onSelect={(iso) => setRowDate(idx, iso)}
                />
              </div>
            )}

            {/* Time chips for selected date */}
            {row.date && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Time</div>
                {loadingKey === key && !slotsByKey[key] ? (
                  <div style={{ fontSize: 13, color: C.gray, padding: '8px 0' }}>Loading times...</div>
                ) : slots.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.gray, padding: '8px 0' }}>No open times that day. Pick another date.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {slots.map(s => (
                      <button key={s.start}
                        onClick={() => setRowTime(idx, s.start)}
                        style={{
                          padding: '8px 12px',
                          border: `1.5px solid ${row.time === s.start ? C.forest : C.light}`,
                          background: row.time === s.start ? '#F0FDF4' : '#fff',
                          color: row.time === s.start ? C.forest : C.dark,
                          borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                        {s.display}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          );
        })}
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
