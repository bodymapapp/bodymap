// src/components/PlatformTermsModal.jsx
//
// HK May 31 2026: one-time platform Terms of Service acceptance gate
// for therapists. Renders on first Dashboard load after this code
// ships for any therapist whose therapists.platform_terms_accepted_at
// is NULL. Cannot be dismissed without accepting (no close X). On
// accept, writes platform_terms_accepted_at + platform_terms_version
// to the row and disappears.
//
// Why: MyBodyMap has had a /terms page since launch but no acceptance
// tracking. The Pro-tier therapists who signed up never explicitly
// accepted our terms. Legally weak. This closes the gap retroactively
// (existing therapists) AND going forward (new signups, see signup
// flow patch).
//
// Design: keeps it warm. Not a wall of legalese. Two short paragraphs,
// link to read the full terms, and an "I accept" button. Adult-spoke,
// not corporate-spoke.

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const CURRENT_TERMS_VERSION = 'v1';

const C = {
  forest: '#2A5741',
  ink: '#1F2937',
  inkSoft: '#4B5563',
  inkMute: '#9CA3AF',
  cream: '#F5F0E8',
  white: '#FFFFFF',
  line: '#E5E7EB',
};

export default function PlatformTermsModal({ therapistId, onAccepted }) {
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [checked, setChecked] = useState(false);

  async function handleAccept() {
    if (!checked) {
      setError('Please check the box to confirm you accept the terms.');
      return;
    }
    setAccepting(true);
    setError(null);
    try {
      const { error: updErr } = await supabase
        .from('therapists')
        .update({
          platform_terms_accepted_at: new Date().toISOString(),
          platform_terms_version: CURRENT_TERMS_VERSION,
        })
        .eq('id', therapistId);
      if (updErr) throw updErr;
      onAccepted?.();
    } catch (e) {
      console.error('[PlatformTermsModal] accept failed', e);
      setError(e.message || 'Could not save. Please try again.');
      setAccepting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(31, 41, 55, 0.6)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{
        background: C.white,
        borderRadius: 18,
        maxWidth: 520,
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{ padding: '32px 28px 22px' }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: C.forest,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 8,
          }}>
            A quick housekeeping moment
          </div>
          <h2 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 24,
            color: C.ink,
            margin: '0 0 16px',
            lineHeight: 1.25,
            fontWeight: 700,
          }}>
            We're tightening up our terms.
          </h2>
          <p style={{ fontSize: 14.5, color: C.inkSoft, lineHeight: 1.65, margin: '0 0 14px' }}>
            MyBodyMap's Terms of Service have been here since launch, but we didn't ask everyone to acknowledge them at signup. We're correcting that now.
          </p>
          <p style={{ fontSize: 14.5, color: C.inkSoft, lineHeight: 1.65, margin: '0 0 18px' }}>
            Nothing about how you use the platform is changing. We just want a clear record that you've read what we agreed to with each other.
          </p>

          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: C.forest,
              textDecoration: 'underline',
              marginBottom: 22,
            }}
          >
            Read the full Terms of Service ↗
          </a>

          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '14px 16px',
            background: C.cream,
            border: `1.5px solid ${C.line}`,
            borderRadius: 12,
            marginBottom: 18,
            cursor: 'pointer',
            userSelect: 'none',
          }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => { setChecked(e.target.checked); if (error) setError(null); }}
              style={{ width: 20, height: 20, accentColor: C.forest, cursor: 'pointer', marginTop: 1 }}
            />
            <span style={{ fontSize: 14, color: C.ink, lineHeight: 1.5, fontWeight: 600 }}>
              I've read and accept the MyBodyMap Terms of Service.
            </span>
          </label>

          {error && (
            <div style={{
              padding: '10px 12px',
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              borderRadius: 8,
              color: '#991B1B',
              fontSize: 13,
              marginBottom: 14,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleAccept}
            disabled={accepting}
            style={{
              width: '100%',
              background: accepting ? C.inkMute : C.forest,
              color: C.white,
              border: 'none',
              borderRadius: 12,
              padding: '14px 24px',
              fontSize: 15,
              fontWeight: 700,
              cursor: accepting ? 'wait' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {accepting ? 'Saving…' : 'Got it, take me back'}
          </button>

          <p style={{
            fontSize: 11,
            color: C.inkMute,
            margin: '14px 0 0',
            textAlign: 'center',
            lineHeight: 1.5,
          }}>
            This only appears once. Questions? Email support@mybodymap.app
          </p>
        </div>
      </div>
    </div>
  );
}
