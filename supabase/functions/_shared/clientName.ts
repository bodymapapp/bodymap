// supabase/functions/_shared/clientName.ts
//
// HK May 31 2026: canonical client name resolution for ALL user-facing
// copy in edge functions (emails, SMS, push). Centralises a rule that
// was drifting silently across 20+ functions.
//
// Why this exists:
//   bookings.client_name is what the therapist typed at booking time.
//   clients.name is the canonical client record name.
//   When clients are merged, share emails with test fixtures, or have
//   their record name updated later, these two can drift. The receipt
//   email saying "Thank you, Lapse Test" while the schedule card shows
//   "Joy Client" is the failure mode this prevents.
//
// Rule:
//   Prefer bookings.client_name when present and non-empty (that is what
//   the therapist intended to call the client at THIS booking). Fall
//   back to clients.name. Fall back to fallback (default "there").
//
// Usage:
//   import { resolveClientName, resolveClientFirstName } from '../_shared/clientName.ts';
//   const clientName  = resolveClientName(booking, client);
//   const firstName   = resolveClientFirstName(booking, client);
//
// For functions WITHOUT booking context (lapse nudges from client only):
//   resolveClientName(null, client)  // falls straight to client.name
//
// Pass the booking object you already loaded; if its select did not
// include client_name, add it. This helper is read-only, no mutations.

type BookingShape = { client_name?: string | null } | null | undefined;
type ClientShape = { name?: string | null } | null | undefined;

export function resolveClientName(
  booking: BookingShape,
  client: ClientShape,
  fallback = 'there',
): string {
  const fromBooking = (booking?.client_name || '').trim();
  if (fromBooking) return fromBooking;
  const fromClient = (client?.name || '').trim();
  if (fromClient) return fromClient;
  return fallback;
}

export function resolveClientFirstName(
  booking: BookingShape,
  client: ClientShape,
  fallback = 'there',
): string {
  const full = resolveClientName(booking, client, '');
  if (!full) return fallback;
  const first = full.split(/\s+/)[0] || '';
  return first || fallback;
}
