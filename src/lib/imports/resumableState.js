// src/lib/imports/resumableState.js
//
// Client-side resumable import state (HK May 22 2026 item B of A-J).
// Tracks an import's progress in localStorage so a tab close,
// navigation away, or wifi drop does not lose work. The therapist
// returns and gets offered 'resume' or 'start fresh'.
//
// Why client-side rather than server-side:
//   Server-side chunked imports via edge function + import_jobs
//   table is the bulletproof solution for 50K+ row scale. At
//   current scale (largest realistic CSV ~5000 rows), this
//   client-side checkpoint handles every realistic failure mode
//   while requiring zero schema changes. Server-side version is
//   queued in BLOCK_PLAN.
//
// State shape stored at key 'mbm.import.<therapistId>.<fileHash>':
// {
//   fileHash:    string  (FNV-1a of CSV content),
//   fileName:    string  (display only),
//   fileType:    'clients' | 'appointments',
//   rowCount:    number  (total rows in the file),
//   currentRow:  number  (next row to process),
//   phase:       'preparing' | 'looking-up-clients' | 'creating-bookings' | etc,
//   startedAt:   number  (Date.now() when import began),
//   updatedAt:   number  (Date.now() at last checkpoint),
//   runId:       string  (UUID, identifies this particular run),
//   mapping:     object  (column-index mapping from detectCsvType),
//   mergeOverrides: object  (fuzzy service merge decisions),
//   counts:      { created, skipped, failed }  (accumulator state),
//   skippedRows: Array,
//   failedRows:  Array,
// }
//
// Checkpoint is written every 25 rows during import. On success, the
// key is deleted. On explicit reset (user chose 'start fresh'), the
// key is deleted. Otherwise the checkpoint persists indefinitely and
// is offered on next mount.
//
// Expiry: checkpoints older than 7 days are pruned on mount so a
// user does not see a stale 'resume' offer from months ago.

const KEY_PREFIX = 'mbm.import.';
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// FNV-1a 32-bit hash. Fast, deterministic, sufficient for change
// detection. Not a cryptographic hash and does not need to be.
export function hashCsvContent(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function checkpointKey(therapistId, fileHash) {
  return `${KEY_PREFIX}${therapistId}.${fileHash}`;
}

// Save the current progress. Best-effort: localStorage may be full
// or disabled (private browsing), in which case we silently no-op.
export function saveCheckpoint(therapistId, fileHash, state) {
  if (!therapistId || !fileHash) return;
  try {
    const payload = { ...state, fileHash, updatedAt: Date.now() };
    localStorage.setItem(checkpointKey(therapistId, fileHash), JSON.stringify(payload));
  } catch {
    // Quota exceeded, private browsing, etc. Just lose the
    // checkpoint; the import still works without it.
  }
}

// Load an existing checkpoint for this file, or null if none.
export function loadCheckpoint(therapistId, fileHash) {
  if (!therapistId || !fileHash) return null;
  try {
    const raw = localStorage.getItem(checkpointKey(therapistId, fileHash));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    // Expire stale checkpoints
    if (parsed.updatedAt && Date.now() - parsed.updatedAt > EXPIRY_MS) {
      localStorage.removeItem(checkpointKey(therapistId, fileHash));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// Clear a checkpoint. Called on successful import OR when user
// chooses 'start fresh' rather than 'resume'.
export function clearCheckpoint(therapistId, fileHash) {
  if (!therapistId || !fileHash) return;
  try {
    localStorage.removeItem(checkpointKey(therapistId, fileHash));
  } catch {}
}

// List all unfinished imports for this therapist (any file). Used
// on mount so we can offer 'we found an unfinished import, do you
// want to resume?'. Also prunes any expired keys we encounter.
export function listUnfinishedImports(therapistId) {
  if (!therapistId) return [];
  const prefix = `${KEY_PREFIX}${therapistId}.`;
  const results = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') continue;
        if (parsed.updatedAt && Date.now() - parsed.updatedAt > EXPIRY_MS) {
          localStorage.removeItem(key);
          continue;
        }
        results.push(parsed);
      } catch {
        // Bad JSON; skip
      }
    }
  } catch {
    // localStorage disabled; return empty
  }
  return results.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// Generate a UUIDv4-ish run id. Not cryptographically random but
// sufficient for checkpoint identification.
export function generateRunId() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ (Math.random() * 16) >> (c / 4)).toString(16)
  );
}
