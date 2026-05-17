// src/lib/findOrCreateClient.js
//
// Phase 13.1 (May 17 2026): every booking should have a client_id from
// the moment it is created. This helper finds-or-creates a clients row
// for a given (therapist_id, email) pair and returns the client_id.
//
// Why this exists:
//   The bookings table historically stored client_name + client_email +
//   client_phone as inline text. A clients row was only created later,
//   at intake or first card-save. That left a class of bugs where any
//   downstream feature needing client_id (Stripe customer linking,
//   longitudinal session intelligence, churn metrics, etc) had to do
//   its own find-or-create at runtime. HK called this out (May 17
//   2026): 'A client should be created at that time and then everything
//   connects to that client ID in client lifetime.'
//
// Behavior:
//   1. Normalizes email to lowercase + trim.
//   2. Looks up an existing clients row by (therapist_id, ilike email).
//      ilike is case-insensitive; we use it to defend against legacy
//      mixed-case rows. Returns the OLDEST matching row when multiple
//      exist (older = the canonical one in any future merge process).
//   3. If none found, inserts a new clients row with name + email +
//      optional phone, returns the new id.
//   4. If no email provided, returns null. Caller decides whether
//      that is acceptable (rare admin/external cases). bookings.client_id
//      is nullable.
//
// Idempotency:
//   Two concurrent callers with the same (therapist, email) could both
//   find no row and both try to insert. The clients table has no unique
//   constraint on (therapist_id, email) yet, so a race could create
//   duplicates. This is the same risk that exists today; the planned
//   merge process (BLOCK_PLAN) handles cleanup. A unique constraint
//   should be added in a follow-up migration once existing duplicates
//   are merged.
//
// Usage:
//   import { findOrCreateClient } from '../lib/findOrCreateClient';
//
//   const clientId = await findOrCreateClient({
//     supabase,                  // configured client
//     therapist_id: therapist.id,
//     name: form.name,
//     email: form.email,
//     phone: form.phone || null,
//   });
//
//   await supabase.from('bookings').insert({
//     therapist_id: therapist.id,
//     client_id: clientId,         // <-- now always set when email exists
//     client_name: form.name,
//     ...
//   });

export async function findOrCreateClient({ supabase, therapist_id, name, email, phone }) {
  if (!supabase) throw new Error('findOrCreateClient: supabase client is required');
  if (!therapist_id) throw new Error('findOrCreateClient: therapist_id is required');

  const normalizedEmail = (email || '').toString().trim().toLowerCase();
  if (!normalizedEmail) {
    // No email = no way to dedup. Caller may proceed with null client_id.
    return null;
  }

  // Step 1: try to find an existing matching clients row.
  const { data: existing, error: findErr } = await supabase
    .from('clients')
    .select('id')
    .eq('therapist_id', therapist_id)
    .ilike('email', normalizedEmail)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (findErr) {
    // We do not throw here. The lookup failing should not block a
    // booking from being created. Return null and let the caller
    // proceed without a client_id; the booking will still have
    // client_name + client_email and can be backfilled later.
    console.warn('findOrCreateClient: lookup failed', findErr);
    return null;
  }

  if (existing?.id) return existing.id;

  // Step 2: no existing row, create one.
  const { data: created, error: insertErr } = await supabase
    .from('clients')
    .insert({
      therapist_id,
      name: (name || '').toString().trim() || 'Client',
      email: normalizedEmail,
      phone: phone ? phone.toString().trim() : null,
    })
    .select('id')
    .single();

  if (insertErr) {
    // Race condition guard: if a parallel call beat us to the insert
    // and the database has a unique constraint, we will hit a 23505
    // duplicate-key error. Re-fetch the existing row in that case.
    if (insertErr.code === '23505') {
      const { data: refetch } = await supabase
        .from('clients')
        .select('id')
        .eq('therapist_id', therapist_id)
        .ilike('email', normalizedEmail)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (refetch?.id) return refetch.id;
    }
    console.warn('findOrCreateClient: insert failed', insertErr);
    return null;
  }

  return created?.id || null;
}
