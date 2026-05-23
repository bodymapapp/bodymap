// candice_import.js
//
// One-off import script for Candice Peek (therapist_id 58799af0).
// Reads her Back2Life client roster CSV and her MassageBook
// appointments CSV, creates a service catalog, inserts clients and
// bookings, and stamps a single import_batch_id so the whole thing
// is one-step-undoable.
//
// Usage:
//   DRY_RUN: prints planned writes only, no DB calls
//   EXECUTE: writes to her live Supabase row
//
// Hard-coded:
//   - therapist_id: 58799af0-3b54-404c-ab14-3129c35e5ad2
//   - 12 service catalog (HK + Candice decisions May 23 2026)
//   - 5 dupe winners: 1L, 2L, 3R, 4L, 5L
//   - CSV paths via CLI args
//
// HK May 23 2026: written after deleting her records yesterday and
// failing to get the in-product import flow to handle her snake_case
// Back2Life CSV. White-glove import while we fix detection (Path B).

const fs = require('fs');
const crypto = require('crypto');
// Lazy-require supabase-js so dry-run works without the package
// installed. EXECUTE mode will require it before any DB call.
let createClient;

// ── Configuration ────────────────────────────────────────────────

const THERAPIST_ID = '58799af0-3b54-404c-ab14-3129c35e5ad2';
const SUPABASE_URL = 'https://rmnqfrljoknmellbnpiy.supabase.co';

const DRY_RUN = process.env.DRY_RUN !== '0'; // default true; set DRY_RUN=0 to execute
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const CLIENTS_CSV = process.argv[2] || './Client_Names.csv';
const APPTS_CSV = process.argv[3] || './MassageBook_Appointments.csv';

if (!SERVICE_ROLE && !DRY_RUN) {
  console.error('FATAL: SUPABASE_SERVICE_ROLE env var required for execute mode.');
  process.exit(1);
}

// Service catalog. Each entry maps to a unique service row in DB.
// Bookings join on a (name, price) lookup so multi-price services
// route to the correct catalog row.
const SERVICE_CATALOG = [
  { key: 'spot_30',       name: '30 Minute Spot Treatment Massage',        price: 50,  duration: 30 },
  { key: 'restorative_60',name: 'Restorative Massage (60 min)',            price: 85,  duration: 60 },
  { key: 'restorative_90',name: 'Restorative Massage (90 min)',            price: 120, duration: 90 },
  { key: 'relax_60',      name: 'Restorative Relaxation Massage (60 min)', price: 85,  duration: 60 },
  { key: 'relax_90',      name: 'Restorative Relaxation Massage (90 min)', price: 120, duration: 90 },
  { key: 'signature_60',  name: 'Signature Integrated Massage (60 min)',   price: 100, duration: 60 },
  { key: 'signature_90',  name: 'Signature Integrated Massage (90 min)',   price: 135, duration: 90 },
  { key: 'signature_prem',name: 'Signature Integrated Massage (Premium 90 min)', price: 150, duration: 90 },
  { key: 'lymphatic',     name: 'Lymphatic Detox and General Health Management', price: 110, duration: 60 },
  { key: 'unwind',        name: 'The Unwind Experience, Aroma Therapy Joy, Cupping', price: 170, duration: 90 },
  { key: 'lymph_pkg',     name: '4 Session Lymphatic Drainage Post Illness (package)', price: 360, duration: 60 },
  { key: 'restorative_pkg',name: 'Restorative Massage 60 minute x 4 (package)', price: 300, duration: 60 },
];

// Map from (CSV-service-name, CSV-price-in-dollars) -> catalog key.
// CSV prices have $ and decimals, we parse to integer dollars.
function mapBookingToServiceKey(rawServiceName, priceDollars) {
  const s = rawServiceName.trim();
  const p = Math.round(priceDollars);

  if (s === '30 minute Spot Treatment Massage') return 'spot_30';
  if (s === 'Lymphatic Detox and General Health Management') return 'lymphatic';
  if (s === 'The Unwind Experience, Aroma Therapy Joy, Cupping') return 'unwind';
  if (s === '4 Session Lymphatic Drainage post illness') return 'lymph_pkg';
  if (s === 'Restorative Massage 60 minute  x 4') return 'restorative_pkg';

  if (s === 'Restorative Massage') {
    if (p === 85) return 'restorative_60';
    if (p === 120) return 'restorative_90';
    return 'restorative_60'; // fallback
  }
  if (s === 'Restorative Relaxation Massage') {
    if (p === 85) return 'relax_60';
    if (p === 120) return 'relax_90';
    return 'relax_60';
  }
  if (s === 'Signature Integrated Massage') {
    if (p === 100) return 'signature_60';
    if (p === 135) return 'signature_90';
    if (p === 150) return 'signature_prem';
    return 'signature_90'; // fallback
  }
  return null;
}

// Dupe decisions: 1L, 2L, 3R, 4L, 5L. Map (first+last lowercased)
// to which row to keep (the date_added of the kept row uniquely
// identifies it among the duplicates). The discarded row's unique
// email (if any) gets appended as a note on the kept row.
const DUPE_DECISIONS = {
  'annette knopf':      { keep_added: '02/13/2022', merge_email_to_notes: 'Aj.knopf@yahoo.com' },
  'debra murphy':       { keep_added: '04/21/2023', merge_email_to_notes: 'dnmlascruce@yahoo.com (typo, missing s)' },
  'david crosthwait':   { keep_added: '04/14/2025', merge_email_to_notes: null }, // 3R: row B has phone
  'katie brewer':       { keep_added: '02/15/2025', merge_email_to_notes: null, prefer_with_email: true }, // both same date; pick the one with email
  'shirley gilbertson': { keep_added: '04/18/2025', merge_email_to_notes: null, prefer_first: true }, // exact dupe; pick first occurrence
};

// ── CSV parsing ──────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(current); current = '';
      } else { current += ch; }
    }
    result.push(current);
    return result;
  };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function rowAsObject(row, headers) {
  const o = {};
  headers.forEach((h, i) => { o[h] = (row[i] || '').trim(); });
  return o;
}

// ── Date / time helpers ──────────────────────────────────────────

function parseDateMonthName(s) {
  // "May 22, 2026" -> "2026-05-22"
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseTime12h(s) {
  // "8:30 AM" -> "08:30:00"
  const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}:00`;
}

function addMinutes(hhmmss, minutes) {
  const [h, m] = hhmmss.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const h2 = Math.floor(total / 60) % 24;
  const m2 = total % 60;
  return `${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}:00`;
}

function parsePriceDollars(s) {
  if (!s) return 0;
  const clean = s.replace(/[$,]/g, '').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function parseDateUSSlash(s) {
  // "04/30/2019" -> "2019-04-30"
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Candice import ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'EXECUTE (writes to live DB)'}`);
  console.log(`Therapist: ${THERAPIST_ID}`);
  console.log(`Clients CSV: ${CLIENTS_CSV}`);
  console.log(`Appts CSV: ${APPTS_CSV}`);

  const importBatchId = crypto.randomUUID();
  console.log(`Import batch ID: ${importBatchId}`);
  console.log();

  // ── 1. Read CSVs ──
  const clientsText = fs.readFileSync(CLIENTS_CSV, 'utf-8');
  const apptsText = fs.readFileSync(APPTS_CSV, 'utf-8');

  const clientsCsv = parseCSV(clientsText);
  const apptsCsv = parseCSV(apptsText);

  console.log(`Clients CSV: ${clientsCsv.rows.length} rows`);
  console.log(`Appts CSV: ${apptsCsv.rows.length} rows`);

  // ── 2. Build deduped client list ──
  const seenNames = new Map(); // lowercased "first last" -> { rowObj, mergeNoteAppend }
  const dupeLog = [];

  for (const row of clientsCsv.rows) {
    const r = rowAsObject(row, clientsCsv.headers);
    if (!r.first_name) continue;
    const nameKey = `${r.first_name} ${r.last_name}`.toLowerCase().trim();

    if (!seenNames.has(nameKey)) {
      seenNames.set(nameKey, { row: r, mergeNote: null });
      continue;
    }

    // Duplicate detected. Apply decisions.
    const existing = seenNames.get(nameKey);
    const decision = DUPE_DECISIONS[nameKey];

    if (!decision) {
      // Unexpected dupe (not in our 5). Default to most-complete logic.
      const score = (rr) => ['mobile_number','email','address1','city','state','zip','birthday','notes']
        .filter(k => rr[k]).length;
      const winner = score(r) >= score(existing.row) ? r : existing.row;
      const loser = winner === r ? existing.row : r;
      const note = loser.email && loser.email !== winner.email ? `Alt email: ${loser.email}` : null;
      seenNames.set(nameKey, { row: winner, mergeNote: note });
      dupeLog.push({ name: nameKey, decision: 'auto-most-complete', kept: winner.date_added, discarded: loser.date_added });
      continue;
    }

    // Known dupe. Pick the row matching the chosen date_added.
    let winner, loser;
    if (decision.prefer_first) {
      winner = existing.row;
      loser = r;
    } else if (decision.prefer_with_email) {
      winner = existing.row.email ? existing.row : r;
      loser = winner === existing.row ? r : existing.row;
    } else {
      winner = (existing.row.date_added === decision.keep_added) ? existing.row : r;
      loser = winner === existing.row ? r : existing.row;
    }

    let note = null;
    if (decision.merge_email_to_notes) {
      note = `Alt email from duplicate record: ${decision.merge_email_to_notes}`;
    }
    seenNames.set(nameKey, { row: winner, mergeNote: note });
    dupeLog.push({ name: nameKey, decision: 'manual', kept: winner.date_added, discarded: loser.date_added });
  }

  console.log(`\n=== Dupe resolution ===`);
  for (const entry of dupeLog) {
    console.log(`  ${entry.name}: kept ${entry.kept}, discarded ${entry.discarded} (${entry.decision})`);
  }

  const clientsToInsert = [];
  for (const [nameKey, { row, mergeNote }] of seenNames.entries()) {
    const fullName = `${row.first_name} ${row.last_name}`.trim();
    const phone = row.mobile_number || row.landline_number || row.alt_phone || row.alt_mobile || null;
    const email = row.email || null;
    const notesParts = [];
    if (mergeNote) notesParts.push(mergeNote);
    if (row.birthday) notesParts.push(`Birthday: ${row.birthday}`);
    if (row.gender) notesParts.push(`Gender: ${row.gender}`);
    if (row.date_added) notesParts.push(`Added to Back2Life: ${row.date_added}`);
    if (row.source) notesParts.push(`Source: ${row.source}`);

    const payload = {
      therapist_id: THERAPIST_ID,
      name: fullName,
      import_batch_id: importBatchId,
    };
    if (email) payload.email = email;
    if (phone) payload.phone = phone;
    if (row.address1) payload.address_line1 = row.address1;
    if (row.address2) payload.address_line2 = row.address2;
    if (row.city) payload.city = row.city;
    if (row.state) payload.state = row.state;
    if (row.zip) payload.zip = row.zip;
    if (row.country) payload.country = row.country;
    if (notesParts.length) payload.notes = notesParts.join('. ');

    clientsToInsert.push({ nameKey, payload });
  }

  console.log(`\n=== Clients to insert: ${clientsToInsert.length} ===`);
  console.log(`(Sample first 3)`);
  for (const c of clientsToInsert.slice(0, 3)) {
    console.log(`  ${c.payload.name} | email=${c.payload.email||'-'} | phone=${c.payload.phone||'-'}`);
  }

  // ── 3. Build appointments list ──
  const apptsToInsert = [];
  const apptSkipped = [];

  for (const row of apptsCsv.rows) {
    const r = rowAsObject(row, apptsCsv.headers);
    if (!r.Date || !r.Client || r.Service === 'Total') {
      apptSkipped.push({ row: r, reason: 'empty date or total row' });
      continue;
    }
    const isoDate = parseDateMonthName(r.Date);
    if (!isoDate) {
      apptSkipped.push({ row: r, reason: 'unparseable date' });
      continue;
    }
    const startTime = parseTime12h(r.Time);
    if (!startTime) {
      apptSkipped.push({ row: r, reason: 'unparseable time' });
      continue;
    }
    const priceDollars = parsePriceDollars(r['Projected Income']);
    const serviceKey = mapBookingToServiceKey(r.Service, priceDollars);
    if (!serviceKey) {
      apptSkipped.push({ row: r, reason: `no service mapping for "${r.Service}" at $${priceDollars}` });
      continue;
    }
    const service = SERVICE_CATALOG.find(s => s.key === serviceKey);
    const endTime = addMinutes(startTime, service.duration);

    const clientNameKey = r.Client.toLowerCase().trim();
    if (!seenNames.has(clientNameKey)) {
      apptSkipped.push({ row: r, reason: `client "${r.Client}" not in roster` });
      continue;
    }

    apptsToInsert.push({
      clientNameKey,
      serviceKey,
      booking_date: isoDate,
      start_time: startTime,
      end_time: endTime,
      client_name: r.Client,
      total_amount: priceDollars,
      original_service_name: r.Service,
    });
  }

  console.log(`\n=== Appointments to insert: ${apptsToInsert.length} ===`);
  console.log(`Skipped: ${apptSkipped.length}`);
  if (apptSkipped.length > 0) {
    console.log(`Reasons:`);
    for (const s of apptSkipped.slice(0, 10)) {
      console.log(`  ${s.reason}`);
    }
  }
  console.log(`(Sample first 3)`);
  for (const a of apptsToInsert.slice(0, 3)) {
    console.log(`  ${a.booking_date} ${a.start_time} | ${a.client_name} | ${a.serviceKey} | $${a.total_amount}`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Services: ${SERVICE_CATALOG.length}`);
  console.log(`  Clients:  ${clientsToInsert.length}`);
  console.log(`  Bookings: ${apptsToInsert.length}`);
  console.log(`  Skipped bookings: ${apptSkipped.length}`);
  console.log(`  Batch ID: ${importBatchId}`);

  if (DRY_RUN) {
    console.log(`\n*** DRY RUN COMPLETE. No DB writes performed. ***`);
    console.log(`*** To execute: DRY_RUN=0 SUPABASE_SERVICE_ROLE=<key> node candice_import.js <clients.csv> <appts.csv>`);
    return;
  }

  // ── 4. Execute against Supabase ──
  if (!createClient) {
    ({ createClient } = require('@supabase/supabase-js'));
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n=== Executing... ===`);

  // 4a. Insert services
  console.log(`Inserting ${SERVICE_CATALOG.length} services...`);
  const serviceRows = SERVICE_CATALOG.map(s => ({
    therapist_id: THERAPIST_ID,
    name: s.name,
    price: s.price,
    duration: s.duration,
    import_batch_id: importBatchId,
  }));
  const { data: insertedServices, error: svcErr } = await supabase
    .from('services').insert(serviceRows).select('id, name');
  if (svcErr) { console.error('Services insert failed:', svcErr); process.exit(2); }
  const serviceKeyToId = new Map();
  for (const inserted of insertedServices) {
    const cat = SERVICE_CATALOG.find(s => s.name === inserted.name);
    if (cat) serviceKeyToId.set(cat.key, inserted.id);
  }
  console.log(`  ✓ ${insertedServices.length} services created`);

  // 4b. Insert clients (chunks of 100)
  console.log(`Inserting ${clientsToInsert.length} clients in chunks of 100...`);
  const nameToClientId = new Map();
  const CHUNK = 100;
  let totalInserted = 0;
  for (let i = 0; i < clientsToInsert.length; i += CHUNK) {
    const chunk = clientsToInsert.slice(i, i + CHUNK);
    const payloads = chunk.map(c => c.payload);
    const { data: inserted, error: cliErr } = await supabase
      .from('clients').insert(payloads).select('id, name');
    if (cliErr) { console.error(`Clients insert failed at chunk ${i}:`, cliErr); process.exit(3); }
    for (let j = 0; j < inserted.length; j++) {
      nameToClientId.set(chunk[j].nameKey, inserted[j].id);
    }
    totalInserted += inserted.length;
    console.log(`  ✓ ${totalInserted}/${clientsToInsert.length}`);
  }

  // 4c. Insert bookings (chunks of 100)
  console.log(`Inserting ${apptsToInsert.length} bookings...`);
  const bookingRows = apptsToInsert.map(a => ({
    therapist_id: THERAPIST_ID,
    service_id: serviceKeyToId.get(a.serviceKey),
    client_id: nameToClientId.get(a.clientNameKey),
    client_name: a.client_name,
    booking_date: a.booking_date,
    start_time: a.start_time,
    end_time: a.end_time,
    status: 'confirmed',
    notes: `Imported from MassageBook on May 23, 2026. Original service: ${a.original_service_name}.`,
    total_amount: a.total_amount,
    deposit_required: false,
    deposit_amount: 0,
    deposit_paid: false,
    import_batch_id: importBatchId,
  }));

  let bookingsInserted = 0;
  for (let i = 0; i < bookingRows.length; i += CHUNK) {
    const chunk = bookingRows.slice(i, i + CHUNK);
    const { data: inserted, error: bkErr } = await supabase
      .from('bookings').insert(chunk).select('id');
    if (bkErr) { console.error(`Bookings insert failed at chunk ${i}:`, bkErr); process.exit(4); }
    bookingsInserted += inserted.length;
    console.log(`  ✓ ${bookingsInserted}/${bookingRows.length}`);
  }

  // 4d. Update therapist row
  console.log(`Updating therapist row flags...`);
  const { error: thErr } = await supabase
    .from('therapists')
    .update({
      skipped_import_at: null,
      booking_page_previewed_at: new Date().toISOString(),
    })
    .eq('id', THERAPIST_ID);
  if (thErr) { console.error('Therapist update failed:', thErr); process.exit(5); }
  console.log(`  ✓`);

  console.log(`\n*** IMPORT COMPLETE ***`);
  console.log(`  Services: ${insertedServices.length}`);
  console.log(`  Clients:  ${totalInserted}`);
  console.log(`  Bookings: ${bookingsInserted}`);
  console.log(`  Batch ID: ${importBatchId}`);
  console.log(`\nTo undo:`);
  console.log(`  DELETE FROM bookings WHERE import_batch_id = '${importBatchId}';`);
  console.log(`  DELETE FROM clients WHERE import_batch_id = '${importBatchId}';`);
  console.log(`  DELETE FROM services WHERE import_batch_id = '${importBatchId}';`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(99); });
