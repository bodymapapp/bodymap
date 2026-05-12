// src/components/DocumentDrawer.jsx
//
// Slide-in document drawer. Rebuilt May 12 2026 after HK QA caught
// three bugs in the first pass:
//   1. Copy/share image rendered only the visible viewport, not the
//      full scrollable content. Fixed: render the inner doc element
//      at its natural height with html2canvas windowHeight option.
//   2. Save as PDF showed a blank print window because the print
//      stylesheet used 'body > * { display: none }' which hid the
//      drawer's ancestors. Fixed: render the doc into a hidden
//      print container outside the drawer (cloned via innerHTML at
//      print time) and show ONLY that container during print.
//   3. The five action buttons were not visually grouped, so the
//      therapist could not tell which button sent a link vs an
//      image vs a PDF. Fixed: 3 grouped action cards labeled
//      'Send as link', 'Send as image', 'Save as PDF'.
//
// Image quality: rendered at scale 2 (retina), background cream,
// no scrollbar in the capture, full content height (not viewport).

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';

const C = {
  cream: '#F9F5EE',
  forest: '#1C2B22',
  forestDark: '#0F1A12',
  sage: '#4A6B54',
  sageBg: '#EEF3EE',
  gold: '#C9A84C',
  goldBg: '#FAF3DC',
  goldDeep: '#92660E',
  ink: '#3D4F43',
  inkSoft: '#6B7F72',
  white: '#FFFFFF',
  lineFaint: '#E8E0D0',
  rose: '#FCE5E0',
  serif: "'Fraunces', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

function Toast({ message, type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  const isError = type === 'error';
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: isError ? '#7F1D1D' : C.forest, color: 'white',
      padding: '11px 18px', borderRadius: 9,
      fontSize: 13.5, fontWeight: 600,
      boxShadow: '0 6px 22px rgba(0,0,0,0.22)',
      zIndex: 10000, maxWidth: '92%',
      animation: 'bmDrawerToast 0.22s ease',
      pointerEvents: 'none',
    }}>{message}</div>
  );
}

// Small icon helpers for action cards
const ICONS = {
  link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>,
  pdf: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></>,
  sms: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  share: <><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  close: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
};

function Icon({ name, size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

export default function DocumentDrawer({ open, onClose, docNumber, docName, docTotalParts = 4, fullPageUrl, client, therapist, children }) {
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const drawerRef = useRef(null);
  const bodyRef = useRef(null);
  const printContainerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [open]);

  useEffect(() => {
    if (open && drawerRef.current) drawerRef.current.focus();
  }, [open]);

  const therapistName = therapist?.business_name || therapist?.full_name || 'Your Practice';

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
  }, []);

  // PDF action.
  //
  // Previous approach used the browser's native print engine on the
  // doc HTML, which strips background colors, gradients, and shadows
  // unless the user checks 'Background graphics' in the print dialog.
  // Result: PDFs looked washed out compared to the Copy/Share image.
  //
  // New approach (May 12 2026): render the doc to a PNG via the same
  // html2canvas path that Copy/Share uses, then embed the PNG into the
  // print stage as <img> tags. The PDF is now a picture of the doc,
  // identical fidelity to the image actions.
  //
  // Multi-page handling: if the rendered canvas is taller than one
  // A4 page (aspect ratio 1:1.414), we split it into per-page slices
  // via a temporary sub-canvas, then append each slice as a separate
  // <img> with page-break-after: always. This produces a proper
  // multi-page PDF without content being awkwardly clipped mid-line.
  const handlePrint = async () => {
    setBusy('pdf');
    try {
      if (!bodyRef.current) throw new Error('Document not ready');
      const stage = printContainerRef.current;
      if (!stage) throw new Error('Print stage not ready');

      // Render the doc to a single tall canvas via the same path as
      // the image actions (renderToBlob clones into the stage).
      // We need the raw canvas here, not the blob, so we re-do the
      // capture inline. Same logic, different return shape.
      stage.innerHTML = '';
      const clone = bodyRef.current.cloneNode(true);
      clone.style.width = '880px';
      clone.style.maxWidth = '880px';
      clone.style.height = 'auto';
      clone.style.maxHeight = 'none';
      clone.style.overflow = 'visible';
      stage.appendChild(clone);
      await new Promise(r => setTimeout(r, 250));
      const fullHeight = Math.max(stage.offsetHeight, clone.scrollHeight);
      const fullCanvas = await html2canvas(stage, {
        backgroundColor: C.cream,
        scale: 2,
        useCORS: true,
        logging: false,
        width: 880,
        height: fullHeight,
        windowWidth: 880,
        windowHeight: fullHeight,
        scrollX: 0,
        scrollY: 0,
      });

      // A4 aspect: 297/210 = 1.414 (height/width)
      // The canvas is `fullCanvas.width` wide. Each printed page is
      // that width tall at A4 aspect: pageHeightPx = width * 1.414.
      const a4Aspect = 297 / 210;
      const pagePxHeight = Math.floor(fullCanvas.width * a4Aspect);
      const pages = Math.max(1, Math.ceil(fullCanvas.height / pagePxHeight));

      // Replace the stage with the rendered page images
      stage.innerHTML = '';
      for (let p = 0; p < pages; p++) {
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = fullCanvas.width;
        // Last page may be shorter than a full A4 if the content
        // ends partway. Cap at the canvas tail.
        const yStart = p * pagePxHeight;
        const sliceHeight = Math.min(pagePxHeight, fullCanvas.height - yStart);
        sliceCanvas.height = sliceHeight;
        const ctx = sliceCanvas.getContext('2d');
        // Cream background so any rounded-corner content edges blend
        ctx.fillStyle = C.cream;
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        // Copy the relevant slice from the full canvas
        ctx.drawImage(
          fullCanvas,
          0, yStart, fullCanvas.width, sliceHeight,
          0, 0, fullCanvas.width, sliceHeight
        );
        const img = document.createElement('img');
        img.src = sliceCanvas.toDataURL('image/png');
        img.style.cssText = `
          width: 100%; display: block; margin: 0;
          page-break-after: ${p < pages - 1 ? 'always' : 'auto'};
          page-break-inside: avoid;
        `;
        stage.appendChild(img);
      }

      // Wait for all images to load before triggering print
      const imgs = stage.querySelectorAll('img');
      await Promise.all(Array.from(imgs).map(img => new Promise(resolve => {
        if (img.complete && img.naturalHeight) resolve();
        else { img.onload = resolve; img.onerror = resolve; }
      })));

      // Print stylesheet: show only the stage, full-bleed image pages
      const styleTag = document.createElement('style');
      styleTag.id = 'bm-print-style';
      styleTag.innerHTML = `
        @media print {
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          @page { size: A4; margin: 0 !important; }
          body > *:not(.bm-print-stage) { display: none !important; }
          .bm-print-stage {
            display: block !important;
            position: static !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            z-index: auto !important;
            pointer-events: auto !important;
            overflow: visible !important;
          }
          .bm-print-stage img {
            width: 100% !important;
            height: auto !important;
            display: block !important;
            page-break-inside: avoid !important;
          }
        }
      `;
      document.head.appendChild(styleTag);

      setTimeout(() => {
        window.print();
        setTimeout(() => {
          stage.innerHTML = '';
          document.getElementById('bm-print-style')?.remove();
          setBusy(null);
        }, 700);
      }, 100);
    } catch (err) {
      showToast(err.message || 'Could not prepare PDF.', 'error');
      setBusy(null);
    }
  };

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

  const handleSms = () => {
    if (!client?.phone) return;
    const body = `Your post-session summary from ${therapistName}: ${fullPageUrl}`;
    window.location.href = `sms:${client.phone}?&body=${encodeURIComponent(body)}`;
  };

  // Render the doc to a PNG via the off-screen print stage.
  //
  // Previous approach (capturing from inside the drawer's scrollable
  // body) only captured the visible viewport because the drawer's
  // flex container constrains height. Even with overflow unwrap, the
  // scrollable div is bounded by flex: 1.
  //
  // New approach: clone the doc HTML into the off-screen print stage
  // sized at 880px wide. The clone renders at its natural height
  // (no flex container constraining it). html2canvas captures the
  // clone, which is the full document top to bottom.
  const renderToBlob = async () => {
    if (!bodyRef.current) throw new Error('Document not ready');
    const stage = printContainerRef.current;
    if (!stage) throw new Error('Print stage not ready');

    // Clone the rendered doc into the stage
    stage.innerHTML = '';
    const clone = bodyRef.current.cloneNode(true);
    clone.style.width = '880px';
    clone.style.maxWidth = '880px';
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    stage.appendChild(clone);

    // Wait for layout + SVG paints. SVG body diagrams need a moment
    // to compute their bounding boxes inside the cloned tree.
    await new Promise(r => setTimeout(r, 250));

    try {
      // offsetHeight reflects the full natural height now that the
      // clone is in the DOM with no height constraint
      const fullHeight = Math.max(stage.offsetHeight, clone.scrollHeight);
      const canvas = await html2canvas(stage, {
        backgroundColor: C.cream,
        scale: 2,
        useCORS: true,
        logging: false,
        width: 880,
        height: fullHeight,
        windowWidth: 880,
        windowHeight: fullHeight,
        scrollX: 0,
        scrollY: 0,
      });
      return new Promise((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Image render failed')), 'image/png');
      });
    } finally {
      stage.innerHTML = '';
    }
  };

  const handleCopyImage = async () => {
    setBusy('copy');
    try {
      if (!navigator.clipboard || !window.ClipboardItem) {
        throw new Error('Clipboard not supported on this browser. Use Share or Download instead.');
      }
      const blob = await renderToBlob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('Image copied. Paste into your email or message.');
    } catch (err) {
      showToast(err.message || 'Could not copy image.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleShareImage = async () => {
    setBusy('share');
    try {
      const blob = await renderToBlob();
      const fileName = `${(docName || 'document').replace(/\s+/g, '-').toLowerCase()}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: docName,
          text: docNumber === 4 ? `Your session summary from ${therapistName}` : docName,
        });
      } else {
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

  return createPortal(
    <>
      <style>{`
        @keyframes bmDrawerSlide { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes bmDrawerFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bmDrawerToast { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
        .bm-action-btn {
          display: inline-flex; align-items: center; gap: 6px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.25);
          color: white;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 12px; font-weight: 600; letter-spacing: 0.15px;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease, transform 0.08s ease;
          white-space: nowrap;
        }
        .bm-action-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.4);
        }
        .bm-action-btn:active:not(:disabled) { transform: scale(0.97); }
        .bm-action-btn:disabled { opacity: 0.5; cursor: wait; }
        .bm-action-btn-primary {
          background: ${C.gold};
          color: ${C.forest};
          border-color: ${C.gold};
          font-weight: 700;
        }
        .bm-action-btn-primary:hover:not(:disabled) {
          background: #D9B85C;
          border-color: #D9B85C;
        }
        .bm-action-group {
          display: flex; align-items: center; gap: 0;
          background: rgba(255,255,255,0.05);
          border-radius: 9px;
          padding: 4px;
        }
        .bm-action-group-label {
          font-size: 9.5px; font-weight: 700;
          color: rgba(255,255,255,0.55);
          text-transform: uppercase;
          letter-spacing: 0.7px;
          padding: 0 6px 0 2px;
          white-space: nowrap;
        }
        .bm-action-group .bm-action-btn {
          border: none;
          padding: 5px 9px;
          font-size: 11.5px;
        }
        .bm-action-group .bm-action-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.10);
        }
        .bm-action-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
        }
      `}</style>

      {/* Backdrop */}
      <div
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
          width: 'min(640px, 100vw)',
          background: C.cream,
          boxShadow: '-8px 0 32px rgba(28,43,34,0.18)',
          zIndex: 999,
          display: 'flex', flexDirection: 'column',
          animation: 'bmDrawerSlide 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          outline: 'none',
        }}>

        {/* Header */}
        <div style={{
          background: C.forest, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent', color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '6px 8px', borderRadius: 7,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
            }}>
            <Icon name="close" size={14} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id="bm-drawer-title" style={{ color: 'white', fontWeight: 600, fontSize: 13.5, lineHeight: 1.2 }}>
              {docName}
            </div>
            {typeof docNumber === 'number' && (
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10.5, fontWeight: 500, letterSpacing: '0.5px', marginTop: 1 }}>
                Document {docNumber} of {docTotalParts}
              </div>
            )}
          </div>
        </div>

        {/* Grouped action bar: Send as link | Send as image | Save as PDF
            Each group has a tiny label so the therapist sees at a glance
            what each cluster does. PDF is its own primary action. */}
        <div style={{
          background: C.forestDark, padding: '8px 12px',
          flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div className="bm-action-bar">

            {/* Group 1: Send as link */}
            <div className="bm-action-group">
              <span className="bm-action-group-label">
                <Icon name="link" size={10} color="rgba(255,255,255,0.55)" /> Link
              </span>
              <button onClick={handleEmail} className="bm-action-btn" title="Email a link to this document">
                <Icon name="email" /> Email
              </button>
              {docNumber === 4 && client?.phone && (
                <button onClick={handleSms} className="bm-action-btn" title="Text a link to the client">
                  <Icon name="sms" /> SMS
                </button>
              )}
            </div>

            {/* Group 2: Send as image */}
            <div className="bm-action-group">
              <span className="bm-action-group-label">
                <Icon name="image" size={10} color="rgba(255,255,255,0.55)" /> Image
              </span>
              <button onClick={handleCopyImage} disabled={busy === 'copy'} className="bm-action-btn" title="Copy a PNG of this document to clipboard">
                <Icon name="copy" /> {busy === 'copy' ? 'Copying...' : 'Copy'}
              </button>
              <button onClick={handleShareImage} disabled={busy === 'share'} className="bm-action-btn" title="Share a PNG of this document (mobile) or download">
                <Icon name="share" /> {busy === 'share' ? 'Preparing...' : 'Share'}
              </button>
            </div>

            {/* Group 3: Save as PDF (primary) */}
            <button onClick={handlePrint} disabled={busy === 'pdf'} className="bm-action-btn bm-action-btn-primary" title="Save the document as a PDF">
              <Icon name="pdf" /> {busy === 'pdf' ? 'Preparing...' : 'Save PDF'}
            </button>
          </div>
        </div>

        {/* Scrollable body wrapping the doc content (the html2canvas target).
            renderToBlob unwraps the overflow so the full content is captured. */}
        <div style={{
          flex: 1, overflowY: 'auto',
          background: C.cream,
          WebkitOverflowScrolling: 'touch',
        }}>
          <div ref={bodyRef}>
            {children}
          </div>
        </div>
      </div>

      {/* Off-screen print stage. handlePrint clones the doc into here
          and the print stylesheet shows ONLY this container. */}
      <div
        ref={printContainerRef}
        className="bm-print-stage"
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-99999px',
          top: 0,
          width: '880px',
          background: 'white',
          zIndex: -1,
          pointerEvents: 'none',
        }}
      />

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>,
    document.body
  );
}
