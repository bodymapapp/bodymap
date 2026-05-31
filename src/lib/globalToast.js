// src/lib/globalToast.js
//
// HK May 31 2026: global toast singleton. Lets any code (not just
// components inside the right provider tree) fire a soft confirmation
// toast. Wraps the existing Toast component pattern but exposes it as
// a module-level function callable from supabase wrappers, fetch
// callsites, anywhere.
//
// Why this exists:
// Prior pattern required every save handler to import useToast, get
// showToast from the hook, and call it manually. Result: half the
// save handlers don't have it. The therapist saves a session, edits
// a price, marks a no-show, etc. and gets no visible confirmation
// half the time. Customer-killing UX inconsistency.
//
// This module pairs with a wrapped supabase client (src/lib/supabase.js)
// that automatically fires a Saved toast on every successful write,
// so the default-no-confirmation problem disappears completely.

const listeners = new Set();

export function subscribeToToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function toast(message, tone = 'success', duration = 3500) {
  // Dedupe rapid-fire identical messages (within 700ms) so a save flow
  // that triggers multiple writes still only shows one "Saved" toast.
  const now = Date.now();
  if (
    lastFired
    && lastFired.message === message
    && lastFired.tone === tone
    && (now - lastFired.at) < 700
  ) {
    return;
  }
  lastFired = { message, tone, at: now };
  const event = { id: now + Math.random(), message, tone, duration };
  listeners.forEach((fn) => {
    try { fn(event); } catch (_) {}
  });
}

let lastFired = null;
