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

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280', light:'#E8E4DC', success:'#10B981' };

export default function QuickSendModal({ template, therapist, recipients: passedRecipients, onClose, onSent }) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [recipients, setRecipients] = useState(passedRecipients || null);
  const [loading, setLoading] = useState(!passedRecipients);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

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
      const res = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-outreach-batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            template_id: template.id,
            therapist_id: therapist.id,
          }),
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
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
    }}>
      {/* Modal body. Backdrop click does NOT close (input fields
          present), explicit X required. Per existing modal pattern
          in this codebase. */}
      <div onClick={e => e.stopPropagation()} style={{
        background:C.white, borderRadius:16, padding:'20px 22px 22px',
        maxWidth:640, width:'100%', maxHeight:'90vh', overflowY:'auto',
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
          <div style={{ padding:'24px 0' }}>
            <div style={{ fontSize:48, textAlign:'center', marginBottom:12 }}>✓</div>
            <div style={{ fontFamily:'Georgia, serif', fontSize:20, fontWeight:700, color:C.dark, textAlign:'center', marginBottom:8 }}>
              Sent {result.sent} email{result.sent === 1 ? '' : 's'}
            </div>
            {(result.skipped_recent > 0 || result.skipped_unsubscribed > 0 || result.failed > 0) && (
              <div style={{ fontSize:13, color:C.gray, textAlign:'center', lineHeight:1.6 }}>
                {result.skipped_recent > 0 && <div>Skipped {result.skipped_recent} (received this template recently)</div>}
                {result.skipped_unsubscribed > 0 && <div>Skipped {result.skipped_unsubscribed} (unsubscribed)</div>}
                {result.failed > 0 && <div style={{ color:'#B91C1C' }}>{result.failed} failed</div>}
              </div>
            )}
            <button onClick={handleClose} style={{
              display:'block', margin:'18px auto 0', background:C.forest, color:C.white,
              border:'none', borderRadius:10, padding:'11px 22px', fontSize:14, fontWeight:700, cursor:'pointer',
            }}>
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Recipient count banner */}
            <div style={{
              background: loading ? '#F9FAFB' : (recipients?.length === 0 ? '#FEF3C7' : '#F0FDF4'),
              border: `1.5px solid ${loading ? C.light : (recipients?.length === 0 ? '#FCD34D' : '#86EFAC')}`,
              borderRadius:10, padding:'11px 14px', marginBottom:16, fontSize:13, fontWeight:600,
              color: loading ? C.gray : (recipients?.length === 0 ? '#78350F' : '#166534'),
            }}>
              {loading
                ? 'Loading recipients...'
                : recipients.length === 0
                  ? 'No clients match this audience right now.'
                  : `Will send to ${recipients.length} client${recipients.length === 1 ? '' : 's'}`}
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
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                disabled={sending}
                rows={10}
                style={{
                  width:'100%', padding:'10px 12px', border:`1.5px solid ${C.light}`, borderRadius:10,
                  fontSize:13, color:C.dark, outline:'none', boxSizing:'border-box',
                  fontFamily:'system-ui', lineHeight:1.6, resize:'vertical',
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
