// src/components/ClientProfile/DocumentViewer.jsx
//
// Full-screen, in-app viewer for a client document. Crucially, the file
// is shown INSIDE MyBodyMap, never by sending the browser to the storage
// URL, so the Supabase address never appears. Bytes are pulled through the
// SDK (RLS-checked), turned into a local blob, and rendered here: images
// in an <img>, PDFs page-by-page with pdf.js (iPhones do not render PDFs
// reliably in an inline frame, so we draw them ourselves).
//
// Also hosts Phase 2: "Read this document" runs the on-demand reader and
// shows what it found right here, on the document, under "What's in this
// document". Anything without a matching client field still lives here.

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { C, F } from './tokens';
import { downloadDocumentBlob, readDocument, fetchDocument } from '../../lib/clientDocuments';

export default function DocumentViewer({ doc, onClose, onExtracted }) {
  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [meta, setMeta] = useState(doc);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState('');
  const [showText, setShowText] = useState(false);

  const pdfHostRef = useRef(null);
  const objectUrlRef = useRef('');

  const isPdf = (meta.mime_type || '').includes('pdf') || (meta.file_path || '').endsWith('.pdf');

  useEffect(() => { setMeta(doc); }, [doc]);

  // Load + render the file inside the app.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setRenderError('');
    setImgUrl('');
    (async () => {
      try {
        const blob = await downloadDocumentBlob(doc.file_path);
        if (!alive) return;
        if (isPdf) {
          await renderPdf(blob, pdfHostRef.current, () => alive);
        } else {
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          setImgUrl(url);
        }
      } catch (e) {
        if (alive) setRenderError('Could not open this document inside the app.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = ''; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.file_path]);

  // Lock background scroll while the viewer is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Esc closes the viewer (web).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleRead = async () => {
    setReading(true);
    setReadError('');
    try {
      const res = await readDocument(doc.id);
      if (!res || res.ok === false) {
        const fresh = await fetchDocument(doc.id).catch(() => null);
        if (fresh) { setMeta(fresh); onExtracted && onExtracted(fresh); }
        setReadError((fresh && fresh.extract_error) || 'The reader could not read this document.');
      } else {
        const fresh = await fetchDocument(doc.id);
        setMeta(fresh);
        onExtracted && onExtracted(fresh);
      }
    } catch (e) {
      setReadError('Could not run the reader just now. Please try again.');
    } finally {
      setReading(false);
    }
  };

  const fields = Array.isArray(meta.extracted_fields) ? meta.extracted_fields : [];
  const hasRead = meta.extract_status === 'done' && (meta.extracted_summary || fields.length);

  return createPortal((
    <div style={{
      position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(20,28,23,0.78)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0, background: C.paper, borderBottom: `1px solid ${C.lineFaint}`,
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
        paddingTop: 'max(12px, env(safe-area-inset-top))',
      }}>
        <button onClick={onClose} aria-label="Close" style={{
          width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#EEF3EE',
          color: C.forest, fontSize: 20, lineHeight: 1, cursor: 'pointer', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F.sans, fontSize: 15, fontWeight: 700, color: C.forest, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {meta.title}
          </div>
        </div>
        {!reading && (
          <button onClick={handleRead} style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7,
            background: C.sage, color: '#fff', border: 'none', borderRadius: 10,
            padding: '9px 13px', fontFamily: F.sans, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            {hasRead ? 'Read again' : 'Read this document'}
          </button>
        )}
        {reading && (
          <span style={{ flexShrink: 0, fontFamily: F.sans, fontSize: 13, fontWeight: 700, color: C.sage }}>Reading.</span>
        )}
      </div>

      {/* Body */}
      <div
        onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}
        style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 14 }}
      >
        {(hasRead || readError) && (
          <div style={{
            maxWidth: 720, margin: '0 auto 14px', background: C.paper, border: `1px solid ${C.lineFaint}`,
            borderRadius: 12, padding: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.sage, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8, fontFamily: F.sans }}>
              What's in this document
            </div>
            {readError ? (
              <div style={{ fontFamily: F.sans, fontSize: 13.5, color: C.amber, lineHeight: 1.5 }}>{readError}</div>
            ) : (
              <>
                {meta.extracted_summary && (
                  <div style={{ fontFamily: F.sans, fontSize: 14, color: C.ink, lineHeight: 1.6, marginBottom: fields.length ? 14 : 0 }}>
                    {meta.extracted_summary}
                  </div>
                )}
                {fields.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {fields.map((f, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, fontFamily: F.sans, fontSize: 13.5, lineHeight: 1.4 }}>
                        <span style={{ flexShrink: 0, minWidth: 130, color: C.muted, fontWeight: 600 }}>{f.label}</span>
                        <span style={{ color: C.forest, fontWeight: 600 }}>{f.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                {meta.extracted_text && (
                  <div style={{ marginTop: 14 }}>
                    <button onClick={() => setShowText(s => !s)} style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontFamily: F.sans, fontSize: 12.5, fontWeight: 700, color: C.sage,
                    }}>
                      {showText ? 'Hide full text' : 'Show full text'}
                    </button>
                    {showText && (
                      <div style={{
                        marginTop: 8, whiteSpace: 'pre-wrap', fontFamily: F.sans, fontSize: 12.5,
                        color: C.inkSoft, lineHeight: 1.6, background: C.paperRaised,
                        border: `1px solid ${C.lineFaint}`, borderRadius: 9, padding: 12, maxHeight: 320, overflowY: 'auto',
                      }}>
                        {meta.extracted_text}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ marginTop: 12, fontSize: 11, color: C.muted, fontFamily: F.sans, lineHeight: 1.5 }}>
                  Read by MyBodyMap. Always check against the document itself.
                </div>
              </>
            )}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', color: '#EEF3EE', fontFamily: F.sans, fontSize: 14, padding: '40px 0' }}>
            Opening document.
          </div>
        )}
        {renderError && !loading && (
          <div style={{ maxWidth: 520, margin: '40px auto', background: C.paper, borderRadius: 12, padding: 18, fontFamily: F.sans, fontSize: 14, color: C.ink, textAlign: 'center', lineHeight: 1.6 }}>
            {renderError}
          </div>
        )}
        {!isPdf && imgUrl && !loading && (
          <img src={imgUrl} alt={meta.title} style={{ display: 'block', maxWidth: 720, width: '100%', margin: '0 auto', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,0.25)' }} />
        )}
        <div ref={pdfHostRef} style={{ maxWidth: 720, margin: '0 auto', display: isPdf ? 'flex' : 'none', flexDirection: 'column', gap: 12 }} />
      </div>
    </div>
  ), document.body);
}

// Render a PDF blob into the host element using pdf.js, one canvas per page.
async function renderPdf(blob, host, isAlive) {
  if (!host) return;
  host.innerHTML = '';
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const hostWidth = Math.min(host.clientWidth || 700, 720);
  for (let n = 1; n <= pdf.numPages; n++) {
    if (isAlive && !isAlive()) return;
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.max(1, (hostWidth / base.width)) * (window.devicePixelRatio || 1);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = '100%';
    canvas.style.borderRadius = '10px';
    canvas.style.boxShadow = '0 6px 24px rgba(0,0,0,0.25)';
    canvas.style.background = '#fff';
    host.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  }
}
