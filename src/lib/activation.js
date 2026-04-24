// Activation tracking, tiny helper used throughout the app to log key
// funnel events per therapist. Fire-and-forget: we never block UI on this.
//
// Usage:
//   import { trackActivation } from '../lib/activation';
//   trackActivation(therapist.id, 'imported_clients', { count: 42 });
//
// Each event is unique per therapist per event_name (enforced by dedupe here).
// We read back our own events to decide whether to log again, most events
// should only fire once per therapist (first time they do something).

import { supabase } from './supabase';

const ONCE_EVENTS = new Set([
  'imported_clients',
  'added_service',
  'set_availability',
  'shared_booking_link',
  'sent_first_intake',
  'first_booking_received',
  'first_client_returned',
  'referral_made',
  'testimonial_submitted',
]);

export async function trackActivation(
  therapistId: string,
  eventName: string,
  metadata?: Record<string, any>,
) {
  if (!therapistId || !eventName) return;
  try {
    // For once-per-therapist events, check if already logged
    if (ONCE_EVENTS.has(eventName)) {
      const { data: existing } = await supabase
        .from('activation_events')
        .select('id')
        .eq('therapist_id', therapistId)
        .eq('event_name', eventName)
        .limit(1)
        .maybeSingle();
      if (existing) return; // already logged, no-op
    }
    await supabase.from('activation_events').insert({
      therapist_id: therapistId,
      event_name: eventName,
      metadata: metadata || null,
    });
  } catch {
    // Never throw to the caller, analytics must not break UX
  }
}
