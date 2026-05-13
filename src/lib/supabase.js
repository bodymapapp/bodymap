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

  /**
   * Bulk-fetch everything the therapist's client profile view needs.
   * Single Promise.all call, then stitch results in JS. Same defensive
   * pattern as getTherapistClients: each auxiliary table failure logs
   * but doesn't tank the whole result.
   *
   * Returns:
   *   {
   *     client: the raw clients row,
   *     bookings: [],            // for timeline + next-booking
   *     sessions: [],            // for timeline + pattern aggregation
   *     packagePurchases: [],    // for balance strip
   *     memberSubscriptions: [], // for balance strip
   *     giftCertificates: [],    // for timeline (received gifts)
   *     stats: {
   *       lifetimeSessions, lifetimeEarnings,
   *       lastVisitDate, daysSinceVisit,
   *       nextBooking, pendingIntake,
   *     },
   *     patterns: {
   *       topFrontZones: [{ id, count }],
   *       topBackZones:  [{ id, count }],
   *       topAvoidZones: [{ id, count }],
   *     },
   *   }
   */
  async getClientProfile(clientId, therapistId, clientEmail = null, clientPhone = null) {
    const [clientRes, bookingsRes, sessionsRes, packagesRes, subsRes, giftsRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
      // Bookings can be linked by client_id OR email/phone for legacy
      // rows. We OR-match so the import data and the natively-created
      // bookings both show up.
      (() => {
        let q = supabase.from('bookings').select('id, client_id, client_email, client_phone, booking_date, start_time, end_time, status, notes, service:services(name, price, duration)').eq('therapist_id', therapistId);
        const ors = [`client_id.eq.${clientId}`];
        if (clientEmail) ors.push(`client_email.eq.${clientEmail.toLowerCase()}`);
        if (clientPhone) ors.push(`client_phone.eq.${clientPhone}`);
        return q.or(ors.join(',')).order('booking_date', { ascending: false });
      })(),
      supabase.from('sessions').select('id, client_id, completed, completed_at, created_at, front_focus, back_focus, front_avoid, back_avoid, front_focus_therapist, back_focus_therapist, pressure, goal, table_temp, room_temp, music, lighting, conversation, draping, oil_pref, med_flag, med_note, therapist_notes, medical_conditions').eq('therapist_id', therapistId).eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('package_purchases').select('id, client_id, sessions_remaining, sessions_purchased, price_paid, status, expires_at, purchased_at, package:packages(name)').eq('therapist_id', therapistId).eq('client_id', clientId).order('purchased_at', { ascending: false }),
      supabase.from('member_subscriptions').select('id, client_id, status, current_period_start, current_period_end, monthly_price, monthly_session_credits, current_credits, started_at, membership:memberships(name, monthly_session_credits)').eq('therapist_id', therapistId).eq('client_id', clientId).order('started_at', { ascending: false }),
      supabase.from('gift_certificates').select('id, code, amount, remaining, status, design_template, recipient_name, purchaser_name, message, created_at').eq('therapist_id', therapistId).eq('recipient_email', clientEmail || '').order('created_at', { ascending: false }),
    ]);

    if (clientRes.error) {
      console.error('[getClientProfile] client query failed:', clientRes.error);
      throw clientRes.error;
    }
    if (bookingsRes.error) console.error('[getClientProfile] bookings query failed:', bookingsRes.error);
    if (sessionsRes.error) console.error('[getClientProfile] sessions query failed:', sessionsRes.error);
    if (packagesRes.error) console.error('[getClientProfile] packages query failed:', packagesRes.error);
    if (subsRes.error) console.error('[getClientProfile] subscriptions query failed:', subsRes.error);
    if (giftsRes.error) console.error('[getClientProfile] gifts query failed:', giftsRes.error);

    const client = clientRes.data;
    const bookings = bookingsRes.data || [];
    const sessions = sessionsRes.data || [];
    const packagePurchases = packagesRes.data || [];
    const memberSubscriptions = subsRes.data || [];
    const giftCertificates = giftsRes.data || [];

    // ─── Stats ───
    const countedBookings = bookings.filter(b => !b.status || ['confirmed', 'completed'].includes(b.status));
    const completedBookings = bookings.filter(b => b.status === 'completed');
    const lifetimeSessions = countedBookings.length;
    const lifetimeEarnings = countedBookings.reduce((sum, b) => sum + (b.service?.price || 0), 0);

    const sortedByDate = [...countedBookings].sort((a, b) => (b.booking_date || '').localeCompare(a.booking_date || ''));
    const lastVisit = sortedByDate[0];
    const lastVisitDate = lastVisit?.booking_date || null;
    const daysSinceVisit = lastVisitDate
      ? Math.floor((Date.now() - new Date(lastVisitDate + 'T00:00:00Z').getTime()) / 86400000)
      : null;

    const todayStr = new Date().toISOString().slice(0, 10);
    const futureBookings = bookings.filter(b => b.booking_date >= todayStr && (!b.status || ['confirmed'].includes(b.status))).sort((a, b) => (a.booking_date || '').localeCompare(b.booking_date || ''));
    const nextBooking = futureBookings[0] || null;

    const pendingIntake = sessions.find(s => !s.completed && !s.completed_at) || null;

    // ─── Patterns: top body-map zones across all sessions ───
    // Aggregate the focus arrays across every completed session so the
    // therapist can see this client's recurring zones at a glance.
    // therapist-marked zones (front_focus_therapist) take priority
    // since the therapist's hands know better than the client; fall back
    // to client-marked zones from intake.
    function topN(arrField, n = 3) {
      const counts = new Map();
      for (const s of sessions) {
        const arr = Array.isArray(s[arrField]) ? s[arrField] : [];
        for (const zone of arr) {
          counts.set(zone, (counts.get(zone) || 0) + 1);
        }
      }
      return [...counts.entries()]
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, n);
    }
    const topFrontZones = topN('front_focus_therapist').length > 0 ? topN('front_focus_therapist') : topN('front_focus');
    const topBackZones = topN('back_focus_therapist').length > 0 ? topN('back_focus_therapist') : topN('back_focus');
    const topAvoidZones = [
      ...topN('front_avoid', 2),
      ...topN('back_avoid', 2),
    ].sort((a, b) => b.count - a.count).slice(0, 3);

    // ─── Preferences: most recent session's settings as the default ───
    // The most recent completed session is the source of truth for what
    // the therapist normally does for this client. If no sessions yet,
    // all fields null and the UI shows "Not set yet."
    const latestCompletedSession = sessions.find(s => s.completed);
    const preferences = latestCompletedSession
      ? {
          pressure: latestCompletedSession.pressure,
          goal: latestCompletedSession.goal,
          table_temp: latestCompletedSession.table_temp,
          room_temp: latestCompletedSession.room_temp,
          music: latestCompletedSession.music,
          lighting: latestCompletedSession.lighting,
          conversation: latestCompletedSession.conversation,
          draping: latestCompletedSession.draping,
          oil_pref: latestCompletedSession.oil_pref,
        }
      : null;

    // ─── Medical flags: aggregate from medical_conditions + med_flag/note ───
    const medicalFlags = [];
    const seenConditions = new Set();
    for (const s of sessions) {
      const conditions = Array.isArray(s.medical_conditions) ? s.medical_conditions : [];
      for (const c of conditions) {
        if (c && !seenConditions.has(c)) {
          seenConditions.add(c);
          medicalFlags.push({ type: 'condition', text: c });
        }
      }
      if (s.med_flag && s.med_flag !== 'none' && !seenConditions.has(s.med_flag)) {
        seenConditions.add(s.med_flag);
        medicalFlags.push({ type: 'flag', text: s.med_flag, note: s.med_note });
      }
    }

    return {
      client,
      bookings,
      sessions,
      packagePurchases,
      memberSubscriptions,
      giftCertificates,
      stats: {
        lifetimeSessions,
        lifetimeCompletedSessions: completedBookings.length,
        lifetimeEarnings,
        lastVisitDate,
        daysSinceVisit,
        nextBooking,
        pendingIntake,
      },
      patterns: { topFrontZones, topBackZones, topAvoidZones },
      preferences,
      medicalFlags,
    };
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
