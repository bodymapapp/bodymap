// src/pages/IntakeRedirect.jsx
//
// HK May 31 2026: short-link landing page for intake forms.
//
// The therapist hits "Send intake → SMS/Email" from the side panel.
// Instead of putting a 200+ character URL in the message, we save a
// row in intake_send_requests with a short 7-char code, and put a
// short URL in the message:  https://mybodymap.app/i/<code>
//
// When the client opens that link, this page runs. It looks up the
// row by short_code, reads the therapist slug + client name + email
// + booking_id, and 302-redirects to the actual intake form with the
// fields prefilled. Looks the same as the long-URL approach to the
// client; just doesn't make the therapist look unprofessional in
// chat.
//
// Mirrors the /s/:code pattern used by agreement signing
// (AgreementSign.jsx).

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function IntakeRedirect() {
  const { code } = useParams();
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code) {
        setError('Missing link code.');
        return;
      }
      // Look up the request. RLS allows anonymous read by short_code
      // since these are deliberately-shared short tokens (same model
      // as agreement signing).
      const { data, error: dbErr } = await supabase
        .from('intake_send_requests')
        .select('therapist_slug, client_name, client_email, booking_id')
        .eq('short_code', code)
        .maybeSingle();
      if (cancelled) return;
      if (dbErr || !data) {
        setError('This link is no longer valid. Ask your therapist to send a new one.');
        return;
      }
      const params = new URLSearchParams();
      if (data.client_name) params.set('name', data.client_name);
      if (data.client_email) params.set('email', data.client_email);
      if (data.booking_id) params.set('booking_id', data.booking_id);
      const url = `/${data.therapist_slug}?${params.toString()}`;
      // 302-style replace so the short URL doesn't sit in history.
      window.location.replace(url);
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div style={{
        padding: 40, maxWidth: 480, margin: '40px auto',
        textAlign: 'center', fontFamily: 'system-ui, sans-serif',
        color: '#2A5741', background: '#FAF5EE', borderRadius: 12,
      }}>
        <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'Georgia, serif' }}>Link expired</h2>
        <p style={{ marginTop: 12, fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>{error}</p>
      </div>
    );
  }
  // Default: blank, redirect happens immediately
  return null;
}
