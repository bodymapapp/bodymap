// src/components/MultiImport.jsx
//
// Single unified import flow (HK May 21 2026 evening, Jackie multi-
// CSV insight). Replaces the two-tab Client/Appointment import as
// the default. Old tabs still accessible behind an Advanced link.
//
// Flow:
//   1. Therapist drops 1+ CSVs (drag-and-drop + file picker side by
//      side, per Design Principle #11 mobile-first: both visible).
//   2. We auto-detect each file's type by header inspection.
//   3. Show a single confirmation screen: "Found X clients in
//      file1.csv and Y appointments in file2.csv".
//   4. User confirms, we run client import first (UPSERT existing,
//      create new), then appointment import (cross-references the
//      client roster automatically).
//   5. Show unified summary.
//
// Design principles enforced:
//   #11 mobile-first: vertical stacked layout, no horizontal scroll.
//   #12 pre-flight: each file gets the same pre-flight checks as
//        the single-tab path before any DB writes.
//   #14 one way in: ONE button, the platform figures out which path
//        each file should take.
//   #15 HIPAA-aware: data uploads through the user's session, never
//        flows through HK or any non-clinical channel.

import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { parseCSV, detectCsvType } from '../lib/imports/detectCsvType';
import { runClientImport, runAppointmentImport } from '../lib/imports/runImports';
import { formatUSPhone } from '../lib/formatters/phone';
import { detectFuzzyMatches } from '../lib/imports/fuzzyServiceMatch';

const C = {
  forest: '#2A5741',
  forestDark: '#1F4030',
  sage: '#6B9E80',
  cream: '#FBFAF4',
  beige: '#F5F0E5',
  border: '#E8E4DC',
  ink: '#1F2937',
  gray: '#6B7280',
  light: '#E5E7EB',
  white: '#FFFFFF',
  amber: '#D97706',
  amberLight: '#FEF3C7',
  amberBorder: '#FCD34D',
  red: '#DC2626',
  redLight: '#FEF2F2',
  redBorder: '#FCA5A5',
  green: '#16A34A',
  greenLight: '#F0FDF4',
  greenBorder: '#86EFAC',
};

function FileCard({ file, onRemove }) {
  const { fileName, headers, rows, detected, error } = file;
  const typeColor = {
    clients: { bg: '#E0F2FE', border: '#7DD3FC', text: '#075985', label: '👥 Client roster' },
    appointments: { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E', label: '📅 Appointment history' },
    services: { bg: '#FCE7F3', border: '#F9A8D4', text: '#9F1239', label: '🔧 Services list' },
    unknown: { bg: '#FEE2E2', border: '#FCA5A5', text: '#991B1B', label: '❓ Unknown' },
  }[detected?.type || 'unknown'];

  return (
    <div style={{
      background: C.white,
      border: `1.5px solid ${C.border}`,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fileName}
          </div>
          <div style={{ fontSize: 11.5, color: C.gray, marginTop: 2 }}>
            {rows.length} row{rows.length === 1 ? '' : 's'}, {headers.length} columns
          </div>
        </div>
        <button
          onClick={onRemove}
          aria-label="Remove this file"
          style={{
            background: 'transparent',
            border: `1px solid ${C.light}`,
            color: C.gray,
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Remove
        </button>
      </div>
      <div style={{
        background: typeColor.bg,
        border: `1px solid ${typeColor.border}`,
        color: typeColor.text,
        padding: '6px 12px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        display: 'inline-block',
        marginRight: 8,
      }}>
        {typeColor.label}
      </div>
      {detected?.confidence === 'high' && (
        <span style={{ fontSize: 11, color: C.gray }}>auto-detected</span>
      )}
      {detected?.confidence === 'low' && (
        <span style={{ fontSize: 11, color: C.amber, fontWeight: 600 }}>low confidence, please verify</span>
      )}
      {detected?.reason && (
        <div style={{ fontSize: 11.5, color: C.gray, marginTop: 6, fontStyle: 'italic' }}>
          {detected.reason}
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: C.red, marginTop: 6 }}>{error}</div>
      )}
    </div>
  );
}

export default function MultiImport({ therapist, onComplete }) {
  const [files, setFiles] = useState([]); // [{ fileName, headers, rows, detected, error }]
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Preview state (HK May 21 2026 evening): after files are dropped
  // and classified, the therapist gets one more screen showing
  // what's about to happen with first-10-row sample tables. They
  // confirm before any database write.
  const [showPreview, setShowPreview] = useState(false);
  // Fuzzy service match state (HK May 21 evening, full version):
  // when the preview opens, fetch existing services and check
  // each new service name against them. Surface matches with merge
  // controls. User decisions (mergeOverrides) get passed to the
  // runner so it uses the merge target instead of auto-creating.
  // Shape:
  //   fuzzyMatches: Map<newServiceName, Array<{ id, name, score, reason }>>
  //   mergeOverrides: Map<newServiceName, existingServiceId>
  //     where 'skip' means 'create new, do not merge'.
  const [existingServices, setExistingServices] = useState([]);
  const [fuzzyMatches, setFuzzyMatches] = useState(new Map());
  const [mergeOverrides, setMergeOverrides] = useState(new Map());
  const fileInputRef = useRef(null);

  // Browser warning during import (HK May 21 evening): if the user
  // tries to close the tab mid-import, surface the native browser
  // confirm prompt. This is the modern web's equivalent of "are
  // you sure?". Resumable imports are the better long-term answer
  // and queued in BLOCK_PLAN; this protects against accidental
  // close in the meantime.
  React.useEffect(() => {
    if (!importing) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = 'Import is still running. Closing this tab now may leave your data partially imported.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [importing]);

  // Rotating friendly tips during import (HK May 22 2026: 'say
  // something funny like go get a cup of coffee or water'). Keeps
  // the wait feeling intentional rather than dead. Rotates every 5
  // seconds. Pool of tips picked at random on each rotation to
  // avoid the same therapist seeing the same sequence twice.
  const TIPS = [
    'Now would be a great time to grab a coffee.',
    'Or a glass of water. Hydration is a love language.',
    'Stretch your neck. You earned it.',
    'This might be a good moment to take three deep breaths.',
    'Pet a dog if one is nearby. Cat works too.',
    'Look out a window for 20 seconds. Real, science-backed eye rest.',
    'We are gently waking up your client records one at a time.',
    'Every row we read is a future session that lands cleanly.',
    'You are doing the hard part of switching platforms. We respect that.',
    'If you have a houseplant, this is a good moment to thank it.',
    'Think of one client you are excited to message after this.',
    'Roll your shoulders back five times. Yes, right now.',
    'Your CSV had real, thoughtful data in it. Nice work over there.',
    'We are being careful with your data. Slow is smooth, smooth is fast.',
    'Almost there. Or maybe not. But the vibes are immaculate.',
  ];
  const [tipIdx, setTipIdx] = useState(0);
  React.useEffect(() => {
    if (!importing) return;
    // Start with a random tip so two imports in a row don't show
    // the same first one
    setTipIdx(Math.floor(Math.random() * TIPS.length));
    const interval = setInterval(() => {
      setTipIdx(prev => (prev + 1 + Math.floor(Math.random() * 3)) % TIPS.length);
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importing]);

  async function readFile(f) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const { headers, rows } = parseCSV(ev.target.result);
          if (headers.length === 0 || rows.length === 0) {
            resolve({ fileName: f.name, headers: [], rows: [], detected: null, error: 'File appears empty' });
            return;
          }
          const detected = detectCsvType(headers, rows);
          resolve({ fileName: f.name, headers, rows, detected, error: null });
        } catch (e) {
          resolve({ fileName: f.name, headers: [], rows: [], detected: null, error: 'Could not parse CSV' });
        }
      };
      reader.onerror = () => resolve({ fileName: f.name, headers: [], rows: [], detected: null, error: 'File read failed' });
      reader.readAsText(f);
    });
  }

  async function addFiles(fileList) {
    const csvOnly = [...fileList].filter(f => /\.csv$/i.test(f.name));
    if (csvOnly.length === 0) {
      alert('Please drop CSV files only.');
      return;
    }
    const parsed = await Promise.all(csvOnly.map(readFile));
    setFiles(prev => [...prev, ...parsed]);
  }

  function handleFileInput(e) {
    if (e.target.files?.length) {
      addFiles(e.target.files);
      e.target.value = ''; // allow re-selecting the same file
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      addFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setDragOver(false);
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  function overrideType(idx, newType) {
    setFiles(prev => prev.map((f, i) => {
      if (i !== idx) return f;
      // Re-detect with the user's override forced
      const headers = f.headers.map(x => x.toLowerCase().trim());
      // Build a mapping appropriate for the chosen type by running
      // detectCsvType and then forcing the type field
      const detected = { ...f.detected, type: newType, confidence: 'high', reason: 'Set manually by you' };
      return { ...f, detected };
    }));
  }

  // ── The actual import runner ──
  async function runAll() {
    setImporting(true);
    setProgress({ phase: 'starting', current: 0, total: 0 });

    // Order: clients first (so appointments can cross-reference),
    // then appointments. Services-only files are not yet handled
    // through this path (rare; therapists usually configure these
    // in Settings). If encountered, we surface a polite skip note.
    const clientFiles = files.filter(f => f.detected?.type === 'clients');
    const appointmentFiles = files.filter(f => f.detected?.type === 'appointments');
    const skippedFiles = files.filter(f =>
      f.detected?.type !== 'clients' &&
      f.detected?.type !== 'appointments'
    );

    const aggregate = {
      clientsCreated: 0,
      clientsUpdated: 0,
      clientsSkipped: 0,
      clientsFailed: 0,
      appointmentsCreated: 0,
      appointmentsSkipped: 0,
      appointmentsFailed: 0,
      membershipsCreated: 0,
      membershipsFailed: 0,
      perFile: [],
    };

    // ── Clients first ──
    for (const f of clientFiles) {
      try {
        const r = await runClientImport(
          supabase, therapist, f.headers, f.rows, f.detected.mapping,
          { onProgress: (p) => setProgress({ ...p, fileName: f.fileName }) }
        );
        aggregate.clientsCreated += r.created;
        aggregate.clientsSkipped += r.skipped;
        aggregate.clientsFailed += r.failed;
        aggregate.membershipsCreated += r.membershipsCreated || 0;
        aggregate.membershipsFailed += r.membershipsFailed || 0;
        // The skipped count for "already_exists" with UPSERT updates
        // counts as updates for the summary surface
        aggregate.clientsUpdated += r.skippedRows.filter(s =>
          s.reason === 'already_exists' && /filled in/.test(s.details || '')
        ).length;
        aggregate.perFile.push({
          fileName: f.fileName,
          type: 'clients',
          ...r,
        });
      } catch (e) {
        console.error('[multi-import] client file failed:', f.fileName, e);
        aggregate.perFile.push({
          fileName: f.fileName,
          type: 'clients',
          error: e?.message || 'Unknown error',
        });
      }
    }

    // ── Then appointments (now that client roster is in) ──
    for (const f of appointmentFiles) {
      try {
        const r = await runAppointmentImport(
          supabase, therapist, f.headers, f.rows, f.detected.mapping,
          {
            onProgress: (p) => setProgress({ ...p, fileName: f.fileName }),
            serviceMergeOverrides: mergeOverrides,
          }
        );
        aggregate.appointmentsCreated += r.created;
        aggregate.appointmentsSkipped += r.skipped;
        aggregate.appointmentsFailed += r.failed;
        aggregate.clientsCreated += r.clientsCreated || 0;
        aggregate.perFile.push({
          fileName: f.fileName,
          type: 'appointments',
          ...r,
        });
      } catch (e) {
        console.error('[multi-import] appointment file failed:', f.fileName, e);
        aggregate.perFile.push({
          fileName: f.fileName,
          type: 'appointments',
          error: e?.message || 'Unknown error',
        });
      }
    }

    for (const f of skippedFiles) {
      aggregate.perFile.push({
        fileName: f.fileName,
        type: f.detected?.type || 'unknown',
        skippedFile: true,
        reason: `Files of type "${f.detected?.type || 'unknown'}" are not yet supported in this unified flow. You can use Advanced import options below.`,
      });
    }

    setProgress(null);
    setResults(aggregate);
    setImporting(false);

    // Track activation
    if (aggregate.clientsCreated > 0 && therapist?.id) {
      try {
        const { trackActivation } = await import('../lib/activation');
        trackActivation(therapist.id, 'imported_clients', { count: aggregate.clientsCreated });
      } catch {}
    }
    if (onComplete) onComplete();
  }

  function downloadCsv(filename, headers, rows) {
    const csvHeader = [...headers, 'bm_reason', 'bm_details'].map(h =>
      /[",\n]/.test(h) ? `"${h.replace(/"/g, '""')}"` : h
    ).join(',');
    const csvRows = rows.map(r => {
      const cells = [
        ...(r.row || []),
        r.reason || '',
        r.details || '',
      ];
      return cells.map(c => {
        const s = String(c ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',');
    });
    const blob = new Blob([csvHeader + '\n' + csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setFiles([]);
    setResults(null);
    setProgress(null);
  }

  // ── RESULTS SCREEN ──
  if (results) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{
          background: C.greenLight,
          border: `1.5px solid ${C.greenBorder}`,
          borderRadius: 12,
          padding: 18,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.green, marginBottom: 10 }}>
            ✓ Import complete
          </div>
          <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.7 }}>
            <div><strong>{results.clientsCreated}</strong> new client{results.clientsCreated === 1 ? '' : 's'} created</div>
            {results.clientsUpdated > 0 && (
              <div><strong>{results.clientsUpdated}</strong> existing client{results.clientsUpdated === 1 ? '' : 's'} filled in with new email or phone</div>
            )}
            {results.appointmentsCreated > 0 && (
              <div><strong>{results.appointmentsCreated}</strong> appointment{results.appointmentsCreated === 1 ? '' : 's'} added</div>
            )}
            {results.membershipsCreated > 0 && (
              <div><strong>{results.membershipsCreated}</strong> membership{results.membershipsCreated === 1 ? '' : 's'} created</div>
            )}
            {(results.clientsSkipped > 0 || results.appointmentsSkipped > 0) && (
              <div style={{ marginTop: 8, color: C.gray, fontSize: 13 }}>
                {results.clientsSkipped + results.appointmentsSkipped} row{(results.clientsSkipped + results.appointmentsSkipped) === 1 ? '' : 's'} skipped (already in your account or missing required fields)
              </div>
            )}
            {(results.clientsFailed > 0 || results.appointmentsFailed > 0) && (
              <div style={{ marginTop: 4, color: C.red, fontSize: 13 }}>
                {results.clientsFailed + results.appointmentsFailed} row{(results.clientsFailed + results.appointmentsFailed) === 1 ? '' : 's'} failed
              </div>
            )}
          </div>
        </div>

        {/* Per-file results with downloadable CSVs */}
        {results.perFile.map((pf, i) => (
          <div key={i} style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 14,
            marginBottom: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 6 }}>{pf.fileName}</div>
            {pf.skippedFile ? (
              <div style={{ fontSize: 12, color: C.amber }}>{pf.reason}</div>
            ) : pf.error ? (
              <div style={{ fontSize: 12, color: C.red }}>{pf.error}</div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: C.gray, marginBottom: 8 }}>
                  {pf.type === 'clients' ? 'Client roster' : 'Appointment history'}: {pf.created} created, {pf.skipped} skipped, {pf.failed} failed
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {pf.skippedRows?.length > 0 && (
                    <button
                      onClick={() => downloadCsv(`skipped-${pf.fileName}`, files.find(f => f.fileName === pf.fileName)?.headers || [], pf.skippedRows)}
                      style={{
                        background: C.amberLight, color: '#78350F', border: `1px solid ${C.amberBorder}`,
                        padding: '6px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Download {pf.skippedRows.length} skipped row{pf.skippedRows.length === 1 ? '' : 's'}
                    </button>
                  )}
                  {pf.failedRows?.length > 0 && (
                    <button
                      onClick={() => downloadCsv(`failed-${pf.fileName}`, files.find(f => f.fileName === pf.fileName)?.headers || [], pf.failedRows)}
                      style={{
                        background: C.redLight, color: C.red, border: `1px solid ${C.redBorder}`,
                        padding: '6px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Download {pf.failedRows.length} failed row{pf.failedRows.length === 1 ? '' : 's'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}

        <button
          onClick={reset}
          style={{
            marginTop: 16,
            background: C.forest, color: '#fff', border: 'none',
            padding: '12px 24px', borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Import more files
        </button>
      </div>
    );
  }

  // ── PREVIEW SCREEN (HK May 21 evening): show what's about to
  // happen before the database write. Therapist confirms or
  // cancels. Renders a small sample table for each file with the
  // detected mapping applied. ──
  if (showPreview && !importing && !results) {
    const totalRows = files.reduce((sum, f) => sum + f.rows.length, 0);
    const clientFileCount = files.filter(f => f.detected?.type === 'clients').length;
    const apptFileCount = files.filter(f => f.detected?.type === 'appointments').length;

    return (
      <div style={{ padding: 20 }}>
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 19, fontWeight: 700, color: C.forest, margin: '0 0 6px' }}>
            Preview before importing
          </h3>
          <p style={{ fontSize: 13, color: C.gray, margin: 0, lineHeight: 1.55 }}>
            Here's what we'll bring into your account. Look at the first few rows of each file to make sure things landed in the right columns. Tap Import to confirm, or Back to adjust.
          </p>
        </div>

        <div style={{
          background: C.greenLight,
          border: `1.5px solid ${C.greenBorder}`,
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
          fontSize: 13.5,
          color: C.ink,
          lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: C.green }}>About to import</div>
          {clientFileCount > 0 && (
            <div>📋 <strong>{clientFileCount}</strong> client roster file{clientFileCount === 1 ? '' : 's'}</div>
          )}
          {apptFileCount > 0 && (
            <div>📅 <strong>{apptFileCount}</strong> appointment history file{apptFileCount === 1 ? '' : 's'}</div>
          )}
          <div style={{ marginTop: 6 }}>
            <strong>{totalRows}</strong> total row{totalRows === 1 ? '' : 's'} across all files
          </div>
        </div>

        {files.map((f, idx) => {
          if (!f.detected || f.detected.type === 'unknown') return null;
          const m = f.detected.mapping;
          const isClient = f.detected.type === 'clients';
          const preview = f.rows.slice(0, 5);

          const get = (row, col) => col >= 0 && col < row.length ? (row[col] || '').trim() : '';

          // Columns to show in preview, by type
          const cols = isClient ? [
            { label: 'Name', render: (r) => {
              const fn = get(r, m.firstName);
              const ln = get(r, m.lastName);
              const full = get(r, m.fullName);
              return [fn, ln].filter(Boolean).join(' ') || full || '-';
            }},
            { label: 'Email', render: (r) => get(r, m.email) || '-' },
            { label: 'Phone', render: (r) => formatUSPhone(get(r, m.phone)) || '-' },
            { label: 'City', render: (r) => get(r, m.city) || '-' },
            { label: 'State', render: (r) => get(r, m.state) || '-' },
            { label: 'Zip', render: (r) => get(r, m.zip) || '-' },
          ] : [
            { label: 'Client', render: (r) => get(r, m.clientName) || '-' },
            { label: 'Service', render: (r) => get(r, m.service) || '-' },
            { label: 'Date', render: (r) => get(r, m.date) || '-' },
            { label: 'Time', render: (r) => get(r, m.startTime) || '-' },
            { label: 'Duration', render: (r) => {
              const d = get(r, m.duration);
              return d ? `${d} min` : '-';
            }},
            { label: 'Email', render: (r) => get(r, m.clientEmail) || '-' },
            { label: 'Phone', render: (r) => formatUSPhone(get(r, m.clientPhone)) || '-' },
          ];

          return (
            <div key={idx} style={{
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: 12,
              marginBottom: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{f.fileName}</div>
                <div style={{ fontSize: 11.5, color: C.gray }}>
                  showing first {preview.length} of {f.rows.length} rows
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: C.beige }}>
                      {cols.map(c => (
                        <th key={c.label} style={{
                          padding: '7px 10px',
                          textAlign: 'left',
                          fontWeight: 700,
                          color: C.gray,
                          borderBottom: `1px solid ${C.light}`,
                          whiteSpace: 'nowrap',
                        }}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, ri) => (
                      <tr key={ri} style={{ borderBottom: `1px solid ${C.light}` }}>
                        {cols.map(c => (
                          <td key={c.label} style={{
                            padding: '7px 10px',
                            color: C.ink,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 200,
                          }}>{c.render(r)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* Fuzzy service match section (HK May 21 evening, full version).
            Surface near-matches the therapist may want to merge instead
            of creating duplicates. Each row shows the new name, the
            existing match(es), and merge controls. */}
        {fuzzyMatches.size > 0 && (
          <div style={{
            background: '#FEF7E8',
            border: '1.5px solid #F0D89C',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>
              {fuzzyMatches.size} new service name{fuzzyMatches.size === 1 ? '' : 's'} look similar to your existing services
            </div>
            <div style={{ fontSize: 12.5, color: '#78350F', lineHeight: 1.55, marginBottom: 14 }}>
              Tap "Use this one" to merge into the existing service. Tap "Create as new" to keep them separate. If you skip, we create as new.
            </div>
            {[...fuzzyMatches.entries()].map(([newName, matches]) => {
              const currentOverride = mergeOverrides.get(newName);
              return (
                <div key={newName} style={{
                  background: '#fff',
                  border: '1px solid #F0D89C',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 10,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
                    From your CSV: <span style={{ fontStyle: 'italic' }}>"{newName}"</span>
                  </div>
                  {matches.map(m => (
                    <div key={m.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                      padding: '8px 10px',
                      background: currentOverride === m.id ? '#F0FDF4' : C.cream,
                      border: `1.5px solid ${currentOverride === m.id ? C.greenBorder : C.border}`,
                      borderRadius: 8,
                      marginBottom: 6,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                          {m.reason} · {Math.round(m.score * 100)}% similar
                        </div>
                      </div>
                      <button
                        onClick={() => setMergeOverrides(prev => {
                          const next = new Map(prev);
                          if (currentOverride === m.id) {
                            next.delete(newName);
                          } else {
                            next.set(newName, m.id);
                          }
                          return next;
                        })}
                        style={{
                          background: currentOverride === m.id ? C.green : C.forest,
                          color: '#fff',
                          border: 'none',
                          padding: '7px 14px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        {currentOverride === m.id ? '✓ Will merge' : 'Use this one'}
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setMergeOverrides(prev => {
                      const next = new Map(prev);
                      next.set(newName, 'skip');
                      return next;
                    })}
                    style={{
                      marginTop: 4,
                      background: 'transparent',
                      color: C.gray,
                      border: `1px solid ${C.light}`,
                      padding: '6px 12px',
                      borderRadius: 999,
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {currentOverride === 'skip' ? '✓ Create as new' : 'Create as new'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Confirmation actions */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => { setShowPreview(false); runAll(); }}
            style={{
              flex: '2 1 200px',
              background: 'linear-gradient(135deg, #2A5741, #1F4030)',
              color: '#fff',
              border: 'none',
              padding: '14px 24px',
              borderRadius: 999,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(42, 87, 65, 0.25)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Looks good, import now
          </button>
          <button
            onClick={() => setShowPreview(false)}
            style={{
              flex: '1 1 120px',
              background: 'transparent',
              color: C.gray,
              border: `1.5px solid ${C.light}`,
              padding: '14px 24px',
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // ── IMPORTING (progress) SCREEN ──
  if (importing) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.forest, marginBottom: 12 }}>
          Importing your data...
        </div>
        {progress && (
          <>
            <div style={{ fontSize: 13, color: C.gray, marginBottom: 6 }}>
              {progress.fileName ? `${progress.fileName}: ` : ''}{
                progress.phase === 'preparing' ? 'Reading the file' :
                progress.phase === 'looking-up-clients' ? 'Looking up existing clients' :
                progress.phase === 'creating-new-clients' ? 'Creating new client records' :
                progress.phase === 'creating-bookings' ? 'Adding appointments' :
                progress.phase === 'importing-clients' ? 'Adding clients' :
                progress.phase
              }
            </div>
            <div style={{ fontSize: 12, color: C.gray }}>
              {progress.current} of {progress.total}
            </div>
          </>
        )}
        {/* Rotating friendly tip (HK May 22 2026). Refreshes every
            5 seconds so the wait feels intentional. */}
        <div style={{
          marginTop: 28,
          padding: '14px 18px',
          background: C.cream,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          maxWidth: 380,
          marginLeft: 'auto',
          marginRight: 'auto',
          fontSize: 13.5,
          color: C.ink,
          fontStyle: 'italic',
          lineHeight: 1.5,
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'opacity 0.3s',
        }}
          key={tipIdx}
        >
          ☕ {TIPS[tipIdx]}
        </div>
        <div style={{ fontSize: 11.5, color: C.gray, marginTop: 14, fontStyle: 'italic' }}>
          Please keep this tab open while we work.
        </div>
      </div>
    );
  }

  // ── DROP / SELECT FILES SCREEN ──
  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 19, fontWeight: 700, color: C.forest, margin: '0 0 4px' }}>
          Bring in your data
        </h3>
        <p style={{ fontSize: 13, color: C.gray, margin: 0, lineHeight: 1.55 }}>
          Drop your CSV files from MassageBook, Vagaro, GlossGenius, Mindbody, Square, or anywhere else. We'll figure out which is which (clients, appointments) and merge them together. You can drop multiple files at once.
        </p>
      </div>

      {/* Drag-and-drop + file picker, both visible (Maria-persona +
          power user side-by-side per design principle #11) */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            flex: '1 1 280px',
            minHeight: 140,
            border: `2px dashed ${dragOver ? C.forest : C.border}`,
            background: dragOver ? C.greenLight : C.cream,
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: 26, marginBottom: 6 }}>📁</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4, textAlign: 'center' }}>
            Drag CSV files here
          </div>
          <div style={{ fontSize: 12, color: C.gray, textAlign: 'center' }}>
            One file or several at once
          </div>
        </div>
        <div style={{
          flex: '1 1 280px',
          minHeight: 140,
          background: C.cream,
          border: `1.5px solid ${C.border}`,
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 10, textAlign: 'center' }}>
            Or pick files from your phone
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            multiple
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'linear-gradient(135deg, #2A5741, #1F4030)',
              color: '#fff',
              border: 'none',
              padding: '11px 22px',
              borderRadius: 999,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Choose CSV files
          </button>
        </div>
      </div>

      {/* Detected files */}
      {files.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            {files.length} file{files.length === 1 ? '' : 's'} ready
          </div>
          {files.map((f, i) => (
            <FileCard key={i} file={f} onRemove={() => removeFile(i)} />
          ))}
        </div>
      )}

      {/* Import button: shows preview before commit */}
      {files.length > 0 && files.every(f => !f.error && f.detected?.type !== 'unknown') && (
        <button
          onClick={async () => {
            // Fetch existing services for fuzzy matching, then collect
            // all new service names from the dropped files and check
            // for near-matches.
            const { data: services } = await supabase
              .from('services')
              .select('id, name')
              .eq('therapist_id', therapist.id)
              .eq('active', true);
            const existing = services || [];
            setExistingServices(existing);

            // Collect new service names from appointment files
            const newServiceNames = new Set();
            for (const f of files) {
              if (f.detected?.type !== 'appointments') continue;
              const m = f.detected.mapping;
              if (m.service < 0) continue;
              for (const row of f.rows) {
                const v = (row[m.service] || '').trim();
                if (v) newServiceNames.add(v);
              }
            }

            // Filter out names that already match exactly (case-insensitive)
            const existingNamesLower = new Set(existing.map(s => s.name.toLowerCase().trim()));
            const trulyNew = [...newServiceNames].filter(n =>
              !existingNamesLower.has(n.toLowerCase().trim())
            );

            // Detect fuzzy matches for the truly new names
            const matches = detectFuzzyMatches(trulyNew, existing, { threshold: 0.70 });
            setFuzzyMatches(matches);

            // Default: no merge overrides set; if therapist takes no
            // action, we create the new services as standalone.
            setMergeOverrides(new Map());

            setShowPreview(true);
          }}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #2A5741, #1F4030)',
            color: '#fff',
            border: 'none',
            padding: '14px 28px',
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(42, 87, 65, 0.25)',
            marginBottom: 14,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Preview {files.reduce((sum, f) => sum + f.rows.length, 0)} row{files.reduce((sum, f) => sum + f.rows.length, 0) === 1 ? '' : 's'} from {files.length} file{files.length === 1 ? '' : 's'}
        </button>
      )}

      {files.some(f => f.detected?.type === 'unknown' && !f.error) && (
        <div style={{
          background: C.amberLight, border: `1.5px solid ${C.amberBorder}`,
          borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13, color: '#78350F',
        }}>
          One or more files could not be auto-classified. You can remove them, or use Advanced import options below to set the mapping manually.
        </div>
      )}

      {/* Advanced (legacy two-tab path) */}
      <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${C.light}` }}>
        <button
          onClick={() => setShowAdvanced(v => !v)}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.gray,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {showAdvanced ? '▾' : '▸'} Advanced import options
        </button>
        {showAdvanced && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12.5, color: C.gray, lineHeight: 1.55, marginBottom: 10 }}>
              The advanced path lets you map columns manually, useful for unusual CSV formats or troubleshooting. Most therapists should use the unified flow above.
            </div>
            <a
              href="#legacy-import"
              onClick={(e) => {
                e.preventDefault();
                // Bubble up to parent to switch to legacy
                if (onComplete) onComplete({ openLegacy: true });
              }}
              style={{ color: C.forest, fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}
            >
              Open the legacy import (Client + Appointment tabs)
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
