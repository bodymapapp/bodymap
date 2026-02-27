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
  const { signIn } = useAuth();
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
