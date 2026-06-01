// src/lib/imports/detectCsvType.js
//
// Auto-detection of CSV content type by header inspection.
// Used by MultiImport to classify each dropped file.
//
// Returns one of: 'clients' | 'appointments' | 'unknown'
// And the mapping object so the runImports functions can use it.

// Whole-word strict matcher (per HK May 21 2026, Jackie incident).
// Term must be surrounded by start/end or non-alphanumeric boundaries.
function findStrict(headers, ...terms) {
  for (const t of terms) {
    const i = headers.findIndex(x => {
      if (x === t) return true;
      const re = new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i');
      return re.test(x);
    });
    if (i >= 0) return i;
  }
  return -1;
}

// Loose substring matcher (for low-risk fields like email, phone).
function findLoose(headers, ...terms) {
  for (const t of terms) {
    const i = headers.findIndex(x => x.includes(t));
    if (i >= 0) return i;
  }
  return -1;
}

// Detect a column's likely content type by sampling its values.
// Used to override or fill in mapping when the header is ambiguous
// (HK May 21 2026 evening: 'if Contact 1 column has emails, assign
// it to email, not put a question mark').
//
// Returns one of: 'email' | 'phone' | 'date' | 'time' | 'name' |
//                 'zip' | 'state' | 'currency' | 'integer' | 'unknown'
//
// Heuristic: take up to 10 non-empty values from this column, see
// what pattern matches the majority. Threshold 60% so a mostly-
// clean column with a few stragglers still classifies.
function sniffColumnType(rows, colIdx) {
  if (colIdx < 0 || colIdx === undefined) return 'unknown';
  const samples = [];
  for (const row of rows) {
    if (samples.length >= 10) break;
    const v = (row[colIdx] || '').trim();
    if (v) samples.push(v);
  }
  if (samples.length === 0) return 'unknown';

  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(v);
  const isPhone = (v) => {
    const digits = v.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15 && /[\d\s\-().+]+/.test(v);
  };
  const isDate = (v) => !isNaN(new Date(v).getTime()) && /\d/.test(v) && v.length >= 6;
  const isTime = (v) => /^\d{1,2}:\d{2}(\s*(am|pm|AM|PM))?$/.test(v) || /^\d{4}$/.test(v);
  const isZip = (v) => /^\d{5}(-\d{4})?$/.test(v) || /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/.test(v); // US or Canada
  const isStateUS = (v) => /^[A-Z]{2}$/.test(v.toUpperCase()) && [
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
  ].includes(v.toUpperCase());
  const isCurrency = (v) => /^\$?\d+(\.\d{1,2})?$/.test(v);
  const isInteger = (v) => /^\d+$/.test(v);
  const looksLikeName = (v) => {
    const parts = v.split(/\s+/);
    return parts.length >= 1 && parts.length <= 4 && parts.every(p => /^[A-Z][a-zA-Z'\-]{1,}$/.test(p));
  };

  const counts = { email: 0, phone: 0, date: 0, time: 0, zip: 0, state: 0, currency: 0, integer: 0, name: 0 };
  for (const v of samples) {
    if (isEmail(v)) counts.email++;
    else if (isTime(v)) counts.time++;
    else if (isPhone(v)) counts.phone++;
    else if (isZip(v)) counts.zip++;
    else if (isStateUS(v)) counts.state++;
    else if (isCurrency(v)) counts.currency++;
    else if (isInteger(v)) counts.integer++;
    else if (isDate(v)) counts.date++;
    else if (looksLikeName(v)) counts.name++;
  }

  const threshold = Math.max(1, Math.ceil(samples.length * 0.6));
  // Order matters: email/phone/zip first since they're more specific
  for (const k of ['email', 'phone', 'time', 'date', 'zip', 'state', 'currency', 'name', 'integer']) {
    if (counts[k] >= threshold) return k;
  }
  return 'unknown';
}

// Detect the most likely content type of a CSV based on its
// headers AND a sample of its values. Returns:
//   { type: 'clients' | 'appointments' | 'services' | 'unknown',
//     mapping: { ... },
//     confidence: 'high' | 'medium' | 'low',
//     reason: string  (human-readable explanation) }
//
// New behavior (HK May 21 2026 evening): if header detection is
// ambiguous (returns -1 for email/phone/etc.), we sniff each
// unmapped column's content to see if its values match email,
// phone, date, etc. Then we assign automatically.
export function detectCsvType(headers, rows = []) {
  const h = headers.map(x => x.toLowerCase().trim());

  // Look for distinctive markers via header inspection
  // Use strict word-boundary matching for the date/time STRUCTURAL
  // signal so 'birthdate' does not match 'date' and 'lifetime' does
  // not match 'time'. HK Jun 1 2026: a MassageBook client export has
  // a 'Birthdate' column; loose 'date' matching made the file look
  // like it had appointment dates, so it failed the client !date
  // guard and fell through to 'unknown'.
  const hasDate = findStrict(h, 'date', 'date of appointment', 'appointment date') >= 0;
  const hasStartTime = findStrict(h, 'start time', 'time', 'start') >= 0;
  const hasDuration = findLoose(h, 'duration', 'length', 'minutes') >= 0;
  const hasFirstName = findLoose(h, 'first name', 'firstname', 'first_name', 'given name') >= 0;
  const hasLastName = findLoose(h, 'last name', 'lastname', 'last_name', 'family name') >= 0;
  const hasFullName = findStrict(h, 'client name', 'customer name', 'full name', 'name') >= 0;
  const hasEmail = findLoose(h, 'email') >= 0;
  const hasPhone = findLoose(h, 'phone', 'mobile', 'cell') >= 0;
  const hasAddress = findLoose(h, 'address', 'street') >= 0;
  const hasService = findStrict(h, 'service', 'treatment', 'appointment type', 'session type') >= 0;
  const hasPrice = findStrict(h, 'price', 'amount', 'cost') >= 0;
  const hasServiceNameHeader = findLoose(h, 'service name') >= 0;

  // Content-sniffing: build a map of colIdx -> sniffed type for any
  // column whose header didn't trigger a known mapping. This catches
  // columns like 'Contact1' that hold email addresses.
  const sniffedByCol = new Map();
  if (rows.length > 0) {
    for (let i = 0; i < headers.length; i++) {
      sniffedByCol.set(i, sniffColumnType(rows, i));
    }
  }

  // Helper: prefer header-detected idx, fall back to sniff
  function pickColumn(headerIdx, sniffType) {
    if (headerIdx >= 0) return headerIdx;
    if (!rows.length) return -1;
    for (const [idx, type] of sniffedByCol.entries()) {
      if (type === sniffType) return idx;
    }
    return -1;
  }

  // Determine effective presence using sniff fallback
  const effectiveEmail = hasEmail || (rows.length > 0 && [...sniffedByCol.values()].includes('email'));
  const effectivePhone = hasPhone || (rows.length > 0 && [...sniffedByCol.values()].includes('phone'));
  const effectiveDate = hasDate || (rows.length > 0 && [...sniffedByCol.values()].includes('date'));
  const effectiveTime = hasStartTime || (rows.length > 0 && [...sniffedByCol.values()].includes('time'));

  // ── Decision tree ──

  // Strong appointment signal: has date + time + (service OR client name)
  if (effectiveDate && (effectiveTime || hasDuration) && (hasFullName || hasFirstName)) {
    const mapping = {
      clientName: findLoose(h, 'client name', 'customer name', 'name', 'client'),
      clientEmail: pickColumn(findLoose(h, 'email'), 'email'),
      clientPhone: pickColumn(findLoose(h, 'phone', 'mobile', 'cell'), 'phone'),
      service: findStrict(h, 'service', 'services', 'treatment', 'appointment type', 'session type'),
      date: pickColumn(findLoose(h, 'date of appointment', 'appointment date', 'date'), 'date'),
      startTime: pickColumn(findLoose(h, 'start time', 'time', 'start'), 'time'),
      duration: findLoose(h, 'duration', 'length', 'minutes'),
      provider: findStrict(h, 'service provided by', 'provider', 'service provider', 'employee seen', 'staff', 'therapist'),
      price: pickColumn(findStrict(h, 'price', 'amount', 'cost', 'session price', 'projected income', 'income'), 'currency'),
      notes: findLoose(h, 'notes', 'note', 'comments'),
      // SOAP-style columns (HK May 21 evening). If the CSV exports
      // session notes split across S/O/A/P columns, capture each
      // index. The runner concatenates them into a single notes
      // field labeled by section, since the bookings table has
      // one notes column. Structured body-map import is queued.
      soapSubjective: findLoose(h, 'subjective', 'soap subjective'),
      soapObjective: findLoose(h, 'objective', 'soap objective'),
      soapAssessment: findLoose(h, 'assessment', 'soap assessment'),
      soapPlan: findLoose(h, 'plan', 'soap plan'),
      soapFull: findLoose(h, 'soap notes', 'soap', 'session notes'),
    };
    return {
      type: 'appointments',
      mapping,
      confidence: 'high',
      reason: 'Has date, time, and client name columns',
    };
  }

  // Strong service-list signal: has explicit "service name" + price/duration but no client info
  if (hasServiceNameHeader && hasPrice && !hasFullName && !hasFirstName) {
    return {
      type: 'services',
      mapping: {
        name: findLoose(h, 'service name', 'name'),
        price: pickColumn(findStrict(h, 'price', 'amount', 'cost'), 'currency'),
        duration: findLoose(h, 'duration', 'length', 'minutes'),
        description: findLoose(h, 'description', 'desc'),
      },
      confidence: 'medium',
      reason: 'Has service name and price columns, no client info',
    };
  }

  // Strong client signal: has names + contact info, no date/time
  if ((hasFirstName || hasLastName || hasFullName) && (effectiveEmail || effectivePhone) && !effectiveDate) {
    const mapping = {
      firstName: findLoose(h, 'first name', 'firstname', 'first_name', 'given name', 'client first'),
      lastName: findLoose(h, 'last name', 'lastname', 'last_name', 'family name', 'client last'),
      fullName: -1,
      email: pickColumn(findLoose(h, 'email'), 'email'),
      phone: pickColumn(findLoose(h, 'mobile_number', 'cell phone', 'mobile', 'phone', 'cell'), 'phone'),
      notes: findLoose(h, 'notes', 'note', 'comments'),
      visitCount: findLoose(h, 'visit count', 'visits', 'appointment count'),
      lastVisit: findLoose(h, 'last visit', 'last appointment', 'last seen'),
      // Address fields with sniff fallback for state/zip
      addressLine1: findLoose(h, 'address line 1', 'address1', 'address', 'street address', 'street'),
      addressLine2: findLoose(h, 'address line 2', 'address2', 'apartment', 'apt', 'suite', 'unit'),
      // visit count synonym: MassageBook 'Appointments Booked'
      visitCountAlt: findLoose(h, 'appointments booked'),
      city: findLoose(h, 'city', 'town'),
      state: pickColumn(findStrict(h, 'state', 'region', 'province'), 'state'),
      zip: pickColumn(findLoose(h, 'zip code', 'zip', 'postal code', 'postcode'), 'zip'),
      country: findStrict(h, 'country', 'country code'),
      service: findStrict(h, 'service', 'treatment', 'appointment type', 'session type'),
      price: pickColumn(findStrict(h, 'price', 'amount', 'session price', 'fee', 'cost'), 'currency'),
      membershipPlan: findStrict(h, 'plan', 'plan name', 'membership plan', 'membership'),
      membershipPrice: findStrict(h, 'monthly', 'membership price', 'plan price'),
      membershipCredits: findStrict(h, 'sessions per month', 'credits', 'monthly credits', 'monthly sessions'),
      membershipRenewal: findStrict(h, 'next renewal', 'renewal date', 'next billing', 'next charge'),
      membershipStatus: findStrict(h, 'membership status', 'plan status', 'subscription status'),
    };
    // Smart name handling: only set fullName if no first+last found
    if (mapping.firstName < 0 && mapping.lastName < 0 && hasFullName) {
      mapping.fullName = findLoose(h, 'client name', 'customer name', 'name');
    }
    return {
      type: 'clients',
      mapping,
      confidence: 'high',
      reason: 'Has names and contact info, no dates or times',
    };
  }

  // Weaker client signal: just names, no contact info, no date
  if ((hasFirstName || hasLastName || hasFullName) && !hasDate) {
    const mapping = {
      firstName: findLoose(h, 'first name', 'firstname', 'given name'),
      lastName: findLoose(h, 'last name', 'lastname', 'family name'),
      fullName: hasFullName ? findLoose(h, 'client name', 'customer name', 'name') : -1,
      email: findLoose(h, 'email'),
      phone: findLoose(h, 'mobile', 'phone', 'cell'),
      notes: findLoose(h, 'notes', 'note', 'comments'),
      service: -1,
      price: -1,
    };
    return {
      type: 'clients',
      mapping,
      confidence: 'low',
      reason: 'Has names but no contact info or dates',
    };
  }

  // Default: unknown, user picks
  return {
    type: 'unknown',
    mapping: {},
    confidence: 'low',
    reason: 'Could not auto-detect from column headers',
  };
}

// Build a best-effort mapping for a user-chosen type when auto-detect
// returned 'unknown'. HK May 23 2026: Candice flow. Two CSVs both got
// classified as unknown (Back2Life export with 18 cols, MassageBook
// export with 6 cols). Without this, the user has no way to proceed
// past the staging screen since the Preview button is gated on
// every-file-being-classified.
//
// This function never returns 'unknown'. It returns whatever mapping
// fields we can extract for the requested type, with -1 for fields
// we cannot find. The runner will skip rows where required fields
// resolve to no data; the user can also adjust column mapping via
// the legacy import path if this best-effort is too thin.
export function buildMappingForType(type, headers, rows = []) {
  const h = headers.map(x => x.toLowerCase().trim());

  // Re-derive the sniffed-column map so pickColumn fallback works.
  const sniffedByCol = new Map();
  if (rows.length > 0) {
    for (let i = 0; i < headers.length; i++) {
      sniffedByCol.set(i, sniffColumnType(rows, i));
    }
  }
  function pickColumn(headerIdx, sniffType) {
    if (headerIdx >= 0) return headerIdx;
    if (!rows.length) return -1;
    for (const [idx, t] of sniffedByCol.entries()) {
      if (t === sniffType) return idx;
    }
    return -1;
  }

  if (type === 'clients') {
    const mapping = {
      firstName: findLoose(h, 'first name', 'firstname', 'first_name', 'given name', 'client first'),
      lastName: findLoose(h, 'last name', 'lastname', 'last_name', 'family name', 'client last'),
      fullName: findLoose(h, 'client name', 'customer name', 'name'),
      email: pickColumn(findLoose(h, 'email'), 'email'),
      phone: pickColumn(findLoose(h, 'mobile_number', 'cell phone', 'mobile', 'phone', 'cell'), 'phone'),
      notes: findLoose(h, 'notes', 'note', 'comments'),
      visitCount: findLoose(h, 'visit count', 'visits', 'appointment count'),
      lastVisit: findLoose(h, 'last visit', 'last appointment', 'last seen'),
      addressLine1: findLoose(h, 'address line 1', 'address1', 'address', 'street address', 'street'),
      addressLine2: findLoose(h, 'address line 2', 'address2', 'apartment', 'apt', 'suite', 'unit'),
      city: findLoose(h, 'city', 'town'),
      state: pickColumn(findStrict(h, 'state', 'region', 'province'), 'state'),
      zip: pickColumn(findLoose(h, 'zip code', 'zip', 'postal code', 'postcode'), 'zip'),
      country: findStrict(h, 'country', 'country code'),
      service: findStrict(h, 'service', 'treatment', 'appointment type', 'session type'),
      price: pickColumn(findStrict(h, 'price', 'amount', 'session price', 'fee', 'cost'), 'currency'),
      membershipPlan: findStrict(h, 'plan', 'plan name', 'membership plan', 'membership'),
      membershipPrice: findStrict(h, 'monthly', 'membership price', 'plan price'),
      membershipCredits: findStrict(h, 'sessions per month', 'credits', 'monthly credits', 'monthly sessions'),
      membershipRenewal: findStrict(h, 'next renewal', 'renewal date', 'next billing', 'next charge'),
      membershipStatus: findStrict(h, 'membership status', 'plan status', 'subscription status'),
    };
    // Only set fullName if no first+last found
    if (mapping.firstName >= 0 || mapping.lastName >= 0) {
      mapping.fullName = -1;
    }
    return {
      type: 'clients',
      mapping,
      confidence: 'manual',
      reason: 'Set manually by you',
    };
  }

  if (type === 'appointments') {
    return {
      type: 'appointments',
      mapping: {
        clientName: findLoose(h, 'client name', 'customer name', 'name', 'client'),
        clientEmail: pickColumn(findLoose(h, 'email'), 'email'),
        clientPhone: pickColumn(findLoose(h, 'phone', 'mobile', 'cell'), 'phone'),
        service: findStrict(h, 'service', 'services', 'treatment', 'appointment type', 'session type'),
        date: pickColumn(findLoose(h, 'date of appointment', 'appointment date', 'date'), 'date'),
        startTime: pickColumn(findLoose(h, 'start time', 'time', 'start'), 'time'),
        duration: findLoose(h, 'duration', 'length', 'minutes'),
        provider: findStrict(h, 'service provided by', 'provider', 'service provider', 'employee seen', 'staff', 'therapist'),
        price: pickColumn(findStrict(h, 'price', 'amount', 'cost', 'session price', 'projected income', 'income'), 'currency'),
        notes: findLoose(h, 'notes', 'note', 'comments'),
        soapSubjective: findLoose(h, 'subjective', 'soap subjective'),
        soapObjective: findLoose(h, 'objective', 'soap objective'),
        soapAssessment: findLoose(h, 'assessment', 'soap assessment'),
        soapPlan: findLoose(h, 'plan', 'soap plan'),
        soapFull: findLoose(h, 'soap notes', 'soap', 'session notes'),
      },
      confidence: 'manual',
      reason: 'Set manually by you',
    };
  }

  if (type === 'services') {
    return {
      type: 'services',
      mapping: {
        name: findLoose(h, 'service name', 'name'),
        price: pickColumn(findStrict(h, 'price', 'amount', 'cost'), 'currency'),
        duration: findLoose(h, 'duration', 'length', 'minutes'),
        description: findLoose(h, 'description', 'desc'),
      },
      confidence: 'manual',
      reason: 'Set manually by you',
    };
  }

  return {
    type: 'unknown',
    mapping: {},
    confidence: 'low',
    reason: 'Unknown type passed to buildMappingForType',
  };
}

// Header tokens used to locate the real header row when an export
// has banner/title/metadata rows on top (MassageBook, Vagaro, and
// most "report" style exports do this). HK Jun 1 2026: Sophie May's
// MassageBook export had 3 banner rows above the real header, so the
// importer read row 1 as the header and every column rendered "-".
// Detection is vendor-agnostic: find the row that looks most like a
// header by counting how many known field tokens its cells contain.
const HEADER_TOKENS = [
  'first name', 'firstname', 'first_name', 'given name',
  'last name', 'lastname', 'last_name', 'family name',
  'client name', 'customer name', 'full name', 'name',
  'email', 'e-mail',
  'phone', 'mobile', 'cell', 'landline', 'telephone',
  'address', 'street', 'city', 'state', 'province', 'region',
  'zip', 'postal', 'country',
  'date', 'time', 'start', 'duration', 'length',
  'service', 'treatment', 'provider', 'status',
  'appointment', 'booked', 'booking',
  'gender', 'birthday', 'birthdate', 'dob',
  'notes', 'amount', 'price', 'income',
];

// Count how many distinct header tokens appear across a row's cells.
// Each token counts at most once so a single rich row (real header)
// scores far above a 2-cell banner like "Date Range","Service Providers".
function scoreHeaderRow(cells) {
  const seen = new Set();
  for (const cell of cells) {
    const c = (cell || '').toLowerCase().trim();
    if (!c) continue;
    for (const tok of HEADER_TOKENS) {
      if (seen.has(tok)) continue;
      if (c === tok || c.includes(tok)) { seen.add(tok); break; }
    }
  }
  return seen.size;
}

// Find the index of the most header-like row within the first
// `maxScan` rows. Returns 0 (current behavior) if no row scores at
// least 2 recognizable tokens, so a normal CSV with the header on
// row 1, or a file we cannot read, is never made worse.
function detectHeaderRow(allRows, maxScan = 20) {
  let bestIdx = 0;
  let bestScore = -1;
  const limit = Math.min(allRows.length, maxScan);
  for (let i = 0; i < limit; i++) {
    const s = scoreHeaderRow(allRows[i]);
    // Strictly greater keeps the earliest row on ties, which avoids
    // selecting a later data row that happens to look header-ish.
    if (s > bestScore) { bestScore = s; bestIdx = i; }
  }
  if (bestScore < 2) return 0;
  return bestIdx;
}

// Parse a CSV string into { headers, rows, headerRowNumber, skippedTopRows }.
// State-machine parser: handles quoted fields, commas inside quotes,
// escaped quotes, AND newlines inside quoted fields (the previous
// split-by-newline parser shattered multi-line quoted cells, e.g. a
// MassageBook summary cell like "11\n(25.00%)"). Also strips a leading
// UTF-8 BOM and auto-skips banner/title rows above the real header.
export function parseCSV(text) {
  if (typeof text !== 'string') return { headers: [], rows: [], headerRowNumber: 1, skippedTopRows: 0 };
  // Strip UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const allRows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      allRows.push(row);
      field = '';
      row = [];
    } else if (ch === '\r') {
      // Swallow lone CR; CRLF is handled when the following \n lands.
      if (text[i + 1] !== '\n') {
        row.push(field);
        allRows.push(row);
        field = '';
        row = [];
      }
    } else {
      field += ch;
    }
  }
  // Flush the final field/row if the file did not end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    allRows.push(row);
  }

  if (allRows.length === 0) return { headers: [], rows: [], headerRowNumber: 1, skippedTopRows: 0 };

  const headerIdx = detectHeaderRow(allRows);
  const headers = allRows[headerIdx];
  // Data rows are everything after the header, minus fully-blank rows.
  const rows = allRows
    .slice(headerIdx + 1)
    .filter(r => r.some(c => (c || '').trim() !== ''));

  return {
    headers,
    rows,
    headerRowNumber: headerIdx + 1, // 1-indexed, for the preview note
    skippedTopRows: headerIdx,
  };
}
