// src/contexts/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { seedNewTherapistDefaults } from '../lib/seedDefaults';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

// HK Jun 6 2026: never surface a raw technical error to a person on the
// login or signup screen. A customer who sees "Failed to fetch" gives up.
// Map connection drops, DNS blips, and known auth errors to calm, plain
// language. No em dashes.
function friendlyAuthError(error) {
  const raw = (error && error.message) || '';
  const looksLikeNetwork =
    (error && (error.name === 'TypeError' || error.name === 'AuthRetryableFetchError')) ||
    /failed to fetch|load failed|networkerror|network error|connection|err_|fetch/i.test(raw);
  if (looksLikeNetwork) {
    return "We could not reach MyBodyMap just now. Please check your internet connection and try again.";
  }
  if (raw === 'Invalid login credentials') {
    return "That email or password does not match our records. Please try again.";
  }
  if (raw === 'Email not confirmed') {
    return "Please confirm your email first. Check your inbox for the confirmation link.";
  }
  if (raw === 'User already registered') {
    return "An account with this email already exists. Sign in instead.";
  }
  if (raw.includes('therapists_custom_url_key')) {
    return "That intake URL is already taken. Please choose a different one.";
  }
  if (raw.includes('duplicate key')) {
    return "An account with these details already exists.";
  }
  return raw || 'Something went wrong. Please try again.';
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);

  // Capture the therapist's local timezone once so notification emails can
  // render times in their local zone instead of the server's UTC. Fire and
  // forget; only writes when missing or changed, then stops. (HK Jun 5 2026)
  useEffect(() => {
    if (!therapist?.id) return;
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { tz = ''; }
    if (!tz || therapist.timezone === tz) return;
    supabase.from('therapists').update({ timezone: tz }).eq('id', therapist.id).then(() => {});
    setTherapist(prev => (prev && prev.id === therapist.id) ? { ...prev, timezone: tz } : prev);
  }, [therapist?.id, therapist?.timezone]);

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
                  plan: 'silver',
                  trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
                }]);
                // Auto-seed catalog defaults so the dashboard isn't a blank canvas.
                // Backs the "Up and running in 2 minutes" marketing claim. Idempotent
                // and non-blocking; if any seed step fails, signup still completes.
                seedNewTherapistDefaults(u.id).catch(() => {});
                // Welcome email (non-blocking), edge function BCCs bodymapdemo@gmail.com
                try {
                  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
                  const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
                  fetch(`${supabaseUrl}/functions/v1/send-welcome`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
                    body: JSON.stringify({ email: u.email, firstName: name.split(' ')[0] || 'there', customUrl: urlSlug }),
                  }).catch(() => {});
                } catch (e) { /* non-blocking */ }
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
      return { success: false, error: friendlyAuthError(error) };
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
        // Default new signups to Bronze (free tier) to match marketing.
        // Stripe-paid flows above will upgrade to Silver via the justPaid path.
        plan: 'bronze',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      }]);
      if (dbError) throw dbError;
      // Auto-seed catalog defaults so the dashboard isn't a blank canvas.
      // Backs the "Up and running in 2 minutes" marketing claim. Idempotent
      // and non-blocking; if any seed step fails, signup still completes.
      seedNewTherapistDefaults(authData.user.id).catch(() => {});
      // Fetch back to confirm insert and set state
      const { data: newT } = await supabase.from('therapists').select('*').eq('id', authData.user.id).single();
      if (newT) setTherapist(newT);
      // Re-fetch therapist so dashboard loads correctly
      const { data: t } = await supabase.from('therapists').select('*').eq('id', authData.user.id).single();
      return { success: true, therapist: t };
    } catch (error) {
      return { success: false, error: friendlyAuthError(error) };
    }
  };

  const signInWithGoogle = async () => {
    try {
      // Force Google's account chooser every time (HK May 21 2026,
      // Jackie incident). Without prompt=select_account, Google
      // silently uses whichever account the browser is currently
      // logged into, which means therapists with multiple Google
      // accounts (or anyone sharing a device with family) can't
      // switch accounts without incognito mode. Adding this one
      // parameter shows the standard Google picker every time.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dashboard',
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: friendlyAuthError(error) };
    }
  };

  const updateProfile = async (updates) => {
    try {
      const { data, error } = await supabase.from('therapists').update(updates).eq('id', user.id).select().single();
      if (error) throw error;
      setTherapist(data);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: friendlyAuthError(error) };
    }
  };

  // Re-fetch the therapist row from Supabase and update local state.
  // Use this after an edge function or other server-side code mutates
  // the therapist row (e.g. phone verification, billing webhooks). The
  // AuthContext otherwise only fetches on auth state change, so without
  // this the in-context therapist value can stay stale and break gates
  // that depend on freshly-written fields (like phone_verified_at).
  const refreshTherapist = async () => {
    if (!user?.id) return null;
    const { data, error } = await supabase
      .from('therapists').select('*').eq('id', user.id).single();
    if (error) return null;
    setTherapist(data);
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, therapist, loading, signIn, signOut, signUp, signInWithGoogle, updateProfile, refreshTherapist, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
