// src/components/UnifiedImport.jsx
//
// Top-level wrapper that defaults to the new MultiImport unified
// flow, and lets the user open the legacy two-tab Client +
// Appointment import via an "Advanced" link.
//
// This is what Dashboard renders. Replaces the direct import of
// ImportClients on the Dashboard 'Import existing clients' row.

import React, { useState } from 'react';
import MultiImport from './MultiImport';
import ImportClients from './ImportClients';

export default function UnifiedImport({ therapist, onComplete }) {
  const [showLegacy, setShowLegacy] = useState(false);

  if (showLegacy) {
    return (
      <div>
        <div style={{ padding: '14px 20px 0' }}>
          <button
            onClick={() => setShowLegacy(false)}
            style={{
              background: 'transparent',
              border: '1px solid #E5E7EB',
              color: '#6B7280',
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: 8,
            }}
          >
            ← Back to unified import
          </button>
        </div>
        <ImportClients therapist={therapist} onComplete={onComplete} />
      </div>
    );
  }

  return (
    <MultiImport
      therapist={therapist}
      onComplete={(opts) => {
        if (opts && opts.openLegacy) {
          setShowLegacy(true);
          return;
        }
        if (onComplete) onComplete();
      }}
    />
  );
}
