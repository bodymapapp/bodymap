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
    // Defensive structure: fetch each related table SEPARATELY and
    // stitch in JS. A single complex join failed silently in the
    // earlier version (HK saw 0 clients on dashboard), wiping the
    // whole dashboard. With this pattern, an auxiliary table failure
    // (packages or subscriptions) only loses that one piece. Base
    // clients still render.
    const [clientsRes, bookingsRes, sessionsRes, packagesRes, subsRes] = await Promise.all([
      supabase.from('clients').select('*').eq('therapist_id', therapistId).order('created_at', { ascending: false }),
      supabase.from('bookings').select('id, client_id, client_email, client_phone, booking_date, status').eq('therapist_id', therapistId),
      supabase.from('sessions').select('id, client_id, completed, created_at').eq('therapist_id', therapistId),
      supabase.from('package_purchases').select('id, client_id, client_email, sessions_remaining, sessions_purchased, status, package:packages(name)').eq('therapist_id', therapistId).eq('status', 'active'),
      supabase.from('member_subscriptions').select('id, client_id, client_email, status, membership:memberships(name, monthly_session_credits)').eq('therapist_id', therapistId).eq('status', 'active'),
    ]);

    if (clientsRes.error) {
      console.error('[getTherapistClients] base clients query failed:', clientsRes.error);
      throw clientsRes.error;
    }
    // Log but don't throw on auxiliary errors. Dashboard still renders.
    if (bookingsRes.error) console.error('[getTherapistClients] bookings join failed:', bookingsRes.error);
    if (sessionsRes.error) console.error('[getTherapistClients] sessions join failed:', sessionsRes.error);
    if (packagesRes.error) console.error('[getTherapistClients] packages join failed:', packagesRes.error);
    if (subsRes.error) console.error('[getTherapistClients] subscriptions join failed:', subsRes.error);

    const clients = clientsRes.data || [];
    const allBookings = bookingsRes.data || [];
    const allSessions = sessionsRes.data || [];
    const allPackages = packagesRes.data || [];
    const allSubs = subsRes.data || [];

    // Index aux data by client_id for O(1) per-client lookup.
    // Bookings can be linked by client_id OR by email/phone (legacy
    // bookings sometimes lack client_id). We index by all three.
    const bookingsById = new Map();
    const bookingsByEmail = new Map();
    const bookingsByPhone = new Map();
    for (const b of allBookings) {
      if (b.client_id) {
        if (!bookingsById.has(b.client_id)) bookingsById.set(b.client_id, []);
        bookingsById.get(b.client_id).push(b);
      }
      if (b.client_email) {
        const k = b.client_email.toLowerCase();
        if (!bookingsByEmail.has(k)) bookingsByEmail.set(k, []);
        bookingsByEmail.get(k).push(b);
      }
      if (b.client_phone) {
        if (!bookingsByPhone.has(b.client_phone)) bookingsByPhone.set(b.client_phone, []);
        bookingsByPhone.get(b.client_phone).push(b);
      }
    }
    const sessionsByClient = new Map();
    for (const s of allSessions) {
      if (!s.client_id) continue;
      if (!sessionsByClient.has(s.client_id)) sessionsByClient.set(s.client_id, []);
      sessionsByClient.get(s.client_id).push(s);
    }
    const packageByClient = new Map();
    const packageByEmail = new Map();
    for (const p of allPackages) {
      if (p.client_id) packageByClient.set(p.client_id, p);
      if (p.client_email) packageByEmail.set(p.client_email.toLowerCase(), p);
    }
    const subByClient = new Map();
    const subByEmail = new Map();
    for (const m of allSubs) {
      if (m.client_id) subByClient.set(m.client_id, m);
      if (m.client_email) subByEmail.set(m.client_email.toLowerCase(), m);
    }

    return clients.map(c => {
      // Gather bookings: prefer client_id match, fallback to email/phone.
      let bookings = bookingsById.get(c.id) || [];
      if (bookings.length === 0 && c.email) bookings = bookingsByEmail.get(c.email.toLowerCase()) || bookings;
      if (bookings.length === 0 && c.phone) bookings = bookingsByPhone.get(c.phone) || bookings;

      const counted = bookings.filter(b => !b.status || ['confirmed', 'completed'].includes(b.status));
      const sortedBookings = [...counted].sort((a, b) => (b.booking_date || '').localeCompare(a.booking_date || ''));
      const lastBooking = sortedBookings[0];
      const daysSince = lastBooking?.booking_date
        ? Math.floor((Date.now() - new Date(lastBooking.booking_date + 'T00:00:00Z').getTime()) / 86400000)
        : null;

      const sessions = sessionsByClient.get(c.id) || [];
      const pending = sessions.filter(s => !s.completed);
      const recentPending = pending.filter(s => {
        const hrs = (Date.now() - new Date(s.created_at)) / 3600000;
        return hrs <= 48;
      });

      let activePackage = packageByClient.get(c.id);
      if (!activePackage && c.email) activePackage = packageByEmail.get(c.email.toLowerCase());
      let activeMembership = subByClient.get(c.id);
      if (!activeMembership && c.email) activeMembership = subByEmail.get(c.email.toLowerCase());

      return {
        ...c,
        total_sessions: counted.length,
        completed_sessions: counted.filter(b => b.status === 'completed').length,
        last_session_at: lastBooking?.booking_date || null,
        days_since_visit: daysSince,
        has_pending: recentPending.length > 0,
        has_old_pending: pending.length > recentPending.length,
        active_package: activePackage
          ? {
              name: activePackage.package?.name || 'Package',
              remaining: activePackage.sessions_remaining,
              total: activePackage.sessions_purchased,
            }
          : null,
        active_membership: activeMembership
          ? {
              name: activeMembership.membership?.name || 'Member',
              credits: activeMembership.membership?.monthly_session_credits || 0,
            }
          : null,
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
