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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        supabase.from('therapists').select('*').eq('id', session.user.id).single()
          .then(({ data }) => { if (data) setTherapist(data); })
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        supabase.from('therapists').select('*').eq('id', session.user.id).single()
          .then(({ data }) => { if (data) setTherapist(data); });
      } else {
        setUser(null);
        setTherapist(null);
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
      return { success: false, error: error.message };
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
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/dashboard' } });
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const updateProfile = async (updates) => {
    try {
      const { data, error } = await supabase.from('therapists').update(updates).eq('id', user.id).select().single();
      if (error) throw error;
      setTherapist(data);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return (
    <AuthContext.Provider value={{ user, therapist, loading, signIn, signOut, signUp, signInWithGoogle, updateProfile, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
