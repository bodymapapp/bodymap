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
//   1. Normalizes email to lowercase + trim, phone to last-10 digits.
//   2. If email is provided: look up by (therapist_id, ilike email).
//      ilike is case-insensitive; defends against legacy mixed-case
//      rows. Returns the OLDEST matching row when multiple exist.
//      Create a new clients row with name + email + optional phone
//      if no match.
//   3. If no email but phone is provided (walk-ins, phone-only clients,
//      paper-form transcriptions): look up by phone last-10 digits
//      scoped to therapist_id. If match, return that id. If not,
//      create a new clients row with name + phone (no email).
//   4. If neither email nor phone is provided, return null. Caller
//      decides whether that is acceptable (rare admin/external cases).
//      bookings.client_id is nullable.
//
// Phase 13.9 (May 24 2026): phone fallback added after Terra reported
// "Client record missing on this charge" on 11 bookings, all with
// empty client_email + a phone number. The prior version of this
// function returned null whenever email was missing, which caused
// every walk-in/phone-only booking to insert with NULL client_id and
// surface the broken-checkout error weeks later when the therapist
// tried to record payment. See FOUNDER_RUNBOOK Procedure 10.
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
  const normalizedPhone = phone
    ? phone.toString().replace(/\D/g, '').slice(-10)
    : '';

  // No identifying info at all: caller proceeds with null client_id.
  // Truly anonymous bookings are rare but valid (admin-created walk-in
  // with no contact info, gift-cert redemption flows, etc).
  if (!normalizedEmail && !normalizedPhone) {
    return null;
  }

  // ── Path A: We have an email. Look up by email, create if missing. ──
  if (normalizedEmail) {
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
      console.warn('findOrCreateClient: email lookup failed', findErr);
      return null;
    }

    if (existing?.id) return existing.id;

    // Phase 13.10 (May 24 2026): before creating a new client, check
    // whether a phone-only stub already exists for this person. Real
    // scenario: first booking comes in name+phone only (Path B creates
    // a stub with email=null), then the same person books again later
    // with email provided. Without this check, Path A would create a
    // second client row, duplicating the human. Enrichment rule:
    // match on phone last-10 digits, only consider rows where email
    // is null (phone-only stubs from prior incomplete bookings).
    // Different existing email means a different person sharing the
    // same phone (family, shared business line); we treat them as
    // separate and proceed to create. See FOUNDER_RUNBOOK Procedure 10.
    if (normalizedPhone) {
      const { data: phoneStubs } = await supabase
        .from('clients')
        .select('id, phone, email, created_at')
        .eq('therapist_id', therapist_id)
        .is('email', null)
        .not('phone', 'is', null)
        .order('created_at', { ascending: true });

      const stub = (phoneStubs || []).find(c => {
        const digits = (c.phone || '').replace(/\D/g, '').slice(-10);
        return digits === normalizedPhone;
      });

      if (stub?.id) {
        // Found a phone-only stub for this person. Enrich with the
        // newly-provided email and return the existing id. We only
        // patch email (not name); the therapist can edit the name
        // later if they want, and overwriting could clobber a name
        // they prefer (e.g. "Sandy" they recognize vs "Sandra Lin"
        // from this booking's form).
        await supabase
          .from('clients')
          .update({ email: normalizedEmail })
          .eq('id', stub.id);
        return stub.id;
      }
    }

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

  // ── Path B: No email but we have a phone. ─────────────────────────
  //
  // Phase 13.9 (May 24 2026): without this fallback, walk-in bookings
  // and paper-form transcriptions (where the therapist has a phone
  // but no email) silently inserted with NULL client_id. Real customer
  // Terra hit this 11 times via CSV import + therapist-entered bookings.
  // Look up by normalized last-10 digits scoped to this therapist, then
  // create-by-phone if no match. See FOUNDER_RUNBOOK Procedure 10.
  //
  // Phone uniqueness within a single therapist's client list is a
  // strong fingerprint. The match query strips all non-digits from
  // both sides, then compares last 10. Matches CSV-import variations
  // like '+14693166244, 469-316-6244, (469) 316-6244, 4693166244.
  const { data: existingByPhone, error: phoneFindErr } = await supabase
    .from('clients')
    .select('id, phone')
    .eq('therapist_id', therapist_id)
    .not('phone', 'is', null);

  if (phoneFindErr) {
    console.warn('findOrCreateClient: phone lookup failed', phoneFindErr);
    return null;
  }

  const match = (existingByPhone || []).find(c => {
    const digits = (c.phone || '').replace(/\D/g, '').slice(-10);
    return digits === normalizedPhone;
  });
  if (match?.id) return match.id;

  // No existing client by phone: create one with whatever info we have.
  // This is the canonical "walk-in" case. Better to have a real client
  // row with phone-only than an orphan booking we cannot charge against.
  const { data: createdByPhone, error: createByPhoneErr } = await supabase
    .from('clients')
    .insert({
      therapist_id,
      name: (name || '').toString().trim() || 'Client',
      email: null,
      phone: phone.toString().trim(),
    })
    .select('id')
    .single();

  if (createByPhoneErr) {
    console.warn('findOrCreateClient: phone-based insert failed', createByPhoneErr);
    return null;
  }

  return createdByPhone?.id || null;
}
