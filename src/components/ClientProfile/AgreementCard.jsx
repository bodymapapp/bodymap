// src/components/ClientProfile/AgreementCard.jsx
//
// HK May 15 2026: 'once the client agreement is signed, it should
// show up as a signed document in the dashboard under client. Did
// you not already add it?'
//
// Surfaces the signature data we already capture: signer name,
// timestamp, snapshot of the exact text the client agreed to. The
// write side has been live since cf560b0f but I never wired up the
// read side. Fixing that now.
//
// Three states this card can be in:
//
//   1. SIGNED: client.practice_agreement_signed_at is set. Show a
//      green panel with checkmark, signer name, when, and a "View
//      signed agreement" button that expands the snapshot text in
//      a scrollable block.
//
//   2. SENT BUT NOT SIGNED: there is a pending row in
//      agreement_send_requests with no signed_at yet. Show an
//      amber panel with the sent date and a "Resend" link plus a
//      "Copy link" action.
//
//   3. NOT SENT YET: no signature, no pending send. Show a quiet
//      "No agreement on file" with a "Send for signature" button
//      that opens the standard send flow.

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const C = {
  forest:    '#2A5741',
  amberPale: '#FAF6EE',
  amberLine: '#D4B070',
  amberDeep: '#9A6230',
  ink:       '#1F2937',
  gray:      '#6B7280',
  line:      '#E5E7EB',
  saved:     '#16A34A',
  paper:     '#FFFFFF',
};

export default function AgreementCard({ client, therapist }) {
  const [pendingSend, setPendingSend] = useState(null);
  const [loadingPending, setLoadingPending] = useState(true);
  const [showSignedText, setShowSignedText] = useState(false);
  const [resendCopied, setResendCopied] = useState(false);
  // Phase 19+ (HK May 18 2026): inline generate-link flow. When the
  // therapist taps Send for signature on a client with no pending
  // send, this component now creates the agreement_send_requests
  // row and surfaces the link inline (with copy + email actions),
  // instead of redirecting to /dashboard/settings (which was the
  // old behavior; HK reported this was confusing because Settings
  // has its own client picker the therapist would have to re-do).
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);

  const isSigned = !!client?.practice_agreement_signed_at;
  const signerName = client?.practice_agreement_signer_name || null;
  const signedAt = client?.practice_agreement_signed_at || null;
  const snapshot = client?.practice_agreement_text_snapshot || '';

  useEffect(() => {
    // Look up the most recent pending send_request for this client
    // so we can show 'sent but unsigned' state with a resend option.
    // Only loads when not already signed (no point checking).
    if (isSigned || !client?.id) {
      setLoadingPending(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('agreement_send_requests')
          .select('id, short_code, token, sent_at, signed_at, client_email')
          .eq('client_id', client.id)
          .is('signed_at', null)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (mounted) setPendingSend(data || null);
      } catch (e) { /* non-blocking */ }
      finally { if (mounted) setLoadingPending(false); }
    })();
    return () => { mounted = false; };
  }, [client?.id, isSigned]);

  function copyPendingLink() {
    if (!pendingSend) return;
    const link = pendingSend.short_code
      ? `${window.location.origin}/s/${pendingSend.short_code}`
      : `${window.location.origin}/agreement-sign/${pendingSend.token}`;
    navigator.clipboard.writeText(link).then(() => {
      setResendCopied(true);
      setTimeout(() => setResendCopied(false), 2000);
    });
  }

  // Generate a signing link for THIS client and persist it. Same
  // mechanic as Settings > PracticeAgreement > SendForSignaturePanel,
  // but client is already known so no picker is needed. After success,
  // the existing pendingSend useEffect refreshes and the card surfaces
  // the link with Copy and Email actions.
  async function generateLink() {
    if (!client?.id) {
      setGenerateError('Client record missing. Refresh and try again.');
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    try {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
      const codeBytes = crypto.getRandomValues(new Uint8Array(7));
      const shortCode = Array.from(codeBytes)
        .map(b => alphabet[b % alphabet.length])
        .join('');

      const { data, error: insErr } = await supabase
        .from('agreement_send_requests')
        .insert({
          token,
          short_code: shortCode,
          therapist_id: therapist.id,
          client_id: client.id,
          client_name: client.name || null,
          client_email: client.email || null,
          client_phone: client.phone || null,
        })
        .select('id, short_code, token, sent_at, signed_at, client_email')
        .single();
      if (insErr) throw insErr;

      // Surface immediately by setting pendingSend (no need to refetch).
      setPendingSend(data);

      // Fire-and-forget email delivery via edge function. Same path
      // as the Settings flow. Failure is non-blocking; the therapist
      // can still copy the link manually.
      if (client.email) {
        const link = `${window.location.origin}/s/${shortCode}`;
        supabase.functions.invoke('send-agreement-email', {
          body: {
            short_code: shortCode,
            therapist_id: therapist.id,
            client_email: client.email,
            client_name: client.name || null,
            link,
          },
        }).then(({ error: fnErr }) => {
          if (fnErr) console.error('[send-agreement-email] failed:', fnErr);
        }).catch(e => {
          console.error('[send-agreement-email] threw:', e);
        });
      }
    } catch (e) {
      console.error('[AgreementCard] generateLink failed:', e);
      setGenerateError('Could not create the signing link. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  function formatSignedDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch { return iso; }
  }

  if (loadingPending) {
    return (
      <div style={{ padding: '14px 4px', color: C.gray, fontSize: 13 }}>
        Loading agreement status...
      </div>
    );
  }

  // STATE 1: Signed
  if (isSigned) {
    return (
      <div style={{ padding: '4px 4px 6px' }}>
        <div style={{
          background: '#F0FDF4',
          border: '1.5px solid #BBF7D0',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: showSignedText ? 10 : 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#DCFCE7',
              color: C.saved,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {'\u2713'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#065F46', fontFamily: 'Georgia, serif' }}>
                Signed on file
              </div>
              <div style={{ fontSize: 12, color: '#047857', marginTop: 2, lineHeight: 1.5 }}>
                {signerName ? <><strong>{signerName}</strong> signed </> : 'Signed '}
                on {formatSignedDate(signedAt)}.
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowSignedText(v => !v)}
              style={{
                background: '#fff',
                border: `1px solid #BBF7D0`,
                color: '#065F46',
                borderRadius: 8,
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {showSignedText ? 'Hide signed text' : 'View signed text'}
            </button>
            <button
              onClick={() => window.print()}
              style={{
                background: 'transparent',
                border: 'none',
                color: C.gray,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '7px 6px',
                textDecoration: 'underline',
              }}
            >
              Print this record
            </button>
          </div>
        </div>

        {showSignedText && snapshot && (
          <div style={{
            background: C.paper,
            border: `1px solid ${C.line}`,
            borderRadius: 10,
            padding: '14px 16px',
            maxHeight: 380,
            overflowY: 'auto',
            fontFamily: 'Georgia, serif',
            fontSize: 13,
            lineHeight: 1.65,
            color: C.ink,
            whiteSpace: 'pre-wrap',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'system-ui, sans-serif' }}>
              Agreement text at time of signing
            </div>
            {snapshot}
          </div>
        )}

        {showSignedText && !snapshot && (
          <div style={{
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 12.5,
            color: '#78350F',
            lineHeight: 1.5,
          }}>
            We have a signature record but no snapshot of the agreement text. This can happen for early signatures captured before snapshotting was wired in. The signer name and timestamp above are still valid.
          </div>
        )}
      </div>
    );
  }

  // STATE 2: Sent but unsigned
  if (pendingSend) {
    return (
      <div style={{ padding: '4px 4px 6px' }}>
        <div style={{
          background: C.amberPale,
          border: `1.5px solid ${C.amberLine}`,
          borderRadius: 12,
          padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#FEF3C7',
              color: C.amberDeep,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {'\u2026'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.amberDeep, fontFamily: 'Georgia, serif' }}>
                Waiting for signature
              </div>
              <div style={{ fontSize: 12, color: '#78350F', marginTop: 2, lineHeight: 1.5 }}>
                Sent on {formatSignedDate(pendingSend.sent_at)}.
                {pendingSend.client_email && <> Emailed to <strong>{pendingSend.client_email}</strong>.</>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={copyPendingLink}
              style={{
                background: resendCopied ? C.saved : C.forest,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {resendCopied ? '\u2713 Copied' : 'Copy signing link'}
            </button>
            <a
              href={`/dashboard/settings`}
              style={{
                background: 'transparent',
                border: `1px solid ${C.line}`,
                color: C.ink,
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Send a new link
            </a>
          </div>
          <div style={{ fontSize: 11, color: C.gray, marginTop: 10, lineHeight: 1.5 }}>
            If they have not received the email, the spam folder is the usual culprit. You can also share the link directly via text.
          </div>
        </div>
      </div>
    );
  }

  // STATE 3: No agreement on file
  return (
    <div style={{ padding: '4px 4px 6px' }}>
      <div style={{
        background: '#FAFAFA',
        border: `1px dashed ${C.line}`,
        borderRadius: 12,
        padding: '16px 18px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 13, color: C.gray, marginBottom: 8, fontStyle: 'italic' }}>
          No signed agreement on file yet.
        </div>
        <div style={{ fontSize: 12, color: C.gray, marginBottom: 12, lineHeight: 1.55 }}>
          Send a signing link now, or the client will sign automatically at their next intake.
        </div>
        {generateError && (
          <div style={{
            background: '#FEE2E2',
            border: '1px solid #FCA5A5',
            borderRadius: 8,
            padding: '7px 10px',
            fontSize: 12,
            color: '#991B1B',
            marginBottom: 10,
            lineHeight: 1.5,
          }}>
            {generateError}
          </div>
        )}
        <button
          onClick={generateLink}
          disabled={generating || !client?.id}
          style={{
            display: 'inline-block',
            background: generating ? '#9CA3AF' : C.forest,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: generating ? 'wait' : 'pointer',
          }}
        >
          {generating ? 'Generating...' : 'Send for signature'}
        </button>
      </div>
    </div>
  );
}
