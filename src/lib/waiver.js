// Default waiver text seeded for all therapists. Therapist's business name
// auto-substitutes in client booking flow (we don't ask them to edit).
// Keep in sync with waiver_feature.sql migration.

export const DEFAULT_WAIVER_TEXT = `I understand that massage therapy is provided for stress reduction, relaxation, relief from muscular tension, and improvement of circulation and energy flow. Massage therapy is not a substitute for medical care or diagnosis. If I have any medical conditions, I will inform my therapist before the session begins.

I have completed the intake to the best of my knowledge. I will inform my therapist of any changes to my health, medications, or pregnancy status before future sessions.

I understand I can request changes to pressure, technique, or positioning at any time during my session. I can end the session at any point for any reason.

I release my massage therapist and their business from liability for any injury or adverse reaction that may occur during or after the session, except in cases of gross negligence.

I have read, understood, and voluntarily agree to the above.`;

// Returns the waiver text with therapist/business name substituted in where relevant.
// If therapist has customized their waiver, we don't overwrite their wording — we just
// replace the generic phrases with their specific name/business when present.
export function renderWaiverForClient(waiverText, therapistName, businessName) {
  if (!waiverText) return '';
  return waiverText
    .replace(/\[Therapist Name\]/g, therapistName || 'my therapist')
    .replace(/\[Business Name\]/g, businessName || 'their business');
}
