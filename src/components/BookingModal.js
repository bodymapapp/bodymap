// BookingModal.js
// Used for: Create Booking, Reschedule, and Rebook (in-session)
// mode: 'create' | 'reschedule' | 'rebook'
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { findOrCreateClient } from '../lib/findOrCreateClient';
import CloseButton from './CloseButton';
import MonthCalendar from './MonthCalendar';
import RecurringRulePanel, {
  DEFAULT_RECURRING_RULE,
  generateSeriesDates,
} from './RecurringRulePanel';

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
  const [blockedDay, setBlockedDay] = useState(false);
  // HK Jun 5 2026: when a manual booking is stopped only by a block the
  // therapist set herself, we hold that block here and offer one tap to
  // remove it and book, instead of a dead-end "pick another time".
  const [blockConflict, setBlockConflict] = useState(null);
  // Phase 9.1: partial-day blocks keyed by date string.
  const [partialBlocksByDate, setPartialBlocksByDate] = useState({});
  // HK May 29 2026: existing-bookings count per date for the sage-dots
  // context on the MonthCalendar. Filled in from the same load effect.
  const [bookingsByDate, setBookingsByDate] = useState(new Map());
  // Multi-location (HK May 18 2026): list of therapist's active
  // locations. Dropdown only renders when length >= 2. Default
  // selection is the primary location. On reschedule, preserves the
  // existing booking's location.
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState(existingBooking?.location_id || null);

  // ─── Recurring booking state (HK May 29 2026 rebuild) ─────────────
  // Single unified rule object replacing the previous trio of
  // seriesMode/seriesEveryWeeks/seriesCount. Covers all common patterns
  // (interval, frequency unit, day-of-week multi-select, end-by-count
  // OR end-by-date) in one shape. See RecurringRulePanel for the panel
  // UI and generateSeriesDates for the pure rule->dates function.
  // Disabled entirely on reschedule.
  const [recurringRule, setRecurringRule] = useState(DEFAULT_RECURRING_RULE);
  // Convenience flag for downstream code; same as recurringRule.on.
  const seriesMode = recurringRule.on;

  // Manual overrides (calendar tap to add/drop a date) live inside the
  // rule so the panel's preview line stays accurate.
  // Compute series dates from rule + anchor (the primary `date` field).
  const seriesDates = useMemo(
    () => generateSeriesDates(date, recurringRule),
    [date, recurringRule],
  );

  function toggleSeriesDate(iso) {
    // If the date is currently in the series:
    //   if it's a manual-add → remove from manualAdd
    //   otherwise (rule-generated) → push to manualDrop
    // If not in the series:
    //   if it's in manualDrop → remove from manualDrop
    //   otherwise → push to manualAdd
    setRecurringRule(rule => {
      const inSeries = seriesDates.includes(iso);
      const inAdd = (rule.manualAdd || []).includes(iso);
      const inDrop = (rule.manualDrop || []).includes(iso);
      if (inSeries) {
        if (inAdd) return { ...rule, manualAdd: rule.manualAdd.filter(d => d !== iso) };
        return { ...rule, manualDrop: inDrop ? rule.manualDrop : [...(rule.manualDrop || []), iso] };
      } else {
        if (inDrop) return { ...rule, manualDrop: rule.manualDrop.filter(d => d !== iso) };
        return { ...rule, manualAdd: inAdd ? rule.manualAdd : [...(rule.manualAdd || []), iso] };
      }
    });
  }

  function seriesIndexFor(iso) {
    const i = seriesDates.indexOf(iso);
    return i >= 0 ? i + 1 : null;
  }

  // HK May 29 2026: when the anchor date changes, ensure the recurring
  // rule's endDate is still valid (i.e. strictly after the new anchor).
  // Without this, picking a new anchor that lands on or after the
  // previously-set endDate silently collapses the series to a single
  // session, which is the "I picked weekly but only 1 session shows"
  // bug HK caught.
  useEffect(() => {
    if (!recurringRule.on) return;
    if (recurringRule.endMode !== 'date') return;
    if (!date) return;
    if (recurringRule.endDate && recurringRule.endDate > date) return;
    // Bump forward to a sensible default based on unit.
    const [y, m, d] = date.split('-').map(Number);
    const def = new Date(y, m - 1, d);
    if (recurringRule.unit === 'month') {
      def.setMonth(def.getMonth() + 6);
    } else if (recurringRule.unit === 'day') {
      def.setDate(def.getDate() + 30);
    } else {
      def.setDate(def.getDate() + 84); // 12 weeks for week unit
    }
    const newEnd = `${def.getFullYear()}-${String(def.getMonth() + 1).padStart(2, '0')}-${String(def.getDate()).padStart(2, '0')}`;
    setRecurringRule(rule => ({ ...rule, endDate: newEnd }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, recurringRule.on, recurringRule.endMode, recurringRule.unit]);

  // Load services + availability + blocked days
  useEffect(() => {
    async function load() {
      // HK May 29 2026: also pull bookings for the next ~6 months so the
      // MonthCalendar can show sage dots on days with existing
      // appointments. Therapist-only context; clients on BookingPage
      // don't see this.
      const horizonDate = new Date();
      horizonDate.setMonth(horizonDate.getMonth() + 6);
      const horizonIso = horizonDate.toISOString().slice(0, 10);
      const todayIso = new Date().toISOString().slice(0, 10);

      const [{ data: svcs }, { data: avail }, { data: blocked }, { data: locs }, { data: addons }, { data: futureBookings }, { data: recBlocks }, { data: recExc }] = await Promise.all([
        supabase.from('services').select('*').eq('therapist_id', therapist.id).eq('active', true).is('archived_at', null).order('sort_order', { ascending: true }).order('price', { ascending: true }),
        supabase.from('availability').select('*').eq('therapist_id', therapist.id).eq('active', true),
        // Phase 9.1: fetch start_time/end_time so partial-day blocks
        // are honored in the therapist's book-on-behalf flow too.
        supabase.from('blocked_days').select('date, start_time, end_time').eq('therapist_id', therapist.id),
        // Multi-location: same fetch as the public booking page.
        supabase.from('therapist_locations').select('*').eq('therapist_id', therapist.id).eq('active', true).order('sort_order', { ascending: true }),
        // Phase 23 (HK May 25 2026): add-ons for therapist-initiated
        // bookings.
        supabase.from('service_addons').select('*').eq('therapist_id', therapist.id).eq('active', true).order('display_order').order('created_at'),
        // HK May 29 2026: bookings count per date for sage dots.
        supabase.from('bookings').select('booking_date').eq('therapist_id', therapist.id).gte('booking_date', todayIso).lte('booking_date', horizonIso).neq('status', 'cancelled'),
        // HK Jun 3 2026: recurring block rules (e.g. "Every Sat") plus
        // their exceptions, so the date picker honors them the same way
        // the availability calendar does. Without this, recurring-blocked
        // days were offered as bookable (Jacquie saw a blocked Saturday).
        supabase.from('recurring_blocks').select('*').eq('therapist_id', therapist.id),
        supabase.from('recurring_block_exceptions').select('*').eq('therapist_id', therapist.id),
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
      // HK Jun 3 2026: materialize recurring blocks across the booking
      // horizon so rules like "Every Sat" remove those days (full-day) or
      // those windows (partial) from the picker, matching the calendar.
      {
        const exc = recExc || [];
        const base = new Date(); base.setHours(12, 0, 0, 0);
        for (let i = 0; i < 366; i++) {
          const d = new Date(base); d.setDate(base.getDate() + i);
          const dow = d.getDay();
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          for (const rule of (recBlocks || [])) {
            if (!rule.weekly_days?.includes(dow)) continue;
            if (rule.start_date && rule.start_date > ds) continue;
            if (rule.end_date && rule.end_date < ds) continue;
            if (exc.some(e => e.recurring_block_id === rule.id && e.exception_date === ds)) continue;
            if (rule.start_time && rule.end_time) {
              if (!partial[ds]) partial[ds] = [];
              partial[ds].push({ start_time: rule.start_time.slice(0, 5), end_time: rule.end_time.slice(0, 5) });
            } else {
              fullDay.push(ds);
            }
          }
        }
      }
      setBlockedDates(new Set(fullDay));
      setPartialBlocksByDate(partial);
      // HK May 29 2026: bucket bookings by date for the MonthCalendar
      // sage-dots context.
      const bMap = new Map();
      for (const b of (futureBookings || [])) {
        if (!b.booking_date) continue;
        bMap.set(b.booking_date, (bMap.get(b.booking_date) || 0) + 1);
      }
      setBookingsByDate(bMap);
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
  }, [date, serviceId, blockedDates]);

  // HK Jun 5 2026: a stale "remove block" banner should never linger once
  // the therapist changes the time, date, or service. Each save attempt
  // recomputes it fresh.
  useEffect(() => { setBlockConflict(null); }, [slot, date, serviceId]);

  async function generateSlots() {
    setLoadingSlots(true);
    setSlots([]);
    setSlot(null);

    // HK Jun 3 2026: a full-day blocked date (one-off OR recurring, e.g.
    // "Every Sat") never offers standard times, even though the calendar
    // still lets the day be tapped (allowOverrideOffDay). The custom-time
    // field below remains, so a deliberate book-over-block is still possible.
    const isFullBlocked = blockedDates.has(date);
    setBlockedDay(isFullBlocked);
    if (isFullBlocked) { setSlots([]); setLoadingSlots(false); return; }

    const svc = services.find(s => s.id === serviceId);
    if (!svc) { setLoadingSlots(false); return; }

    const dow = new Date(date + 'T12:00:00').getDay();
    const av = availability.find(a => a.day_of_week === dow);
    // HK May 29 2026: when the therapist enables "Include my off days"
    // on the MonthCalendar and picks a day she doesn't normally work,
    // there is no availability row for that day_of_week. Previously
    // generateSlots returned early with empty slots, which made the
    // toggle feel broken: cell tappable, but "No standard slots on
    // this day" with no slots to pick. Fall back to a default 9am-5pm
    // window so the standard 30-min grid still gets generated. The
    // toggle is the gate; if date is set to an off-day at all, it was
    // an explicit override and the therapist wants to schedule there.
    const start = (av?.start_time || '09:00').slice(0, 5);
    const end   = (av?.end_time   || '17:00').slice(0, 5);

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

  // HK Jun 5 2026: the guided-fix action. Remove the therapist's own
  // block, mirror that into local state so the grid and guard agree, then
  // continue the same booking. Only ever removes a block (never a client
  // booking), and only the specific block that was in the way.
  async function removeBlockAndBook() {
    if (!blockConflict?.id) { setBlockConflict(null); return; }
    setSaving(true);
    setError('');
    const { error: delErr } = await supabase
      .from('blocked_days').delete()
      .eq('id', blockConflict.id)
      .eq('therapist_id', therapist.id);
    if (delErr) { setSaving(false); setError('Could not remove the block. Please try again.'); return; }
    const hhmm = blockConflict.start ? blockConflict.start.slice(0, 5) : null;
    const hhmmEnd = blockConflict.end ? blockConflict.end.slice(0, 5) : null;
    if (hhmm) {
      setPartialBlocksByDate(prev => {
        const next = { ...prev };
        if (next[date]) {
          next[date] = next[date].filter(b => !(b.start_time === hhmm && b.end_time === hhmmEnd));
          if (next[date].length === 0) delete next[date];
        }
        return next;
      });
    } else {
      setBlockedDates(prev => { const n = new Set(prev); n.delete(date); return n; });
    }
    setBlockConflict(null);
    save();
  }

  async function save() {
    setError('');
    setBlockConflict(null);
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

        // HK May 29 2026: conflict check across all proposed series
        // dates before any insert. We compare to any booking on the
        // same date with overlapping start_time/end_time, and to any
        // full-day blocked_day. If any conflicts are found, abort and
        // surface them to the therapist so she can edit the rule or
        // drop the conflicting dates.
        const sortedDatesForCheck = [...seriesDates].sort();
        const [conflictBookingsResult, conflictBlocksResult] = await Promise.all([
          supabase
            .from('bookings')
            .select('id, booking_date, start_time, end_time, client_name')
            .eq('therapist_id', therapist.id)
            .in('booking_date', sortedDatesForCheck)
            .neq('status', 'cancelled'),
          supabase
            .from('blocked_days')
            .select('date, start_time, end_time')
            .eq('therapist_id', therapist.id)
            .in('date', sortedDatesForCheck),
        ]);
        const slotStart = slot.start;
        const slotEnd = slot.end;
        const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
        const conflicts = [];
        for (const r of (conflictBookingsResult.data || [])) {
          if (overlaps(slotStart, slotEnd, (r.start_time || '').slice(0,5), (r.end_time || '').slice(0,5))) {
            conflicts.push({ date: r.booking_date, reason: `already booked: ${r.client_name || 'another client'}` });
          }
        }
        for (const b of (conflictBlocksResult.data || [])) {
          if (!b.start_time) {
            // full-day block
            conflicts.push({ date: b.date, reason: 'full-day block' });
          } else if (overlaps(slotStart, slotEnd, (b.start_time || '').slice(0,5), (b.end_time || '').slice(0,5))) {
            conflicts.push({ date: b.date, reason: 'partial-day block' });
          }
        }
        if (conflicts.length) {
          setSaving(false);
          const lines = conflicts.slice(0, 5).map(c => `  ${c.date}: ${c.reason}`).join('\n');
          const more = conflicts.length > 5 ? `\n  ...and ${conflicts.length - 5} more` : '';
          setError(`Found ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} in the series:\n${lines}${more}\n\nDrop the conflicting dates from the calendar or pick a different time, then try again.`);
          return;
        }

        // Insert series row first.
        // HK May 29 2026: build rule_text from the new recurringRule
        // object. Reads naturally regardless of the chosen unit/DOWs.
        const ruleText = (() => {
          const r = recurringRule;
          const unitName = r.unit === 'day' ? (r.interval === 1 ? 'day' : 'days')
            : r.unit === 'month' ? (r.interval === 1 ? 'month' : 'months')
            : (r.interval === 1 ? 'week' : 'weeks');
          const dowPart = r.unit === 'week' && r.daysOfWeek && r.daysOfWeek.length > 0
            ? ` on ${r.daysOfWeek.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}`
            : '';
          const endPart = r.endMode === 'date' && r.endDate
            ? ` through ${r.endDate}`
            : ` for ${seriesDates.length} session${seriesDates.length === 1 ? '' : 's'}`;
          return `Every ${r.interval} ${unitName}${dowPart}${endPart}`;
        })();

        const { data: seriesRow, error: serErr } = await supabase
          .from('booking_series')
          .insert({
            therapist_id: therapist.id,
            client_id: clientIdForBooking,
            label: `${(svc?.name || 'Session')} series for ${name.trim()}`,
            rule_text: ruleText,
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

      // ─── DOUBLE-BOOKING GUARD (HK Jun 3 2026) ────────────────────
      // The series path above already checks conflicts. The single
      // new-booking and reschedule paths did not, which let a manual
      // booking land on top of an existing client (Julie over Cathy).
      // Mirror the series check here for both branches. The database
      // trigger is the hard backstop; this gives a clear message first.
      {
        const slotStart = slot.start;
        const slotEnd = slot.end;
        const overlaps = (aS, aE, bS, bE) => aS < bE && bS < aE;
        const selfId = isReschedule ? (existingBooking?.id || null) : null;
        const [bkRes, blkRes] = await Promise.all([
          supabase
            .from('bookings')
            .select('id, start_time, end_time, client_name, status')
            .eq('therapist_id', therapist.id)
            .eq('booking_date', date),
          supabase
            .from('blocked_days')
            .select('id, date, start_time, end_time, note')
            .eq('therapist_id', therapist.id)
            .eq('date', date),
        ]);
        const skip = ['cancelled', 'rescheduled', 'no_show', 'pending-approval'];
        let hit = null;
        for (const r of (bkRes.data || [])) {
          if (r.id === selfId) continue;
          if (skip.includes(r.status)) continue;
          if (overlaps(slotStart, slotEnd, (r.start_time || '').slice(0, 5), (r.end_time || '').slice(0, 5))) {
            hit = { name: r.client_name || 'another client' };
            break;
          }
        }
        if (!hit) {
          for (const b of (blkRes.data || [])) {
            if (!b.start_time) { hit = { block: true, blockId: b.id, blockStart: null, blockEnd: null, blockNote: b.note }; break; }
            if (overlaps(slotStart, slotEnd, (b.start_time || '').slice(0, 5), (b.end_time || '').slice(0, 5))) { hit = { block: true, blockId: b.id, blockStart: b.start_time, blockEnd: b.end_time, blockNote: b.note }; break; }
          }
        }
        if (hit) {
          setSaving(false);
          // HK Jun 5 2026: guided fix. When the only thing in the way is a
          // block the therapist set herself, do not dead-end. Name it and
          // offer one tap to remove it and book. A real client conflict
          // still gets the plain message and is never auto-removed.
          if (hit.block && hit.blockId) {
            setBlockConflict({ id: hit.blockId, start: hit.blockStart, end: hit.blockEnd, note: hit.blockNote });
            setError('');
            return;
          }
          setError(hit.block
            ? 'That time falls on blocked-off time. Pick another time.'
            : `That time overlaps ${hit.name}. Pick another time, or reschedule the other booking first.`);
          return;
        }
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

  // HK May 29 2026: lock page-behind scroll while the modal is open.
  // Prevents scroll-chaining: when the modal's inner body scrolls past
  // its boundary, browsers default to scrolling whatever's behind it
  // (the Schedule page). overscroll-behavior:contain on each scroll
  // layer is belt-and-suspenders; the body-lock is the primary fix.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, []);

  const isMobileW = typeof window !== 'undefined' && window.innerWidth < 768;
  return createPortal((
    <div style={{
      // HK Jun 1 2026: responsive. Phone = edge-to-edge full screen.
      // Desktop = centered card on a dim backdrop (a full-bleed 480px
      // column on a wide screen looked unfinished). Either way: no
      // tap-outside-to-close, so no accidental dismissals.
      position: 'fixed',
      inset: 0,
      background: isMobileW ? '#fff' : 'rgba(31,41,51,0.45)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      zIndex: 3000,
      paddingTop: isMobileW ? 'max(24px, env(safe-area-inset-top, 24px))' : 40,
      paddingBottom: isMobileW ? 'max(16px, env(safe-area-inset-bottom, 16px))' : 40,
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      overscrollBehavior: 'contain',
    }}>
      <div style={{
        background: '#fff',
        width: '100%',
        maxWidth: 480,
        minHeight: isMobileW ? '100%' : 'auto',
        maxHeight: isMobileW ? 'none' : 'calc(100dvh - 80px)',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: isMobileW ? 0 : 20,
        boxShadow: isMobileW ? 'none' : '0 24px 64px rgba(0,0,0,0.28)',
        overflow: 'hidden',
        overscrollBehavior: 'contain',
      }}>

        {/* Header */}
        <div style={{ padding: '8px 20px 16px', borderBottom: `1px solid ${C.border}`, background: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: C.dark, margin: 0 }}>{title}</h3>
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
          overscrollBehavior: 'contain',
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
              {/* HK Jun 2 2026: show the ORIGINAL date + time, not just
                  the time, so the therapist can see exactly what they are
                  moving from. Handles both a Date object and a string. */}
              <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
                {(() => {
                  const d = existingBooking?.date;
                  let dateStr = '';
                  try {
                    const dt = d instanceof Date ? d : (d ? new Date(`${d}T12:00:00`) : null);
                    if (dt && !isNaN(dt)) dateStr = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  } catch (e) { dateStr = ''; }
                  const parts = [dateStr, existingBooking?.time].filter(Boolean).join(' at ');
                  return [parts, existingBooking?.service].filter(Boolean).join(' · ');
                })()}
              </div>
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
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
                {seriesMode ? 'Recurring booking' : 'Date'}
              </label>
              <RecurringRulePanel
                rule={recurringRule}
                anchorIso={date || null}
                onChange={(newRule) => setRecurringRule(newRule)}
              />
            </div>
          )}
          {isReschedule && (
            <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Date</label>
          )}

          <div style={{ marginBottom: 12 }}>
            <MonthCalendar
              availability={availability}
              selected={seriesMode ? seriesDates : (date || '')}
              onSelect={(iso) => {
                if (seriesMode) {
                  // First tap with no anchor: set the anchor (which seeds the rule).
                  if (!date) { setDate(iso); return; }
                  toggleSeriesDate(iso);
                } else {
                  setDate(iso);
                }
              }}
              blockedDates={blockedDates}
              partialBlockedDates={new Set(Object.keys(partialBlocksByDate))}
              bookingsByDate={bookingsByDate}
              mode={seriesMode ? 'multi' : 'single'}
              seriesIndexFor={seriesMode ? seriesIndexFor : null}
              allowOverrideOffDay={true}
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
                    <div style={{ fontSize: 13, color: blockedDay ? '#B45309' : C.gray, marginBottom: 10 }}>
                      {blockedDay
                        ? 'This day is blocked on your schedule. Use a custom time below only if you mean to book over the block.'
                        : 'No standard slots on this day.'}
                    </div>
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
          padding: '14px 20px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
          borderTop: `1px solid ${C.border}`,
          background: '#fff',
          flexShrink: 0,
          position: 'sticky',
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {error && <div style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>⚠ {error}</div>}

          {blockConflict && (
            <div style={{ background: '#FFFBEB', border: '1.5px solid #FCD34D', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>
                You blocked this time{blockConflict.start ? ` from ${fmt12(blockConflict.start.slice(0,5))} to ${fmt12(blockConflict.end.slice(0,5))}` : ' (all day)'}{blockConflict.note ? ` · ${blockConflict.note}` : ''}.
              </div>
              <div style={{ fontSize: 12, color: '#9A3412', marginTop: 3 }}>
                Remove the block to book {name.trim() || 'your client'} here. Nothing else changes.
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={removeBlockAndBook} disabled={saving}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: C.forest, color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
                  {saving ? 'Working...' : 'Remove block and book'}
                </button>
                <button onClick={() => setBlockConflict(null)} disabled={saving}
                  style={{ padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E5D5C8', background: 'transparent', color: '#92400E', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Keep block
                </button>
              </div>
            </div>
          )}

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
