// src/lib/imports/runImports.js
//
// Pure import functions extracted from ImportClients.js (HK May 21
// 2026 evening, Jackie multi-CSV insight). These run the actual
// database writes for a client import or appointment import, taking
// (therapist, headers, rows, mapping, opts) and returning a results
// object.
//
// Pure means: no React state, no setState calls, no DOM. Just
// supabase + the inputs + a return value. This lets MultiImport.jsx
// run both passes in sequence over multiple CSVs without needing to
// render and auto-advance the existing ImportClients/ImportBookings
// components.
//
// Two exports:
//   runClientImport(supabase, therapist, headers, rows, mapping, opts)
//   runAppointmentImport(supabase, therapist, headers, rows, mapping, opts)
//
// Both return:
//   {
//     created: number,
//     skipped: number,
//     failed: number,
//     total: number,
//     skippedRows: Array<{ row, reason, details }>,
//     failedRows:  Array<{ row, reason, details }>,
//     membershipsCreated?: number, // client import only
//     membershipsFailed?: number,  // client import only
//   }
//
// HK Standing rules:
//   - No silent auto-create. Pre-flight checks run BEFORE this is
//     called; this function trusts the caller has validated the
//     mapping. If you want pre-flight, run it before calling.
//   - UPSERT semantics on clients: existing client matched by
//     email, then phone (normalized), then name. When matched,
//     missing fields are filled in from the new row.
//   - All errors recorded into skippedRows or failedRows so the
//     therapist can see which rows had what problem.

const normalizePhone = (p) => (p || '').replace(/\D/g, '');

// ─────────────────────────────────────────────────────────────────
// CLIENT IMPORT (with optional historical bookings + memberships)
// ─────────────────────────────────────────────────────────────────

export async function runClientImport(supabase, therapist, headers, rows, mapping, opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  // Resumable import (HK May 22 2026 item B). If resumeFrom is set,
  // we skip rows that already completed. Counts and skipped/failed
  // arrays are seeded from the prior partial run via opts.seedCounts
  // and opts.seedSkippedRows/seedFailedRows so the final summary
  // reflects total progress, not just this resume slice.
  // onCheckpoint(state) is called every 25 rows with the current
  // accumulator state. The caller persists it via resumableState.js.
  const resumeFrom = Number.isFinite(opts.resumeFrom) ? Math.max(0, opts.resumeFrom) : 0;
  const onCheckpoint = opts.onCheckpoint || (() => {});

  let created = opts.seedCounts?.created || 0;
  let skipped = opts.seedCounts?.skipped || 0;
  let failed  = opts.seedCounts?.failed  || 0;
  let membershipsCreated = opts.seedCounts?.membershipsCreated || 0;
  let membershipsFailed  = opts.seedCounts?.membershipsFailed  || 0;
  const skippedRows = Array.isArray(opts.seedSkippedRows) ? [...opts.seedSkippedRows] : [];
  const failedRows  = Array.isArray(opts.seedFailedRows)  ? [...opts.seedFailedRows]  : [];
  const serviceCache = new Map();
  const membershipCache = new Map();

  // Service auto-create helper. Returns id of existing or newly-
  // created service. Returns null on hard failure.
  async function resolveServiceId(serviceName, defaultPrice) {
    if (!serviceName) return null;
    const key = serviceName.toLowerCase().trim();
    if (serviceCache.has(key)) return serviceCache.get(key);

    const { data: existing } = await supabase
      .from('services')
      .select('id')
      .eq('therapist_id', therapist.id)
      .ilike('name', serviceName)
      .maybeSingle();
    if (existing?.id) {
      serviceCache.set(key, existing.id);
      return existing.id;
    }

    const { data: newSvc, error } = await supabase
      .from('services')
      .insert({
        therapist_id: therapist.id,
        name: serviceName,
        duration: 60,
        price: defaultPrice || 0,
        active: true,
      })
      .select('id')
      .single();
    if (error) {
      console.error('[import] could not auto-create service:', error);
      serviceCache.set(key, null);
      return null;
    }
    serviceCache.set(key, newSvc.id);
    return newSvc.id;
  }

  // Membership plan auto-create helper.
  async function resolveMembershipId(planName, monthlyPrice, monthlyCredits) {
    if (!planName) return null;
    const key = planName.toLowerCase().trim();
    if (membershipCache.has(key)) return membershipCache.get(key);

    const { data: existing } = await supabase
      .from('memberships')
      .select('id')
      .eq('therapist_id', therapist.id)
      .ilike('name', planName)
      .maybeSingle();
    if (existing?.id) {
      membershipCache.set(key, existing.id);
      return existing.id;
    }

    const { data: newPlan, error } = await supabase
      .from('memberships')
      .insert({
        therapist_id: therapist.id,
        name: planName,
        monthly_price: monthlyPrice || 0,
        monthly_session_credits: monthlyCredits || 1,
        description: 'Imported plan, edit details and connect a payment processor (Stripe or Square) to enable recurring charges.',
        active: true,
      })
      .select('id')
      .single();
    if (error) {
      console.error('[import] could not auto-create membership plan:', error);
      membershipCache.set(key, null);
      return null;
    }
    membershipCache.set(key, newPlan.id);
    return newPlan.id;
  }

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    // Resume support: rows before resumeFrom already completed in a
    // prior run; skip them entirely. resumeFrom is exclusive ('next
    // row to process'), so when resumeFrom is 250, we start at 250.
    if (rowIdx < resumeFrom) continue;

    const row = rows[rowIdx];
    const get = (idx) => (idx >= 0 && idx < row.length) ? row[idx]?.trim() : '';

    if (rowIdx % 25 === 0) {
      onProgress({ phase: 'importing-clients', current: rowIdx, total: rows.length });
      // Checkpoint to localStorage. Caller persists this so a tab
      // close lets us resume from here. We pass the next-row index
      // (rowIdx + 1 would re-do the current row on resume; rowIdx
      // means resume here, doing this row again. We pick rowIdx so
      // a partially-processed row is replayed safely; the UPSERT
      // logic makes that idempotent on the second try).
      onCheckpoint({
        phase: 'importing-clients',
        currentRow: rowIdx,
        rowCount: rows.length,
        counts: { created, skipped, failed, membershipsCreated, membershipsFailed },
        skippedRows,
        failedRows,
      });
    }

    // ── Build name from first/last or fullName ──
    let firstName = get(mapping.firstName);
    let lastName  = get(mapping.lastName);
    if (!firstName && !lastName && mapping.fullName >= 0) {
      const full = get(mapping.fullName);
      if (full) {
        const trimmed = full.trim().replace(/\s+/g, ' ');
        const spaceIdx = trimmed.indexOf(' ');
        if (spaceIdx > 0) {
          firstName = trimmed.slice(0, spaceIdx);
          lastName = trimmed.slice(spaceIdx + 1);
        } else {
          firstName = trimmed;
        }
      }
    }

    const email     = get(mapping.email)?.toLowerCase() || null;
    const phoneRaw  = get(mapping.phone) || null;
    const phone     = phoneRaw ? normalizePhone(phoneRaw) : null;
    const notes     = get(mapping.notes) || null;
    const lastVisit = get(mapping.lastVisit) || null;
    const visitCount = parseInt(get(mapping.visitCount)) || null;

    // Address fields (HK May 21 2026 evening, Jackie CSV had full
    // home addresses; persona-driven capture). All optional.
    const addressLine1 = get(mapping.addressLine1) || null;
    const addressLine2 = get(mapping.addressLine2) || null;
    const city         = get(mapping.city) || null;
    const state        = get(mapping.state) || null;
    const zip          = get(mapping.zip) || null;
    const country      = get(mapping.country) || null;

    const serviceName = get(mapping.service) || null;
    const priceRaw    = get(mapping.price) || null;
    const sessionPrice = priceRaw ? parseFloat(priceRaw.replace(/[^0-9.]/g, '')) : null;

    const membershipPlanRaw    = get(mapping.membershipPlan) || '';
    const membershipPriceRaw   = get(mapping.membershipPrice) || '';
    const membershipCreditsRaw = get(mapping.membershipCredits) || '';
    const membershipRenewalRaw = get(mapping.membershipRenewal) || '';
    const membershipStatusRaw  = (get(mapping.membershipStatus) || '').toLowerCase();
    const hasMembership = membershipPlanRaw &&
      !['none','no','no membership','n/a','na','-'].includes(membershipPlanRaw.toLowerCase());
    const membershipPlan = hasMembership ? membershipPlanRaw : null;
    const membershipPrice = membershipPriceRaw
      ? parseFloat(membershipPriceRaw.replace(/[^0-9.]/g, ''))
      : null;
    const membershipCredits = membershipCreditsRaw
      ? parseInt(membershipCreditsRaw.replace(/[^0-9]/g, ''), 10) || null
      : null;

    let name = [firstName, lastName].filter(Boolean).join(' ');
    if (!name && email) name = email.split('@')[0].replace(/[._]/g, ' ');
    if (!name && phone) name = `Client ${phone.slice(-4)}`;

    if (!name && !email && !phone) {
      skipped++;
      skippedRows.push({ row, reason: 'missing_required', details: 'Row has no name, email, or phone' });
      continue;
    }

    try {
      let client = null;

      // Existing client lookup: email > phone > name (case-insensitive)
      const selectCols = 'id, email, phone, address_line1, address_line2, city, state, zip, country';
      if (email) {
        const { data: byEmail } = await supabase
          .from('clients').select(selectCols)
          .eq('therapist_id', therapist.id).eq('email', email).maybeSingle();
        if (byEmail) client = byEmail;
      }
      if (!client && phone) {
        const { data: byPhone } = await supabase
          .from('clients').select(selectCols)
          .eq('therapist_id', therapist.id).eq('phone', phone).maybeSingle();
        if (byPhone) client = byPhone;
      }
      if (!client) {
        const { data: byName } = await supabase
          .from('clients').select(selectCols)
          .eq('therapist_id', therapist.id).ilike('name', name).maybeSingle();
        if (byName) client = byName;
      }

      if (client) {
        // UPSERT: fill in missing email/phone/address on the existing
        // record. This is the path that solves Jackie's email/phone gap
        // and now also fills addresses. Existing values are never
        // overwritten (Design Principle: re-importing keeps therapist's
        // most-recent manual edits).
        const updates = {};
        if (email && !client.email) updates.email = email;
        if (phone && !client.phone) updates.phone = phone;
        if (addressLine1 && !client.address_line1) updates.address_line1 = addressLine1;
        if (addressLine2 && !client.address_line2) updates.address_line2 = addressLine2;
        if (city && !client.city) updates.city = city;
        if (state && !client.state) updates.state = state;
        if (zip && !client.zip) updates.zip = zip;
        if (country && !client.country) updates.country = country;
        if (Object.keys(updates).length) {
          await supabase.from('clients').update(updates).eq('id', client.id);
        }
        skipped++;
        skippedRows.push({
          row,
          reason: 'already_exists',
          details: `Client ${name || email || phone} already in your account${Object.keys(updates).length ? ' (filled in ' + Object.keys(updates).join(', ') + ')' : ''}`,
        });
      } else {
        // Insert new client with all available fields
        const payload = { therapist_id: therapist.id, name };
        if (email) payload.email = email;
        if (phone) payload.phone = phone;
        if (notes) payload.notes = notes;
        if (addressLine1) payload.address_line1 = addressLine1;
        if (addressLine2) payload.address_line2 = addressLine2;
        if (city) payload.city = city;
        if (state) payload.state = state;
        if (zip) payload.zip = zip;
        if (country) payload.country = country;
        // Stamp the import batch id so this row can be undone as
        // part of the whole batch (HK May 22 2026 item D).
        if (opts.importBatchId) payload.import_batch_id = opts.importBatchId;

        const { data: newClient, error: insertErr } = await supabase
          .from('clients').insert(payload).select('id').single();

        if (insertErr) {
          failed++;
          failedRows.push({ row, reason: 'database_error', details: insertErr.message });
          continue;
        }
        client = newClient;
        created++;
      }

      // ── Historical bookings (skipped if opts.skipHistoricalBookings) ──
      if (!opts.skipHistoricalBookings) {
        const serviceId = serviceName ? await resolveServiceId(serviceName, sessionPrice) : null;

        let serviceDuration = 60;
        if (serviceId) {
          const { data: svcRow } = await supabase
            .from('services').select('duration').eq('id', serviceId).maybeSingle();
          if (svcRow?.duration) serviceDuration = svcRow.duration;
        }
        const fmtTime = (h, m = 0) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
        const endTimeFor = (startHour, durationMin) => {
          const endMin = startHour * 60 + durationMin;
          return fmtTime(Math.floor(endMin / 60), endMin % 60);
        };

        if (lastVisit && client?.id) {
          const parsedDate = new Date(lastVisit);
          if (!isNaN(parsedDate)) {
            const isoDate = parsedDate.toISOString().slice(0, 10);
            await supabase.from('bookings').insert({
              therapist_id: therapist.id,
              service_id: serviceId,
              client_id: client.id,
              client_name: name,
              client_email: email,
              client_phone: phone,
              booking_date: isoDate,
              start_time: fmtTime(10),
              end_time: endTimeFor(10, serviceDuration),
              status: 'completed',
              notes: 'Imported session history',
              deposit_required: false,
              deposit_amount: 0,
              deposit_paid: false,
              import_batch_id: opts.importBatchId || null,
            });
          }
        }

        if (visitCount && visitCount > 1 && client?.id) {
          const anchor = lastVisit ? new Date(lastVisit) : new Date();
          const startIdx = lastVisit ? 1 : 0;
          const totalToCreate = Math.min(visitCount - startIdx, 10);
          for (let i = 0; i < totalToCreate; i++) {
            const d = new Date(anchor);
            d.setDate(d.getDate() - (i + startIdx) * 14);
            const isoDate = d.toISOString().slice(0, 10);
            await supabase.from('bookings').insert({
              therapist_id: therapist.id,
              service_id: serviceId,
              client_id: client.id,
              client_name: name,
              client_email: email,
              client_phone: phone,
              booking_date: isoDate,
              start_time: fmtTime(10),
              end_time: endTimeFor(10, serviceDuration),
              status: 'completed',
              notes: 'Imported session history',
              deposit_required: false,
              deposit_amount: 0,
              deposit_paid: false,
              import_batch_id: opts.importBatchId || null,
            });
          }
        }
      }

      // ── Membership creation (skipped if opts.skipMemberships) ──
      if (!opts.skipMemberships && hasMembership && client?.id) {
        try {
          const planId = await resolveMembershipId(membershipPlan, membershipPrice, membershipCredits);
          if (!planId) {
            membershipsFailed++;
          } else {
            const { data: existingSub } = await supabase
              .from('member_subscriptions').select('id')
              .eq('therapist_id', therapist.id)
              .eq('client_id', client.id)
              .eq('membership_id', planId)
              .eq('status', 'active')
              .maybeSingle();
            if (!existingSub?.id) {
              const statusRaw = membershipStatusRaw;
              let status = 'active';
              if (['paused','pause'].includes(statusRaw)) status = 'paused';
              else if (['canceled','cancelled','cancel'].includes(statusRaw)) status = 'canceled';
              else if (['past_due','past due','overdue'].includes(statusRaw)) status = 'past_due';

              let periodEnd = null;
              if (membershipRenewalRaw) {
                const parsed = new Date(membershipRenewalRaw);
                if (!isNaN(parsed)) periodEnd = parsed.toISOString();
              }
              if (!periodEnd) {
                const fallback = new Date();
                fallback.setMonth(fallback.getMonth() + 1);
                periodEnd = fallback.toISOString();
              }

              const finalPrice = membershipPrice || 0;
              const finalCredits = membershipCredits || 1;

              const { error: subErr } = await supabase
                .from('member_subscriptions')
                .insert({
                  therapist_id: therapist.id,
                  membership_id: planId,
                  client_id: client.id,
                  client_email: email || `${name.replace(/\s+/g,'.').toLowerCase()}@imported.placeholder`,
                  client_name: name,
                  stripe_subscription_id: null,
                  stripe_customer_id: null,
                  status: status,
                  current_period_end: periodEnd,
                  monthly_price: finalPrice,
                  monthly_session_credits: finalCredits,
                  current_credits: finalCredits,
                  import_batch_id: opts.importBatchId || null,
                });
              if (subErr) {
                console.error('[import] could not create member subscription:', subErr);
                membershipsFailed++;
              } else {
                membershipsCreated++;
              }
            }
          }
        } catch (mErr) {
          console.error('[import] membership block threw:', mErr);
          membershipsFailed++;
        }
      }

    } catch (e) {
      console.error('Import row error:', e, row);
      failed++;
      failedRows.push({ row, reason: 'unexpected_error', details: e?.message || 'Unknown error during import' });
    }
  }

  return {
    created, skipped, failed, total: rows.length,
    membershipsCreated, membershipsFailed,
    skippedRows, failedRows,
  };
}

// ─────────────────────────────────────────────────────────────────
// APPOINTMENT IMPORT (creates bookings + auto-creates client stubs
// for any client name not already in the database)
// ─────────────────────────────────────────────────────────────────

export async function runAppointmentImport(supabase, therapist, headers, rows, mapping, opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const { servicePricesByName = new Map(), serviceMergeOverrides = new Map() } = opts;
  // Resumable import (HK May 22 2026 item B). For the appointment
  // runner, resume happens at the booking-insertion phase (the
  // long one). Earlier phases (parse, dedupe, batch client insert)
  // are short enough to re-run safely. resumeFrom is interpreted
  // as an index into the prepared-bookings array, not the raw
  // rows array. counts seed from prior partial run.
  const resumeFrom = Number.isFinite(opts.resumeFrom) ? Math.max(0, opts.resumeFrom) : 0;
  const onCheckpoint = opts.onCheckpoint || (() => {});

  let created = opts.seedCounts?.created || 0;
  let skipped = opts.seedCounts?.skipped || 0;
  let failed  = opts.seedCounts?.failed  || 0;
  let clientsCreated = opts.seedCounts?.clientsCreated || 0;
  const skippedRows = Array.isArray(opts.seedSkippedRows) ? [...opts.seedSkippedRows] : [];
  const failedRows  = Array.isArray(opts.seedFailedRows)  ? [...opts.seedFailedRows]  : [];

  // Helpers
  const get = (row, idx) => (idx >= 0 && idx < row.length) ? row[idx]?.trim() : '';
  const parseDateFlexible = (s) => {
    if (!s) return null;
    const formats = [s, s.replace(/\./g, '/'), s.replace(/\./g, '-')];
    for (const f of formats) {
      const d = new Date(f);
      if (!isNaN(d)) return d;
    }
    return null;
  };
  const parseTimeFlexible = (s) => {
    if (!s) return null;
    const m = s.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm|AM|PM))?$/);
    if (m) {
      let h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      const ap = (m[3] || '').toLowerCase();
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
    }
    return null;
  };

  // ── Phase 1: parse all rows, separate good from bad ──
  onProgress({ phase: 'preparing', current: 0, total: rows.length });
  const prepared = [];

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const clientName = get(row, mapping.clientName);
    const clientEmail = get(row, mapping.clientEmail)?.toLowerCase() || null;
    const clientPhoneRaw = get(row, mapping.clientPhone) || null;
    const clientPhone = clientPhoneRaw ? normalizePhone(clientPhoneRaw) : null;
    const service = get(row, mapping.service) || null;
    const priceRaw = get(row, mapping.price) || null;
    const price = priceRaw ? parseFloat(priceRaw.replace(/[^0-9.]/g, '')) : null;
    const dateStr = get(row, mapping.date);
    const startTimeStr = get(row, mapping.startTime);
    const durationRaw = get(row, mapping.duration);
    const duration = durationRaw ? parseInt(durationRaw, 10) : 60;
    const baseNotes = get(row, mapping.notes) || null;

    // SOAP-style notes (HK May 21 evening). If the CSV has separate
    // S/O/A/P columns or a generic 'soap notes' column, compose them
    // into a labeled text block stored in bookings.notes. Body-map
    // structured import deferred (different schema, queued).
    const soapSubjective = get(row, mapping.soapSubjective) || null;
    const soapObjective  = get(row, mapping.soapObjective) || null;
    const soapAssessment = get(row, mapping.soapAssessment) || null;
    const soapPlan       = get(row, mapping.soapPlan) || null;
    const soapFull       = get(row, mapping.soapFull) || null;

    let notes = baseNotes;
    const soapParts = [];
    if (soapSubjective) soapParts.push(`S: ${soapSubjective}`);
    if (soapObjective)  soapParts.push(`O: ${soapObjective}`);
    if (soapAssessment) soapParts.push(`A: ${soapAssessment}`);
    if (soapPlan)       soapParts.push(`P: ${soapPlan}`);
    if (soapParts.length) {
      const soapBlock = soapParts.join('\n');
      notes = notes ? `${notes}\n\n[Imported SOAP]\n${soapBlock}` : `[Imported SOAP]\n${soapBlock}`;
    } else if (soapFull) {
      notes = notes ? `${notes}\n\n[Imported notes]\n${soapFull}` : `[Imported notes]\n${soapFull}`;
    }

    if (!clientName || !dateStr) {
      skipped++;
      skippedRows.push({ row, reason: 'missing_required', details: 'Row needs a client name and a date' });
      continue;
    }

    const date = parseDateFlexible(dateStr);
    if (!date) {
      failed++;
      failedRows.push({ row, reason: 'invalid_date', details: `Could not parse date "${dateStr}"` });
      continue;
    }
    const bookingDate = date.toISOString().slice(0, 10);
    const startTime = parseTimeFlexible(startTimeStr) || '10:00:00';

    prepared.push({
      row, clientName, clientEmail, clientPhone, service, price,
      bookingDate, startTime, duration, notes,
    });
  }

  // ── Phase 2: look up clients ──
  onProgress({ phase: 'looking-up-clients', current: 0, total: prepared.length });
  const { data: existingClients } = await supabase
    .from('clients')
    .select('id, name, email, phone')
    .eq('therapist_id', therapist.id);

  const emailToId = new Map();
  const phoneToId = new Map();
  const nameToId = new Map();
  for (const c of existingClients || []) {
    if (c.email) emailToId.set(c.email.toLowerCase().trim(), c.id);
    if (c.phone) {
      const norm = normalizePhone(c.phone);
      if (norm) phoneToId.set(norm, c.id);
    }
    if (c.name) nameToId.set(c.name.trim().toLowerCase(), c.id);
  }

  // ── Phase 3: dedupe within this import, prepare new clients ──
  const newClientsToCreate = [];
  const signatureToQueued = new Map();

  function clientSignature(name, email, phone) {
    if (email) return `e:${email}`;
    if (phone) return `p:${phone}`;
    return `n:${name.toLowerCase().trim()}`;
  }

  for (const p of prepared) {
    let id = null;
    if (p.clientEmail) id = emailToId.get(p.clientEmail.toLowerCase().trim());
    if (!id && p.clientPhone) id = phoneToId.get(p.clientPhone);
    if (!id && !p.clientEmail && !p.clientPhone) {
      id = nameToId.get(p.clientName.trim().toLowerCase());
    }
    if (id) {
      p._clientId = id;

      // UPSERT fill: if the appointment row has email/phone but the
      // existing client record doesn't, fill it in. This is the
      // critical Jackie fix: appointment rows that DO carry contact
      // info will populate existing client stubs.
      const existing = (existingClients || []).find(c => c.id === id);
      if (existing) {
        const updates = {};
        if (p.clientEmail && !existing.email) updates.email = p.clientEmail;
        if (p.clientPhone && !existing.phone) updates.phone = p.clientPhone;
        if (Object.keys(updates).length) {
          await supabase.from('clients').update(updates).eq('id', id);
          if (updates.email) { existing.email = updates.email; emailToId.set(updates.email, id); }
          if (updates.phone) { existing.phone = updates.phone; phoneToId.set(updates.phone, id); }
        }
      }
    } else {
      const sig = clientSignature(p.clientName, p.clientEmail, p.clientPhone);
      if (!signatureToQueued.has(sig)) {
        signatureToQueued.set(sig, {
          therapist_id: therapist.id,
          name: p.clientName,
          email: p.clientEmail,
          phone: p.clientPhone,
          imported_from: 'Appointment Import',
          import_batch_id: opts.importBatchId || null,
          _signature: sig,
        });
      }
    }
  }

  // ── Phase 4: bulk-insert new clients ──
  if (signatureToQueued.size > 0) {
    onProgress({ phase: 'creating-new-clients', current: 0, total: signatureToQueued.size });
    const newClientRows = [...signatureToQueued.values()].map(c => {
      const { _signature, ...rest } = c;
      return rest;
    });
    const sigOrder = [...signatureToQueued.keys()];
    const insertedSigs = [];
    for (let i = 0; i < newClientRows.length; i += 100) {
      const chunk = newClientRows.slice(i, i + 100);
      const chunkSigs = sigOrder.slice(i, i + 100);
      const { data: inserted, error } = await supabase
        .from('clients').insert(chunk).select('id, email, phone, name');
      if (error) {
        console.error('[appt-import] bulk client insert failed:', error);
        for (let j = 0; j < chunk.length; j++) {
          failed++;
          failedRows.push({
            row: prepared.find(p => clientSignature(p.clientName, p.clientEmail, p.clientPhone) === chunkSigs[j])?.row || [],
            reason: 'client_create_failed',
            details: error.message,
          });
        }
      } else {
        for (let j = 0; j < inserted.length; j++) {
          insertedSigs.push({ sig: chunkSigs[j], id: inserted[j].id });
          if (inserted[j].email) emailToId.set(inserted[j].email.toLowerCase().trim(), inserted[j].id);
          if (inserted[j].phone) phoneToId.set(normalizePhone(inserted[j].phone), inserted[j].id);
          if (inserted[j].name) nameToId.set(inserted[j].name.trim().toLowerCase(), inserted[j].id);
          clientsCreated++;
        }
      }
    }

    // Attach client_id to prepared rows
    const sigToId = new Map(insertedSigs.map(s => [s.sig, s.id]));
    for (const p of prepared) {
      if (!p._clientId) {
        const sig = clientSignature(p.clientName, p.clientEmail, p.clientPhone);
        p._clientId = sigToId.get(sig);
      }
    }
  }

  // ── Phase 5: resolve service IDs (with optional price overrides) ──
  const serviceCache = new Map();
  async function resolveServiceId(serviceName) {
    if (!serviceName) return null;
    const key = serviceName.toLowerCase().trim();
    if (serviceCache.has(key)) return serviceCache.get(key);

    // Check fuzzy merge override first (HK May 21 evening, full
    // fuzzy matching). If the therapist explicitly chose to merge
    // this CSV name into an existing service id, use that id and
    // skip the lookup / auto-create. 'skip' means create as new.
    const overrideId = serviceMergeOverrides.get(serviceName);
    if (overrideId && overrideId !== 'skip') {
      serviceCache.set(key, overrideId);
      return overrideId;
    }

    const { data: existing } = await supabase
      .from('services').select('id')
      .eq('therapist_id', therapist.id)
      .ilike('name', serviceName).maybeSingle();
    if (existing?.id) {
      serviceCache.set(key, existing.id);
      return existing.id;
    }

    const override = servicePricesByName.get(key);
    const { data: newSvc, error } = await supabase
      .from('services').insert({
        therapist_id: therapist.id,
        name: serviceName,
        duration: override?.duration || 60,
        price: typeof override?.price === 'number' ? override.price : 0,
        active: true,
      }).select('id').single();
    if (error) {
      console.error('[appt-import] could not auto-create service:', error);
      serviceCache.set(key, null);
      return null;
    }
    serviceCache.set(key, newSvc.id);
    return newSvc.id;
  }

  // ── Phase 6: dedupe vs existing bookings ──
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('client_email, client_phone, client_name, booking_date, start_time')
    .eq('therapist_id', therapist.id);

  const existingBookingKeys = new Set();
  function bookingKey(emailLower, phone, nameLower, date, start) {
    const id = emailLower || phone || nameLower || 'unknown';
    return `${id}|${date}|${start}`;
  }
  for (const b of existingBookings || []) {
    const emailLower = b.client_email ? b.client_email.toLowerCase().trim() : null;
    const phone = b.client_phone ? normalizePhone(b.client_phone) || null : null;
    const nameLower = b.client_name ? b.client_name.toLowerCase().trim() : null;
    existingBookingKeys.add(bookingKey(emailLower, phone, nameLower, b.booking_date, b.start_time));
  }

  // ── Phase 7: insert bookings ──
  onProgress({ phase: 'creating-bookings', current: resumeFrom, total: prepared.length });
  for (let idx = 0; idx < prepared.length; idx++) {
    // Resume support: skip bookings already inserted in a prior run.
    // Idempotency is ensured by the existingBookingKeys dedup set
    // (loaded fresh each run from the bookings table), so even if
    // resumeFrom was off by one, we would not double-insert.
    if (idx < resumeFrom) continue;

    const p = prepared[idx];
    if (idx % 25 === 0) {
      onProgress({ phase: 'creating-bookings', current: idx, total: prepared.length });
      onCheckpoint({
        phase: 'creating-bookings',
        currentRow: idx,
        rowCount: prepared.length,
        counts: { created, skipped, failed, clientsCreated },
        skippedRows,
        failedRows,
      });
    }
    if (!p._clientId) continue;

    const emailLower = p.clientEmail ? p.clientEmail.toLowerCase().trim() : null;
    const nameLower = p.clientName.toLowerCase().trim();
    const key = bookingKey(emailLower, p.clientPhone, nameLower, p.bookingDate, p.startTime);

    if (existingBookingKeys.has(key)) {
      skipped++;
      skippedRows.push({ row: p.row, reason: 'duplicate_booking', details: 'A booking with this client + date + time already exists' });
      continue;
    }
    existingBookingKeys.add(key);

    try {
      const serviceId = p.service ? await resolveServiceId(p.service) : null;

      const startParts = p.startTime.split(':').map(Number);
      const endMin = startParts[0] * 60 + startParts[1] + p.duration;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}:00`;

      const status = new Date(p.bookingDate + 'T' + p.startTime) < new Date() ? 'completed' : 'confirmed';

      const { error } = await supabase.from('bookings').insert({
        therapist_id: therapist.id,
        service_id: serviceId,
        client_id: p._clientId,
        client_name: p.clientName,
        client_email: p.clientEmail,
        client_phone: p.clientPhone,
        booking_date: p.bookingDate,
        start_time: p.startTime,
        end_time: endTime,
        status,
        notes: p.notes,
        deposit_required: false,
        deposit_amount: 0,
        deposit_paid: false,
        import_batch_id: opts.importBatchId || null,
      });
      if (error) {
        failed++;
        failedRows.push({ row: p.row, reason: 'database_error', details: error.message });
      } else {
        created++;
      }
    } catch (e) {
      failed++;
      failedRows.push({ row: p.row, reason: 'unexpected_error', details: e?.message || 'Unknown error' });
    }
  }

  return {
    created, skipped, failed, total: rows.length,
    clientsCreated,
    skippedRows, failedRows,
  };
}
