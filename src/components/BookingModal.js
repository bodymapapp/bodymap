// BookingModal.js
// Used for: Create Booking, Reschedule, and Rebook (in-session)
// mode: 'create' | 'reschedule' | 'rebook'
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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

export default function BookingModal({ therapist, mode = 'create', existingBooking = null, prefillClient = null, onClose, onSuccess }) {
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
  const [date, setDate]   = useState('');
  const [slots, setSlots] = useState([]);
  const [slot, setSlot]   = useState(null);
  const [notes, setNotes] = useState(existingBooking?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [blockedDates, setBlockedDates] = useState(new Set());

  // Load services + availability + blocked days
  useEffect(() => {
    async function load() {
      const [{ data: svcs }, { data: avail }, { data: blocked }] = await Promise.all([
        supabase.from('services').select('*').eq('therapist_id', therapist.id).eq('active', true).is('archived_at', null).order('price'),
        supabase.from('availability').select('*').eq('therapist_id', therapist.id).eq('active', true),
        supabase.from('blocked_days').select('date').eq('therapist_id', therapist.id),
      ]);
      setServices(svcs || []);
      setAvail(avail || []);
      setBlockedDates(new Set((blocked || []).map(b => b.date)));
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

    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin   = eh * 60 + em;
    const dur = svc.duration || 60;

    const raw = [];
    for (let m = startMin; m + dur <= endMin; m += 30) {
      const h = Math.floor(m / 60), mn = m % 60;
      const slotStart = `${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;
      const slotEnd   = addMins(slotStart, dur);

      const conflict = bookedFiltered.some(b => {
        const bs = parseInt(b.start_time) * 60 + parseInt(b.start_time.slice(3));
        const be = parseInt(b.end_time)   * 60 + parseInt(b.end_time.slice(3));
        const ss = m, se = m + dur;
        return ss < be && se > bs;
      });
      if (!conflict) raw.push({ start: slotStart, end: slotEnd });
    }
    setSlots(raw);
    setLoadingSlots(false);
  }

  async function save() {
    setError('');
    if (!name.trim())   { setError('Client name is required.'); return; }
    if (!date)          { setError('Please pick a date.'); return; }
    if (!slot)          { setError('Please pick a time slot.'); return; }
    if (!serviceId)     { setError('Please select a service.'); return; }

    setSaving(true);
    try {
      if (isReschedule && existingBooking?.id) {
        // Update existing booking date/time
        const { error: e } = await supabase.from('bookings')
          .update({ booking_date: date, start_time: slot.start, end_time: slot.end, notes })
          .eq('id', existingBooking.id);
        if (e) throw e;
      } else {
        // Insert new booking
        const svc = services.find(s => s.id === serviceId);
        const { error: e } = await supabase.from('bookings').insert({
          therapist_id:  therapist.id,
          service_id:    serviceId,
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
        });
        if (e) throw e;
      }
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  const svc = services.find(s => s.id === serviceId);
  const title = isReschedule ? 'Reschedule Appointment' : isRebook ? 'Book Next Appointment' : 'Create Booking';

  // Build available dates: next 365 days, exclude blocked dates
  const avDows = availability.map(a => a.day_of_week);
  const availDates = [];
  const base = new Date(); base.setHours(0,0,0,0);
  for (let i = 0; i < 365 && availDates.length < 300; i++) {
    const d = new Date(base); d.setDate(base.getDate() + i);
    const ds = toDateStr(d);
    if (avDows.includes(d.getDay()) && !blockedDates.has(ds)) availDates.push(ds);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ padding: '24px 24px 16px', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: C.dark, margin: 0 }}>{title}</h3>
            <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: C.gray }}>✕</button>
          </div>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

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

          {/* Service */}
          {!isReschedule && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Service</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {services.map(s => (
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
                ))}
              </div>
            </div>
          )}

          {/* Date picker */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Date</label>
            {availDates.length === 0 ? (
              <div style={{ fontSize: 13, color: C.gray, padding: '10px 0' }}>No availability set up yet. Add your working hours in Settings.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                {availDates.map(d => (
                  <button key={d} onClick={() => setDate(d)}
                    style={{ padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${date === d ? C.forest : C.border}`,
                      background: date === d ? C.forest : '#fff', color: date === d ? '#fff' : C.dark,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {fmtDate(d)}
                  </button>
                ))}
              </div>
            )}
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

          {error && <div style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>⚠ {error}</div>}

          {/* Summary + confirm */}
          {date && slot && (
            <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.forest }}>
                {isReschedule ? 'Moving to:' : 'Booking:'} {fmtDate(date)} at {fmt12(slot.start)}
              </div>
              {!isReschedule && svc && <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{svc.name} · {svc.duration} min · ${svc.price}</div>}
            </div>
          )}

          <button onClick={save} disabled={saving || !date || !slot}
            style={{ padding: '14px', borderRadius: 12, border: 'none', background: (date && slot) ? C.forest : '#D1D5DB',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: (date && slot) ? 'pointer' : 'not-allowed', opacity: saving ? 0.7 : 1, marginTop: 8 }}>
            {saving ? 'Saving…' : !date ? 'Select a date above' : !slot ? 'Select a time above' : isReschedule ? 'Confirm Reschedule' : 'Confirm Booking'}
          </button>

        </div>
      </div>
    </div>
  );
}
