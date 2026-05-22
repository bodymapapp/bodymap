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
  const hasDate = findLoose(h, 'date') >= 0;
  const hasStartTime = findLoose(h, 'start time', 'start', 'time') >= 0;
  const hasDuration = findLoose(h, 'duration', 'length', 'minutes') >= 0;
  const hasFirstName = findLoose(h, 'first name', 'firstname', 'given name') >= 0;
  const hasLastName = findLoose(h, 'last name', 'lastname', 'family name') >= 0;
  const hasFullName = findLoose(h, 'client name', 'customer name', 'name') >= 0;
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
      service: findStrict(h, 'service', 'treatment', 'appointment type', 'session type'),
      date: pickColumn(findLoose(h, 'date'), 'date'),
      startTime: pickColumn(findLoose(h, 'start time', 'time', 'start'), 'time'),
      duration: findLoose(h, 'duration', 'length', 'minutes'),
      price: pickColumn(findStrict(h, 'price', 'amount', 'cost', 'session price'), 'currency'),
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
      firstName: findLoose(h, 'first name', 'firstname', 'given name', 'client first'),
      lastName: findLoose(h, 'last name', 'lastname', 'family name', 'client last'),
      fullName: -1,
      email: pickColumn(findLoose(h, 'email'), 'email'),
      phone: pickColumn(findLoose(h, 'mobile', 'phone', 'cell'), 'phone'),
      notes: findLoose(h, 'notes', 'note', 'comments'),
      visitCount: findLoose(h, 'visit count', 'visits', 'appointment count'),
      lastVisit: findLoose(h, 'last visit', 'last appointment', 'last seen'),
      // Address fields with sniff fallback for state/zip
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

// Parse a CSV string into { headers, rows }. Handles quoted fields,
// commas inside quotes, and escaped quotes. Same parser as the
// existing ImportClients.js uses.
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}
