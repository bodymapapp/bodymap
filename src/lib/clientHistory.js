// src/lib/clientHistory.js
//
// Dated, append-only history for the client's standing clinical facts.
// Each change to a tracked field writes an immutable row in
// client_fact_history. The clients column stays as the "current value";
// this table is the record behind it, so we can show a timeline and,
// later, summarize how a client changed over time.
//
// effective_on = the date the fact is true as of. For a document read
// that is the date printed on the form; for a manual edit it is today.
// recorded_at = when the entry was written.

import { supabase } from './supabase';

export const HISTORY_FIELDS = [
  'allergies', 'health_conditions', 'medications', 'areas_to_avoid', 'emergency_contact',
];

export const HISTORY_FIELD_LABELS = {
  allergies: 'Allergies',
  health_conditions: 'Conditions',
  medications: 'Medications',
  areas_to_avoid: 'Areas to avoid',
  emergency_contact: 'Emergency contact',
};

export const HISTORY_SOURCE_LABELS = {
  edit: 'edited', document: 'from a document', intake: 'from intake', import: 'imported',
};

function todayLocal() {
  // Local YYYY-MM-DD (toISOString would shift to UTC).
  try { return new Date().toLocaleDateString('en-CA'); } catch (_e) { return new Date().toISOString().slice(0, 10); }
}

// Append one history entry. Best-effort: never throws to the caller so a
// logging hiccup can never block a save. Skips tracked-field guard so
// callers can pass any of the five fields.
export async function recordFactHistory({
  therapistId, clientId, field, value, previousValue = null,
  source = 'edit', sourceDocumentId = null, effectiveOn = null,
}) {
  if (!therapistId || !clientId || !HISTORY_FIELDS.includes(field)) return;
  const v = value == null ? null : String(value).trim() || null;
  const pv = previousValue == null ? null : String(previousValue).trim() || null;
  if (v === pv) return; // nothing actually changed
  try {
    await supabase.from('client_fact_history').insert({
      therapist_id: therapistId,
      client_id: clientId,
      field,
      value: v,
      previous_value: pv,
      source,
      source_document_id: sourceDocumentId,
      effective_on: effectiveOn || todayLocal(),
      created_by: therapistId,
    });
  } catch (_e) { /* best effort, never block the save */ }
}

// Append several entries at once (used by the document apply).
export async function recordFactHistoryBatch(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const clean = rows
    .filter(r => r && r.therapistId && r.clientId && HISTORY_FIELDS.includes(r.field))
    .map(r => ({
      therapist_id: r.therapistId,
      client_id: r.clientId,
      field: r.field,
      value: r.value == null ? null : String(r.value).trim() || null,
      previous_value: r.previousValue == null ? null : String(r.previousValue).trim() || null,
      source: r.source || 'document',
      source_document_id: r.sourceDocumentId || null,
      effective_on: r.effectiveOn || todayLocal(),
      created_by: r.therapistId,
    }));
  if (clean.length === 0) return;
  try { await supabase.from('client_fact_history').insert(clean); } catch (_e) { /* best effort */ }
}

// Read the change history for a client, newest first.
export async function listFactHistory(clientId, { limit = 100 } = {}) {
  const { data, error } = await supabase
    .from('client_fact_history')
    .select('id, field, value, previous_value, source, source_document_id, effective_on, recorded_at')
    .eq('client_id', clientId)
    .order('effective_on', { ascending: false })
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
