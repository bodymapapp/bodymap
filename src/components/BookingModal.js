// BookingModal.js
// Used for: Create Booking, Reschedule, and Rebook (in-session)
// mode: 'create' | 'reschedule' | 'rebook'
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { findOrCreateClient } from '../lib/findOrCreateClient';
import CloseButton from './CloseButton';
import SelectableMonthView from './SelectableMonthView';

const C = {
  forest: '#2A5741', sage: '#6B9E80', beige: '#F5F0E8',
  dark: '#1A1A2E', gray: '#6B7280', light: '#F3F4F6',
  border: '#E8E4DC', white: '#FFFFFF',
};

const fmtDate = d => {
  const [y, m, day] = d.split('-');
  return new Date(+y, +m - 1, +day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const toDateStr = d => {
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};

const addMins = (hhmm, mins) => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
};

const fmt12 = t => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

export default function BookingModal({ therapist, mode = 'create', existingBooking = null, prefillClient = null, prefillDateTime = null, onClose, onSuccess }) {
  const isReschedule = mode === 'reschedule';
  const isRebook    = mode === 'rebook';

  // Form state
  const [name,  setName]  = useState(existingBooking?.client || prefillClient?.name  || '');
  const [email, setEmail] = useState(existingBooking?.email  || prefillClient?.email || '');
  const [phone, setPhone] = useState(prefillClient?.phone || '');
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [allClients, setAllClients] = useState([]);

  // Load client list for autocomplete
  useEffect(() => {
    if (!therapist?.id) return;
    supabase.from('clients').select('name, email, phone').eq('therapist_id', therapist.id)
      .eq('do_not_rebook', false).order('name')
      .then(({ data }) => setAllClients(data || []));
  }, [therapist?.id]);

  function handleNameChange(val) {
    setName(val);
    if (val.length < 2) { setClientSuggestions([]); return; }
    const q = val.toLowerCase();
    setClientSuggestions(allClients.filter(c => c.name?.toLowerCase().includes(q)).slice(0, 5));
  }

  function selectClient(c) {
    setName(c.name);
    setEmail(c.email || '');
    setPhone(c.phone || '');
    setClientSuggestions([]);
  }
  const [serviceId, setServiceId] = useState('');
  const [services, setServices]   = useState([]);
  const [availability, setAvail]  = useState([]);
  // HK May 25 2026 (Phase 23): add-ons in therapist-initiated bookings.
  // Public BookingPage already supports add-ons; the therapist-side
  // modal was missing them, so therapists couldn't add the hot stones
  // upcharge, CBD oil, etc when booking from the schedule.
  // Loads from service_addons same query the public page uses.
  // selectedAddonIds is a Set of addon UUIDs the therapist toggled on.
  const [availableAddons, setAvailableAddons] = useState([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState(new Set(existingBooking?.addon_ids || []));
  // Phase 9.3 (HK May 18 2026): when launched from the long-press
  // 'block or event' confirm sheet, prefillDateTime carries the
  // date and start time the user pressed on. We seed `date` from
  // it directly; the matching slot gets selected by an effect
  // below once services and slots are loaded.
  const [date, setDate]   = useState(prefillDateTime?.date || '');
  const [slots, setSlots] = useState([]);
  const [slot, setSlot]   = useState(null);
  const [notes, setNotes] = useState(existingBooking?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [blockedDates, setBlockedDates] = useState(new Set());
  // Phase 9.1: partial-day blocks keyed by date string.
  const [partialBlocksByDate, setPartialBlocksByDate] = useState({});
  // Multi-location (HK May 18 2026): list of therapist's active
  // locations. Dropdown only renders when length >= 2. Default
  // selection is the primary location. On reschedule, preserves the
  // existing booking's location.
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState(existingBooking?.location_id || null);

  // ─── Series booking state (HK May 29 2026) ──────────────────────────
  // Series mode lets the therapist book N sessions for the same client
  // in one flow. Defaults OFF; disabled entirely on reschedule.
  // Rule-first design for our 70yo persona: pick every-N-weeks and
  // count, the calendar auto-selects, manual tweaks supported on top.
  const [seriesMode, setSeriesMode] = useState(false);
  const [seriesEveryWeeks, setSeriesEveryWeeks] = useState(2);
  const [seriesCount, setSeriesCount] = useState(4);
  // Manual override layer: dates the user explicitly added (beyond rule)
  // and dates explicitly dropped (subtracted from rule).
  const [seriesManualAdd, setSeriesManualAdd] = useState([]);
  const [seriesManualDrop, setSeriesManualDrop] = useState([]);

  // Compute the final list of dates in the series:
  //   ruleBase = [anchor, anchor + every*7 days, anchor + 2*every*7, ...]
  //   final = (ruleBase - seriesManualDrop) ∪ seriesManualAdd, deduped, sorted.
  // anchor = the primary `date` field, so changing it shifts the series.
  const seriesDates = useMemo(() => {
    if (!seriesMode) return [];
    if (!date) return [];
    const ruleBase = [];
    const [y, m, d] = date.split('-').map(Number);
    const anchor = new Date(y, m - 1, d);
    const count = Math.max(1, Math.min(52, seriesCount | 0));
    const every = Math.max(1, Math.min(26, seriesEveryWeeks | 0));
    for (let i = 0; i < count; i++) {
      const dt = new Date(anchor);
      dt.setDate(anchor.getDate() + i * every * 7);
      ruleBase.push(toDateStr(dt));
    }
    const dropSet = new Set(seriesManualDrop);
    const merged = new Set(ruleBase.filter(d => !dropSet.has(d)));
    for (const d of seriesManualAdd) merged.add(d);
    return Array.from(merged).sort();
  }, [seriesMode, date, seriesEveryWeeks, seriesCount, seriesManualAdd, seriesManualDrop]);

  function toggleSeriesDate(iso) {
    // If currently in seriesDates, drop it. Else add it.
    if (seriesDates.includes(iso)) {
      // If it's a rule-generated date, add to drop list. If it's manual-add, remove from add list.
      if (seriesManualAdd.includes(iso)) {
        setSeriesManualAdd(arr => arr.filter(d => d !== iso));
      } else {
        setSeriesManualDrop(arr => arr.includes(iso) ? arr : [...arr, iso]);
      }
    } else {
      // Add: remove from drop list if it was dropped, else add to manual-add.
      if (seriesManualDrop.includes(iso)) {
        setSeriesManualDrop(arr => arr.filter(d => d !== iso));
      } else {
        setSeriesManualAdd(arr => arr.includes(iso) ? arr : [...arr, iso]);
      }
    }
  }

  function seriesIndexFor(iso) {
    const i = seriesDates.indexOf(iso);
    return i >= 0 ? i + 1 : null;
  }

  // Load services + availability + blocked days
  useEffect(() => {
    async function load() {
      const [{ data: svcs }, { data: avail }, { data: blocked }, { data: locs }, { data: addons }] = await Promise.all([
        supabase.from('services').select('*').eq('therapist_id', therapist.id).eq('active', true).is('archived_at', null).order('sort_order', { ascending: true }).order('price', { ascending: true }),
        supabase.from('availability').select('*').eq('therapist_id', therapist.id).eq('active', true),
        // Phase 9.1: fetch start_time/end_time so partial-day blocks
        // are honored in the therapist's book-on-behalf flow too.
        supabase.from('blocked_days').select('date, start_time, end_time').eq('therapist_id', therapist.id),
        // Multi-location: same fetch as the public booking page.
        supabase.from('therapist_locations').select('*').eq('therapist_id', therapist.id).eq('active', true).order('sort_order', { ascending: true }),
        // Phase 23 (HK May 25 2026): add-ons for therapist-initiated
        // bookings. Mirrors the public booking page fetch so the same
        // set of add-ons is available everywhere.
        supabase.from('service_addons').select('*').eq('therapist_id', therapist.id).eq('active', true).order('display_order').order('created_at'),
      ]);
      setServices(svcs || []);
      setAvail(avail || []);
      setAvailableAddons(addons || []);
      // Split full-day vs partial. Full-day blocks the entire date in
      // the calendar (blockedDates Set). Partial gets bucketed by date
      // and used in slot generation as a pseudo-booking.
      const fullDay = [];
      const partial = {};
      for (const b of (blocked || [])) {
        if (b.start_time && b.end_time) {
          if (!partial[b.date]) partial[b.date] = [];
          partial[b.date].push({ start_time: b.start_time.slice(0,5), end_time: b.end_time.slice(0,5) });
        } else {
          fullDay.push(b.date);
        }
      }
      setBlockedDates(new Set(fullDay));
      setPartialBlocksByDate(partial);
      // Locations: default to primary (or whatever location the
      // existing reschedule booking already had, preserved at state
      // init).
      const locList = locs || [];
      setLocations(locList);
      if (!existingBooking?.location_id && locList.length > 0) {
        const primary = locList.find(l => l.is_primary) || locList[0];
        setLocationId(primary.id);
      }
      if (svcs?.length) {
        // Pre-select service if reschedule
        const existing = svcs.find(s => s.name === existingBooking?.service) || svcs[0];
        setServiceId(existing?.id || svcs[0]?.id);
      }
    }
    load();
  }, [therapist.id]);

  // Generate time slots when date or service changes
  useEffect(() => {
    if (!date || !serviceId) return;
    generateSlots();
  }, [date, serviceId]);

  async function generateSlots() {
    setLoadingSlots(true);
    setSlots([]);
    setSlot(null);

    const svc = services.find(s => s.id === serviceId);
    if (!svc) { setLoadingSlots(false); return; }

    const dow = new Date(date + 'T12:00:00').getDay();
    const av = availability.find(a => a.day_of_week === dow);
    if (!av) { setLoadingSlots(false); return; }

    const start = (av.start_time || '09:00').slice(0, 5);
    const end   = (av.end_time   || '17:00').slice(0, 5);

    // Fetch existing bookings on that date to avoid conflicts
    const { data: booked } = await supabase
      .from('bookings')
      .select('start_time, end_time, id')
      .eq('therapist_id', therapist.id)
      .eq('booking_date', date)
      .neq('status', 'cancelled');

    const bookedFiltered = (booked || []).filter(b => isReschedule ? b.id !== existingBooking?.id : true);
    // Phase 9.1: append partial-day blocks for this date as pseudo-
    // bookings so the conflict check below treats them as occupied.
    const partials = (partialBlocksByDate[date] || []).map(b => ({
      start_time: b.start_time,
      end_time: b.end_time,
      id: `block-${b.start_time}`,
    }));
    const conflictPool = [...bookedFiltered, ...partials];

    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin   = eh * 60 + em;
    const dur = svc.duration || 60;

    // Buffer time (HK May 18 2026): when therapist has buffer enabled,
    // extend each existing booking's effective end time by buffer_minutes
    // so the slot generator won't offer slots starting inside the buffer
    // window. Mirrors the same logic in src/pages/BookingPage.js
    // generateSlots(). Buffer also applies to partial-day blocks (the
    // therapist might want breathing room after a self-block too).
    const bufferMins = therapist?.buffer_enabled ? (therapist?.buffer_minutes || 15) : 0;

    const raw = [];
    for (let m = startMin; m + dur <= endMin; m += 30) {
      const h = Math.floor(m / 60), mn = m % 60;
      const slotStart = `${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;
      const slotEnd   = addMins(slotStart, dur);

      const conflict = conflictPool.some(b => {
        // Two-sided buffer (HK May 19 2026, Candice fix): block slots
        // adjacent on BOTH sides of each existing booking, not just
        // after. Mirrors the matching fix in BookingPage.generateSlots.
        const bs = (parseInt(b.start_time) * 60 + parseInt(b.start_time.slice(3))) - bufferMins;
        const be = (parseInt(b.end_time)   * 60 + parseInt(b.end_time.slice(3))) + bufferMins;
        const ss = m, se = m + dur;
        return ss < be && se > bs;
      });
      if (!conflict) raw.push({ start: slotStart, end: slotEnd });
    }
    setSlots(raw);
    setLoadingSlots(false);
  }

  // Phase 9.3 (HK May 18 2026): if launched with prefillDateTime,
  // auto-select the slot matching the prefilled start time once
  // slots have populated. If no matching standard slot exists (e.g.
  // the press landed at 10:23 AM and standard slots are on 30-min
  // boundaries), fall through to a custom-time slot at the exact
  // prefilled time.
  useEffect(() => {
    if (!prefillDateTime?.startTime) return;
    if (loadingSlots) return;
    if (slot) return; // user already picked something
    const svc = services.find(s => s.id === serviceId);
    if (!svc) return;
    const targetStart = prefillDateTime.startTime;
    const match = slots.find(s => s.start === targetStart);
    if (match) {
      setSlot(match);
    } else {
      // Custom slot at the exact prefilled time. Mirrors the
      // 'Set a custom time' path further down in the UI.
      setSlot({ start: targetStart, end: addMins(targetStart, svc.duration || 60) });
    }
    // Only run once after slots first load. Re-running on every
    // slot change would fight the user when they pick a different slot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingSlots, slots.length, serviceId]);

  async function save() {
    setError('');
    if (!name.trim())   { setError('Client name is required.'); return; }
    if (!date)          { setError('Please pick a date.'); return; }
    if (!slot)          { setError('Please pick a time slot.'); return; }
    if (!serviceId)     { setError('Please select a service.'); return; }
    if (seriesMode && !isReschedule && seriesDates.length < 2) {
      setError('A series needs at least 2 dates. Adjust the rule or turn off series mode.');
      return;
    }

    setSaving(true);
    try {
      let bookingId = null;
      let eventType = null;

      // ─── SERIES PATH (HK May 29 2026) ────────────────────────────
      // When seriesMode is on, insert a booking_series row, then N
      // bookings sharing that series_id + series_index 1..N. Each
      // session uses the same client/service/duration/start_time but
      // its own booking_date. Notifications fire per booking via
      // fireBookingConfirmation. Conflicts are not auto-resolved here;
      // the therapist's calendar preview is the conflict surface.
      if (seriesMode && !isReschedule) {
        const svc = services.find(s => s.id === serviceId);
        const clientIdForBooking = await findOrCreateClient({
          supabase, therapist_id: therapist.id, name, email, phone,
        });

        // Insert series row first.
        const { data: seriesRow, error: serErr } = await supabase
          .from('booking_series')
          .insert({
            therapist_id: therapist.id,
            client_id: clientIdForBooking,
            label: `${(svc?.name || 'Session')} series for ${name.trim()}`,
            rule_text: `Every ${seriesEveryWeeks} week${seriesEveryWeeks === 1 ? '' : 's'} for ${seriesDates.length} sessions`,
            total_count: seriesDates.length,
            created_by_therapist_id: therapist.id,
          })
          .select('id')
          .single();
        if (serErr) throw serErr;
        const seriesId = seriesRow.id;

        const sortedDates = [...seriesDates].sort();
        const rows = sortedDates.map((dateStr, idx) => ({
          therapist_id:  therapist.id,
          service_id:    serviceId,
          client_id:     clientIdForBooking,
          client_name:   name.trim(),
          client_email:  email.trim().toLowerCase(),
          client_phone:  phone.trim(),
          booking_date:  dateStr,
          start_time:    slot.start,
          end_time:      slot.end,
          notes:         notes.trim(),
          status:        'confirmed',
          deposit_required: false,
          deposit_amount:   0,
          deposit_paid:     false,
          location_id:   locationId || null,
          addon_ids:           Array.from(selectedAddonIds),
          addon_total_price:   addonTotalPrice,
          addon_extra_minutes: addonExtraMinutes,
          series_id:    seriesId,
          series_index: idx + 1,
        }));

        const { data: inserted, error: bulkErr } = await supabase
          .from('bookings')
          .insert(rows)
          .select('id, booking_date, series_index');
        if (bulkErr) throw bulkErr;

        // Fire booking confirmation for each. Non-blocking, paced
        // lightly so we don't bury Resend's 5/sec budget.
        for (const b of (inserted || [])) {
          fireBookingConfirmation(b.id, 'booking_created');
          await new Promise(r => setTimeout(r, 220));
        }

        onSuccess?.();
        onClose();
        return;
      }

      if (isReschedule && existingBooking?.id) {
        // Update existing booking date/time. location_id only sent
        // when therapist has multi-location active (otherwise the
        // existing FK stays untouched, which is the correct behavior
        // for single-location accounts).
        // HK May 29 2026: capture previous_booking_date + previous_start_time
        // + rescheduled_at on the row itself so the Schedule timeline
        // can show "Rescheduled from <old date> <old time>" without
        // needing a separate history table lookup.
        const prevDate = existingBooking?.booking_date || existingBooking?.start_date || null;
        const prevTime = existingBooking?.start_time || null;
        const updatePayload = {
          booking_date: date,
          start_time: slot.start,
          end_time: slot.end,
          notes,
          previous_booking_date: prevDate,
          previous_start_time: prevTime,
          rescheduled_at: new Date().toISOString(),
        };
        if (locations.length >= 2 && locationId) {
          updatePayload.location_id = locationId;
        }
        const { error: e } = await supabase.from('bookings')
          .update(updatePayload)
          .eq('id', existingBooking.id);
        if (e) throw e;
        bookingId = existingBooking.id;
        eventType = 'booking_rescheduled';

        // HK May 26 2026: fire the C10 reschedule confirmation email
        // (notify-booking-event with event_type='reschedule' routes to
        // send-reschedule-confirmation in the fan-out). Non-blocking.
        try {
          const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
          const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
          fetch(`${supabaseUrl}/functions/v1/notify-booking-event`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
            },
            body: JSON.stringify({
              booking_id: bookingId,
              event_type: 'reschedule',
              reschedule_prev: { prev_date: prevDate, prev_time: prevTime },
            }),
          }).catch(() => { /* non-blocking */ });
        } catch (_) { /* non-blocking */ }
      } else {
        // Insert new booking
        const svc = services.find(s => s.id === serviceId);
        // Phase 13.2 (HK May 17 2026): every booking carries a client_id.
        const clientIdForBooking = await findOrCreateClient({
          supabase,
          therapist_id: therapist.id,
          name,
          email,
          phone,
        });
        // Phase 15.1 (HK May 18 2026): capture the new booking id so we can
        // fire booking-confirmation notifications right after. Prior to
        // this, the insert was fire-and-forget, the id was lost, no
        // notifications fired for therapist-created bookings. Real
        // therapist Healing Hands BM1 hit this gap last night.
        const { data: newBooking, error: e } = await supabase.from('bookings').insert({
          therapist_id:  therapist.id,
          service_id:    serviceId,
          client_id:     clientIdForBooking,
          client_name:   name.trim(),
          client_email:  email.trim().toLowerCase(),
          client_phone:  phone.trim(),
          booking_date:  date,
          start_time:    slot.start,
          end_time:      slot.end,
          notes:         notes.trim(),
          status:        'confirmed',
          deposit_required: false,
          deposit_amount:   0,
          deposit_paid:     false,
          // Multi-location (HK May 18 2026): NULL when therapist has
          // no locations set up. Otherwise the picked location, or
          // primary by default.
          location_id:   locationId || null,
          // Phase 23 (HK May 25 2026): persist selected add-ons +
          // their aggregated price and extra-minutes on the booking
          // row. Same columns the public BookingPage writes to.
          addon_ids:           Array.from(selectedAddonIds),
          addon_total_price:   addonTotalPrice,
          addon_extra_minutes: addonExtraMinutes,
        }).select('id').single();
        if (e) throw e;
        bookingId = newBooking?.id || null;
        eventType = 'booking_created';
      }

      // Fire-and-forget: notify client and therapist. Never blocks UI.
      // HK May 28 2026: for RESCHEDULES, notify-booking-event already
      // fired above with event_type='reschedule', which routes to
      // send-reschedule-confirmation (client C13) + the therapist
      // reschedule alert. Calling send-booking-confirmation here too
      // produced duplicate noise: an extra therapist 'new_booking' AND
      // a CLIENT 'booking_confirmation' (a brand-new-booking email)
      // instead of the proper reschedule email. So fire only on new
      // bookings, not on reschedules. The notify-booking-event call
      // above is the single source of truth for reschedule
      // notifications.
      if (bookingId && !isReschedule) fireBookingConfirmation(bookingId, eventType);

      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  // Phase 15.1 (HK May 18 2026): fire booking confirmation after a
  // therapist-created booking or reschedule. Same edge function as
  // the public booking page (BookingPage.fireBookingConfirmation).
  // Fire-and-forget: errors are warned to console but never block UI.
  async function fireBookingConfirmation(theBookingId, eventType) {
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
        body: JSON.stringify({
          booking_id: theBookingId,
          event_type: eventType || 'booking_created',
        }),
      });
    } catch (e) {
      console.warn('send-booking-confirmation invocation failed:', e);
    }
  }

  const svc = services.find(s => s.id === serviceId);
  const title = isReschedule ? 'Reschedule Appointment' : isRebook ? 'Book Next Appointment' : 'Create Booking';

  // Phase 23 (HK May 25 2026): compute selected-addon aggregates.
  // Used both for the UI (live total + extra minutes) and the
  // booking insert payload. Mirrors public BookingPage logic.
  const selectedAddons = (availableAddons || []).filter(a => selectedAddonIds.has(a.id));
  const addonTotalPrice = selectedAddons.reduce((sum, a) => sum + Number(a.price || 0), 0);
  const addonExtraMinutes = selectedAddons.reduce((sum, a) => sum + Number(a.extra_minutes || 0), 0);
  function toggleAddon(id) {
    setSelectedAddonIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Build available dates: next 365 days, exclude blocked dates
  const avDows = availability.map(a => a.day_of_week);
  const availDates = [];
  const base = new Date(); base.setHours(0,0,0,0);
  for (let i = 0; i < 365 && availDates.length < 300; i++) {
    const d = new Date(base); d.setDate(base.getDate() + i);
    const ds = toDateStr(d);
    if (avDows.includes(d.getDay()) && !blockedDates.has(ds)) availDates.push(ds);
  }

  return createPortal((
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 3000,
      padding: 20,
      paddingTop: 'max(20px, env(safe-area-inset-top, 0px))',
      paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#fff',
        borderRadius: 20,
        width: '100%',
        maxWidth: 480,
        maxHeight: 'calc(100dvh - 40px)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
      }}>

        {/* Header */}
        <div style={{ padding: '24px 24px 16px', borderBottom: `1px solid ${C.border}`, background: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: C.dark, margin: 0 }}>{title}</h3>
            <CloseButton onClick={onClose} label="Cancel" />
          </div>
        </div>

        <div style={{
          padding: 24,
          paddingBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>

          {/* Client info, readonly for reschedule */}
          {!isReschedule && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Client</label>
              <div style={{ position: 'relative' }}>
                <input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="Full name *"
                  style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                {clientSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 10, zIndex: 100, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                    {clientSuggestions.map((c, i) => (
                      <div key={i} onClick={() => selectClient(c)}
                        style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 14, borderBottom: i < clientSuggestions.length - 1 ? `1px solid ${C.border}` : 'none' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F0FDF4'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <div style={{ fontWeight: 600, color: C.dark }}>{c.name}</div>
                        {c.email && <div style={{ fontSize: 12, color: C.gray }}>{c.email}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (for intake link)"
                style={{ padding: '10px 12px', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: 'none' }} />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)"
                style={{ padding: '10px 12px', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: 'none' }} />
            </div>
          )}

          {isReschedule && (
            <div style={{ background: C.beige, borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, marginBottom: 4 }}>Moving appointment for</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.dark }}>{name}</div>
              <div style={{ fontSize: 12, color: C.gray }}>{existingBooking?.time} · {existingBooking?.service}</div>
            </div>
          )}

          {/* Location (HK May 18 2026): only shows when therapist has
              2+ active locations. Single-location therapists keep the
              modal exactly as it was. Picker buttons match the service
              picker style for visual consistency. */}
          {locations.length >= 2 && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Location</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {locations.map(loc => {
                  const isPicked = locationId === loc.id;
                  const addrShort = [loc.city, loc.state].filter(Boolean).join(', ');
                  return (
                    <button
                      key={loc.id}
                      onClick={() => setLocationId(loc.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: `1.5px solid ${isPicked ? C.forest : C.border}`,
                        background: isPicked ? '#F0FDF4' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600, color: isPicked ? C.forest : C.dark, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        📍 {loc.name}
                        {loc.is_primary && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: C.gray, marginLeft: 2 }}>(primary)</span>
                        )}
                      </span>
                      {addrShort && (
                        <span style={{ fontSize: 12, color: C.gray }}>{addrShort}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Service */}
          {!isReschedule && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Service</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(() => {
                  // Filter by location when therapist has 2+ locations
                  // and one is picked. NULL/empty location_ids on a
                  // service = available everywhere, default behavior.
                  let visibleServices = services;
                  if (locations.length >= 2 && locationId) {
                    visibleServices = services.filter(s => {
                      if (!s.location_ids || s.location_ids.length === 0) return true;
                      return s.location_ids.includes(locationId);
                    });
                  }
                  // Render the service button (extracted so we can
                  // reuse it both flat and within groups).
                  const renderServiceBtn = (s) => (
                    <button key={s.id} onClick={() => setServiceId(s.id)}
                      style={{ padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${serviceId === s.id ? C.forest : C.border}`,
                        background: serviceId === s.id ? '#F0FDF4' : '#fff', cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: serviceId === s.id ? C.forest : C.dark, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {s.visibility === 'private' && (
                          <span title="Private service: hidden from your public booking page. Only you can schedule it." style={{ fontSize: 12 }}>🔒</span>
                        )}
                        {s.name}
                      </span>
                      <span style={{ fontSize: 13, color: C.gray }}>{s.duration} min · ${s.price}</span>
                    </button>
                  );
                  // When therapist opted into groups, render each
                  // group section with a small header. The order of
                  // groups follows therapist.service_group_order;
                  // ungrouped services land under "All other services."
                  if (therapist?.use_service_groups) {
                    const order = Array.isArray(therapist.service_group_order) ? therapist.service_group_order : [];
                    const buckets = {};
                    for (const s of visibleServices) {
                      const key = (s.service_group || '').trim() || '__UNGROUPED__';
                      if (!buckets[key]) buckets[key] = [];
                      buckets[key].push(s);
                    }
                    const namedKeys = Object.keys(buckets).filter(k => k !== '__UNGROUPED__');
                    const orderedKeys = [];
                    for (const name of order) {
                      if (namedKeys.includes(name)) orderedKeys.push(name);
                    }
                    for (const k of namedKeys) {
                      if (!orderedKeys.includes(k)) orderedKeys.push(k);
                    }
                    if (buckets['__UNGROUPED__']) orderedKeys.push('__UNGROUPED__');
                    const nodes = [];
                    for (const key of orderedKeys) {
                      const label = key === '__UNGROUPED__' ? 'All other services' : key;
                      nodes.push(
                        <div key={`group:${key}`} style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: '0.07em',
                          textTransform: 'uppercase',
                          color: C.gray,
                          marginTop: nodes.length === 0 ? 0 : 8,
                          marginBottom: 2,
                        }}>{label}</div>
                      );
                      for (const s of buckets[key]) {
                        nodes.push(renderServiceBtn(s));
                      }
                    }
                    return nodes;
                  }
                  return visibleServices.map(renderServiceBtn);
                })()}
              </div>
            </div>
          )}

          {/* Add-ons (HK May 25 2026 Phase 23). Only renders when the
              therapist has configured any add-ons in Settings →
              Services → Add-ons. Multi-select toggle tiles, matches
              the service-picker visual. Live aggregate at bottom
              shows current total and extra minutes added. */}
          {serviceId && availableAddons.length > 0 && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>
                Add-ons (optional)
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {availableAddons.map(a => {
                  const isPicked = selectedAddonIds.has(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAddon(a.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: `1.5px solid ${isPicked ? C.forest : C.border}`,
                        background: isPicked ? '#F0FDF4' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600, color: isPicked ? C.forest : C.dark, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: 4,
                          border: `1.5px solid ${isPicked ? C.forest : C.border}`,
                          background: isPicked ? C.forest : '#fff',
                          color: '#fff',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700,
                        }}>{isPicked ? '✓' : ''}</span>
                        {a.name}
                      </span>
                      <span style={{ fontSize: 13, color: C.gray }}>
                        +${Number(a.price || 0).toFixed(0)}
                        {a.extra_minutes ? ` · +${a.extra_minutes} min` : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedAddons.length > 0 && (
                <div style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: C.forest,
                  fontWeight: 600,
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: 8,
                  padding: '6px 10px',
                }}>
                  {selectedAddons.length} add-on{selectedAddons.length === 1 ? '' : 's'} · +${addonTotalPrice.toFixed(0)}
                  {addonExtraMinutes ? ` · ${addonExtraMinutes} extra min` : ''}
                </div>
              )}
            </div>
          )}

          {/* Date picker (HK May 29 2026): replaced the horizontal chip
              strip with SelectableMonthView so the therapist sees their
              actual calendar (busy/blocked/free) when picking. For
              series bookings, a rule strip above lets them pick "every
              N weeks for M sessions" and the calendar auto-selects. */}
          {!isReschedule && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {seriesMode ? 'Series' : 'Date'}
              </label>
              <button
                type="button"
                onClick={() => {
                  setSeriesMode(v => !v);
                  setSeriesManualAdd([]);
                  setSeriesManualDrop([]);
                }}
                style={{
                  background: seriesMode ? C.sage : '#fff',
                  color: seriesMode ? '#fff' : C.forest,
                  border: `1.5px solid ${seriesMode ? C.sage : C.border}`,
                  borderRadius: 16, padding: '4px 12px',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}>
                {seriesMode ? 'Series ON' : 'Book a series'}
              </button>
            </div>
          )}
          {isReschedule && (
            <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Date</label>
          )}

          {seriesMode && !isReschedule && (
            <div style={{
              background: '#F4F6F2', border: `1.5px solid #D6E0D4`, borderRadius: 10,
              padding: '12px 14px', marginBottom: 12, fontSize: 14, color: C.dark, lineHeight: 1.7,
            }}>
              Every{' '}
              <Stepper value={seriesEveryWeeks} min={1} max={26} onChange={setSeriesEveryWeeks} />
              {' '}weeks for{' '}
              <Stepper value={seriesCount} min={1} max={52} onChange={setSeriesCount} />
              {' '}sessions starting <strong style={{ color: C.forest }}>{date ? fmtDate(date) : '(pick a date below)'}</strong>.
              <div style={{ fontSize: 11, color: C.gray, marginTop: 8, lineHeight: 1.55 }}>
                {seriesDates.length > 0
                  ? `${seriesDates.length} session${seriesDates.length === 1 ? '' : 's'} selected. Tap a sage day to drop it, or tap a free day to add one.`
                  : 'Pick a starting date below to build the series.'}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 12, maxHeight: 360, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 10, padding: 8 }}>
            <SelectableMonthView
              therapist={therapist}
              mode={seriesMode ? 'series' : 'single'}
              selectedDates={seriesMode ? seriesDates : (date ? [date] : [])}
              onSelectDate={(iso) => {
                if (seriesMode) {
                  // First tap with no anchor: set the anchor (which seeds the rule).
                  if (!date) { setDate(iso); return; }
                  toggleSeriesDate(iso);
                } else {
                  setDate(iso);
                }
              }}
              seriesIndexFor={seriesMode ? seriesIndexFor : null}
              monthsToShow={seriesMode ? 4 : 2}
            />
          </div>

          {/* Time slots */}
          {date && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>
                Time {svc ? `· ${svc.duration} min` : ''}
              </label>
              {loadingSlots ? (
                <div style={{ fontSize: 13, color: C.gray }}>Loading slots…</div>
              ) : (
                <>
                  {slots.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {slots.map(s => (
                        <button key={s.start} onClick={() => setSlot(s)}
                          style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${slot?.start === s.start ? C.forest : C.border}`,
                            background: slot?.start === s.start ? C.forest : '#fff',
                            color: slot?.start === s.start ? '#fff' : C.dark,
                            fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          {fmt12(s.start)}
                        </button>
                      ))}
                    </div>
                  )}
                  {slots.length === 0 && (
                    <div style={{ fontSize: 13, color: C.gray, marginBottom: 10 }}>No standard slots on this day.</div>
                  )}
                  {/* Custom time override */}
                  <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 10 }}>
                    <div style={{ fontSize: 11, color: C.gray, marginBottom: 6, fontWeight: 600 }}>
                      Set a custom time, after hours or special scheduling
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="time"
                        onChange={e => {
                          const t = e.target.value;
                          if (!t) return;
                          setSlot({ start: t, end: addMins(t, svc?.duration || 60) });
                        }}
                        style={{ padding: '8px 10px', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: 'none', flex: 1 }}
                      />
                      {svc && <span style={{ fontSize: 12, color: C.gray, whiteSpace: 'nowrap' }}>{svc.duration} min</span>}
                    </div>
                    {slot && !slots.find(s => s.start === slot.start) && (
                      <div style={{ fontSize: 12, color: '#D97706', marginTop: 6, fontWeight: 600 }}>
                        ⚠ Custom time, outside normal hours
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any notes for this session…"
              style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'system-ui' }} />
          </div>

        </div>

        {/* Sticky footer. HK May 27 2026 round 6: Jacquie reported
            on iPhone she could not scroll far enough to reach the
            Confirm Booking button. Root cause: outer container used
            alignItems:'center' + maxHeight:'90vh' which on iOS Safari
            with the dynamic toolbar showing put the bottom of the
            modal under the system UI. Two-part fix:
              1. Outer container is now top-anchored, uses 100dvh
                 (dynamic viewport height) for sizing, and inherits
                 safe-area-inset on top + bottom padding.
              2. Confirm button + summary now live in a sticky footer
                 that ALWAYS shows, regardless of how far the body
                 has scrolled. The therapist sees the action target
                 the entire time. */}
        <div style={{
          padding: '14px 24px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
          borderTop: `1px solid ${C.border}`,
          background: '#fff',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 20,
        }}>
          {error && <div style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>⚠ {error}</div>}

          {date && slot && (
            <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 12, padding: '10px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.forest }}>
                {isReschedule ? 'Moving to:' : 'Booking:'} {fmtDate(date)} at {fmt12(slot.start)}
              </div>
              {!isReschedule && svc && <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{svc.name} · {svc.duration} min · ${svc.price}</div>}
            </div>
          )}

          <button onClick={save} disabled={saving || !date || !slot}
            style={{ padding: '14px', borderRadius: 12, border: 'none', background: (date && slot) ? C.forest : '#D1D5DB',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: (date && slot) ? 'pointer' : 'not-allowed', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
            {saving ? 'Saving...' : !date ? 'Select a date above' : !slot ? 'Select a time above' : isReschedule ? 'Confirm Reschedule' : 'Confirm Booking'}
          </button>
        </div>

      </div>
    </div>
  ), document.body);
}

// HK May 29 2026: small +/- stepper for the series rule strip. Big
// tappable buttons for our 70yo persona (no dropdowns, no number-pad
// gymnastics). value is clamped to [min, max].
function Stepper({ value, min = 1, max = 99, onChange }) {
  const dec = () => onChange(Math.max(min, (value | 0) - 1));
  const inc = () => onChange(Math.min(max, (value | 0) + 1));
  const btn = {
    width: 28, height: 28,
    borderRadius: 14, border: '1.5px solid #2A5741',
    background: '#fff', color: '#2A5741',
    fontSize: 16, fontWeight: 700, lineHeight: 1,
    cursor: 'pointer', fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, verticalAlign: 'middle',
    WebkitTapHighlightColor: 'transparent',
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, verticalAlign: 'middle' }}>
      <button type="button" onClick={dec} aria-label="Decrease" style={btn}>−</button>
      <strong style={{ minWidth: 22, textAlign: 'center', display: 'inline-block', color: '#2A5741', fontSize: 15 }}>{value}</strong>
      <button type="button" onClick={inc} aria-label="Increase" style={btn}>+</button>
    </span>
  );
}
