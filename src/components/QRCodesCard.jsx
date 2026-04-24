// src/components/QRCodesCard.jsx
// Three QR code panels in Settings: digital intake, booking link, and a custom link
// the therapist can paste themselves (their own website, social page, anything).
// Print-friendly, downloadable, mobile-responsive.

import React, { useState } from 'react';

// Display a small preview (240px) but download the high-res version (800px)
// so therapists can print up to 8 inches square without pixelation.
const QR_API_PREVIEW = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=';
const QR_API_HIRES = 'https://api.qrserver.com/v1/create-qr-code/?size=800x800&margin=30&data=';

function QRPanel({ title, subtitle, url, filename, businessName, C2, highlighted = false, children }) {
  const previewSrc = url ? `${QR_API_PREVIEW}${encodeURIComponent(url)}` : null;
  const hiresSrc = url ? `${QR_API_HIRES}${encodeURIComponent(url)}` : null;
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const copy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  // Reliable download that works on iPhone Safari (which ignores the `download`
  // attribute on cross-origin links). Fetches the image as a Blob, creates a
  // same-origin object URL, then triggers download via a hidden link.
  const download = async () => {
    if (!hiresSrc || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(hiresSrc);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e) {
      // Fallback: open in new tab so user can long-press and Save Image
      window.open(hiresSrc, '_blank');
    }
    setDownloading(false);
  };

  // Print-ready window with business name, QR at full size, and the URL below.
  // Uses window.print() so AirPrint / any printer works.
  const printQR = () => {
    if (!hiresSrc) return;
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>${title} QR Code</title>
  <style>
    @media print {
      @page { margin: 0.5in; }
      body { margin: 0; }
      .no-print { display: none; }
    }
    body {
      font-family: Georgia, serif;
      text-align: center;
      padding: 40px 20px;
      color: #1F2937;
    }
    h1 { font-size: 24px; margin: 0 0 8px; }
    .subtitle { font-size: 14px; color: #6B7280; margin: 0 0 32px; font-style: italic; }
    img { max-width: 500px; width: 100%; height: auto; display: block; margin: 0 auto 20px; }
    .url { font-family: monospace; font-size: 13px; color: #6B7280; word-break: break-all; }
    .cta { font-size: 18px; margin-top: 28px; font-weight: 700; color: #2A5741; }
    button {
      background: #2A5741; color: white; border: none; padding: 12px 28px;
      border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <h1>${businessName || 'Scan to Continue'}</h1>
  <p class="subtitle">${subtitle}</p>
  <img src="${hiresSrc}" alt="QR code" />
  <p class="url">${url}</p>
  <p class="cta">Scan with your phone camera</p>
  <button class="no-print" onclick="window.print()">🖨️ Print</button>
</body>
</html>`);
    w.document.close();
    // Auto-open print dialog after image loads
    w.onload = () => setTimeout(() => w.print(), 300);
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

      {previewSrc ? (
        <>
          <div style={{ background: '#fff', padding: 8, borderRadius: 10, border: `1px solid ${C2.lightGray}`, marginBottom: 14 }}>
            <img src={previewSrc} alt="QR code" style={{ width: 160, height: 160, display: 'block' }} />
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
          <div style={{ display: 'flex', gap: 6, width: '100%', marginBottom: 6 }}>
            <button
              onClick={copy}
              style={{
                flex: 1,
                background: copied ? C2.forest : C2.sage,
                color: '#fff',
                border: 'none',
                padding: '9px 8px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
            <button
              onClick={download}
              disabled={downloading}
              style={{
                flex: 1,
                background: C2.beige,
                border: `1.5px solid ${C2.lightGray}`,
                color: C2.darkGray,
                padding: '9px 8px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: downloading ? 'wait' : 'pointer',
              }}
            >
              {downloading ? '…' : '⬇️ Save'}
            </button>
          </div>
          <button
            onClick={printQR}
            style={{
              width: '100%',
              background: 'transparent',
              border: `1.5px solid ${C2.lightGray}`,
              color: C2.darkGray,
              padding: '9px 10px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🖨️ Print
          </button>
          <p style={{ fontSize: 10, color: C2.gray, margin: '8px 0 0', lineHeight: 1.4 }}>
            Downloads as 800×800 PNG. Prints sharp at any size.
          </p>
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

export default function QRCodesCard({ intakeUrl, bookingUrl, businessName, C2 }) {
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
          subtitle="Your modern digital intake"
          url={intakeUrl}
          filename="bodymap-intake-qr.png"
          businessName={businessName}
          C2={C2}
          highlighted
        />

        <QRPanel
          title="Booking Page"
          subtitle="For new clients booking a session"
          url={bookingUrl}
          filename="bodymap-booking-qr.png"
          businessName={businessName}
          C2={C2}
        />

        <QRPanel
          title="Custom Link"
          subtitle="Your website, social page, anything"
          url={normalizedCustom}
          filename="bodymap-custom-qr.png"
          businessName={businessName}
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
