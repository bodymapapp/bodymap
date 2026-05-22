// src/components/CustomQuickSendModal.jsx
//
// Custom Send flow (HK May 22 2026 Tier 1 item 3). Lets the
// therapist pick one or more specific clients and send them any
// message, without going through the audience-preset templates.
//
// Two-step UI:
//   Step 1: client picker with search. Tap chips toggle selection.
//   Step 2: subject + body composer with preview.
//
// On Send: uses the existing send-outreach-batch edge function with
// the new override_recipient_ids / override_subject / override_body
// parameters. The 'custom_anchor' template row anchors the call
// (the edge function needs SOME template_id for re-send protection
// and logging). That row's subject/body get overwritten with the
// content the therapist sent, so it's also the draft buffer for
// next time they open Custom Send.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ensureCustomAnchor } from '../lib/outreachQuicksend';

const C = {
  forest: '#2A5741', sage: '#6B9E80', cream: '#F5F0E8',
  ink: '#1A1A2E', gray: '#6B7280', light: '#E8E4DC',
  white: '#FFFFFF', accent: '#C9A84C', red: '#DC2626',
  greenSoft: '#F0FDF4', greenBorder: '#86EFAC',
};

export default function CustomQuickSendModal({ therapist, onClose, onSent }) {
  const [step, setStep] = useState(1); // 1 = picker, 2 = composer
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [anchorId, setAnchorId] = useState(null);

  // Load all clients on mount + draft from previous Custom Send
  useEffect(() => {
    if (!therapist?.id) return;
    let cancelled = false;
    (async () => {
      const id = await ensureCustomAnchor(therapist.id);
      if (cancelled) return;
      setAnchorId(id);

      // Preload draft (subject + body from last custom send)
      const { data: anchor } = await supabase
        .from('outreach_templates')
        .select('subject, body')
        .eq('id', id)
        .maybeSingle();
      if (!cancelled && anchor) {
        setSubject(anchor.subject || '');
        setBody(anchor.body || '');
      }

      // Load clients with email (no email = cannot custom-send)
      const { data } = await supabase
        .from('clients')
        .select('id, name, email, phone, unsubscribed_at')
        .eq('therapist_id', therapist.id)
        .not('email', 'is', null)
        .is('unsubscribed_at', null)
        .order('name', { ascending: true });
      if (cancelled) return;
      setClients(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [therapist?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c => {
      const name = (c.name || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [clients, search]);

  function toggle(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearAll() { setSelectedIds(new Set()); }
  function selectAllVisible() {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const c of filtered) next.add(c.id);
      return next;
    });
  }

  async function handleSend() {
    if (!anchorId || selectedIds.size === 0) return;
    setSending(true);
    setError('');

    // Persist the draft so it shows next time
    await supabase
      .from('outreach_templates')
      .update({ subject, body, updated_at: new Date().toISOString() })
      .eq('id', anchorId)
      .eq('therapist_id', therapist.id);

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
            template_id: anchorId,
            therapist_id: therapist.id,
            override_recipient_ids: Array.from(selectedIds),
            override_subject: subject,
            override_body: body,
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

  function handleClose() {
    if (sending) return;
    if (result && onSent) onSent();
    onClose();
  }

  return (
    <div onClick={handleClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, maxWidth: 640, width: '100%',
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${C.light}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: C.ink }}>
              {result ? 'Sent' : step === 1 ? 'Pick clients' : 'Write your message'}
            </div>
            <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
              {result ? 'Your custom message went out' : step === 1
                ? `${selectedIds.size} selected`
                : `${selectedIds.size} recipient${selectedIds.size === 1 ? '' : 's'}`}
            </div>
          </div>
          <button onClick={handleClose} disabled={sending} style={{
            background: 'transparent', border: 'none', fontSize: 22, color: C.gray,
            cursor: sending ? 'wait' : 'pointer', padding: 4, lineHeight: 1,
          }} aria-label="Close">×</button>
        </div>

        {/* Result */}
        {result && (
          <div style={{ padding: 24 }}>
            <div style={{
              background: C.greenSoft, border: `1.5px solid ${C.greenBorder}`,
              borderRadius: 10, padding: 14, fontSize: 13.5, color: '#14532D', lineHeight: 1.6,
            }}>
              <strong>Sent to {result.sent} client{result.sent === 1 ? '' : 's'}.</strong>
              {(result.skipped_recent > 0 || result.skipped_unsubscribed > 0 || result.failed > 0) && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#3F6650' }}>
                  {result.skipped_recent > 0 && <>Skipped {result.skipped_recent} (sent recently). </>}
                  {result.skipped_unsubscribed > 0 && <>Skipped {result.skipped_unsubscribed} (unsubscribed). </>}
                  {result.failed > 0 && <>Failed {result.failed}. </>}
                </div>
              )}
            </div>
            <button onClick={handleClose} style={{
              marginTop: 14, background: C.forest, color: '#fff', border: 'none',
              padding: '10px 22px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Done</button>
          </div>
        )}

        {/* Step 1: picker */}
        {!result && step === 1 && (
          <div style={{ padding: 16 }}>
            <input
              type="text"
              placeholder="Search by name or email"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: `1.5px solid ${C.light}`, fontSize: 14, fontFamily: 'inherit',
                boxSizing: 'border-box', marginBottom: 10,
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: 12 }}>
              <button onClick={selectAllVisible} style={{
                background: 'transparent', border: `1px solid ${C.light}`,
                color: C.forest, padding: '5px 12px', borderRadius: 999,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>Select all visible ({filtered.length})</button>
              {selectedIds.size > 0 && (
                <button onClick={clearAll} style={{
                  background: 'transparent', border: `1px solid ${C.light}`,
                  color: C.gray, padding: '5px 12px', borderRadius: 999,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>Clear ({selectedIds.size})</button>
              )}
            </div>
            <div style={{
              maxHeight: 360, overflowY: 'auto',
              border: `1px solid ${C.light}`, borderRadius: 10,
            }}>
              {loading ? (
                <div style={{ padding: 20, textAlign: 'center', color: C.gray, fontSize: 13 }}>Loading...</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: C.gray, fontSize: 13 }}>
                  {clients.length === 0
                    ? 'No clients with email on file. Add emails on the client profile to send messages.'
                    : 'No matches.'}
                </div>
              ) : (
                filtered.map(c => {
                  const selected = selectedIds.has(c.id);
                  return (
                    <div key={c.id} onClick={() => toggle(c.id)} style={{
                      padding: '10px 12px', borderBottom: `1px solid ${C.light}`,
                      display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer',
                      background: selected ? '#F0F9F4' : 'transparent',
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 6,
                        border: `2px solid ${selected ? C.forest : C.light}`,
                        background: selected ? C.forest : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {selected && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name || '(no name)'}
                        </div>
                        <div style={{ fontSize: 12, color: C.gray, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.email}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button onClick={handleClose} style={{
                background: 'transparent', border: `1.5px solid ${C.light}`, color: C.gray,
                padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={() => setStep(2)} disabled={selectedIds.size === 0} style={{
                background: selectedIds.size > 0 ? C.forest : C.light, color: '#fff', border: 'none',
                padding: '10px 22px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
              }}>Next: write message</button>
            </div>
          </div>
        )}

        {/* Step 2: composer */}
        {!result && step === 2 && (
          <div style={{ padding: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="A short subject line"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: `1.5px solid ${C.light}`, fontSize: 14, fontFamily: 'inherit',
                boxSizing: 'border-box', marginBottom: 14,
              }}
            />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
              Message
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={`Hi {{first_name}},\n\nWrite anything here. Use {{first_name}}, {{therapist_name}}, and {{rebook_link}} to personalize for each recipient.\n\nTake care,\n{{therapist_name}}`}
              rows={10}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: `1.5px solid ${C.light}`, fontSize: 14, fontFamily: 'inherit',
                boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.55,
              }}
            />
            <div style={{ fontSize: 11.5, color: C.gray, marginTop: 6, lineHeight: 1.5 }}>
              Personalization tokens: <code style={{ background: '#F5F0E8', padding: '1px 5px', borderRadius: 3 }}>{'{{first_name}}'}</code>, <code style={{ background: '#F5F0E8', padding: '1px 5px', borderRadius: 3 }}>{'{{therapist_name}}'}</code>, <code style={{ background: '#F5F0E8', padding: '1px 5px', borderRadius: 3 }}>{'{{rebook_link}}'}</code>. Each is replaced for every recipient.
            </div>
            {error && (
              <div style={{
                marginTop: 10, padding: 10, background: '#FEF2F2',
                border: '1px solid #FCA5A5', borderRadius: 8,
                fontSize: 12, color: '#991B1B',
              }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'space-between' }}>
              <button onClick={() => setStep(1)} disabled={sending} style={{
                background: 'transparent', border: `1.5px solid ${C.light}`, color: C.gray,
                padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                cursor: sending ? 'wait' : 'pointer',
              }}>← Back to pick</button>
              <button
                onClick={handleSend}
                disabled={sending || !subject.trim() || !body.trim() || selectedIds.size === 0}
                style={{
                  background: (sending || !subject.trim() || !body.trim()) ? C.sage : C.forest,
                  color: '#fff', border: 'none',
                  padding: '10px 22px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                  cursor: (sending || !subject.trim() || !body.trim()) ? 'not-allowed' : 'pointer',
                }}
              >
                {sending ? 'Sending...' : `Send to ${selectedIds.size}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
