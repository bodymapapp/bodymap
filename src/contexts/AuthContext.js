// src/contexts/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        supabase.from('therapists').select('*').eq('id', session.user.id).single()
          .then(async ({ data }) => {
            if (data) {
              // Existing user - check if they just paid and need Silver upgrade
              const justPaid = localStorage.getItem('justPaid') === 'true';
              if (justPaid) {
                localStorage.removeItem('justPaid');
                await supabase.from('therapists').update({ plan: 'silver' }).eq('id', session.user.id);
                data.plan = 'silver';
                setTherapist(data);
                window.location.href = '/dashboard?upgraded=true';
                return;
              }
              setTherapist(data);
            } else {
              // New Google user - no therapist row yet
              const justPaid = localStorage.getItem('justPaid') === 'true';
              if (justPaid) {
                // Paid flow - create therapist record directly, skip onboarding
                localStorage.removeItem('justPaid');
                const u = session.user;
                const name = u.user_metadata?.full_name || u.email?.split('@')[0] || '';
                const urlSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30);
                await supabase.from('therapists').insert([{
                  id: u.id, email: u.email,
                  full_name: name, business_name: name,
                  custom_url: urlSlug,
                  password_hash: 'managed_by_supabase_auth',
                  plan: 'silver'
                }]);
                window.location.href = '/dashboard?upgraded=true';
              } else {
                const provider = session.user?.app_metadata?.provider;
                if (provider === 'google' && window.location.pathname !== '/onboarding') {
                  window.location.href = '/onboarding';
                }
              }
            }
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      } else {
        setUser(null);
        setTherapist(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setUser(data.user);
      const { data: t } = await supabase.from('therapists').select('*').eq('id', data.user.id).single();
      if (t) setTherapist(t);
      return { success: true };
    } catch (error) {
      let msg = error.message;
      if (msg === "User already registered") msg = "An account with this email already exists. Sign in instead.";
      else if (msg.includes("therapists_custom_url_key")) msg = "That intake URL is already taken. Please choose a different one.";
      else if (msg.includes("duplicate key")) msg = "An account with these details already exists.";
      return { success: false, error: msg };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTherapist(null);
    window.location.href = '/login';
  };

  const signUp = async (email, password, metadata) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw authError;
      const { error: dbError } = await supabase.from('therapists').insert([{
        id: authData.user.id, email,
        business_name: metadata.businessName,
        full_name: metadata.fullName,
        phone: metadata.phone,
        custom_url: metadata.customUrl,
        password_hash: 'managed_by_supabase_auth',
        plan: 'free'
      }]);
      if (dbError) throw dbError;
      // Fetch back to confirm insert and set state
      const { data: newT } = await supabase.from('therapists').select('*').eq('id', authData.user.id).single();
      if (newT) setTherapist(newT);
      // Re-fetch therapist so dashboard loads correctly
      const { data: t } = await supabase.from('therapists').select('*').eq('id', authData.user.id).single();
      return { success: true, therapist: t };
    } catch (error) {
      let msg = error.message;
      if (msg === "User already registered") msg = "An account with this email already exists. Sign in instead.";
      else if (msg.includes("therapists_custom_url_key")) msg = "That intake URL is already taken. Please choose a different one.";
      else if (msg.includes("duplicate key")) msg = "An account with these details already exists.";
      return { success: false, error: msg };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/dashboard' } });
      if (error) throw error;
      return { success: true };
    } catch (error) {
      let msg = error.message;
      if (msg === "User already registered") msg = "An account with this email already exists. Sign in instead.";
      else if (msg.includes("therapists_custom_url_key")) msg = "That intake URL is already taken. Please choose a different one.";
      else if (msg.includes("duplicate key")) msg = "An account with these details already exists.";
      return { success: false, error: msg };
    }
  };

  const updateProfile = async (updates) => {
    try {
      const { data, error } = await supabase.from('therapists').update(updates).eq('id', user.id).select().single();
      if (error) throw error;
      setTherapist(data);
      return { success: true, data };
    } catch (error) {
      let msg = error.message;
      if (msg === "User already registered") msg = "An account with this email already exists. Sign in instead.";
      else if (msg.includes("therapists_custom_url_key")) msg = "That intake URL is already taken. Please choose a different one.";
      else if (msg.includes("duplicate key")) msg = "An account with these details already exists.";
      return { success: false, error: msg };
    }
  };

  return (
    <AuthContext.Provider value={{ user, therapist, loading, signIn, signOut, signUp, signInWithGoogle, updateProfile, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
