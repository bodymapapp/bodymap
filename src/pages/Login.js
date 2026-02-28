import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const C = {
  sage: '#6B9E80',
  forest: '#2A5741',
  lavender: '#B4A7D6',
  gray: '#6B7280',
  darkGray: '#1F2937',
  lightGray: '#F9FAFB',
  red: '#DC2626'
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn(email, password);
    
    if (result.success) {
      const isFirstLoginToday = localStorage.getItem('lastLoginDate') !== new Date().toDateString();
      if (isFirstLoginToday) {
        localStorage.setItem('showSendOnLoad', 'true');
        localStorage.setItem('lastLoginDate', new Date().toDateString());
      }
      const isFirstEver = !localStorage.getItem('hasLoggedInBefore');
      if (isFirstEver) localStorage.setItem('showBookmarkNudge', 'true');
      localStorage.setItem('hasLoggedInBefore', 'true');
      window.location.href = '/dashboard';
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: C.lightGray,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: '400px', width: '100%' }}>
        {/* Logo */}
        <Link to="/" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          justifyContent: 'center',
          marginBottom: '32px',
          textDecoration: 'none'
        }}>
          <span style={{ fontSize: '40px' }}>🌿</span>
          <span style={{ fontSize: '32px', fontWeight: '700', color: C.forest }}>BodyMap</span>
        </Link>

        {/* Login Card */}
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '40px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: '700', 
            color: C.darkGray, 
            marginBottom: '8px',
            textAlign: 'center'
          }}>
            Welcome Back
          </h1>
          <p style={{ 
            fontSize: '14px', 
            color: C.gray, 
            marginBottom: '32px',
            textAlign: 'center'
          }}>
            Sign in to your therapist dashboard
          </p>

          {error && (
            <div style={{ 
              background: '#FEF2F2', 
              border: '1px solid #FCA5A5', 
              borderRadius: '8px', 
              padding: '12px',
              marginBottom: '24px',
              color: C.red,
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button type="button" onClick={async () => { setLoading(true); await signInWithGoogle(); setLoading(false); }} disabled={loading} style={{ width: '100%', background: 'white', color: '#374151', padding: '14px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/><path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }}/><span style={{ fontSize: '13px', color: '#9CA3AF' }}>or sign in with email</span><div style={{ flex: 1, height: '1px', background: '#E5E7EB' }}/>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151', 
                marginBottom: '8px' 
              }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '15px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151', 
                marginBottom: '8px' 
              }}>
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '15px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#9CA3AF' : C.sage,
                color: 'white',
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: '16px'
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div style={{ textAlign: 'center', fontSize: '14px', color: C.gray }}>
              Don't have an account?{' '}
              <Link to="/signup" style={{ color: C.sage, fontWeight: '600', textDecoration: 'none' }}>
                Sign up
              </Link>
            </div>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link to="/" style={{ color: C.gray, fontSize: '14px', textDecoration: 'none' }}>
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
