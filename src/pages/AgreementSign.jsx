// src/pages/AgreementSign.jsx
//
// Standalone agreement e-signature page. Reached via a token-bearing
// link emailed/texted by the therapist from Settings 4.3 → Client
// Agreement → "Send for signature."
//
// Flow:
//   1. Therapist clicks "Send for signature" in the agreement editor
//   2. Picks a client (or types a new name + contact)
//   3. We mint a token, save a row in agreement_send_requests
//   4. Email/SMS goes out with link: /agreement-sign/{token}
//   5. Client opens link, reads the agreement (rendered with their
//      therapist's branding + live percentages), types their name
//      in the signature field, taps "Sign and submit"
//   6. We record the signature on the matching client + send a
//      confirmation back to the therapist
//
// This page is unauthenticated, the token IS the auth.

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AgreementRenderer } from '../components/PracticeAgreement';
import { renderAgreementForClient, DEFAULT_PRACTICE_AGREEMENT } from '../lib/practiceAgreement';

const C = {
  forest: '#2A5741',
  forestInk: '#1F3A2C',
  amber: '#B87840',
  amberDeep: '#9A6230',
  amberLine: '#D4B070',
  paperEdge: '#F5EFE0',
  ink: '#1F2937',
  inkSoft: '#1A2A22',
  gray: '#6B7280',
  line: '#E5E7EB',
  paper: '#FFFFFF',
  saved: '#16A34A',
};

export default function AgreementSign() {
  // The route can come in as /agreement-sign/:token (the long
  // backward-compat path) OR /s/:code (the short friendly path).
  // useParams returns whichever is matched.
  const { token, code } = useParams();
  const lookupKey = token || code;
  const lookupColumn = token ? 'token' : 'short_code';
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(null);
  const [therapist, setTherapist] = useState(null);
  const [error, setError] = useState(null);
  const [typedName, setTypedName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Look up the send request by whichever identifier the
        // URL provided. Both columns are unique-indexed.
        const { data: reqData, error: reqErr } = await supabase
          .from('agreement_send_requests')
          .select('*')
          .eq(lookupColumn, lookupKey)
          .single();
        if (reqErr || !reqData) {
          if (mounted) setError('This signature link is invalid or has expired.');
          if (mounted) setLoading(false);
          return;
        }
        if (reqData.signed_at) {
          if (mounted) setSubmitted(true);
          if (mounted) setTypedName(reqData.signed_by_name || '');
        }
        if (mounted) setRequest(reqData);

        // Look up the therapist who sent it
        const { data: tData, error: tErr } = await supabase
          .from('therapists')
          .select('id, business_name, full_name, email, phone, practice_agreement_text, cancellation_policy, cancellation_policy_enabled, custom_url')
          .eq('id', reqData.therapist_id)
          .single();
        if (tErr || !tData) {
          if (mounted) setError('Could not load therapist details. Please contact your therapist for help.');
          if (mounted) setLoading(false);
          return;
        }
        if (mounted) setTherapist(tData);
        if (mounted) setTypedName(prev => prev || reqData.client_name || '');
      } catch (e) {
        if (mounted) setError('Something went wrong loading this page. Please try again or contact your therapist.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [lookupKey, lookupColumn]);

  async function submit() {
    if (!typedName.trim() || !request || !therapist) return;
    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      // Snapshot the resolved text (with live percentages) so the
      // signed record matches what the client saw.
      const resolved = renderAgreementForClient(
        therapist.practice_agreement_text || DEFAULT_PRACTICE_AGREEMENT,
        therapist
      );

      // Mark the request signed. Use the row id (always present)
      // instead of token (only present in one of the two URL shapes).
      await supabase
        .from('agreement_send_requests')
        .update({
          signed_at: nowIso,
          signed_by_name: typedName.trim(),
          signed_text_snapshot: resolved,
          signed_user_agent: (navigator.userAgent || '').slice(0, 300),
        })
        .eq('id', request.id);

      // If a client_id is attached, stamp the signature on that client
      // record so future bookings know they've signed.
      if (request.client_id) {
        await supabase.from('clients').update({
          practice_agreement_signed_at: nowIso,
          practice_agreement_signer_name: typedName.trim(),
          practice_agreement_text_snapshot: resolved,
        }).eq('id', request.client_id);
      }

      // Notify therapist that the client signed. Fire-and-forget; the
      // signature is already recorded, the email is purely a
      // courtesy notification.
      supabase.functions.invoke('notify-agreement-signed', {
        body: {
          send_request_id: request.id,
          therapist_id: therapist.id,
          signer_name: typedName.trim(),
          signed_at: nowIso,
        },
      }).catch(e => console.error('[notify-agreement-signed] threw:', e));

      setSubmitted(true);
    } catch (e) {
      console.error('[AgreementSign] submit failed:', e);
      alert('Could not submit your signature. Please try again or contact your therapist.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: C.gray, fontFamily: 'system-ui, sans-serif' }}>
        Loading your agreement…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 480, margin: '60px auto', padding: 30, background: '#fff', borderRadius: 14, fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Unable to load this page</div>
        <div style={{ fontSize: 14, color: C.gray, lineHeight: 1.6 }}>{error}</div>
      </div>
    );
  }

  const text = therapist?.practice_agreement_text || DEFAULT_PRACTICE_AGREEMENT;
  const rendered = renderAgreementForClient(text, therapist);
  const businessName = therapist?.business_name || therapist?.full_name || '';
  const monogram = businessName.split(/\s+/).map(w => w[0]?.toUpperCase()).slice(0, 2).join('');

  return (
    <div style={{ background: C.paperEdge, minHeight: '100vh', padding: '24px 16px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ background: C.paper, borderRadius: 12, overflow: 'hidden', boxShadow: '0 12px 36px rgba(31,58,44,0.10)' }}>
          {/* Therapist-branded header */}
          <div style={{
            background: `linear-gradient(180deg, ${C.forestInk} 0%, ${C.forest} 100%)`,
            color: '#fff',
            padding: '24px 28px 22px',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: `linear-gradient(90deg, ${C.amber} 0%, ${C.amberDeep} 50%, ${C.amber} 100%)`,
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 46, height: 46, borderRadius: '50%',
                border: `1.5px solid rgba(255,255,255,0.35)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700,
                background: 'rgba(255,255,255,0.05)', flexShrink: 0,
              }}>
                {monogram || '·'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 20, fontWeight: 700, lineHeight: 1.15 }}>
                  {businessName || 'Your Practice'}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 5, fontFamily: 'system-ui, sans-serif' }}>
                  Client Agreement and Informed Consent
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{
            padding: '24px 30px 28px',
            fontFamily: 'Georgia, serif',
            color: C.inkSoft,
            fontSize: 14,
            lineHeight: 1.75,
          }}>
            <AgreementRenderer text={rendered} />
          </div>

          {/* Signature panel */}
          <div style={{
            background: '#FAF6EE',
            borderTop: `2px double ${C.amberLine}`,
            padding: '24px 30px 28px',
            fontFamily: 'system-ui, sans-serif',
          }}>
            {submitted ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 46, height: 46, borderRadius: '50%',
                  background: '#DCFCE7', color: C.saved,
                  fontSize: 24, fontWeight: 700, marginBottom: 12,
                }}>✓</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
                  Thank you, {typedName.split(/\s+/)[0] || 'your signature is recorded'}.
                </div>
                <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.6 }}>
                  Your therapist has been notified. You can close this page.
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.amberDeep, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Sign to agree
                </div>
                <p style={{ margin: '0 0 14px', fontSize: 13.5, color: C.ink, lineHeight: 1.65 }}>
                  By typing your full legal name below and tapping <strong>Sign and submit</strong>, you confirm that you have read and understood this agreement, that your consent is informed and voluntary, and that you agree to all of its terms. Typing your name has the same legal effect as a handwritten signature under the ESIGN Act.
                </p>
                <input
                  type="text"
                  value={typedName}
                  onChange={e => setTypedName(e.target.value)}
                  placeholder="Type your full legal name"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: `1.5px solid ${C.line}`,
                    borderRadius: 10,
                    fontSize: 16,
                    fontFamily: 'Georgia, serif',
                    fontStyle: 'italic',
                    color: C.ink,
                    boxSizing: 'border-box',
                    marginBottom: 14,
                    outline: 'none',
                  }}
                  onFocus={e => { e.target.style.borderColor = C.forest; }}
                  onBlur={e => { e.target.style.borderColor = C.line; }}
                />
                <button
                  onClick={submit}
                  disabled={!typedName.trim() || submitting}
                  style={{
                    width: '100%',
                    background: typedName.trim() && !submitting ? C.forest : '#D1D5DB',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '14px',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: typedName.trim() && !submitting ? 'pointer' : 'not-allowed',
                    boxShadow: typedName.trim() && !submitting ? `0 4px 12px ${C.forest}33` : 'none',
                  }}
                >
                  {submitting ? 'Submitting…' : 'Sign and submit'}
                </button>
                <div style={{ fontSize: 11, color: C.gray, textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
                  Need a copy for your records? Take a screenshot of this page before signing, or ask your therapist for a PDF.
                </div>
              </>
            )}
          </div>

          {/* Therapist-specific footer */}
          <div style={{ background: C.paperEdge, padding: '14px 30px 16px', fontSize: 10, color: C.gray, textAlign: 'center', borderTop: `1px solid ${C.line}`, fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, color: C.inkSoft, marginBottom: 3, letterSpacing: '0.02em' }}>
              {businessName}
            </div>
            {(therapist?.email || therapist?.phone) && (
              <div style={{ marginBottom: 6 }}>
                {therapist.email}{therapist.email && therapist.phone ? ' · ' : ''}{therapist.phone}
              </div>
            )}
            <div style={{ fontSize: 9, color: '#9CA3AF', letterSpacing: '0.06em' }}>
              Based on ABMP and AMTA professional standards
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
