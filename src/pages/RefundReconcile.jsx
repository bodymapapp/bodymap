// src/pages/RefundReconcile.jsx
//
// Phase 14.3e (HK May 17 2026): founder ops tool to reconcile
// session_payments rows whose Stripe charges have been refunded
// outside the platform. Calls the backfill-stripe-refunds edge
// function and shows the result.
//
// Lives in FounderHub. NOT in user-facing Settings: this is an
// operational lever for the founder, not therapist-facing config.

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const C = {
  forest: '#2A5741',
  forestDeep: '#1F4030',
  cream: '#FAF5EE',
  text: '#1F2937',
  muted: '#6B7280',
  light: '#E5E7EB',
  green: '#16A34A',
  red: '#DC2626',
  redLight: '#FEE2E2',
  amber: '#D97706',
};

export function RefundReconcileEmbedded() {
  // Therapists list for the selector. Founder may need to reconcile
  // for any therapist on the platform.
  const [therapists, setTherapists] = useState([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('therapists')
        .select('id, business_name, email')
        .eq('stripe_account_connected', true)
        .order('business_name', { ascending: true });
      setTherapists(data || []);
      // Default to Joy Therapist (the test account) for convenience.
      const joy = (data || []).find(t => t.id === '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf');
      if (joy) setSelectedTherapistId(joy.id);
    })();
  }, []);

  async function runBackfill() {
    if (!selectedTherapistId) return;
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/backfill-stripe-refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({ therapist_id: selectedTherapistId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || data.detail || `HTTP ${res.status}`);
      }
      setResult(data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setRunning(false);
    }
  }

  const selectedTherapist = therapists.find(t => t.id === selectedTherapistId);

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ fontSize: 14, color: C.muted, marginBottom: 18, lineHeight: 1.6, maxWidth: 600 }}>
        Reconciles session_payments rows whose Stripe charges have been refunded
        outside the platform (Stripe Dashboard, API, etc). Scans up to 500
        succeeded rows for the chosen therapist, asks Stripe whether each was
        refunded, and flips matching rows to status='refunded'. Idempotent.
        Safe to re-run.
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
          Therapist
        </div>
        <select
          value={selectedTherapistId}
          onChange={(e) => setSelectedTherapistId(e.target.value)}
          style={{
            width: '100%', maxWidth: 480,
            padding: '10px 12px',
            border: `1.5px solid ${C.light}`,
            borderRadius: 10,
            fontSize: 14, color: C.text,
            background: '#fff',
            outline: 'none',
          }}>
          <option value="">Select a therapist...</option>
          {therapists.map(t => (
            <option key={t.id} value={t.id}>
              {t.business_name || t.email} - {t.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={runBackfill}
        disabled={!selectedTherapistId || running}
        style={{
          background: (!selectedTherapistId || running) ? C.muted : `linear-gradient(135deg, ${C.forestDeep}, ${C.forest})`,
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: '12px 22px',
          fontSize: 14,
          fontWeight: 700,
          cursor: (!selectedTherapistId || running) ? 'not-allowed' : 'pointer',
          opacity: (!selectedTherapistId || running) ? 0.6 : 1,
        }}>
        {running ? 'Reconciling...' : 'Run reconcile'}
      </button>

      {result && (
        <div style={{
          marginTop: 20,
          padding: '14px 18px',
          background: '#F0FDF4',
          border: `1.5px solid #86EFAC`,
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 8 }}>
            Reconcile complete
          </div>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
            {selectedTherapist?.business_name || 'Therapist'}:
            scanned <strong>{result.scanned}</strong> succeeded payments,
            flipped <strong>{result.refunded}</strong> to refunded
            {result.errors && result.errors.length > 0 && (
              <>, with <strong>{result.errors.length}</strong> errors</>
            )}.
          </div>
          {result.errors && result.errors.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ fontSize: 12, color: C.amber, cursor: 'pointer', fontWeight: 600 }}>
                Show {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
              </summary>
              <pre style={{
                marginTop: 8, fontSize: 11, color: C.text,
                background: '#fff', padding: 10, borderRadius: 6,
                overflowX: 'auto', maxHeight: 200,
              }}>
                {JSON.stringify(result.errors, null, 2)}
              </pre>
            </details>
          )}
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
            Refresh the therapist's Billing tab to see the updated hero + refunds list.
          </div>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 20,
          padding: '14px 18px',
          background: C.redLight,
          border: '1.5px solid #FCA5A5',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 4 }}>
            Reconcile failed
          </div>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5, fontFamily: 'monospace' }}>
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
