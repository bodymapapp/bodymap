// src/pages/ClientIntake.js
// Custom URL page - loads therapist, shows MyBodyMap, saves to Supabase

import BMLogo from '../components/BMLogo';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db, supabase } from '../lib/supabase';
import Demo from './Demo';
import { renderAgreementForClient } from '../lib/practiceAgreement';

export default function ClientIntake() {
  const { customUrl } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const bookingIdFromUrl = searchParams.get('booking_id');
  const nameFromUrl = searchParams.get('name') || '';
  const emailFromUrl = searchParams.get('email') || '';
  const phoneFromUrl = searchParams.get('phone') || '';
  // When ClientIntake is reached via the intake-before-booking gate,
  // the BookingPage redirects here with return_to_book=<slug>. After
  // a successful intake submission we send the client back to the
  // booking page with intake_completed=1 so the gate is bypassed.
  const returnToBookSlug = searchParams.get('return_to_book') || '';
  const navigate = useNavigate();
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTherapist();
  }, [customUrl]);

  const loadTherapist = async () => {
    try {
      setLoading(true);
      const data = await db.getTherapistByUrl(customUrl);
      setTherapist(data);
      setError(null);

      // Schema diagnostic logging so HK and any therapist can verify
      // their custom intake reaches the page. Same format as
      // BookingPage's logging, so the two pages report identically.
      try {
        const schema = data?.intake_schema;
        const summary = !schema ? 'NULL (no custom edits saved)' :
          `fields=${(schema.fields || []).length}, ` +
          `medical_checklist=${schema.medical_checklist_enabled !== false}, ` +
          `hipaa=${!!schema.hipaa_mode}, ` +
          `version=${schema.version || 'unset'}`;
        console.log(
          `%c[MyBodyMap] Loaded therapist ${data?.custom_url} (${data?.business_name || data?.full_name})`,
          'color: #2A5741; font-weight: bold;'
        );
        console.log(`[MyBodyMap]   intake_schema: ${summary}`);
        if (schema?.fields) {
          console.log('[MyBodyMap]   field labels:', schema.fields.map((f) => `${f.id}=${JSON.stringify(f.label)}${f.hidden ? ' [HIDDEN]' : ''}`).join(', '));
          const pressure = schema.fields.find((f) => f.id === 'pressure');
          if (pressure?.options) {
            console.log('[MyBodyMap]   pressure options:', pressure.options.map((o) => o.v).join(', '));
          }
        }
      } catch (e) { console.warn('[MyBodyMap] schema log failed', e); }
    } catch (err) {
      console.error('Error loading therapist:', err);
      setError('Therapist not found. Please check the URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (intakeData) => {
    try {
      // Step 1: Create or get client
      const client = await db.upsertClient(therapist.id, {
        name: intakeData.clientName,
        phone: intakeData.clientPhone,
        email: intakeData.clientEmail || null
      });

      // Update SMS consent if the client opted in on this intake.
      // Only ever flip sms_opted_in to TRUE, never overwrite a previous TRUE
      // with FALSE if they left it unchecked this time. Opt-out must go
      // through STOP on SMS itself (handled by Twilio).
      if (intakeData.smsOptIn && client?.id) {
        try {
          await supabase.from('clients')
            .update({ sms_opted_in: true, sms_opted_in_at: new Date().toISOString() })
            .eq('id', client.id);
        } catch (e) { /* non-blocking */ }
      }

      // Step 2: Resolve booking_id, use URL param if present, otherwise find
      // the client's next upcoming booking for this therapist. This ensures
      // sessions ALWAYS have booking_id set, so the schedule only needs one
      // condition to determine intake status (no email fallback needed).
      let resolvedBookingId = bookingIdFromUrl || null;
      if (!resolvedBookingId && intakeData.clientEmail) {
        const today = new Date().toISOString().split('T')[0];
        const { data: nextBooking } = await supabase
          .from('bookings')
          .select('id')
          .eq('therapist_id', therapist.id)
          .eq('client_email', intakeData.clientEmail.toLowerCase().trim())
          .neq('status', 'cancelled')
          .gte('booking_date', today)
          .order('booking_date', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (nextBooking) resolvedBookingId = nextBooking.id;
      }

      // Step 3: Create session with resolved booking_id
      const newSession = await db.createSession({
        therapist_id: therapist.id,
        client_id: client.id,
        booking_id: resolvedBookingId,
        front_focus: intakeData.frontFocus || [],
        front_avoid: intakeData.frontAvoid || [],
        back_focus: intakeData.backFocus || [],
        back_avoid: intakeData.backAvoid || [],
        pressure: intakeData.pressure || 3,
        goal: intakeData.goal || 'relax',
        table_temp: intakeData.tableTemp || 'warm',
        room_temp: intakeData.roomTemp || 'comfortable',
        music: intakeData.music || 'soft',
        lighting: intakeData.lighting || 'dim',
        conversation: intakeData.conversation || 'quiet',
        draping: intakeData.draping || 'standard',
        oil_pref: intakeData.oilPref || 'none',
        med_flag: intakeData.medFlag || 'none',
        med_note: intakeData.medNote || null,
        client_notes: intakeData.notes || null,
        // Custom schema additions: medical conditions checklist (text[])
        // and custom_intake_answers (jsonb keyed by field id). Both nullable.
        // The columns were added in supabase/migrations/intake_schema.sql.
        medical_conditions: Array.isArray(intakeData.medicalConditions) ? intakeData.medicalConditions : null,
        custom_intake_answers: intakeData.customAnswers && Object.keys(intakeData.customAnswers).length > 0
          ? intakeData.customAnswers
          : null,
        // Focus distribution (Lindsey #4 follow-up, May 10 2026).
        // Nullable: client may not have reached the back-body screen
        // (e.g. on an existing-client returning-flow), or may have
        // not opted to set distribution. NULL means therapist sees
        // no distribution constraint; the BodySVG heatmap is still
        // available as a fallback signal.
        front_pct:  intakeData.frontPct   ?? null,
        top_pct:    intakeData.topPct     ?? null,
        middle_pct: intakeData.middlePct  ?? null,
        bottom_pct: intakeData.bottomPct  ?? null,
        completed: false
      });

      // Step 4: Record waiver signature if therapist has waiver enabled.
      // This is non-blocking, a signature failure should never prevent intake submission.
      if (therapist.waiver_enabled !== false && therapist.waiver_text) {
        try {
          await supabase.from('waiver_signatures').insert({
            therapist_id: therapist.id,
            client_id: client.id,
            session_id: newSession?.id || null,
            typed_name: intakeData.clientName,
            client_email: intakeData.clientEmail || null,
            waiver_text_snapshot: therapist.waiver_text,
            user_agent: (navigator.userAgent || '').slice(0, 300),
            // ip_address populated server-side via edge function in a future pass;
            // browser cannot see its own public IP without an external service.
          });
        } catch (e) { /* non-blocking */ }
      }

      // Step 4b: Record the practice agreement signature if therapist
      // has the unified agreement set. Non-blocking, same pattern as
      // waiver above. The agreement text is snapshotted at signing time
      // so future edits to the therapist's agreement don't retroactively
      // change what the client signed.
      if (therapist.practice_agreement_enabled !== false && therapist.practice_agreement_text) {
        try {
          const nowIso = new Date().toISOString();
          // Snapshot the RESOLVED text (with current cancellation
          // percentages substituted in) so the audit trail shows
          // exactly what the client agreed to. If the therapist
          // updates their percentages later, the historical
          // signature still reflects the concrete numbers shown at
          // the moment of signing.
          const resolvedSnapshot = renderAgreementForClient(
            therapist.practice_agreement_text,
            therapist
          );
          await supabase.from('clients').update({
            practice_agreement_signed_at: nowIso,
            practice_agreement_signer_name: intakeData.clientName,
            practice_agreement_text_snapshot: resolvedSnapshot,
          }).eq('id', client.id);
          if (newSession?.id) {
            await supabase.from('bookings').update({
              practice_agreement_signed_at: nowIso,
              practice_agreement_signer_name: intakeData.clientName,
              practice_agreement_text_snapshot: resolvedSnapshot,
            }).eq('id', newSession.id);
          }
        } catch (e) { /* non-blocking */ }
      }

      // HK May 28 2026: fire T03 intake_filled notification to the
      // therapist. This was the missing fire site that left T03 dead.
      // Fire-and-forget; never blocks the redirect, never breaks intake
      // if the function is down.
      try {
        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
        if (supabaseUrl && anonKey) {
          fetch(`${supabaseUrl}/functions/v1/notify-intake-filled`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
              therapist_id: therapist.id,
              booking_id: resolvedBookingId || null,
              session_id: newSession?.id || null,
              client_name: intakeData.clientName || null,
            }),
          }).catch(() => {});
        }
      } catch (_e) { /* never block intake on a missing notification */ }

      // Step 5: Redirect to thank you page (or back to booking if the
      // intake was triggered by the intake-before-booking gate).
      if (returnToBookSlug) {
        const params = new URLSearchParams({
          intake_completed: '1',
          name: intakeData.clientName || '',
          email: intakeData.clientEmail || '',
          phone: intakeData.clientPhone || '',
        });
        navigate(`/book/${returnToBookSlug}?${params.toString()}`);
        return;
      }
      navigate('/thank-you', { 
        state: { 
          therapistName: therapist.business_name,
          clientName: intakeData.clientName 
        } 
      });
    } catch (err) {
      console.error('Error saving intake:', err);
      alert('There was an error saving your preferences. Please try again.');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
        background: '#F0EAD9'
      }}>
        <div style={{ textAlign: 'center' }}>
          <BMLogo size={44} variant="dark" showWordmark={true} />
          <div style={{ fontSize: '18px', color: '#6B7280' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
        background: '#F0EAD9',
        padding: '24px'
      }}>
        <div style={{ 
          textAlign: 'center',
          background: 'white',
          padding: '40px',
          borderRadius: '12px',
          maxWidth: '400px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <h2 style={{ fontSize: '24px', marginBottom: '16px', color: '#1F2937' }}>
            Therapist Not Found
          </h2>
          <p style={{ fontSize: '16px', color: '#6B7280', marginBottom: '24px' }}>
            {error}
          </p>
          <a 
            href="https://mybodymap.app"
            style={{
              display: 'inline-block',
              background: '#6B9E80',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600'
            }}
          >
            Go to MyBodyMap Home
          </a>
        </div>
      </div>
    );
  }

  const getLastSession = async (contact) => {
    try {
      // contact is email when pre-filled from booking, phone when typed on welcome screen
      const isEmail = contact.includes('@');
      const digits = contact.replace(/\D/g, '');

      // Fetch this therapist's clients (id + match fields only, never
      // clinical columns) then match on email, phone, or name.
      const { data: allClients } = await supabase
        .from('clients')
        .select('id, name, email, phone')
        .eq('therapist_id', therapist.id);

      if (!allClients?.length) return null;

      let client = null;

      if (isEmail) {
        // Match by email (case-insensitive)
        client = allClients.find(c =>
          c.email && c.email.toLowerCase().trim() === contact.toLowerCase().trim()
        );
      }

      if (!client && digits.length >= 7) {
        // Match by phone (last 10 digits)
        client = allClients.find(c =>
          c.phone && c.phone.replace(/\D/g, '').slice(-10) === digits.slice(-10)
        );
      }

      if (!client && nameFromUrl) {
        // Match by name (case-insensitive, trimmed)
        const nameLower = nameFromUrl.toLowerCase().trim();
        client = allClients.find(c =>
          c.name && c.name.toLowerCase().trim() === nameLower
        );
      }

      if (!client) return null;

      // Get their previous sessions, exclude the current booking's session
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!sessions?.length) return null;

      // Use most recent session that isn't the current booking
      const prev = sessions.find(s => s.booking_id !== bookingIdFromUrl) || sessions[0];

      // jsonb columns may return as array OR as JSON string, handle both
      const parseZones = (field) => {
        if (!field) return [];
        if (Array.isArray(field)) return field;
        if (typeof field === 'string') {
          try { const p = JSON.parse(field); return Array.isArray(p) ? p : []; }
          catch { return []; }
        }
        return [];
      };

      const bodyMap = {};
      parseZones(prev.front_focus).forEach(id => bodyMap[id] = 'focus');
      parseZones(prev.front_avoid).forEach(id => bodyMap[id] = 'avoid');
      parseZones(prev.back_focus ).forEach(id => bodyMap[id] = 'focus');
      parseZones(prev.back_avoid ).forEach(id => bodyMap[id] = 'avoid');

      return {
        bodyMap,
        prefs: {
          pressure:     prev.pressure     || 3,
          goal:         prev.goal         || 'relax',
          tableTemp:    prev.table_temp   || 'warm',
          roomTemp:     prev.room_temp    || 'comfortable',
          music:        prev.music        || 'soft',
          lighting:     prev.lighting     || 'dim',
          conversation: prev.conversation || 'quiet',
          draping:      prev.draping      || 'standard',
          oilPref:      prev.oil_pref     || 'none',
          medFlag:      prev.med_flag     || 'none',
        },
        date: prev.created_at,
      };
    } catch (err) {
      console.error('Error fetching last session:', err);
      return null;
    }
  };

  return (
    <Demo 
      therapist={therapist}
      therapistName={therapist.full_name || therapist.business_name}
      businessName={therapist.business_name}
      waiverEnabled={
        (therapist.practice_agreement_enabled !== false && therapist.practice_agreement_text)
          ? true
          : (therapist.waiver_enabled !== false)
      }
      waiverText={
        // Prefer the unified practice agreement when set. Falls back
        // to the legacy waiver_text for therapists who haven't
        // migrated yet. HK May 14 2026.
        //
        // Tokens like {cancel_under_24h} get resolved here against
        // the therapist's live cancellation policy so the client sees
        // concrete percentages, not raw template tokens. The resolved
        // text is also what gets snapshotted on signature, so the
        // audit trail shows exactly what the client agreed to even
        // if percentages change later.
        (therapist.practice_agreement_enabled !== false && therapist.practice_agreement_text)
          ? renderAgreementForClient(therapist.practice_agreement_text, therapist)
          : (therapist.waiver_text || '')
      }
      initialName={nameFromUrl}
      initialEmail={emailFromUrl}
      initialPhone={phoneFromUrl}
      onSubmit={handleSubmit}
      getLastSession={getLastSession}
    />
  );
}
