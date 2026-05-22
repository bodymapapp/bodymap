// src/components/UnifiedImport.jsx
//
// Top-level wrapper that defaults to the new MultiImport unified
// flow, and lets the user open the legacy two-tab Client +
// Appointment import via an "Advanced" link.
//
// This is what Dashboard renders. Replaces the direct import of
// ImportClients on the Dashboard 'Import existing clients' row.
//
// HK May 22 2026 item C: when the therapist switches modes, the
// files they dropped in MultiImport are preserved (the component
// stays mounted under display:none instead of unmounting). Same
// for ImportClients on the way back. State is never lost on
// mode-switch round trip.

import React, { useState } from 'react';
import MultiImport from './MultiImport';
import ImportClients from './ImportClients';

export default function UnifiedImport({ therapist, onComplete }) {
  const [showLegacy, setShowLegacy] = useState(false);

  return (
    <div>
      {/* Back-to-unified bar (only when in legacy mode) */}
      {showLegacy && (
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
      )}

      {/* Both children stay mounted. We hide the inactive one with
          display:none so React preserves its state (dropped files,
          mapping, fuzzy decisions, etc). Switching modes round-trip
          never loses work. */}
      <div style={{ display: showLegacy ? 'none' : 'block' }}>
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
      </div>
      <div style={{ display: showLegacy ? 'block' : 'none' }}>
        <ImportClients therapist={therapist} onComplete={onComplete} />
      </div>
    </div>
  );
}
