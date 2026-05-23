// src/lib/onboardingNavigate.js
//
// HK May 23 2026: Shared handler for OnboardingChecklist's special
// 'view' values that aren't real routes. The checklist component
// passes the view string to onNavigate(), and this helper interprets:
//
//   import-skip       → stamps therapists.skipped_import_at = now()
//                       (Step 1: 'I'm starting fresh' button)
//   import-help       → opens mailto: with prefilled help-import body
//                       (Step 1: 'I need help' button)
//   preview-booking   → opens /book/<custom_url> in a new tab AND
//                       stamps therapists.booking_page_previewed_at
//                       (Step 4: 'Preview booking page' button)
//   anything else     → routes to /dashboard/<view> via React Router
//
// Two placements use this: the dashboard home render (line ~5934 of
// Dashboard.js) and the Settings page render (above 'How I practice').
// Both placements call this helper so the three special behaviors
// stay identical regardless of where the therapist taps.

import { supabase } from './supabase';

export function buildOnboardingNavigate({ therapist, navigate, onTherapistUpdated }) {
  return async function onboardingNavigate(view) {
    if (!view) {
      navigate('/dashboard');
      return;
    }

    // Sentinel: __refresh. The component just wrote something to the
    // therapist row and wants the parent state refreshed without any
    // navigation. Used by Step 5 policy toggles.
    if (view === '__refresh') {
      if (onTherapistUpdated) onTherapistUpdated();
      return;
    }

    // Step 1: 'I'm starting fresh'. Stamp the timestamp so the
    // checklist auto-detector treats Step 1 as complete. The
    // checklist re-reads from therapist prop, so we call back to
    // the parent to refetch.
    if (view === 'import-skip') {
      if (!therapist?.id) return;
      try {
        const { error } = await supabase
          .from('therapists')
          .update({ skipped_import_at: new Date().toISOString() })
          .eq('id', therapist.id);
        if (error) {
          console.error('[onboarding] skip import failed:', error);
          return;
        }
        if (onTherapistUpdated) onTherapistUpdated();
      } catch (e) {
        console.error('[onboarding] skip import threw:', e);
      }
      return;
    }

    // Step 1: 'I need help'. Prefilled mailto opens in the user's
    // default email client. The therapist fills in the bracketed
    // placeholders before sending. Routes to support@mybodymap.app
    // for now; will move to import@mybodymap.app when the disclaimer
    // flow ships (BLOCK_PLAN follow-up).
    if (view === 'import-help') {
      const subject = encodeURIComponent('Help importing my client data');
      const body = encodeURIComponent(
        'Hi MyBodyMap team,\n\n' +
        'I would like help importing my client data into MyBodyMap.\n\n' +
        'My business name: [your business name]\n' +
        'My previous platform: [Square, MassageBook, Vagaro, Mindbody, Jane, ClinicSense, other]\n' +
        'Approximate number of clients: [your count]\n\n' +
        'Thanks!'
      );
      window.location.href = `mailto:support@mybodymap.app?subject=${subject}&body=${body}`;
      return;
    }

    // Step 4: 'Preview booking page'. Opens the public booking page in
    // a new tab so the therapist sees what their clients see, then
    // stamps the timestamp so the step auto-completes. The new-tab
    // open happens BEFORE the supabase update so any DB latency does
    // not delay the visual confirmation.
    //
    // 'preview-booking-stamp' variant: same DB stamp but caller (the
    // component) is handling the UI itself via modal, so we skip the
    // window.open. Added May 23 2026 when HK flagged the new-tab open
    // as a dead-end UX.
    if (view === 'preview-booking' || view === 'preview-booking-stamp') {
      if (view === 'preview-booking') {
        const custom = therapist?.custom_url || '';
        const url = custom
          ? `${window.location.origin}/book/${custom}`
          : `${window.location.origin}/dashboard/settings#booking_page`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }

      if (!therapist?.id) return;
      try {
        const { error } = await supabase
          .from('therapists')
          .update({ booking_page_previewed_at: new Date().toISOString() })
          .eq('id', therapist.id);
        if (error) {
          console.error('[onboarding] preview stamp failed:', error);
          return;
        }
        if (onTherapistUpdated) onTherapistUpdated();
      } catch (e) {
        console.error('[onboarding] preview stamp threw:', e);
      }
      return;
    }

    // Default: route to /dashboard/<view>. This handles all existing
    // step routes like 'settings#import', 'settings#services', etc.
    navigate(`/dashboard/${view}`);
  };
}
