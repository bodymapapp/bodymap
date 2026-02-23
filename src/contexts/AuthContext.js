// src/contexts/AuthContext.js
// This manages user authentication and therapist profile

import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    checkUser();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await loadTherapistProfile(session.user.id);
      } else {
        setUser(null);
        setTherapist(null);
      }
      setLoading(false);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await loadTherapistProfile(session.user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTherapistProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('therapists')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      setTherapist(data);
    } catch (error) {
      console.error('Error loading therapist profile:', error);
    }
  };

  const signUp = async (email, password, metadata) => {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      });

      if (authError) throw authError;

      // Create therapist profile in database
      const { error: dbError } = await supabase
        .from('therapists')
        .insert([{
          id: authData.user.id,
          email: email,
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
      console.error('Signup error:', error);
      return { success: false, error: error.message };
    }
  };

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setTherapist(null);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  const updateProfile = async (updates) => {
    try {
      const { data, error } = await supabase
        .from('therapists')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      setTherapist(data);
      return { success: true, data };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    therapist,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
