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

// Detect the most likely content type of a CSV based on its
// headers. Returns:
//   { type: 'clients' | 'appointments' | 'services' | 'unknown',
//     mapping: { ... },
//     confidence: 'high' | 'medium' | 'low',
//     reason: string  (human-readable explanation) }
export function detectCsvType(headers) {
  const h = headers.map(x => x.toLowerCase().trim());

  // Look for distinctive markers
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

  // ── Decision tree ──

  // Strong appointment signal: has date + time + (service OR client name)
  if (hasDate && (hasStartTime || hasDuration) && (hasFullName || hasFirstName)) {
    const mapping = {
      clientName: findLoose(h, 'client name', 'customer name', 'name', 'client'),
      clientEmail: findLoose(h, 'email'),
      clientPhone: findLoose(h, 'phone', 'mobile', 'cell'),
      service: findStrict(h, 'service', 'treatment', 'appointment type', 'session type'),
      date: findLoose(h, 'date'),
      startTime: findLoose(h, 'start time', 'time', 'start'),
      duration: findLoose(h, 'duration', 'length', 'minutes'),
      price: findStrict(h, 'price', 'amount', 'cost', 'session price'),
      notes: findLoose(h, 'notes', 'note', 'comments'),
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
        price: findStrict(h, 'price', 'amount', 'cost'),
        duration: findLoose(h, 'duration', 'length', 'minutes'),
        description: findLoose(h, 'description', 'desc'),
      },
      confidence: 'medium',
      reason: 'Has service name and price columns, no client info',
    };
  }

  // Strong client signal: has names + contact info, no date/time
  if ((hasFirstName || hasLastName || hasFullName) && (hasEmail || hasPhone) && !hasDate) {
    const mapping = {
      firstName: findLoose(h, 'first name', 'firstname', 'given name', 'client first'),
      lastName: findLoose(h, 'last name', 'lastname', 'family name', 'client last'),
      fullName: -1,
      email: findLoose(h, 'email'),
      phone: findLoose(h, 'mobile', 'phone', 'cell'),
      notes: findLoose(h, 'notes', 'note', 'comments'),
      visitCount: findLoose(h, 'visit count', 'visits', 'appointment count'),
      lastVisit: findLoose(h, 'last visit', 'last appointment', 'last seen'),
      service: findStrict(h, 'service', 'treatment', 'appointment type', 'session type'),
      price: findStrict(h, 'price', 'amount', 'session price', 'fee', 'cost'),
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
