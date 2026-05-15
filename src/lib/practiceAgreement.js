// src/lib/practiceAgreement.js
//
// One unified practice agreement. Replaces (from the therapist's UX
// surface) the separate booking policies, cancellation policy,
// massage guidelines, consent form, and liability waiver.
//
// HK May 14 2026 direction:
//   - One document the therapist edits inline
//   - One signature the client provides at intake
//   - Booking-time hard gate re-acknowledges the cancellation policy
//     (because that's the rule clients forget and get angry about)
//   - Older clients: PDF export so therapist can collect pen signature
//
// Default text synthesized from:
//   - ABMP (Associated Bodywork & Massage Professionals) standard
//     intake/consent template
//   - AMTA (American Massage Therapy Association) Standards of
//     Practice and Code of Ethics
//   - MassageBook industry packet
// The first paragraph of the default text cites these sources so the
// therapist and client see the lineage.

export const DEFAULT_PRACTICE_AGREEMENT = `# Practice Agreement and Informed Consent

This agreement is based on the standards published by the Associated Bodywork & Massage Professionals (ABMP) and the American Massage Therapy Association (AMTA). It explains what to expect from your sessions, the policies that govern this practice, and your rights as a client. Please read it carefully. Your signature confirms you understand and agree.

## About these sessions

The sessions you receive at this practice are therapeutic massage and bodywork for general wellness, stress reduction, relief of muscular tension, and improvement of circulation. Massage therapy is not a substitute for medical care. The therapist does not diagnose, prescribe, or treat illness, injury, or disease. If you have a specific medical concern, please consult your physician. Clients with acute injuries or conditions outside the scope of massage practice should consult their doctor before booking. If your therapist determines that massage is not appropriate for your condition, they will let you know and may refer you to a more suitable healthcare provider.

## Your consent

You voluntarily request and consent to receiving massage therapy. You have had the opportunity to ask questions about your sessions, alternative therapies, and the potential benefits and risks, and your questions have been answered to your satisfaction. Your consent is informed and voluntary, and you may withdraw it at any time, except for services already provided.

## Known risks

The potential risks associated with massage therapy include, but are not limited to:

- Minor superficial bruising
- Short-term muscle soreness
- Aggravation of an unknown or pre-existing injury

If you experience pain or discomfort during a session, please tell your therapist immediately so the pressure or technique can be adjusted to your comfort level.

## Health history

You have provided an accurate and complete health history to the best of your knowledge during intake. You agree to inform your therapist of any new diagnoses, medications, injuries, pregnancy, or changes to your health before future sessions. You affirm that you do not have any contagious conditions that could pose a risk to your therapist or other clients.

You authorize your therapist to update this intake record for accuracy when new information comes up during a session (for example, a new medication you mention, a typo correction, or a clarification of a pressure preference). Your therapist will not change the substance of your consent or your medical history without your agreement.

## Appointment confirmations

Appointments are typically confirmed one to two days before the scheduled time. If you do not receive a confirmation, please reach out to your therapist before your session.

## Appointment confirmation

Appointments are typically confirmed one to two days before your scheduled time. If you do not receive a confirmation message and need to reach your therapist, please use the contact information provided in your booking confirmation.

## Arrival and timing

For your first appointment, please arrive 15 minutes before your scheduled time to complete intake. For all other appointments, please arrive 5 minutes early so we can begin on time. If you arrive late, your session will end at the scheduled end time so the schedule stays on track, and the full session fee still applies. If you are more than 15 minutes late and have not reached out, the session may be cancelled.

## Cancellation policy

Standard cancellation tiers at this practice:

- More than 24 hours notice: no fee
- Less than 24 hours notice: up to 50% of the session fee
- No-show or same-day cancellation without notice: full session fee

Your therapist may waive these fees at their discretion for verifiable emergencies, illness, or inclement weather. The exact fee amounts for your booking will appear on the booking page when you confirm, and you will see and acknowledge them before the booking is confirmed.

## Illness

If you are feeling sick (cold, flu, fever, anything contagious), please reschedule. There is no fee to reschedule for illness with reasonable notice. Clients with signs, symptoms, or diagnosed contagious conditions or active infections are asked to notify their therapist and reschedule.

## Draping and physical boundaries

You will be appropriately draped with a sheet at all times during your massage. Only the area being worked on is uncovered. The breast and genital areas are always covered and never massaged. Your therapist will respect your physical comfort and your right to ask for pressure or technique adjustments at any time.

## Hygiene and environment

Please arrive showered and clean. Please avoid heavy meals during the two hours before your session. This is a non-smoking, odor-neutral practice. Both you and your therapist contribute to keeping the environment safe and comfortable.

## Professional conduct

You agree to treat your therapist with respect and dignity. Harassment, threatening behavior, sexual advances or requests, or disrespectful language will result in the session being ended immediately, and the full session fee still applies. Clients who arrive under the influence of drugs or alcohol will be asked to leave, and the full session fee still applies.

Your therapist commits to the same standards of respect, professionalism, and ethical conduct in return. The therapist will not engage in any sexual conduct or activity during a session. Your therapist serves all clients without discrimination based on race, ethnicity, religion, age, sex, gender identity, sexual orientation, disability, or socioeconomic status.

## Ending the session

You can ask to stop the session at any time, for any reason. Your therapist can also end the session at any time, for any reason, including the situations described above.

## Confidentiality

Your session notes and intake information are confidential and will not be shared without your written permission, except as required by law. Your therapist follows HIPAA-aligned privacy standards: information is stored securely, accessed only when needed, and never sold or shared with third parties for marketing.

## Liability release

You release your massage therapist and their business from liability for any harm that may unintentionally result from this treatment, except in cases of gross negligence.

## Your signature

By signing below, you confirm that you have read and understood this agreement, that your consent is informed and voluntary, and that you agree to its terms.`;

// Parse the document into sections by H2 (## ) headers. Used by the
// editor to allow inline editing of one section at a time without
// loading the whole doc into a single textarea.
export function parseAgreementSections(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith('# ')) {
      // H1 = preamble. Treated as its own section with title 'Title'.
      if (current) sections.push(current);
      current = { title: line.replace(/^#\s+/, '').trim(), body: '', level: 1 };
    } else if (line.startsWith('## ')) {
      if (current) sections.push(current);
      current = { title: line.replace(/^##\s+/, '').trim(), body: '', level: 2 };
    } else {
      if (!current) {
        current = { title: '', body: '', level: 0 };
      }
      current.body += (current.body ? '\n' : '') + line;
    }
  }
  if (current) sections.push(current);
  return sections;
}

// Reverse: write sections back into the markdown document
export function sectionsToMarkdown(sections) {
  return sections.map(s => {
    if (s.level === 1) return `# ${s.title}\n\n${s.body.trim()}`;
    if (s.level === 2) return `## ${s.title}\n\n${s.body.trim()}`;
    return s.body.trim();
  }).join('\n\n');
}

// Render the agreement with the therapist's substitutions
// (business name, cancellation fee, etc).
export function renderAgreementForClient(agreementText, therapist) {
  if (!agreementText) return '';
  const business = therapist?.business_name || therapist?.full_name || 'your therapist';
  return agreementText
    .replace(/\[Business Name\]/g, business)
    .replace(/\[Therapist Name\]/g, therapist?.full_name || business);
}
