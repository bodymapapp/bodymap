// src/pages/ClientIntake.js
// Custom URL page - loads therapist, shows BodyMap, saves to Supabase

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db, supabase } from '../lib/supabase';
import Demo from './Demo';

export default function ClientIntake() {
  const { customUrl } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const bookingIdFromUrl = searchParams.get('booking_id');
  const nameFromUrl = searchParams.get('name') || '';
  const emailFromUrl = searchParams.get('email') || '';
  const phoneFromUrl = searchParams.get('phone') || '';
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

      // Step 2: Resolve booking_id — use URL param if present, otherwise find
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
      await db.createSession({
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
        completed: false
      });

      // Step 3: Redirect to thank you page
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
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌿</div>
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
            Go to BodyMap Home
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

      // Fetch all clients for this therapist once — then match on email, phone, or name
      const { data: allClients } = await supabase
        .from('clients')
        .select('*')
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

      // Get their previous sessions — exclude the current booking's session
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!sessions?.length) return null;

      // Use most recent session that isn't the current booking
      const prev = sessions.find(s => s.booking_id !== bookingIdFromUrl) || sessions[0];

      const bodyMap = {};
      (prev.front_focus || []).forEach(id => bodyMap[id] = 'focus');
      (prev.front_avoid || []).forEach(id => bodyMap[id] = 'avoid');
      (prev.back_focus  || []).forEach(id => bodyMap[id] = 'focus');
      (prev.back_avoid  || []).forEach(id => bodyMap[id] = 'avoid');

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
      therapistName={therapist.business_name}
      initialName={nameFromUrl}
      initialEmail={emailFromUrl}
      initialPhone={phoneFromUrl}
      onSubmit={handleSubmit}
      getLastSession={getLastSession}
    />
  );
}
