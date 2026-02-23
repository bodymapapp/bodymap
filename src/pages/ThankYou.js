// src/pages/ThankYou.js
// Confirmation page after client submits their intake

import React from 'react';
import { useLocation, Link } from 'react-router-dom';

const C = {
  sage: '#6B9E80',
  forest: '#2A5741',
  beige: '#F0EAD9',
  darkGray: '#1F2937',
  gray: '#6B7280'
};

export default function ThankYou() {
  const location = useLocation();
  const { therapistName, clientName } = location.state || {};

  return (
    <div style={{
      minHeight: '100vh',
      background: C.beige,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '48px',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        {/* Success Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          background: '#D1FAE5',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: '40px'
        }}>
          ✓
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          color: C.darkGray,
          marginBottom: '16px'
        }}>
          All Set{clientName ? `, ${clientName.split(' ')[0]}` : ''}!
        </h1>

        {/* Message */}
        <p style={{
          fontSize: '18px',
          color: C.gray,
          lineHeight: '1.6',
          marginBottom: '32px'
        }}>
          Your preferences have been sent to {therapistName || 'your therapist'}.
          <br /><br />
          They'll review your body map before your session to give you the best possible experience.
        </p>

        {/* What Happens Next */}
        <div style={{
          background: C.beige,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '32px',
          textAlign: 'left'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '700',
            color: C.darkGray,
            marginBottom: '16px'
          }}>
            What Happens Next:
          </h3>
          <ul style={{
            fontSize: '15px',
            color: C.gray,
            lineHeight: '1.8',
            paddingLeft: '20px',
            margin: 0
          }}>
            <li>Your therapist will review your preferences</li>
            <li>They'll prepare for your session accordingly</li>
            <li>Arrive a few minutes early to relax</li>
            <li>Enjoy your personalized massage!</li>
          </ul>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <Link
            to="/"
            style={{
              display: 'block',
              background: C.sage,
              color: 'white',
              padding: '14px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '16px'
            }}
          >
            Learn More About BodyMap
          </Link>
          
          <p style={{
            fontSize: '14px',
            color: C.gray,
            margin: 0
          }}>
            Looking forward to your session! 🌿
          </p>
        </div>
      </div>
    </div>
  );
}
