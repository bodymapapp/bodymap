// src/pages/Signup.js
// Therapist registration page

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
  red: '#DC2626',
  green: '#059669'
};

export default function Signup() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    businessName: '',
    phone: '',
    customUrl: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Auto-generate custom URL from business name
    if (name === 'businessName') {
      const url = value.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '')
        .substring(0, 30);
      setFormData(prev => ({ ...prev, customUrl: url }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!formData.customUrl || formData.customUrl.length < 3) {
      setError('Custom URL must be at least 3 characters');
      return;
    }

    setLoading(true);

    const result = await signUp(formData.email, formData.password, {
      fullName: formData.fullName,
      businessName: formData.businessName,
      phone: formData.phone,
      customUrl: formData.customUrl
    });

    if (result.success) {
      navigate('/dashboard');
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
      <div style={{ maxWidth: '500px', width: '100%' }}>
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

        {/* Signup Card */}
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
            Create Your Account
          </h1>
          <p style={{ 
            fontSize: '14px', 
            color: C.gray, 
            marginBottom: '32px',
            textAlign: 'center'
          }}>
            Start your 14-day free trial
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
            {/* Full Name */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151', 
                marginBottom: '8px' 
              }}>
                Your Full Name
              </label>
              <input
                type="text"
                name="fullName"
                required
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Jane Smith"
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

            {/* Business Name */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151', 
                marginBottom: '8px' 
              }}>
                Business Name
              </label>
              <input
                type="text"
                name="businessName"
                required
                value={formData.businessName}
                onChange={handleChange}
                placeholder="Healing Hands Massage"
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

            {/* Custom URL */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151', 
                marginBottom: '8px' 
              }}>
                Your Custom URL
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: C.gray, fontSize: '14px' }}>mybodymap.app/</span>
                <input
                  type="text"
                  name="customUrl"
                  required
                  value={formData.customUrl}
                  onChange={handleChange}
                  placeholder="healinghands"
                  style={{
                    flex: 1,
                    padding: '12px',
                    fontSize: '15px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <p style={{ fontSize: '12px', color: C.gray, marginTop: '4px' }}>
                Clients will use this link to fill out their body map
              </p>
            </div>

            {/* Phone */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151', 
                marginBottom: '8px' 
              }}>
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                placeholder="(555) 123-4567"
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

            {/* Email */}
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
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
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

            {/* Password */}
            <div style={{ marginBottom: '20px' }}>
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
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="Minimum 8 characters"
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

            {/* Confirm Password */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151', 
                marginBottom: '8px' 
              }}>
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
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
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

            <div style={{ textAlign: 'center', fontSize: '14px', color: C.gray }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: C.sage, fontWeight: '600', textDecoration: 'none' }}>
                Sign in
              </Link>
            </div>
          </form>

          <p style={{ fontSize: '12px', color: C.gray, textAlign: 'center', marginTop: '24px' }}>
            By signing up, you agree to our{' '}
            <Link to="/terms" style={{ color: C.sage }}>Terms</Link>
            {' '}and{' '}
            <Link to="/privacy" style={{ color: C.sage }}>Privacy Policy</Link>
          </p>
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
