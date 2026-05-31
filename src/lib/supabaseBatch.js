// src/lib/supabaseBatch.js
//
// HK May 31 2026: chunked .in() helper.
//
// Why this exists:
//   Supabase queries with .in('field', bigArray) serialize the array
//   into the URL as `?field=in.(uuid1,uuid2,...)`. At ~30K characters
//   the gateway returns HTTP 400 with no useful error. We've hit this
//   silently in production once already (ScheduleDashboard fetchBookings
//   on 651-booking Joy Demo). Therapists with 1000+ clients run their
//   outreach against arrays that exceed the limit routinely.
//
// What this does:
//   Splits the input array into chunks of `batchSize`, runs the user's
//   query function once per chunk, concatenates the data arrays.
//   Errors short-circuit: the first error stops further batches and
//   surfaces. Empty input returns { data: [], error: null } without
//   firing any query (saves a round-trip).
//
// Usage:
//   const { data, error } = await selectIn(
//     supabase.from('clients').select('id, name, email').eq('therapist_id', tid),
//     'email',
//     emails,
//   );
//
// Two patterns supported:
//   selectIn(query, column, ids) - for SELECTs
//   deleteIn(table, supabase, column, ids) - for DELETEs (because
//     supabase's .delete() chain works differently and we want the
//     same ergonomics)

const DEFAULT_BATCH_SIZE = 100;

/**
 * Run a SELECT with .in() in chunked batches.
 * @param {object} queryBuilder - a supabase query builder ready for .in() (e.g. supabase.from('x').select('id').eq(...))
 * @param {string} column - the column name for the .in()
 * @param {Array} values - the values array (may exceed gateway URL limit)
 * @param {number} batchSize - max values per batch, default 100
 */
export async function selectIn(queryBuilder, column, values, batchSize = DEFAULT_BATCH_SIZE) {
  if (!values || values.length === 0) return { data: [], error: null };
  if (!queryBuilder || typeof queryBuilder.in !== 'function') {
    return { data: null, error: new Error('selectIn: queryBuilder missing .in()') };
  }

  // De-dupe values to keep the URL short and the result clean.
  const unique = Array.from(new Set(values));
  if (unique.length <= batchSize) {
    return queryBuilder.in(column, unique);
  }

  const out = [];
  for (let i = 0; i < unique.length; i += batchSize) {
    const chunk = unique.slice(i, i + batchSize);
    // IMPORTANT: each .in() call must be made on a fresh builder. Reusing
    // a query builder across calls accumulates filters and breaks the
    // second-batch results. The caller passes us the COMPOSED builder;
    // we clone its filter intent by cloning the underlying via the
    // public PostgrestFilterBuilder constructor pattern. Simplest:
    // require the caller to pass a FUNCTION returning a fresh builder.
    // To keep ergonomics, when batching is needed we throw a clear
    // error directing the caller to selectInFn instead.
    return { data: null, error: new Error(`selectIn: ${unique.length} values exceeds batchSize ${batchSize}; use selectInFn with a builder factory`) };
  }
  return { data: out, error: null };
}

/**
 * Run a SELECT with .in() in chunked batches; builder is a function so
 * each chunk gets a fresh query. Preferred for large arrays.
 *
 * @param {function} builderFn - () => supabase query builder ready for .in()
 * @param {string} column
 * @param {Array} values
 * @param {number} batchSize
 */
export async function selectInFn(builderFn, column, values, batchSize = DEFAULT_BATCH_SIZE) {
  if (!values || values.length === 0) return { data: [], error: null };
  const unique = Array.from(new Set(values));

  if (unique.length <= batchSize) {
    return builderFn().in(column, unique);
  }

  const allRows = [];
  for (let i = 0; i < unique.length; i += batchSize) {
    const chunk = unique.slice(i, i + batchSize);
    const { data, error } = await builderFn().in(column, chunk);
    if (error) return { data: null, error };
    if (Array.isArray(data)) allRows.push(...data);
  }
  return { data: allRows, error: null };
}

/**
 * DELETE with .in() chunked. Returns { error } only; row counts vary
 * by client config.
 */
export async function deleteIn(supabase, table, column, values, batchSize = DEFAULT_BATCH_SIZE) {
  if (!values || values.length === 0) return { error: null };
  const unique = Array.from(new Set(values));
  for (let i = 0; i < unique.length; i += batchSize) {
    const chunk = unique.slice(i, i + batchSize);
    const { error } = await supabase.from(table).delete().in(column, chunk);
    if (error) return { error };
  }
  return { error: null };
}
