import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

// Setup block for the booking detail view: Send intake (Email / SMS) and
// the practice agreement (send pills, or a "Signed (date)" badge when the
// client has already signed).
//
// HK Jun 2 2026: extracted verbatim from DetailPanel so the slide-over and
// the desktop page left box render the exact same wired block. The intake +
// agreement sends live here once (single source of truth), instead of being
// duplicated across the two layouts.
//
// Props:
//   appt, therapist, clientRow - the booking + people context
//   notify(msg)                - toast callback (defaults to a no-op)
//   showLabel                  - render an uppercase "Setup" header (left box)
//   wrapperStyle               - override the outer card style (left box uses
//                                the white card; slide-over uses the compact
//                                cream box by default)
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
        notify(`Intake sent to ${clientRow.email}`);
      } else if (channel === 'sms') {
        const phone = clientRow.phone || '';
        const body = encodeURIComponent(messageBody);
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
        notify(`Agreement sent to ${clientRow.email}`);
      } else if (channel === 'sms') {
        const phone = clientRow.phone || '';
        const body = encodeURIComponent(`Hi ${(appt.client || clientRow.name || '').split(' ')[0] || 'there'}! Please sign your practice agreement: ${link}`);
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

  const showIntakeSend = appt.status === 'pending-intake';
  const agreementSigned = !!clientRow.practice_agreement_signed_at;
  // If intake is done AND agreement is signed, nothing actionable here.
  if (!showIntakeSend && agreementSigned) return null;

  const clientEmail = appt.email || clientRow?.email || '';
  const clientPhone = appt.client_phone || appt.phone || clientRow?.phone || '';
  const hasEmail = !!clientEmail;
  const hasPhone = !!clientPhone;

  const pill = (label, icon, href, onClick, disabled) => {
    const sharedStyle = {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '6px 10px', borderRadius: 999,
      background: disabled ? '#F4F4F4' : '#fff',
      border: `1px solid ${disabled ? '#E5E7EB' : '#C8D5BC'}`,
      color: disabled ? '#9CA3AF' : '#2A5741',
      fontSize: 12, fontWeight: 600,
      textDecoration: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit',
    };
    if (href && !disabled) {
      return <a key={label} href={href} style={sharedStyle}><span style={{ fontSize: 11 }}>{icon}</span>{label}</a>;
    }
    return (
      <button key={label} type="button" onClick={disabled ? undefined : onClick} disabled={disabled} style={sharedStyle}>
        <span style={{ fontSize: 11 }}>{icon}</span>{label}
      </button>
    );
  };

  const rowStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: '8px 0', flexWrap: 'wrap',
  };
  const labelStyle = {
    display: 'flex', alignItems: 'center', gap: 7,
    fontSize: 13, fontWeight: 600, color: '#1F4030',
    flexShrink: 0,
  };
  const pillRow = {
    display: 'flex', gap: 6, flexShrink: 0,
  };

  const signedDate = agreementSigned
    ? new Date(clientRow.practice_agreement_signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  const box = wrapperStyle || {
    marginTop: 10,
    padding: '4px 12px',
    background: '#FAFAF7',
    border: '1px solid #EAE5DA',
    borderRadius: 10,
  };

  return (
    <div style={box}>
      {showLabel && (
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Setup</div>
      )}
      {showIntakeSend && (
        <div style={{ ...rowStyle, borderBottom: !agreementSigned ? '1px solid #EFEAE0' : 'none' }}>
          <div style={labelStyle}>
            <span>📝</span>
            <span>Send intake</span>
          </div>
          {!hasEmail && !hasPhone ? (
            <span style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>No contact on file</span>
          ) : (
            <div style={pillRow}>
              {pill('Email', '📧', null, hasEmail ? () => sendIntake('email') : null, !hasEmail || !!sendingIntake)}
              {pill('SMS', '💬', null, hasPhone ? () => sendIntake('sms') : null, !hasPhone || !!sendingIntake)}
            </div>
          )}
        </div>
      )}
      {agreementSigned ? (
        <div style={rowStyle}>
          <div style={labelStyle}>
            <span>✍️</span>
            <span>Agreement</span>
          </div>
          <span style={{
            fontSize: 12, fontWeight: 600, color: '#2A5741',
            background: '#EEF3EE', padding: '4px 10px', borderRadius: 999,
            border: '1px solid #C8D5BC',
          }}>
            ✓ Signed {signedDate}
          </span>
        </div>
      ) : (
        <div style={rowStyle}>
          <div style={labelStyle}>
            <span>✍️</span>
            <span>Send agreement</span>
          </div>
          {!hasEmail && !hasPhone ? (
            <span style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>No contact on file</span>
          ) : (
            <div style={pillRow}>
              {pill(
                sendingAgreement === 'email' ? 'Sending…' : 'Email',
                '📧',
                null,
                () => sendAgreement('email'),
                !hasEmail || sendingAgreement === 'email'
              )}
              {pill(
                sendingAgreement === 'sms' ? 'Sending…' : 'SMS',
                '💬',
                null,
                () => sendAgreement('sms'),
                !hasPhone || sendingAgreement === 'sms'
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
