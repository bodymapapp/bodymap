// src/components/QRCodesCard.jsx
// Three QR code panels in Settings: digital intake, booking link, and a custom link
// the therapist can paste themselves (their own website, social page, anything).
// Print-friendly, downloadable, mobile-responsive.

import React, { useState } from 'react';

const QR_API = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=';

function QRPanel({ title, subtitle, url, filename, C2, highlighted = false, children }) {
  const qrSrc = url ? `${QR_API}${encodeURIComponent(url)}` : null;
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <div style={{
      flex: 1,
      minWidth: 240,
      background: C2.white,
      border: `1.5px solid ${highlighted ? C2.sage : C2.lightGray}`,
      borderRadius: 14,
      padding: 18,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.gray, margin: '0 0 4px' }}>
        {title}
      </p>
      <p style={{ fontSize: 13, color: C2.darkGray, fontWeight: 600, margin: '0 0 14px', lineHeight: 1.4 }}>
        {subtitle}
      </p>

      {children /* optional input for custom panel */}

      {qrSrc ? (
        <>
          <div style={{ background: '#fff', padding: 8, borderRadius: 10, border: `1px solid ${C2.lightGray}`, marginBottom: 14 }}>
            <img src={qrSrc} alt="QR code" style={{ width: 160, height: 160, display: 'block' }} />
          </div>
          <div style={{
            width: '100%',
            background: '#FAFAF7',
            border: `1px solid ${C2.lightGray}`,
            borderRadius: 6,
            padding: '7px 10px',
            fontSize: 11,
            fontFamily: 'monospace',
            color: C2.darkGray,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: 10,
          }}>
            {url}
          </div>
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button
              onClick={copy}
              style={{
                flex: 1,
                background: copied ? C2.forest : C2.sage,
                color: '#fff',
                border: 'none',
                padding: '9px 10px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
            <a
              href={qrSrc}
              download={filename}
              style={{
                flex: 1,
                background: C2.beige,
                border: `1.5px solid ${C2.lightGray}`,
                color: C2.darkGray,
                padding: '9px 10px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              ⬇️ Download
            </a>
          </div>
        </>
      ) : (
        <div style={{
          width: 160,
          height: 160,
          border: `2px dashed ${C2.lightGray}`,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C2.gray,
          fontSize: 12,
          marginBottom: 14,
          textAlign: 'center',
          padding: 16,
        }}>
          Paste a link above to generate a QR code
        </div>
      )}
    </div>
  );
}

export default function QRCodesCard({ intakeUrl, bookingUrl, C2 }) {
  const [customInput, setCustomInput] = useState('');

  // Normalize the custom URL: add https:// if missing, trim whitespace
  const normalizedCustom = (() => {
    const v = customInput.trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    return `https://${v}`;
  })();

  return (
    <div style={{
      background: C2.white,
      border: `1.5px solid ${C2.lightGray}`,
      borderRadius: 14,
      padding: 24,
      marginBottom: 20,
    }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.gray, margin: '0 0 6px' }}>
          📱 QR Codes
        </p>
        <p style={{ fontSize: 13, color: C2.darkGray, lineHeight: 1.6, margin: 0, fontFamily: 'Georgia, serif' }}>
          Print these and place them at your table, front desk, or on your business card. Clients scan with their phone camera. No app needed.
        </p>
      </div>

      <div style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <QRPanel
          title="Intake Form"
          subtitle="For clients filling their body map"
          url={intakeUrl}
          filename="bodymap-intake-qr.png"
          C2={C2}
          highlighted
        />

        <QRPanel
          title="Booking Page"
          subtitle="For new clients booking a session"
          url={bookingUrl}
          filename="bodymap-booking-qr.png"
          C2={C2}
        />

        <QRPanel
          title="Custom Link"
          subtitle="Your website, social page, anything"
          url={normalizedCustom}
          filename="bodymap-custom-qr.png"
          C2={C2}
        >
          <input
            type="text"
            placeholder="yourwebsite.com"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 13,
              border: `1.5px solid ${C2.lightGray}`,
              borderRadius: 8,
              marginBottom: 14,
              fontFamily: 'system-ui',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </QRPanel>
      </div>
    </div>
  );
}
