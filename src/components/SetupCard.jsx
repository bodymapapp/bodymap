import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Setup block for the booking detail view: Send intake (Email / SMS) and the
// practice agreement. After a send, each row shows a hard, persistent
// confirmation (green "Sent (time)" badge) instead of a transient toast. The
// sent state is read back from intake_send_requests / agreement_send_requests
// on mount so it survives a reload.
//
// HK Jun 2 2026: extracted from DetailPanel so the slide-over and the desktop
// page left box use one wired source.
//
// Props:
//   appt, therapist, clientRow - booking + people context
//   notify(msg)                - toast callback, used for FAILURES only
//   showLabel                  - render an uppercase "Setup" header (left box)
//   wrapperStyle               - override the outer card style
function fmtSent(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return time;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

export default function SetupCard({
  appt,
  therapist,
  clientRow,
  notify = () => {},
  showLabel = false,
  wrapperStyle = null,
}) {
  const [sendingIntake, setSendingIntake] = useState(false);
  const [sendingAgreement, setSendingAgreement] = useState(false);
  const [intakeSentAt, setIntakeSentAt] = useState(null);
  const [agreementSentAt, setAgreementSentAt] = useState(null);
  // When a row is already confirmed sent, the pills are replaced by the green
  // badge. "Resend" reveals the pills again without losing the confirmation.
  const [resendIntake, setResendIntake] = useState(false);
  const [resendAgreement, setResendAgreement] = useState(false);

  // Read back the most recent send so the confirmation persists across reloads.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (appt?.id) {
        const { data } = await supabase
          .from('intake_send_requests')
          .select('created_at')
          .eq('booking_id', appt.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (alive && data && data[0]) setIntakeSentAt(data[0].created_at);
      }
      if (clientRow?.id) {
        const { data: ag } = await supabase
          .from('agreement_send_requests')
          .select('sent_at, created_at')
          .eq('client_id', clientRow.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (alive && ag && ag[0]) setAgreementSentAt(ag[0].sent_at || ag[0].created_at);
      }
    })();
    return () => { alive = false; };
  }, [appt?.id, clientRow?.id]);

  async function sendIntake(channel) {
    if (sendingIntake) return;
    if (!clientRow?.id || !therapist?.id) {
      notify('Open this booking again after the client record loads');
      return;
    }
    setSendingIntake(channel);
    try {
      const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
      const codeBytes = crypto.getRandomValues(new Uint8Array(7));
      const shortCode = Array.from(codeBytes)
        .map(b => alphabet[b % alphabet.length])
        .join('');
      const { data: req, error: insErr } = await supabase
        .from('intake_send_requests')
        .insert({
          short_code: shortCode,
          therapist_id: therapist.id,
          therapist_slug: therapist.custom_url,
          client_id: clientRow.id,
          client_name: clientRow.name || null,
          client_email: clientRow.email || null,
          client_phone: clientRow.phone || null,
          booking_id: appt.id,
        })
        .select('short_code')
        .single();
      if (insErr) throw insErr;
      const link = `${window.location.origin}/i/${req.short_code || shortCode}`;
      const firstNameLocal = (appt.client || clientRow.name || '').split(' ')[0] || 'there';
      const messageBody = `Hi ${firstNameLocal}! Please fill your intake form before your session: ${link}`;
      if (channel === 'email') {
        if (clientRow.email) {
          try {
            const { data: fnData, error: fnErr } = await supabase.functions.invoke('send-intake-email', {
              body: {
                short_code: req.short_code || shortCode,
                therapist_id: therapist.id,
                client_email: clientRow.email,
                client_name: appt.client || clientRow.name || null,
                link,
              },
            });
            if (fnErr || !fnData?.ok) {
              const detail = fnErr?.message || fnData?.error || 'email delivery failed';
              console.error('[sendIntake email]', detail);
              try { await navigator.clipboard.writeText(link); } catch (_) {}
              notify('Email did not send. Link copied so you can paste it.');
              return;
            }
          } catch (e) {
            console.error('[sendIntake email] threw:', e);
            try { await navigator.clipboard.writeText(link); } catch (_) {}
            notify('Email did not send. Link copied so you can paste it.');
            return;
          }
        }
        try { await navigator.clipboard.writeText(link); } catch (_e) {}
        setIntakeSentAt(new Date().toISOString());
        setResendIntake(false);
      } else if (channel === 'sms') {
        const phone = clientRow.phone || '';
        const body = encodeURIComponent(messageBody);
        setIntakeSentAt(new Date().toISOString());
        setResendIntake(false);
        window.location.href = `sms:${phone}&body=${body}`;
      }
    } catch (e) {
      console.error('[sendIntake]', e);
      notify('Could not create intake link, try again');
    } finally {
      setSendingIntake(false);
    }
  }

  async function sendAgreement(channel) {
    if (sendingAgreement) return;
    if (!clientRow?.id || !therapist?.id) {
      notify('Open this booking again after the client record loads');
      return;
    }
    setSendingAgreement(channel);
    try {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
      const codeBytes = crypto.getRandomValues(new Uint8Array(7));
      const shortCode = Array.from(codeBytes)
        .map(b => alphabet[b % alphabet.length])
        .join('');
      const { data: req, error: insErr } = await supabase
        .from('agreement_send_requests')
        .insert({
          token,
          short_code: shortCode,
          therapist_id: therapist.id,
          client_id: clientRow.id,
          client_name: clientRow.name || null,
          client_email: clientRow.email || null,
          client_phone: clientRow.phone || null,
        })
        .select('id, short_code, token')
        .single();
      if (insErr) throw insErr;
      const link = `${window.location.origin}/s/${req.short_code || shortCode}`;
      if (channel === 'email') {
        if (clientRow.email) {
          try {
            const { data: fnData, error: fnErr } = await supabase.functions.invoke('send-agreement-email', {
              body: {
                short_code: req.short_code || shortCode,
                therapist_id: therapist.id,
                client_email: clientRow.email,
                client_name: clientRow.name || null,
                link,
              },
            });
            if (fnErr || !fnData?.ok) {
              const detail = fnErr?.message || fnData?.error || 'email delivery failed';
              console.error('[sendAgreement email]', detail);
              try { await navigator.clipboard.writeText(link); } catch (_) {}
              notify('Email did not send. Link copied so you can paste it.');
              return;
            }
          } catch (e) {
            console.error('[sendAgreement email] threw:', e);
            try { await navigator.clipboard.writeText(link); } catch (_) {}
            notify('Email did not send. Link copied so you can paste it.');
            return;
          }
        }
        try { await navigator.clipboard.writeText(link); } catch (_e) {}
        setAgreementSentAt(new Date().toISOString());
        setResendAgreement(false);
      } else if (channel === 'sms') {
        const phone = clientRow.phone || '';
        const body = encodeURIComponent(`Hi ${(appt.client || clientRow.name || '').split(' ')[0] || 'there'}! Please sign your practice agreement: ${link}`);
        setAgreementSentAt(new Date().toISOString());
        setResendAgreement(false);
        window.location.href = `sms:${phone}&body=${body}`;
      }
    } catch (e) {
      console.error('[sendAgreement]', e);
      notify('Could not send agreement, try again');
    } finally {
      setSendingAgreement(false);
    }
  }

  if (appt.preview || !clientRow) return null;

  // HK Jun 2 2026: both rows always render. Each turns into a green
  // confirmation when done (intake received / agreement signed) or sent,
  // rather than disappearing.
  const intakeReceived = appt.status !== 'pending-intake';
  const agreementSigned = !!clientRow.practice_agreement_signed_at;

  const clientEmail = appt.email || clientRow?.email || '';
  const clientPhone = appt.client_phone || appt.phone || clientRow?.phone || '';
  const hasEmail = !!clientEmail;
  const hasPhone = !!clientPhone;

  const rowStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: '8px 0', flexWrap: 'wrap',
  };
  const labelStyle = {
    display: 'flex', alignItems: 'center', gap: 7,
    fontSize: 13, fontWeight: 600, color: '#1F4030',
    flexShrink: 0,
  };
  const pillRow = { display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' };

  const pill = (label, icon, onClick, disabled) => {
    const sharedStyle = {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '6px 12px', borderRadius: 999,
      background: disabled ? '#F4F4F4' : '#fff',
      border: `1px solid ${disabled ? '#E5E7EB' : '#C8D5BC'}`,
      color: disabled ? '#9CA3AF' : '#2A5741',
      fontSize: 12, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit',
    };
    return (
      <button key={label} type="button" onClick={disabled ? undefined : onClick} disabled={disabled} style={sharedStyle}>
        <span style={{ fontSize: 11 }}>{icon}</span>{label}
      </button>
    );
  };

  // Green confirmation badge, shared by Sent and Signed states.
  const confirmBadge = (text) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 700, color: '#1F6F43',
      background: '#E6F2E9', padding: '5px 12px', borderRadius: 999,
      border: '1px solid #B7D8BF',
    }}>
      <span style={{ fontSize: 12 }}>✓</span>{text}
    </span>
  );

  const resendLink = (onClick) => (
    <button type="button" onClick={onClick}
      style={{ background: 'none', border: 'none', color: '#94A39A', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '0 2px', textDecoration: 'underline' }}>
      Resend
    </button>
  );

  const noContact = <span style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>No contact on file</span>;

  const box = wrapperStyle || {
    marginTop: 10,
    padding: '4px 12px',
    background: '#FAFAF7',
    border: '1px solid #EAE5DA',
    borderRadius: 10,
  };

  // Intake row: sent (badge + resend) vs not sent (pills).
  const intakeSent = !!intakeSentAt && !resendIntake;
  // Agreement row: signed (badge) vs sent (badge + resend) vs not sent (pills).
  const agreementSent = !!agreementSentAt && !resendAgreement;

  return (
    <div style={box}>
      {showLabel && (
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Setup</div>
      )}

      {/* Intake row: received (green) / sent (green + resend) / pills */}
      <div style={{ ...rowStyle, borderBottom: '1px solid #EFEAE0' }}>
        <div style={labelStyle}>
          <span>📝</span>
          <span>{intakeReceived ? 'Intake' : 'Send intake'}</span>
        </div>
        {intakeReceived ? (
          confirmBadge('Intake received')
        ) : intakeSent ? (
          <div style={pillRow}>
            {confirmBadge(`Sent ${fmtSent(intakeSentAt)}`)}
            {(hasEmail || hasPhone) && resendLink(() => setResendIntake(true))}
          </div>
        ) : !hasEmail && !hasPhone ? (
          noContact
        ) : (
          <div style={pillRow}>
            {pill('Email', '📧', hasEmail ? () => sendIntake('email') : null, !hasEmail || sendingIntake === 'email')}
            {pill('SMS', '💬', hasPhone ? () => sendIntake('sms') : null, !hasPhone || sendingIntake === 'sms')}
          </div>
        )}
      </div>

      <div style={rowStyle}>
        <div style={labelStyle}>
          <span>✍️</span>
          <span>{agreementSigned ? 'Practice agreement' : 'Send practice agreement'}</span>
        </div>
        {agreementSigned ? (
          confirmBadge(`Signed ${new Date(clientRow.practice_agreement_signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`)
        ) : agreementSent ? (
          <div style={pillRow}>
            {confirmBadge(`Sent ${fmtSent(agreementSentAt)}`)}
            {(hasEmail || hasPhone) && resendLink(() => setResendAgreement(true))}
          </div>
        ) : !hasEmail && !hasPhone ? (
          noContact
        ) : (
          <div style={pillRow}>
            {pill(sendingAgreement === 'email' ? 'Sending…' : 'Email', '📧', () => sendAgreement('email'), !hasEmail || sendingAgreement === 'email')}
            {pill(sendingAgreement === 'sms' ? 'Sending…' : 'SMS', '💬', () => sendAgreement('sms'), !hasPhone || sendingAgreement === 'sms')}
          </div>
        )}
      </div>
    </div>
  );
}
