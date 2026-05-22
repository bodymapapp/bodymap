// src/lib/formatters/phone.js
//
// Phone number display formatting (HK May 21 2026 evening Design
// Principle #16: "Stored data and displayed data are separate
// concerns. Store canonical, display human.").
//
// Phones are stored as digits-only in the database: '5734801030'.
// That makes equality checks trivial and prevents duplicate clients
// from format mismatches. But digits-only is hostile to read.
//
// formatUSPhone takes the canonical storage form and produces a
// readable display string: '(573) 480-1030'.
//
// USAGE:
//   import { formatUSPhone } from '../lib/formatters/phone';
//   <div>{formatUSPhone(client.phone)}</div>
//
// FORMATS:
//   '5734801030'      → '(573) 480-1030'
//   '15734801030'     → '+1 (573) 480-1030'    // 11-digit with leading 1
//   '15735551234567'  → '+1 (573) 555-1234567' // long international, no good display
//   '480-1030'        → '480-1030'             // too short, return as-is
//   null / undefined  → ''
//   ''                → ''
//
// For non-US phones (international), we don't attempt to format yet.
// Future work: country-code-aware formatting.

export function formatUSPhone(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');

  // US 10-digit
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // US 11-digit with country code 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Too short or unusual length: return digits as-is so therapist
  // sees what was stored, can fix manually if needed
  if (digits.length > 0) return digits;
  return '';
}

// Strip formatting back to digits-only for storage / lookup.
// Mirror image of formatUSPhone. Used at the import boundary and
// when the user types into a phone field.
export function normalizePhone(value) {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
}
