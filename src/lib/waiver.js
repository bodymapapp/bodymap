// Default waiver text seeded for all therapists. Therapist's business name
// auto-substitutes in client booking flow (we don't ask them to edit).
// Keep in sync with waiver_feature.sql migration.
//
// HK May 14 2026: Alison G. shared a MassageBook policy packet as her
// reference. Industry-standard waiver should explicitly include:
//   - Voluntary consent to receive massage
//   - Statement that massage is for wellness, not medical treatment
//   - Affirmation of accurate health history
//   - Explicit list of known risks (bruising, soreness, aggravation
//     of unknown injuries)
//   - Reciprocal right to end the session
//   - Affirmation client doesn't have contagious conditions
//   - Confidentiality acknowledgement
//   - Liability release for unintentional harm

export const DEFAULT_WAIVER_TEXT = `I voluntarily request and consent to receiving massage therapy.

I understand that massage therapy is provided for stress reduction, relaxation, relief from muscular tension, and general wellness. Massage therapy is not a substitute for medical care or diagnosis, and the therapist does not diagnose illness, injury, or disease.

I have provided an accurate and complete health history to the best of my knowledge. I will inform my therapist of any new diagnoses, medications, injuries, pregnancy, or changes to my health before future sessions. I authorize my therapist to update this intake record for accuracy when new information comes up during a session (for example, a new medication, a typo correction, or a clarification of a pressure preference). My therapist will not change the substance of my consent or my medical history without my agreement.

I understand the potential risks associated with massage therapy include, but are not limited to:
- Minor superficial bruising
- Short-term muscle soreness
- Aggravation of an unknown or pre-existing injury

I affirm that I do not have any contagious conditions that could pose a risk to my therapist or other clients.

I understand I can request changes to pressure, technique, or positioning at any time. I can end the session at any time, for any reason. My therapist may also end the session at any time, for any reason.

I understand my session notes and intake information are confidential and will not be shared without my written permission, except as required by law.

I have had the opportunity to ask questions about massage therapy, and my questions have been answered to my satisfaction.

I release my massage therapist and their business from liability for any harm that may unintentionally result from this treatment, except in cases of gross negligence.

I have read, understood, and voluntarily agree to the above.`;

// Returns the waiver text with therapist/business name substituted in where relevant.
// If therapist has customized their waiver, we don't overwrite their wording, we just
// replace the generic phrases with their specific name/business when present.
export function renderWaiverForClient(waiverText, therapistName, businessName) {
  if (!waiverText) return '';
  return waiverText
    .replace(/\[Therapist Name\]/g, therapistName || 'my therapist')
    .replace(/\[Business Name\]/g, businessName || 'their business');
}
