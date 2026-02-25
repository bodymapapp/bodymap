// src/lib/supabase.js
// This file handles all database operations

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit'  // DISABLE auth lock to prevent timeout errors
  }
});

// Database helper functions
export const db = {
  // Get therapist by custom URL (for client intake)
  async getTherapistByUrl(customUrl) {
    const { data, error } = await supabase
      .from('therapists')
      .select('id, business_name, full_name')
      .eq('custom_url', customUrl)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Create or update client
  async upsertClient(therapistId, clientData) {
    // Check if client exists by phone
    const { data: existing } = await supabase
      .from('clients')
      .select('*')
      .eq('therapist_id', therapistId)
      .eq('phone', clientData.phone)
      .maybeSingle();
    
    if (existing) return existing;

    // Create new client
    const { data, error } = await supabase
      .from('clients')
      .insert([{
        therapist_id: therapistId,
        name: clientData.name,
        phone: clientData.phone,
        email: clientData.email || null
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Create session (client intake submission)
  async createSession(sessionData) {
    const { data, error } = await supabase
      .from('sessions')
      .insert([sessionData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get all sessions for a therapist
  async getTherapistSessions(therapistId) {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        client:clients(*)
      `)
      .eq('therapist_id', therapistId)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    return data;
  },

  // Get single session details
  async getSession(sessionId) {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        client:clients(*)
      `)
      .eq('id', sessionId)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update session (add notes, mark complete)
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

  // Mark session as complete
  async completeSession(sessionId, therapistNotes) {
    const { data, error } = await supabase
      .from('sessions')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        therapist_notes: therapistNotes
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get all clients for therapist
  async getTherapistClients(therapistId) {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('therapist_id', therapistId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Get client history
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
