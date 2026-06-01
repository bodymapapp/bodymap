// src/components/QuickSendModal.jsx
//
// Modal that opens when therapist taps a quick-send block. Shows:
//   - Audience name + recipient count
//   - Editable subject line
//   - Editable body (textarea, plain text + smart tokens)
//   - Rich preview rendered with one actual recipient's name
//   - Smart token reference legend
//   - Send button (with confirmation if recipient count > 50)
//
// The therapist's edits are persisted to the template row on save
// so subsequent uses of the same block remember the edits. To
// revert to the original wording, use "Reset to default" from the
// block's "..." menu.
//
// Send flow:
//   1. Persist edits to outreach_templates row
//   2. POST to send-outreach-batch edge function with template_id
//   3. Edge function does re-send protection, calls Resend per
//      recipient, writes outreach_quicksend_sends rows, returns summary
//   4. Show toast: "Sent N. Skipped M (already received recently)."

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { renderTokens, AUDIENCE_LABELS } from '../lib/outreachQuicksend';
import CloseButton from './CloseButton';
import AutoGrowingTextarea from './AutoGrowingTextarea';

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280', light:'#E8E4DC', success:'#10B981' };

export default function QuickSendModal({ template, therapist, recipients: passedRecipients, onClose, onSent }) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [recipients, setRecipients] = useState(passedRecipients || null);
  const [loading, setLoading] = useState(!passedRecipients);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [showRecipientList, setShowRecipientList] = useState(false);

  // Load recipients if not passed in. Block-level click already
  // computed this; modal-level fetch is a fallback for direct
  // opens (e.g. from menu).
  React.useEffect(() => {
    if (passedRecipients) return;
    let cancelled = false;
    (async () => {
      const { getAudienceRecipients } = await import('../lib/outreachQuicksend');
      const recs = await getAudienceRecipients(template.audience_preset, therapist.id);
      if (cancelled) return;
      setRecipients(recs);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [template.audience_preset, therapist.id, passedRecipients]);

  const previewRecipient = recipients && recipients.length > 0 ? recipients[0] : { first_name: 'Sarah' };
  const renderedSubject = renderTokens(subject, previewRecipient, therapist);
  const renderedBody = renderTokens(body, previewRecipient, therapist);

  async function handleSend() {
    if (!recipients || recipients.length === 0) return;

    if (recipients.length > 50) {
      const ok = window.confirm(`Send to ${recipients.length} clients? This is a large batch and will go out over the next minute or two.`);
      if (!ok) return;
    }

    setSending(true);
    setError('');

    // Step 1: persist edits to the template row so the block
    // remembers them next time the therapist opens it.
    const { error: updErr } = await supabase
      .from('outreach_templates')
      .update({
        subject,
        body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', template.id)
      .eq('therapist_id', therapist.id);

    if (updErr) {
      setSending(false);
      setError(`Could not save template edits: ${updErr.message}`);
      return;
    }

    // Step 2: POST to send-outreach-batch edge function
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // For the custom-send path, recipients were chosen explicitly
      // by the therapist in CustomClientPicker and passed in via
      // props. The edge function would otherwise recompute recipients
      // from template.audience_preset, which for the custom anchor
      // is 'custom_selection' (a no-op preset that returns nothing).
      // Pass override_recipient_ids so the edge function uses our
      // chosen list. Also pass override_subject/body in case the
      // edits to the anchor row got swallowed by a race.
      const isCustomSend = !!passedRecipients;
      const requestBody = {
        template_id: template.id,
        therapist_id: therapist.id,
      };
      if (isCustomSend) {
        requestBody.override_recipient_ids = recipients.map(r => r.id);
        requestBody.override_subject = subject;
        requestBody.override_body = body;
      }

      const res = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-outreach-batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await res.json();
      setSending(false);

      if (!res.ok || data.error) {
        setError(data.error || `Send failed (HTTP ${res.status})`);
        return;
      }

      setResult({
        sent: data.sent || 0,
        skipped_recent: data.skipped_recent || 0,
        skipped_unsubscribed: data.skipped_unsubscribed || 0,
        failed: data.failed || 0,
      });
    } catch (e) {
      setSending(false);
      setError(`Send failed: ${e.message || String(e)}`);
    }
  }

  // Modal-level close handler: only allow if not sending
  function handleClose() {
    if (sending) return;
    if (result && onSent) onSent();
    onClose();
  }

  return (
    <div onClick={handleClose} style={{
      position:'fixed', inset:0, background:'rgba(15,23,42,0.55)', zIndex:9999,
      display:'flex',
      alignItems:'flex-start',
      justifyContent:'center',
      padding:16,
      paddingTop: 'max(16px, env(safe-area-inset-top, 0px))',
      paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      {/* Modal body. Backdrop click does NOT close (input fields
          present), explicit X required. Per existing modal pattern
          in this codebase. */}
      <div onClick={e => e.stopPropagation()} style={{
        background:C.white, borderRadius:16, padding:'20px 22px 22px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 22px)',
        maxWidth:640, width:'100%',
        maxHeight: 'calc(100dvh - 32px)',
        overflowY:'auto',
        WebkitOverflowScrolling: 'touch',
        boxShadow:'0 12px 40px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>Quick send</div>
            <div style={{ fontFamily:'Georgia, serif', fontSize:20, fontWeight:700, color:C.dark }}>{template.label}</div>
            <div style={{ fontSize:12, color:C.gray, marginTop:2 }}>
              Audience: {AUDIENCE_LABELS[template.audience_preset] || template.audience_preset}
            </div>
          </div>
          <CloseButton onClick={handleClose} label="Cancel" disabled={sending} />
        </div>

        {result ? (
          <div style={{ padding:'8px 0 4px' }}>
            {/* Hero: refined icon + tight headline. Not a giant 48px
                checkmark which read as low-effort. Small filled
                sage circle, white check, paired with a Georgia
                serif headline. HK May 23 2026 redesign for stronger
                visual confirmation. */}
            <div style={{
              display:'flex', alignItems:'center', gap:14,
              padding:'4px 0 18px',
              borderBottom:`1px solid ${C.light}`,
              marginBottom:18,
            }}>
              <div style={{
                width:42, height:42, borderRadius:'50%',
                background:C.forest,
                display:'flex', alignItems:'center', justifyContent:'center',
                flexShrink:0,
                boxShadow:'0 2px 8px rgba(42,87,65,0.25)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'Georgia, serif', fontSize:20, fontWeight:700, color:C.dark, lineHeight:1.2 }}>
                  Message sent
                </div>
                <div style={{ fontSize:13, color:C.gray, marginTop:3 }}>
                  {result.sent === 1
                    ? `Delivered to ${recipients?.[0]?.first_name || 'your client'}`
                    : `Delivered to ${result.sent} clients`}
                </div>
              </div>
            </div>

            {/* What went out: receipt-style card. Concrete content
                builds trust. The therapist sees the actual subject
                they sent, not just a number. */}
            <div style={{
              background:'#FAFAF6',
              border:`1px solid ${C.light}`,
              borderRadius:12,
              padding:'14px 16px',
              marginBottom:16,
            }}>
              <div style={{
                fontSize:11, fontWeight:600, color:C.gray,
                textTransform:'uppercase', letterSpacing:'0.07em',
                marginBottom:6,
              }}>
                Subject line
              </div>
              <div style={{
                fontSize:14.5, fontWeight:600, color:C.dark,
                lineHeight:1.4,
                overflow:'hidden', textOverflow:'ellipsis',
                display:'-webkit-box',
                WebkitLineClamp:2,
                WebkitBoxOrient:'vertical',
              }}>
                {subject || '(no subject)'}
              </div>
            </div>

            {/* Skipped/failed: only render when there are any.
                Quiet, low-contrast, no scary red unless real fail. */}
            {(result.skipped_recent > 0 || result.skipped_unsubscribed > 0 || result.failed > 0) && (
              <div style={{
                fontSize:12.5, color:C.gray, lineHeight:1.7,
                padding:'12px 14px',
                background:'#FFF8E7',
                border:'1px solid #FCE7B5',
                borderRadius:10,
                marginBottom:16,
              }}>
                {result.skipped_recent > 0 && (
                  <div>
                    <strong style={{ color:'#92400E' }}>{result.skipped_recent} skipped</strong> (received this template recently)
                  </div>
                )}
                {result.skipped_unsubscribed > 0 && (
                  <div>
                    <strong style={{ color:'#92400E' }}>{result.skipped_unsubscribed} skipped</strong> (unsubscribed)
                  </div>
                )}
                {result.failed > 0 && (
                  <div>
                    <strong style={{ color:'#B91C1C' }}>{result.failed} failed</strong> to send. Check your settings or try again.
                  </div>
                )}
              </div>
            )}

            {/* Actions: two clear options. Primary closes & returns
                to outreach for next send. Secondary closes silently. */}
            <div style={{
              display:'flex',
              gap:10,
              flexWrap:'wrap',
            }}>
              <button onClick={handleClose} style={{
                flex:1,
                minWidth:140,
                background:C.forest,
                color:C.white,
                border:'none',
                borderRadius:10,
                padding:'12px 18px',
                fontSize:14,
                fontWeight:700,
                cursor:'pointer',
                boxShadow:'0 1px 3px rgba(42,87,65,0.2)',
              }}>
                Done
              </button>
            </div>

            {/* Subtle reassurance under the buttons. Builds trust in
                the system for the 70-year-old persona. */}
            <div style={{
              fontSize:11.5,
              color:C.gray,
              textAlign:'center',
              marginTop:14,
              lineHeight:1.5,
            }}>
              You can review every send in Outreach history.
            </div>
          </div>
        ) : (
          <>
            {/* Recipient count banner + expandable list */}
            <div style={{
              background: loading ? '#F9FAFB' : (recipients?.length === 0 ? '#FEF3C7' : '#F0FDF4'),
              border: `1.5px solid ${loading ? C.light : (recipients?.length === 0 ? '#FCD34D' : '#86EFAC')}`,
              borderRadius:10, marginBottom:16,
              color: loading ? C.gray : (recipients?.length === 0 ? '#78350F' : '#166534'),
              overflow:'hidden',
            }}>
              <div
                onClick={() => {
                  if (loading || !recipients || recipients.length === 0) return;
                  setShowRecipientList(v => !v);
                }}
                style={{
                  padding:'11px 14px',
                  fontSize:13, fontWeight:600,
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'space-between',
                  cursor: (loading || !recipients || recipients.length === 0) ? 'default' : 'pointer',
                  userSelect:'none',
                }}
              >
                <span>
                  {loading
                    ? 'Loading recipients...'
                    : recipients.length === 0
                      ? 'No clients match this audience right now.'
                      : `Will send to ${recipients.length} client${recipients.length === 1 ? '' : 's'}`}
                </span>
                {!loading && recipients && recipients.length > 0 && (
                  <span style={{
                    fontSize:11,
                    fontWeight:600,
                    opacity:0.8,
                    display:'flex',
                    alignItems:'center',
                    gap:4,
                  }}>
                    {showRecipientList ? 'Hide' : 'View'}
                    <span style={{
                      display:'inline-block',
                      transform: showRecipientList ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition:'transform 0.15s ease',
                      fontSize:10,
                    }}>▾</span>
                  </span>
                )}
              </div>

              {showRecipientList && recipients && recipients.length > 0 && (
                <div style={{
                  borderTop:`1px solid ${recipients?.length === 0 ? '#FCD34D' : '#86EFAC'}`,
                  background:'rgba(255,255,255,0.55)',
                  maxHeight:240,
                  overflowY:'auto',
                  WebkitOverflowScrolling:'touch',
                }}>
                  {recipients.map((r, idx) => (
                    <div
                      key={r.client_id || r.email || idx}
                      style={{
                        padding:'9px 14px',
                        borderBottom: idx < recipients.length - 1 ? '1px solid rgba(22, 101, 52, 0.10)' : 'none',
                        display:'flex',
                        flexDirection:'column',
                        gap:2,
                      }}
                    >
                      <div style={{ fontSize:13, fontWeight:600, color:'#0F1F1A' }}>
                        {r.name || r.email || 'Unnamed client'}
                      </div>
                      {r.qualifying_label && (
                        <div style={{ fontSize:11.5, fontWeight:500, color:'#3F6B52', opacity:0.85 }}>
                          {r.qualifying_label}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subject */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:C.gray, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                disabled={sending}
                style={{
                  width:'100%', padding:'10px 12px', border:`1.5px solid ${C.light}`, borderRadius:10,
                  fontSize:14, color:C.dark, outline:'none', boxSizing:'border-box', fontFamily:'system-ui',
                }}
              />
            </div>

            {/* Body */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:C.gray, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Message</label>
              <AutoGrowingTextarea
                value={body}
                onChange={e => setBody(e.target.value)}
                disabled={sending}
                minRows={6}
                maxRows={16}
                style={{
                  border: `1.5px solid ${C.light}`,
                  fontSize: 13, color: C.dark,
                }}
              />
              <div style={{ fontSize:11, color:C.gray, marginTop:6, lineHeight:1.5 }}>
                Use {'{{first_name}}'}, {'{{therapist_name}}'}, {'{{rebook_link}}'} for personalization. They will be replaced for each recipient.
              </div>
            </div>

            {/* Rich preview */}
            {recipients && recipients.length > 0 && (
              <div style={{
                background:C.beige, border:`1px solid ${C.light}`, borderRadius:10,
                padding:'12px 14px', marginBottom:16,
              }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
                  Preview (showing as: {previewRecipient.name || previewRecipient.first_name})
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:8 }}>
                  {renderedSubject}
                </div>
                <div style={{ fontSize:13, color:C.dark, lineHeight:1.6, whiteSpace:'pre-wrap' }}>
                  {renderedBody}
                </div>
              </div>
            )}

            {error && (
              <div style={{
                background:'#FEE2E2', border:'1.5px solid #FCA5A5', borderRadius:10,
                padding:'10px 12px', marginBottom:14, fontSize:13, color:'#7F1D1D',
              }}>
                {error}
              </div>
            )}

            {/* Send + cancel */}
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={handleClose} disabled={sending} style={{
                background:'transparent', color:C.gray, border:`1.5px solid ${C.light}`, borderRadius:10,
                padding:'11px 18px', fontSize:14, fontWeight:600,
                cursor: sending ? 'not-allowed' : 'pointer',
              }}>
                Cancel
              </button>
              <button onClick={handleSend} disabled={sending || loading || !recipients || recipients.length === 0} style={{
                background: (sending || !recipients?.length) ? C.sage : C.forest, color:C.white,
                border:'none', borderRadius:10, padding:'11px 22px', fontSize:14, fontWeight:700,
                cursor: (sending || !recipients?.length) ? 'not-allowed' : 'pointer',
              }}>
                {sending ? 'Sending...' : recipients ? `Send to ${recipients.length}` : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
