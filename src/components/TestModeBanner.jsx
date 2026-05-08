// src/components/TestModeBanner.jsx
//
// Visible banner that appears at the top of every page when the
// frontend is running in test mode (REACT_APP_PAYMENT_MODE=test).
//
// Production never shows this banner because production never has
// the env var set. Vercel preview environments DO set it, so anyone
// browsing a preview URL sees the banner immediately.
//
// The banner is loud on purpose. We never want to mistake test mode
// for live mode during QA, especially when entering a test card.

import React, { useState } from 'react';
import { isTestMode } from '../lib/paymentMode';

export default function TestModeBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (!isTestMode()) return null;
  if (dismissed) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 99999,
      background: 'linear-gradient(90deg, #FBBF24, #F59E0B)',
      color: '#1F2937',
      padding: '8px 16px',
      fontSize: 13,
      fontWeight: 700,
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      letterSpacing: 0.4,
    }}>
      <span style={{ fontSize: 16 }}>🧪</span>
      <span>TEST MODE ACTIVE. No real payments. Use 4242 4242 4242 4242 for Stripe, 4111 1111 1111 1111 for Square.</span>
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: 'rgba(0,0,0,0.1)',
          border: 'none',
          color: '#1F2937',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          padding: '4px 10px',
          borderRadius: 6,
          marginLeft: 8,
        }}
        title="Hide for this session"
      >
        ×
      </button>
    </div>
  );
}
