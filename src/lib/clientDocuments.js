// src/lib/clientDocuments.js
//
// Data + storage helpers for client documents (consent / intake / other).
// Private bucket 'client-documents'; files are keyed by
// {therapist_id}/{client_id}/{document_id}.{ext}. The first path segment is
// the therapist's auth uid, which is what the storage RLS policy checks.
// Viewing always goes through a short-lived (60s) signed URL. Deletes are
// soft (deleted_at) so a legal record is never lost to a stray tap.

import { supabase } from './supabase';

export const DOC_BUCKET = 'client-documents';
export const DOC_MAX_BYTES = 25 * 1024 * 1024; // matches the bucket cap

export const DOC_CATEGORIES = [
  { id: 'consent', label: 'Consent form' },
  { id: 'intake',  label: 'Intake' },
  { id: 'other',   label: 'Other' },
];

export function categoryLabel(id) {
  const c = DOC_CATEGORIES.find(x => x.id === id);
  return c ? c.label : 'Document';
}

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

function extFor(file) {
  const fromName = (file.name || '').split('.').pop();
  if (fromName && fromName.length <= 5 && /^[a-z0-9]+$/i.test(fromName)) {
    return fromName.toLowerCase().replace('jpeg', 'jpg');
  }
  const m = (file.type || '').split('/').pop();
  return (m || 'bin').toLowerCase().replace('jpeg', 'jpg');
}

export function isImageFile(file) {
  return !!file && typeof file.type === 'string' && file.type.startsWith('image/');
}

const DOC_SELECT = 'id,title,category,file_path,file_name,mime_type,size_bytes,page_count,captured_via,created_at,extract_status,extracted_summary,extracted_fields,extracted_text,extracted_at,extract_error';

// List active (non-deleted) documents for a client, newest first.
export async function listDocuments(therapistId, clientId) {
  const { data, error } = await supabase
    .from('client_documents')
    .select(DOC_SELECT)
    .eq('therapist_id', therapistId)
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Compress + downscale an image File and wrap it in a one-page PDF.
// Lazy-loads jspdf so it only ships to the browser when a therapist
// actually captures or chooses a photo.
export async function imageFileToPdf(file, { maxDim = 1600, quality = 0.82 } = {}) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('Could not read that photo.'));
    r.readAsDataURL(file);
  });
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Could not open that photo. Try a JPG or PNG.'));
    i.src = dataUrl;
  });
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('That photo looked empty. Please try again.');
  const scale = Math.min(1, maxDim / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const jpeg = canvas.toDataURL('image/jpeg', quality);

  const { jsPDF } = await import('jspdf');
  const pageW = 595.28, pageH = 841.89; // A4 portrait, points
  const margin = 24;
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;
  const ratio = Math.min(availW / w, availH / h);
  const drawW = w * ratio, drawH = h * ratio;
  const x = (pageW - drawW) / 2, y = (pageH - drawH) / 2;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  pdf.addImage(jpeg, 'JPEG', x, y, drawW, drawH);
  const blob = pdf.output('blob');
  const base = file.name ? file.name.replace(/\.[^.]+$/, '') : 'document';
  return new File([blob], `${base}.pdf`, { type: 'application/pdf' });
}

// Upload a file and create the metadata row. Returns the new row.
// If the row insert fails, the orphaned object is best-effort removed.
export async function uploadDocument({ therapistId, clientId, file, title, category = 'consent', capturedVia = 'upload', createdBy }) {
  const docId = uuid();
  const ext = extFor(file);
  const path = `${therapistId}/${clientId}/${docId}.${ext}`;
  const up = await supabase.storage.from(DOC_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (up.error) throw up.error;

  const row = {
    id: docId,
    therapist_id: therapistId,
    client_id: clientId,
    title: title && title.trim() ? title.trim() : categoryLabel(category),
    category,
    file_path: path,
    file_name: file.name || null,
    mime_type: file.type || null,
    size_bytes: file.size || null,
    page_count: ext === 'pdf' ? 1 : null,
    captured_via: capturedVia,
    created_by: createdBy || therapistId,
  };
  const ins = await supabase
    .from('client_documents')
    .insert(row)
    .select(DOC_SELECT)
    .single();
  if (ins.error) {
    try { await supabase.storage.from(DOC_BUCKET).remove([path]); } catch (_e) { /* best effort */ }
    throw ins.error;
  }
  return ins.data;
}

// Trigger the on-demand reader (Phase 2). Returns the function result.
export async function readDocument(documentId) {
  const { data, error } = await supabase.functions.invoke('read-document', {
    body: { document_id: documentId },
  });
  if (error) throw error;
  return data; // { ok, extracted } | { ok:false, error }
}

// Re-fetch a single document row (after a read) to refresh extracted data.
export async function fetchDocument(id) {
  const { data, error } = await supabase
    .from('client_documents')
    .select(DOC_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error) throw error;
  return data;
}

export async function signedUrlFor(filePath, { download = false } = {}) {
  const { data, error } = await supabase.storage
    .from(DOC_BUCKET)
    .createSignedUrl(filePath, 60, download ? { download: true } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

// Fetch the raw file bytes through the SDK (RLS-checked) so the document
// can be shown inside the app, never by navigating the browser to the
// storage URL. Returns a Blob.
export async function downloadDocumentBlob(filePath) {
  const { data, error } = await supabase.storage.from(DOC_BUCKET).download(filePath);
  if (error) throw error;
  return data; // Blob
}

export async function renameDocument(id, title) {
  const { error } = await supabase
    .from('client_documents')
    .update({ title: (title || '').trim() || 'Document' })
    .eq('id', id);
  if (error) throw error;
}

export async function setDocumentCategory(id, category) {
  const { error } = await supabase.from('client_documents').update({ category }).eq('id', id);
  if (error) throw error;
}

export async function softDeleteDocument(id) {
  const { error } = await supabase
    .from('client_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
