// src/contexts/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadTherapistProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadTherapistProfile(session.user.id);
      } else {
        setUser(null);
        setTherapist(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadTherapistProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('therapists')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error) setTherapist(data);
    } catch (error) {
      console.error('Error loading therapist profile:', error);
    }
  };

  const signUp = async (email, password, metadata) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw authError;
      const { error: dbError } = await supabase.from('therapists').insert([{
        id: authData.user.id,
        email,
        business_name: metadata.businessName,
        full_name: metadata.fullName,
        phone: metadata.phone,
        custom_url: metadata.customUrl,
        password_hash: 'managed_by_supabase_auth',
        plan: 'free'
      }]);
      if (dbError) throw dbError;
      return { success: true, user: authData.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setUser(data.user);
      await loadTherapistProfile(data.user.id);
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setTherapist(null);
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
    <AuthContext.Provider value={{ user, therapist, loading, signUp, signIn, signOut, updateProfile, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
