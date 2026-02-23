// src/pages/TestDashboard.js
// TEMPORARY - Delete after verifying dashboard works

import React from 'react';
import ClientList from '../components/ClientList';

const C = {
  sage: '#6B9E80',
  forest: '#2A5741',
  beige: '#F0EAD9',
  white: '#FFFFFF',
  darkGray: '#1F2937'
};

export default function TestDashboard() {
  // REPLACE THIS WITH YOUR ACTUAL THERAPIST ID FROM SUPABASE
  const therapistId = 'a9b7a7f7-09d4-4320-8c1a-3dc44227f423';

  return (
    <div style={{ 
      background: C.beige, 
      minHeight: '100vh', 
      padding: '40px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          background: C.white, 
          padding: '24px', 
          borderRadius: '12px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ fontSize: '28px', color: C.forest, margin: '0 0 8px 0' }}>
            🧪 TEST DASHBOARD (No Auth Required)
          </h1>
          <p style={{ fontSize: '14px', color: C.darkGray, margin: 0 }}>
            This bypasses authentication to verify ClientList component works
          </p>
        </div>

        {/* ClientList Component */}
        <div style={{ 
          background: C.white, 
          padding: '32px', 
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <ClientList therapistId={therapistId} />
        </div>

        {/* Stats */}
        <div style={{
          background: C.white,
          padding: '24px',
          borderRadius: '12px',
          marginTop: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '14px', color: C.darkGray }}>
            ✅ If you see your clients above, Part 2 is working perfectly!
          </p>
        </div>
      </div>
    </div>
  );
}