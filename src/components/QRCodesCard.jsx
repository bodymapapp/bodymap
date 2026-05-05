// src/components/QRCodesCard.jsx
// QR code panels in Settings:
//   1. Digital intake QR (fixed)
//   2. Booking link QR (fixed)
//   3. SAVED custom QR codes — persisted in the custom_qr_codes table
//      so therapists do not have to retype URLs every time they want
//      to print. Triggered by Ashley Scalzulli email: "save the custom
//      link QR codes so I do not have to keep remaking the same link
//      over and over."
//
// Print-friendly, downloadable, mobile-responsive.

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import InlineEditField from './InlineEditField';

// Display a small preview (240px) but download the high-res version (800px)
// so therapists can print up to 8 inches square without pixelation.
const QR_API_PREVIEW = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=';
const QR_API_HIRES = 'https://api.qrserver.com/v1/create-qr-code/?size=800x800&margin=30&data=';

// Normalize a URL: trim whitespace, prepend https:// if missing
function normalizeUrl(input) {
  const v = (input || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

// Slugify a label for filename use (alphanumerics + dashes only)
function slugify(s) {
  return (s || 'qr')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'qr';
}

function QRPanel({ title, subtitle, url, filename, businessName, C2, highlighted = false, children, headerRight }) {
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
      window.open(hiresSrc, '_blank');
    }
    setDownloading(false);
  };

  const printQR = () => {
    if (!url) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html>
      <html><head>
        <title>${title} QR Code</title>
        <style>
          body { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px; font-family:system-ui; }
          h1 { margin:0 0 6px; font-size:22px; color:#1F2937; }
          p { margin:0 0 24px; font-size:13px; color:#6B7280; }
          img { max-width:600px; width:100%; height:auto; }
          .url { margin-top:18px; font-size:12px; color:#6B7280; word-break:break-all; }
        </style>
      </head><body>
        ${businessName ? `<h1>${businessName}</h1>` : ''}
        <p>${subtitle || title}</p>
        <img src="${hiresSrc}" alt="${title}" />
        <div class="url">${url}</div>
      </body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  return (
    <div style={{
      background: highlighted ? '#FCF8EE' : '#fff',
      border: `1.5px solid ${highlighted ? '#E8C5B5' : C2.lightGray}`,
      borderRadius: 12,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: highlighted ? '0 4px 16px rgba(168, 116, 104, 0.10)' : 'none',
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 8, marginBottom: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C2.darkGray, marginBottom: 2 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: C2.gray }}>{subtitle}</div>}
        </div>
        {headerRight}
      </div>
      {children}
      {url ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 12px' }}>
            <img
              src={previewSrc}
              alt={`${title} QR`}
              style={{ width: 160, height: 160, borderRadius: 8 }}
            />
          </div>
          <div style={{ fontSize: 10, color: C2.gray, textAlign: 'center', wordBreak: 'break-all', padding: '0 4px 10px' }}>
            {url}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={download} disabled={downloading} style={{
              flex: 1, minWidth: 0,
              background: '#fff', border: `1.5px solid ${C2.lightGray}`,
              padding: '7px 10px', borderRadius: 7,
              fontSize: 11, fontWeight: 600, color: C2.darkGray,
              cursor: downloading ? 'wait' : 'pointer',
            }}>
              {downloading ? 'Saving…' : '↓ Download'}
            </button>
            <button onClick={printQR} style={{
              flex: 1, minWidth: 0,
              background: '#fff', border: `1.5px solid ${C2.lightGray}`,
              padding: '7px 10px', borderRadius: 7,
              fontSize: 11, fontWeight: 600, color: C2.darkGray,
              cursor: 'pointer',
            }}>
              🖨 Print
            </button>
            <button onClick={copy} style={{
              flex: 1, minWidth: 0,
              background: copied ? '#16A34A' : '#fff',
              border: `1.5px solid ${copied ? '#16A34A' : C2.lightGray}`,
              padding: '7px 10px', borderRadius: 7,
              fontSize: 11, fontWeight: 600,
              color: copied ? '#fff' : C2.darkGray,
              cursor: 'pointer',
              transition: 'all 0.18s',
            }}>
              {copied ? '✓ Copied' : 'Copy URL'}
            </button>
          </div>
        </>
      ) : (
        <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 11, color: C2.gray, fontStyle: 'italic' }}>
          Enter a link above to generate a QR code.
        </div>
      )}
    </div>
  );
}

// Inline soft-delete affordance (same pattern as IntakeEditor / ConditionRow).
// Idle state: × button. Tap once -> Delete? [Yes] [No]. 5-second auto-cancel.
function DeleteAffordance({ onDelete, C2 }) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 5000);
    return () => clearTimeout(t);
  }, [confirming]);

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} aria-label="Remove" style={{
        background: 'transparent', color: C2.gray,
        border: 'none', cursor: 'pointer',
        fontSize: 16, lineHeight: 1, padding: '0 4px',
        flexShrink: 0,
      }}>×</button>
    );
  }
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <span style={{ fontSize: 10, color: '#DC2626', fontWeight: 600 }}>Delete?</span>
      <button onClick={() => { setConfirming(false); onDelete(); }} aria-label="Confirm delete" style={{
        background: '#DC2626', color: '#fff', border: 'none', borderRadius: 5,
        cursor: 'pointer', fontSize: 10, fontWeight: 700, padding: '3px 8px',
      }}>Yes</button>
      <button onClick={() => setConfirming(false)} aria-label="Cancel delete" style={{
        background: 'transparent', color: C2.gray,
        border: `1px solid ${C2.lightGray}`, borderRadius: 5,
        cursor: 'pointer', fontSize: 10, fontWeight: 600, padding: '3px 8px',
      }}>No</button>
    </div>
  );
}

export default function QRCodesCard({ intakeUrl, bookingUrl, businessName, C2 }) {
  const { user } = useAuth();
  const [savedQRs, setSavedQRs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftUrl, setDraftUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Load saved custom QRs once on mount and whenever the user changes.
  // Quietly fails if the table does not exist yet (migration not run);
  // therapist still gets the two fixed QRs above.
  const loadSavedQRs = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('custom_qr_codes')
      .select('*')
      .eq('therapist_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('custom_qr_codes load failed (migration may not be run):', error.message);
      setSavedQRs([]);
    } else {
      setSavedQRs(data || []);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadSavedQRs(); }, [loadSavedQRs]);

  const addQR = async () => {
    const label = draftLabel.trim();
    const url = normalizeUrl(draftUrl);
    if (!label || !url) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('custom_qr_codes')
      .insert({ therapist_id: user.id, label, url })
      .select()
      .single();
    setSaving(false);
    if (error) {
      console.error('custom_qr_codes insert failed:', error);
      alert('Could not save. Please try again.');
      return;
    }
    setSavedQRs([data, ...savedQRs]);
    setDraftLabel('');
    setDraftUrl('');
    setAdding(false);
  };

  const updateQR = async (id, patch) => {
    // Optimistic update
    setSavedQRs((prev) => prev.map((q) => q.id === id ? { ...q, ...patch } : q));
    const { error } = await supabase
      .from('custom_qr_codes')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('custom_qr_codes update failed:', error);
      // Reload to sync truth
      loadSavedQRs();
    }
  };

  const deleteQR = async (id) => {
    // Optimistic delete
    setSavedQRs((prev) => prev.filter((q) => q.id !== id));
    const { error } = await supabase
      .from('custom_qr_codes')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('custom_qr_codes delete failed:', error);
      loadSavedQRs();
    }
  };

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

      {/* Two fixed QRs at the top */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
        alignItems: 'stretch',
        marginBottom: 24,
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
      </div>

      {/* Saved custom QR codes section */}
      <div style={{ borderTop: `1px solid ${C2.lightGray}`, paddingTop: 20 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12, gap: 8, flexWrap: 'wrap',
        }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.gray, margin: '0 0 4px' }}>
              ⭐ Your Saved QR Codes
            </p>
            <p style={{ fontSize: 12, color: C2.gray, margin: 0, lineHeight: 1.5 }}>
              Save your website, social pages, or any link you reuse. They stay here forever.
            </p>
          </div>
          {!adding && (
            <button onClick={() => setAdding(true)} style={{
              background: C2.forest, color: '#fff', border: 'none',
              padding: '8px 14px', borderRadius: 8,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              flexShrink: 0,
            }}>
              + Add a QR code
            </button>
          )}
        </div>

        {/* Add form — appears inline when "+ Add" is tapped */}
        {adding && (
          <div style={{
            background: '#FCF8EE', border: '1.5px solid #E8C5B5', borderRadius: 10,
            padding: 14, marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#5C2E27', marginBottom: 10 }}>
              Add a new custom QR code
            </div>
            <input
              type="text"
              placeholder="Label (e.g. My Instagram, Yelp Reviews)"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              maxLength={60}
              style={{
                width: '100%', padding: '9px 11px', fontSize: 13,
                border: `1.5px solid ${C2.lightGray}`, borderRadius: 8,
                marginBottom: 8, fontFamily: 'system-ui',
                boxSizing: 'border-box', outline: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Link (e.g. instagram.com/yourname)"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={500}
              style={{
                width: '100%', padding: '9px 11px', fontSize: 13,
                border: `1.5px solid ${C2.lightGray}`, borderRadius: 8,
                marginBottom: 12, fontFamily: 'system-ui',
                boxSizing: 'border-box', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setAdding(false); setDraftLabel(''); setDraftUrl(''); }} style={{
                background: 'transparent', color: C2.gray,
                border: `1px solid ${C2.lightGray}`, borderRadius: 7,
                padding: '7px 14px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={addQR} disabled={saving || !draftLabel.trim() || !draftUrl.trim()} style={{
                background: (saving || !draftLabel.trim() || !draftUrl.trim()) ? '#9CA3AF' : C2.forest,
                color: '#fff', border: 'none', borderRadius: 7,
                padding: '7px 14px', fontSize: 12, fontWeight: 700,
                cursor: (saving || !draftLabel.trim() || !draftUrl.trim()) ? 'not-allowed' : 'pointer',
              }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* List of saved QRs */}
        {loading ? (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: C2.gray }}>
            Loading your saved QR codes…
          </div>
        ) : savedQRs.length === 0 ? (
          !adding && (
            <div style={{
              background: '#F9FAFB', border: `1px dashed ${C2.lightGray}`, borderRadius: 10,
              padding: '20px 16px', textAlign: 'center', fontSize: 12, color: C2.gray,
              lineHeight: 1.6,
            }}>
              No saved QR codes yet. Tap <strong>+ Add a QR code</strong> to save your first one.
            </div>
          )
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            alignItems: 'stretch',
          }}>
            {savedQRs.map((qr) => (
              <QRPanel
                key={qr.id}
                title={qr.label}
                subtitle={qr.url}
                url={qr.url}
                filename={`bodymap-${slugify(qr.label)}-qr.png`}
                businessName={businessName}
                C2={C2}
                headerRight={<DeleteAffordance onDelete={() => deleteQR(qr.id)} C2={C2} />}
              >
                {/* Inline editable label inside the panel header. Renders
                    a small "Rename" affordance — therapists who want to
                    fix a typo do not have to delete + recreate. */}
                <div style={{ marginTop: -6, marginBottom: 6, fontSize: 11 }}>
                  <InlineEditField
                    value={qr.label}
                    type="text"
                    width="100%"
                    align="left"
                    fontSize={11}
                    fontWeight={500}
                    color={C2.gray}
                    ariaLabel={`Rename ${qr.label}`}
                    onSave={(v) => updateQR(qr.id, { label: String(v).trim() || qr.label })}
                  />
                </div>
              </QRPanel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
