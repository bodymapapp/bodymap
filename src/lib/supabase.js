// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const db = {
  async getTherapistByUrl(customUrl) {
    // CRITICAL: this select MUST include intake_schema so therapist
    // customizations (renamed labels, hidden fields, custom questions,
    // medical conditions) actually flow through to the client intake.
    // Bug history: prior to May 2026, this query selected only 5
    // basic columns and intake_schema was undefined when passed to
    // Demo, so effectiveSchema() always fell back to DEFAULT_SCHEMA
    // and therapist edits never reached clients. Symptom was 'I edit
    // intake, deploy, my changes don't show'. Fix is to select * so
    // every column reaches Demo and effectiveSchema can read it.
    //
    // We use select('*') instead of an explicit column list because
    // Demo also reads waiver settings, business identity, and any
    // future flags. Hardcoding columns has bitten us before.
    const { data, error } = await supabase
      .from('therapists')
      .select('*')
      .eq('custom_url', customUrl)
      .single();
    if (error) throw error;
    return data;
  },

  async upsertClient(therapistId, clientData) {
    const { data: existing } = await supabase
      .from('clients')
      .select('*')
      .eq('therapist_id', therapistId)
      .eq('phone', clientData.phone)
      .maybeSingle();
    if (existing) return existing;
    const { data, error } = await supabase
      .from('clients')
      .insert([{ therapist_id: therapistId, name: clientData.name, phone: clientData.phone, email: clientData.email || null }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async createSession(sessionData) {
    const { data, error } = await supabase
      .from('sessions')
      .insert([sessionData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getTherapistSessions(therapistId) {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, client:clients(*)')
      .eq('therapist_id', therapistId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  },

  async getSession(sessionId) {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, client:clients(*)')
      .eq('id', sessionId)
      .single();
    if (error) throw error;
    return data;
  },

  async updateSession(sessionId, updates) {
    const { data, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getTherapistClients(therapistId) {
    // Pull clients with bookings AND sessions joined.
    // Bookings = appointment records (have booking_date, status,
    // service_id). The visit-count and last-visit timestamps on
    // the client list card should reflect bookings, since those
    // are the actual unit of work that happened.
    // Sessions are the optional SOAP-note records, separate from
    // bookings, used here only for the has_pending flag (intake
    // filled but SOAP not yet written).
    const { data: clients, error } = await supabase
      .from('clients')
      .select(`
        *,
        bookings(id, booking_date, status),
        sessions(id, completed, created_at)
      `)
      .eq('therapist_id', therapistId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (clients || []).map(c => {
      // Booking-derived stats: total visits + last visit. Counts
      // confirmed and completed bookings. Null status counts as
      // confirmed (legacy rows from before the column was added).
      const allBookings = c.bookings || [];
      const counted = allBookings.filter(b => !b.status || ['confirmed', 'completed'].includes(b.status));
      const sortedBookings = [...counted].sort((a, b) => (b.booking_date || '').localeCompare(a.booking_date || ''));
      const lastBooking = sortedBookings[0];
      const daysSince = lastBooking?.booking_date
        ? Math.floor((Date.now() - new Date(lastBooking.booking_date + 'T00:00:00Z').getTime()) / 86400000)
        : null;

      // Session-derived stats (SOAP records, separate concept).
      // Used only for has_pending: clients who filled intake but
      // don't yet have a SOAP note written. Matters for the
      // therapist's day-of workflow.
      const sessions = c.sessions || [];
      const pending = sessions.filter(s => !s.completed);
      const recentPending = pending.filter(s => {
        const hrs = (Date.now() - new Date(s.created_at)) / 3600000;
        return hrs <= 48;
      });

      return {
        ...c,
        total_sessions: counted.length,
        completed_sessions: counted.filter(b => b.status === 'completed').length,
        last_session_at: lastBooking?.booking_date || null,
        days_since_visit: daysSince,
        has_pending: recentPending.length > 0,
        has_old_pending: pending.length > recentPending.length,
      };
    });
  },

  async getFeedback(sessionId) {
    const { data, error } = await supabase.from("feedback").select("*").eq("session_id", sessionId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async getClientHistory(clientId) {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
};
