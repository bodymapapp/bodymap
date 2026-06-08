// src/components/ClientProfile/DocumentsCard.jsx
//
// Forms and documents for a client: consent forms, intake paperwork, and
// other files. Two ways in, both 70-year-old friendly: choose a PDF or
// photo from the device, or take a photo of a paper form with the camera.
// Photos are compressed and wrapped into a one-page PDF in the browser
// (free, no server) so everything reads as a clean document.
//
// Storage is private. Files live in the 'client-documents' bucket locked to
// the therapist, and every view goes through a 60-second signed URL. Deletes
// are soft, so a legal record is never lost to a stray tap.

import React, { useEffect, useRef, useState } from 'react';
import { C, F, S } from './tokens';
import { RoundIconButton } from '../ChevronIcon';
import DocumentViewer from './DocumentViewer';
import {
  DOC_CATEGORIES, DOC_MAX_BYTES, categoryLabel,
  listDocuments, uploadDocument, renameDocument,
  setDocumentCategory, softDeleteDocument, imageFileToPdf, isImageFile,
} from '../../lib/clientDocuments';

function formatDocDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocIcon({ isPdf }) {
  const stroke = isPdf ? '#B0902F' : C.sage;
  const bg = isPdf ? C.goldBg : C.sageBg;
  return (
    <div style={{
      width: 38, height: 38, borderRadius: 9, background: bg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
    </div>
  );
}

function CategoryChips({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
      {DOC_CATEGORIES.map((c) => {
        const on = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            style={{
              fontFamily: F.sans, fontSize: 12.5, fontWeight: 600,
              padding: '7px 13px', borderRadius: 999, cursor: 'pointer',
              border: `1.5px solid ${on ? C.sage : C.lineFaint}`,
              background: on ? C.sage : C.paper,
              color: on ? '#fff' : C.ink,
              transition: 'all 0.15s ease',
            }}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

export default function DocumentsCard({ client, therapist, readOnly = false, onSummary, onClientUpdated }) {
  const therapistId = therapist?.id;
  const clientId = client?.id;
  const canUse = !readOnly && !!therapistId && !!clientId;

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [newCategory, setNewCategory] = useState('consent');
  const [busy, setBusy] = useState(false);
  const [confirmingId, setConfirmingId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('consent');
  const [viewerDoc, setViewerDoc] = useState(null);

  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const capturedViaRef = useRef('upload');

  const report = (list) => {
    if (typeof onSummary === 'function') {
      onSummary({
        count: list.length,
        hasConsent: list.some((d) => d.category === 'consent'),
      });
    }
  };

  useEffect(() => {
    let alive = true;
    if (!canUse) { setLoading(false); return; }
    (async () => {
      try {
        const list = await listDocuments(therapistId, clientId);
        if (!alive) return;
        setDocs(list);
        report(list);
      } catch (e) {
        if (alive) setError('Could not load documents just now.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapistId, clientId, canUse]);

  const pickFile = (viaCamera) => {
    setError('');
    capturedViaRef.current = viaCamera ? 'camera' : 'upload';
    const el = viaCamera ? cameraRef.current : fileRef.current;
    if (el) { el.value = ''; el.click(); }
  };

  const onFileChosen = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setError('');
    if (file.size > DOC_MAX_BYTES) {
      setError('That file is over 25 MB. Please choose a smaller one.');
      return;
    }
    setBusy(true);
    try {
      let toUpload = file;
      // The paper option: any image becomes a tidy one-page PDF.
      if (isImageFile(file)) {
        toUpload = await imageFileToPdf(file);
      }
      const row = await uploadDocument({
        therapistId, clientId, file: toUpload,
        title: categoryLabel(newCategory),
        category: newCategory,
        capturedVia: capturedViaRef.current,
      });
      const next = [row, ...docs];
      setDocs(next);
      report(next);
      setAdding(false);
      setNewCategory('consent');
    } catch (err) {
      setError(err?.message ? String(err.message) : 'That upload did not go through. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const openDoc = (doc) => setViewerDoc(doc);

  const startEdit = (doc) => {
    setConfirmingId('');
    setEditingId(doc.id);
    setEditTitle(doc.title || '');
    setEditCategory(doc.category || 'other');
  };

  const saveEdit = async (doc) => {
    setBusy(true);
    try {
      if (editTitle.trim() !== (doc.title || '')) await renameDocument(doc.id, editTitle);
      if (editCategory !== doc.category) await setDocumentCategory(doc.id, editCategory);
      const next = docs.map((d) => d.id === doc.id
        ? { ...d, title: editTitle.trim() || 'Document', category: editCategory }
        : d);
      setDocs(next);
      report(next);
      setEditingId('');
    } catch (e) {
      setError('Could not save that change. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = async (doc) => {
    setBusy(true);
    try {
      await softDeleteDocument(doc.id);
      const next = docs.filter((d) => d.id !== doc.id);
      setDocs(next);
      report(next);
      setConfirmingId('');
    } catch (e) {
      setError('Could not remove that document. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (readOnly) {
    return (
      <div style={{ fontFamily: F.sans, fontSize: 13.5, color: C.inkSoft, lineHeight: 1.6 }}>
        Consent forms and other documents for this client will appear here.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: F.sans }}>
      <input ref={fileRef} type="file" accept="application/pdf,image/*" onChange={onFileChosen} style={{ display: 'none' }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFileChosen} style={{ display: 'none' }} />

      {error && (
        <div style={{
          background: C.redBg, color: C.red, fontSize: 12.5, fontWeight: 600,
          borderRadius: 9, padding: '9px 12px', marginBottom: 12, lineHeight: 1.5,
        }}>
          {error}
        </div>
      )}

      {/* Add control */}
      {!adding ? (
        <button
          type="button"
          onClick={() => { setAdding(true); setError(''); }}
          disabled={busy}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            background: C.sage, color: '#fff', border: 'none', borderRadius: 11,
            padding: '13px 16px', fontFamily: F.sans, fontSize: 14.5, fontWeight: 700,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            boxShadow: '0 2px 6px rgba(42,87,65,0.18)', marginBottom: docs.length ? 16 : 4,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add a document
        </button>
      ) : (
        <div style={{
          border: `1.5px solid ${C.lineFaint}`, borderRadius: 12, padding: S.lg,
          background: C.paperRaised, marginBottom: docs.length ? 16 : 4,
        }}>
          {busy ? (
            <div style={{ textAlign: 'center', padding: '14px 0', color: C.sage, fontSize: 14, fontWeight: 600 }}>
              Saving this document securely.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                What kind of document?
              </div>
              <div style={{ marginBottom: 16 }}>
                <CategoryChips value={newCategory} onChange={setNewCategory} />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => pickFile(true)} style={bigActionStyle}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  Take a photo
                </button>
                <button type="button" onClick={() => pickFile(false)} style={bigActionStyle}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  Choose a file
                </button>
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11.5, color: C.muted }}>PDF or photo. A photo is saved as a PDF. Up to 25 MB.</span>
                <button type="button" onClick={() => { setAdding(false); setError(''); }} style={{ background: 'none', border: 'none', color: C.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: F.sans }}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ color: C.muted, fontSize: 13, padding: '6px 2px' }}>Loading documents.</div>
      ) : docs.length === 0 ? (
        <div style={{ color: C.inkSoft, fontSize: 13.5, lineHeight: 1.6, padding: '4px 2px' }}>
          No documents yet. Add a signed consent form, an intake, or any file you want kept with this client.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {docs.map((doc) => {
            const isPdf = (doc.mime_type || '').includes('pdf') || (doc.file_path || '').endsWith('.pdf');
            const editing = editingId === doc.id;
            const confirming = confirmingId === doc.id;
            return (
              <div key={doc.id} style={{
                border: `1px solid ${C.lineFaint}`, borderRadius: 11, padding: '11px 12px', background: C.paper,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <DocIcon isPdf={isPdf} />
                  <button
                    type="button"
                    onClick={() => openDoc(doc)}
                    style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: F.sans }}
                  >
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: C.forest, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.title}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[categoryLabel(doc.category), formatDocDate(doc.created_at), formatSize(doc.size_bytes), doc.captured_via === 'camera' ? 'Photo' : 'File', doc.extract_status === 'done' ? 'Read' : null].filter(Boolean).join(' · ')}
                    </div>
                  </button>
                  {!editing && !confirming && (
                    <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                      <RoundIconButton onClick={() => startEdit(doc)} ariaLabel="Rename or recategorize" size={32} fontSize={15}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                        </svg>
                      </RoundIconButton>
                      <RoundIconButton onClick={() => { setConfirmingId(doc.id); setEditingId(''); }} ariaLabel="Remove document" size={32}>×</RoundIconButton>
                    </div>
                  )}
                </div>

                {confirming && (
                  <div style={{ marginTop: 11, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: C.ink, fontWeight: 600 }}>Remove this document?</span>
                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                      <button type="button" disabled={busy} onClick={() => removeDoc(doc)} style={{ background: C.red, color: '#fff', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: F.sans }}>Remove</button>
                      <button type="button" onClick={() => setConfirmingId('')} style={{ background: C.paper, color: C.ink, border: `1.5px solid ${C.lineFaint}`, borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: F.sans }}>Keep</button>
                    </div>
                  </div>
                )}

                {editing && (
                  <div style={{ marginTop: 12 }}>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Document name"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${C.lineFaint}`, fontFamily: F.sans, fontSize: 14, color: C.forest, marginBottom: 10 }}
                    />
                    <div style={{ marginBottom: 12 }}>
                      <CategoryChips value={editCategory} onChange={setEditCategory} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setEditingId('')} style={{ background: C.paper, color: C.ink, border: `1.5px solid ${C.lineFaint}`, borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: F.sans }}>Cancel</button>
                      <button type="button" disabled={busy} onClick={() => saveEdit(doc)} style={{ background: C.sage, color: '#fff', border: 'none', borderRadius: 9, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: F.sans }}>Save</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewerDoc && (
        <DocumentViewer
          doc={viewerDoc}
          clientId={readOnly ? null : client?.id}
          clientName={client?.name ? String(client.name).split(' ')[0] : ''}
          therapistId={therapistId}
          onClose={() => setViewerDoc(null)}
          onExtracted={(updated) => {
            setViewerDoc(v => (v && v.id === updated.id ? updated : v));
            setDocs(list => list.map(d => (d.id === updated.id ? updated : d)));
          }}
          onClientUpdated={onClientUpdated}
        />
      )}
    </div>
  );
}

const bigActionStyle = {
  flex: 1, minWidth: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
  background: '#FFFFFF', border: `1.5px solid #D8E3DA`, borderRadius: 12, padding: '16px 12px',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", fontSize: 13.5, fontWeight: 700,
  color: '#2A5741', cursor: 'pointer',
};
