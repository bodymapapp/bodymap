// src/components/DocumentDrawer.jsx
//
// Slide-in document panel. Replaces the previous "open in new tab"
// behavior on the journey timeline. Therapist taps a dot, drawer
// slides in over the session detail page showing the doc inline.
// From there: PDF, Email link, SMS link, Copy as image, Share image.
//
// Width: 560px on desktop, full-width on mobile (<768px).
// Backdrop: forest-tinted dim, click to close. ESC also closes.
//
// Image actions use html2canvas to rasterize the drawer body to PNG.
// - Copy as image: writes PNG to clipboard (Chrome/Edge/Safari).
// - Share as image: uses navigator.share with files (mobile share
//   sheet, iOS Safari + Android Chrome). Falls back to download
//   if not supported.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import html2canvas from 'html2canvas';

const C = {
  cream: '#F9F5EE',
  forest: '#1C2B22',
  sage: '#4A6B54',
  gold: '#C9A84C',
  goldBg: '#FAF3DC',
  ink: '#3D4F43',
  inkSoft: '#6B7F72',
  white: '#FFFFFF',
  lineFaint: '#E8E0D0',
  serif: "'Fraunces', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

function Toast({ message, type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  const isError = type === 'error';
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      background: isError ? '#7F1D1D' : C.forest, color: 'white',
      padding: '9px 16px', borderRadius: 8,
      fontSize: 13, fontWeight: 600,
      boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
      zIndex: 100, maxWidth: '90%',
      animation: 'bmDrawerToast 0.25s ease',
    }}>{message}</div>
  );
}

export default function DocumentDrawer({ open, onClose, docNumber, docName, docTotalParts = 4, fullPageUrl, client, therapist, children }) {
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const bodyRef = useRef(null);
  const drawerRef = useRef(null);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while drawer is open (NOT on html, per Android
  // scroll-lock fix from earlier). Use position:fixed on body which
  // is safe on iOS and Android.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [open]);

  // Focus the drawer when it opens for keyboard accessibility
  useEffect(() => {
    if (open && drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [open]);

  const therapistName = therapist?.business_name || therapist?.full_name || 'Your Practice';

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
  }, []);

  // ─── Action: print to PDF (scoped to drawer body) ───
  const handlePrint = () => {
    // Add a one-shot print class that hides everything except the
    // drawer body, lets the doc print cleanly without the session
    // detail page behind it.
    const styleTag = document.createElement('style');
    styleTag.id = 'bm-drawer-print-style';
    styleTag.innerHTML = `
      @media print {
        body > * { display: none !important; }
        .bm-drawer-print-active { display: block !important; position: absolute !important; inset: 0 !important; background: white !important; overflow: visible !important; }
        .bm-drawer-print-active * { visibility: visible !important; }
        .bm-drawer-print-hide { display: none !important; }
      }
    `;
    document.head.appendChild(styleTag);
    drawerRef.current?.classList.add('bm-drawer-print-active');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        drawerRef.current?.classList.remove('bm-drawer-print-active');
        document.getElementById('bm-drawer-print-style')?.remove();
      }, 500);
    }, 50);
  };

  // ─── Action: email link ───
  const handleEmail = () => {
    const isClient = docNumber === 4;
    const recipient = isClient && client?.email ? client.email : '';
    const subject = isClient
      ? `Your session summary from ${therapistName}`
      : `${docName} for ${client?.name || 'client'}`;
    const body = isClient
      ? `Your post-session summary is here: ${fullPageUrl}\n\nThanks for trusting ${therapistName} with your care.`
      : `${docName} link: ${fullPageUrl}`;
    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // ─── Action: SMS link (recap only) ───
  const handleSms = () => {
    if (!client?.phone) return;
    const body = `Your post-session summary from ${therapistName}: ${fullPageUrl}`;
    window.location.href = `sms:${client.phone}?&body=${encodeURIComponent(body)}`;
  };

  // ─── Helper: render drawer body to PNG blob ───
  const renderToBlob = async () => {
    if (!bodyRef.current) throw new Error('Drawer body not ready');
    const canvas = await html2canvas(bodyRef.current, {
      backgroundColor: C.cream,
      scale: 2, // retina-quality
      useCORS: true,
      logging: false,
    });
    return new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG render failed')), 'image/png');
    });
  };

  // ─── Action: copy as image to clipboard ───
  const handleCopyImage = async () => {
    setBusy('copy');
    try {
      if (!navigator.clipboard || !window.ClipboardItem) {
        throw new Error('Clipboard not supported. Use Share or Save as PDF.');
      }
      const blob = await renderToBlob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('Image copied. Paste it into your email or message.');
    } catch (err) {
      showToast(err.message || 'Could not copy image.', 'error');
    } finally {
      setBusy(null);
    }
  };

  // ─── Action: share as image (mobile native share sheet) ───
  const handleShareImage = async () => {
    setBusy('share');
    try {
      const blob = await renderToBlob();
      const fileName = `${docName.replace(/\s+/g, '-').toLowerCase()}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: docName,
          text: docNumber === 4 ? `Your session summary from ${therapistName}` : docName,
        });
      } else {
        // Fallback: download the image so the therapist can attach manually
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Image downloaded. Attach it to your message.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        showToast(err.message || 'Could not share image.', 'error');
      }
    } finally {
      setBusy(null);
    }
  };

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes bmDrawerSlide {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes bmDrawerFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes bmDrawerToast {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="bm-drawer-print-hide"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(28,43,34,0.55)',
          zIndex: 998,
          animation: 'bmDrawerFade 0.18s ease',
        }}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bm-drawer-title"
        tabIndex={-1}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(560px, 100vw)',
          background: C.cream,
          boxShadow: '-8px 0 32px rgba(28,43,34,0.18)',
          zIndex: 999,
          display: 'flex', flexDirection: 'column',
          animation: 'bmDrawerSlide 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          outline: 'none',
        }}>

        {/* Toolbar */}
        <div className="bm-drawer-print-hide" style={{
          background: C.forest, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent', color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '6px 10px', borderRadius: 7,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
              fontSize: 12, fontWeight: 600,
            }}>
            ✕
          </button>
          <span id="bm-drawer-title" style={{ color: 'white', fontWeight: 600, fontSize: 13, letterSpacing: '0.2px' }}>
            {docName}
          </span>
          {typeof docNumber === 'number' && (
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 500, letterSpacing: '0.3px' }}>
              · {docNumber} of {docTotalParts}
            </span>
          )}
        </div>

        {/* Action bar */}
        <div className="bm-drawer-print-hide" style={{
          background: '#0F1A12', padding: '8px 12px',
          display: 'flex', gap: 6, alignItems: 'center',
          flexWrap: 'wrap', flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <DrawerActionButton onClick={handleCopyImage} busy={busy === 'copy'} label="Copy image" icon="copy" />
          <DrawerActionButton onClick={handleShareImage} busy={busy === 'share'} label="Share image" icon="share" />
          <DrawerActionButton onClick={handleEmail} label="Email link" icon="email" />
          {docNumber === 4 && client?.phone && (
            <DrawerActionButton onClick={handleSms} label="Send SMS" icon="sms" />
          )}
          <DrawerActionButton onClick={handlePrint} label="Save as PDF" icon="pdf" primary />
          {fullPageUrl && (
            <a href={fullPageUrl} target="_blank" rel="noopener noreferrer" style={{
              background: 'transparent', color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.18)',
              padding: '5px 10px', borderRadius: 7,
              fontWeight: 500, fontSize: 11, letterSpacing: '0.2px',
              textDecoration: 'none',
              marginLeft: 'auto',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              Open full page ↗
            </a>
          )}
        </div>

        {/* Body */}
        <div
          ref={bodyRef}
          style={{
            flex: 1, overflowY: 'auto',
            background: C.cream,
            WebkitOverflowScrolling: 'touch',
          }}>
          {children}
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      </div>
    </>
  );
}

function DrawerActionButton({ onClick, busy, label, icon, primary }) {
  const iconSvg = {
    copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
    share: <><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></>,
    email: <><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></>,
    sms: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
    pdf: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  }[icon];

  return (
    <button onClick={onClick} disabled={busy} style={{
      background: primary ? C.gold : 'transparent',
      color: primary ? C.forest : 'white',
      border: primary ? 'none' : '1px solid rgba(255,255,255,0.25)',
      padding: '5px 10px', borderRadius: 7,
      fontWeight: primary ? 700 : 600, fontSize: 11.5,
      cursor: busy ? 'wait' : 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 5,
      opacity: busy ? 0.6 : 1,
      letterSpacing: '0.2px',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {iconSvg}
      </svg>
      {busy ? '...' : label}
    </button>
  );
}
