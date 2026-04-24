import React from 'react';
import { supabase } from '../lib/supabase';

// ── Notification taxonomy ────────────────────────────────────────────────
const CLIENT_NOTIFICATIONS = [
  {
    key: 'booking_confirmation',
    name: 'Booking confirmation',
    desc: 'Sent right after a client books.',
    channels: ['email', 'sms'],
  },
  {
    key: 'reminder_24h',
    name: '24-hour reminder',
    desc: 'Day before the session, with intake link.',
    channels: ['email', 'sms'],
  },
  {
    key: 'post_session',
    name: 'After the session',
    desc: 'Thank-you with your note and a link to rebook.',
    channels: ['email', 'sms'],
  },
  {
    key: 'rebooking_nudge',
    name: 'Rebooking nudge',
    desc: 'Gentle reminder when a regular hasn\'t been back in a while.',
    channels: ['email', 'sms'],
  },
];

const THERAPIST_NOTIFICATIONS = [
  {
    key: 'new_booking',
    name: 'New booking came in',
    desc: 'Right when a client books with you.',
    channels: ['email', 'app_alert', 'sms'],
  },
  {
    key: 'intake_filled',
    name: 'Client filled their intake',
    desc: 'So you know they\'re ready.',
    channels: ['email', 'app_alert', 'sms'],
  },
  {
    key: 'gift_purchased',
    name: 'Gift card purchased',
    desc: 'When someone buys a gift card for your practice.',
    channels: ['email', 'app_alert', 'sms'],
  },
  {
    key: 'daily_pulse',
    name: 'Daily practice pulse',
    desc: 'One summary email every evening.',
    channels: ['email'],
  },
];

const CHANNEL_LABELS = {
  email: { label: 'Email', icon: '✉️' },
  sms: { label: 'Text', icon: '💬' },
  app_alert: { label: 'App alert', icon: '🔔' },
};

// Default prefs if none loaded yet
const DEFAULT_PREFS = {
  client: {
    booking_confirmation: { email: true, sms: false },
    reminder_24h:         { email: true, sms: false },
    post_session:         { email: true, sms: false },
    rebooking_nudge:      { email: false, sms: false },
  },
  therapist: {
    new_booking:    { email: true, app_alert: true, sms: false },
    intake_filled:  { email: true, app_alert: true, sms: false },
    gift_purchased: { email: true, app_alert: true, sms: false },
    daily_pulse:    { email: true },
  },
};

export default function NotificationPrefsCard({ therapist, C2 }) {
  const [prefs, setPrefs] = React.useState(therapist?.notification_prefs || DEFAULT_PREFS);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const twilioConnected = !!(
    therapist?.twilio_account_sid && therapist?.twilio_auth_token && therapist?.twilio_phone_number
  );

  async function toggle(audience, key, channel) {
    const next = JSON.parse(JSON.stringify(prefs));
    if (!next[audience][key]) next[audience][key] = {};
    next[audience][key][channel] = !next[audience][key]?.[channel];
    setPrefs(next);
    setSaving(true);
    await supabase.from('therapists').update({ notification_prefs: next }).eq('id', therapist.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  function Toggle({ on, disabled, onClick }) {
    return (
      <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        aria-label={on ? 'On' : 'Off'}
        style={{
          width: 34, height: 20, borderRadius: 10,
          background: disabled ? '#F3F4F6' : (on ? C2.forest : '#D1D5DB'),
          border: 'none',
          position: 'relative',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'background 0.2s',
          flexShrink: 0,
          padding: 0,
        }}
      >
        <div style={{
          position: 'absolute',
          top: 2, left: on ? 16 : 2,
          width: 16, height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }} />
      </button>
    );
  }

  function renderSection(audience, items, title, subtitle) {
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C2.darkGray, marginBottom: 4, fontFamily: 'Georgia, serif' }}>{title}</div>
        <div style={{ fontSize: 12, color: C2.gray, marginBottom: 14, lineHeight: 1.5 }}>{subtitle}</div>
        <div style={{ background: '#FAFAF7', border: `1px solid ${C2.lightGray}`, borderRadius: 10, overflow: 'hidden' }}>
          {items.map((item, i) => (
            <div key={item.key} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 14px',
              borderBottom: i < items.length - 1 ? `1px solid ${C2.lightGray}` : 'none',
              flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C2.darkGray, marginBottom: 2 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: C2.gray, lineHeight: 1.4 }}>{item.desc}</div>
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                {item.channels.map(ch => {
                  const meta = CHANNEL_LABELS[ch];
                  const smsDisabled = ch === 'sms' && !twilioConnected;
                  const isOn = !!prefs?.[audience]?.[item.key]?.[ch];
                  return (
                    <div key={ch} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 46 }}
                         title={smsDisabled ? 'Connect Twilio below to enable text messages' : ''}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: smsDisabled ? '#9CA3AF' : C2.gray, letterSpacing: '0.04em' }}>{meta.label}</span>
                      <Toggle on={isOn && !smsDisabled} disabled={smsDisabled} onClick={() => toggle(audience, item.key, ch)} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C2.white, border: `1.5px solid ${C2.lightGray}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.gray, margin: '0 0 6px 0' }}>🔔 Notifications</p>
          <p style={{ fontSize: 13, color: C2.darkGray, lineHeight: 1.6, margin: 0, fontFamily: 'Georgia, serif' }}>
            Choose how your clients hear from you — and how you hear about them.
          </p>
        </div>
        {saved && <span style={{ fontSize: 11, color: C2.forest, fontWeight: 700 }}>✓ Saved</span>}
      </div>

      {!twilioConnected && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', marginTop: 12, marginBottom: 18, fontSize: 12, color: '#78350F', lineHeight: 1.5 }}>
          <strong>Text messages are off until you connect Twilio.</strong> Scroll to the "SMS Outreach" card below to set it up. Once connected, text toggles become available.
        </div>
      )}
      {twilioConnected && (
        <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, padding: '10px 14px', marginTop: 12, marginBottom: 18, fontSize: 12, color: '#166534', lineHeight: 1.5 }}>
          ✓ Twilio connected · Text messages enabled.
        </div>
      )}

      {renderSection(
        'client',
        CLIENT_NOTIFICATIONS,
        'Your clients',
        'What your clients get from you. Text messages only go to clients who agreed at booking.'
      )}

      {renderSection(
        'therapist',
        THERAPIST_NOTIFICATIONS,
        'You',
        'What lands on your phone, email, or inbox.'
      )}

      <p style={{ fontSize: 11, color: C2.gray, lineHeight: 1.5, margin: '14px 0 0' }}>
        <strong>App alert</strong> = a tap on your phone when you have MyBodyMap installed to your home screen. Works without Twilio.
      </p>
    </div>
  );
}
