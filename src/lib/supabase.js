// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const db = {
  async getTherapistByUrl(customUrl) {
    const { data, error } = await supabase
      .from('therapists')
      .select('id, business_name, full_name')
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
    // Fetch clients with real session counts from the sessions table
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*, sessions(id, completed, created_at)')
      .eq('therapist_id', therapistId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (clients || []).map(c => {
      const sessions = c.sessions || [];
      const sorted = [...sessions].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      const lastSession = sorted[0];
      const daysSince = lastSession ? Math.floor((Date.now() - new Date(lastSession.created_at)) / 86400000) : null;
      const pending = sessions.filter(s => !s.completed);
      return {
        ...c,
        total_sessions: sessions.length,
        completed_sessions: sessions.filter(s => s.completed).length,
        last_session_at: lastSession?.created_at || null,
        days_since_visit: daysSince,
        has_pending: pending.length > 0,
      };
    });
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
