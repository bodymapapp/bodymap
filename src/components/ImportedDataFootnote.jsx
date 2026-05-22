// src/components/ImportedDataFootnote.jsx
//
// Small inline note indicating that the metrics on this surface
// include data brought in from another platform via CSV import.
// Distinguishes "MyBodyMap-native" data from "imported history"
// so therapists don't mistake imported records for native ones.
//
// HK May 21 2026 evening: 'Just include that footnote in the
// metrics and charts until all data is new from our platform.'
//
// USAGE:
//   import ImportedDataFootnote from './ImportedDataFootnote';
//   <ImportedDataFootnote
//     therapistId={therapist.id}
//     metricType="revenue"  // optional, just changes wording
//   />
//
// The component renders nothing if the therapist has zero imported
// records. Only shows when the count is meaningful (> 0).
//
// Lookup is cached: a single query per therapist per session.

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Module-level cache so a Dashboard with multiple metric surfaces
// doesn't refetch on every render.
const cache = new Map(); // therapistId -> { hasImports: bool, fetchedAt: number }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

async function fetchHasImports(therapistId) {
  const cached = cache.get(therapistId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.hasImports;
  }

  // Check clients table for any rows with imported_from set
  // (faster than scanning bookings.notes substring).
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('therapist_id', therapistId)
    .not('imported_from', 'is', null)
    .limit(1);

  let hasImports = false;
  if (!error) {
    // .limit(1) with head:true returns count via the response header,
    // but we just need to know if any exist. Check clients result first.
    const { count } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('therapist_id', therapistId)
      .not('imported_from', 'is', null);
    hasImports = (count || 0) > 0;
  }

  // Fallback: check bookings.notes for imported markers
  if (!hasImports) {
    const { count: bookingCount } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('therapist_id', therapistId)
      .ilike('notes', '%Imported%');
    hasImports = (bookingCount || 0) > 0;
  }

  cache.set(therapistId, { hasImports, fetchedAt: Date.now() });
  return hasImports;
}

export default function ImportedDataFootnote({ therapistId, metricType = 'sessions', style = {} }) {
  const [hasImports, setHasImports] = useState(false);

  useEffect(() => {
    if (!therapistId) return;
    let cancelled = false;
    fetchHasImports(therapistId).then(v => { if (!cancelled) setHasImports(v); });
    return () => { cancelled = true; };
  }, [therapistId]);

  if (!hasImports) return null;

  const wording = {
    revenue: 'Includes revenue from imported historical sessions.',
    sessions: 'Includes sessions imported from your previous platform.',
    clients: 'Includes clients imported from your previous platform.',
    generic: 'Includes data imported from your previous platform.',
  }[metricType] || 'Includes data imported from your previous platform.';

  return (
    <div style={{
      fontSize: 11.5,
      color: '#6B7280',
      fontStyle: 'italic',
      lineHeight: 1.5,
      padding: '6px 0 0',
      borderTop: '1px dashed #E5E7EB',
      marginTop: 8,
      ...style,
    }}>
      <span style={{ marginRight: 4 }}>ℹ️</span>
      {wording} You can identify imported records by the "Imported" tag in their profile.
    </div>
  );
}
