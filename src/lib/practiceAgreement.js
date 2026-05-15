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

export const DEFAULT_PRACTICE_AGREEMENT = `# Client Agreement and Informed Consent

This agreement is based on the standards published by the Associated Bodywork & Massage Professionals (ABMP) and the American Massage Therapy Association (AMTA). It explains what your sessions include, the policies that govern this practice, the risks and benefits involved, and the rights and responsibilities of both you and your therapist. Please read it carefully before signing. Your signature confirms that you understand the terms and agree to them.

## Scope of services

The services provided at this practice are therapeutic massage and bodywork delivered for general wellness, stress reduction, relief of muscular tension, improvement of circulation, and support of the body's natural relaxation response. These services are not intended to diagnose, treat, cure, or prevent any medical condition, and they are not a substitute for medical care from a licensed physician or healthcare provider.

Your therapist does not provide medical diagnoses, prescribe medication, or order or interpret medical tests. Nothing said during a session should be understood as medical advice. If you have a specific medical concern, an undiagnosed symptom, an acute injury, or a condition outside the scope of massage practice, you should consult your physician before booking a session. If your therapist concludes during intake or at any point during a session that massage is not appropriate for your current condition, they will tell you, may refer you to a healthcare provider better suited to your needs, and may decline or end the session.

## Your informed consent

You voluntarily request and consent to receive massage therapy. Before consenting you have had the opportunity to ask questions about the techniques used, the benefits and risks of treatment, available alternative therapies, and any aspect of this agreement, and your questions have been answered to your satisfaction. You understand that consent is given freely, may be limited (for example to specific areas of the body), and may be withdrawn at any time before or during a session, except for services that have already been provided.

If you are signing on behalf of a minor or a person under your legal care, you confirm that you have the legal authority to consent on their behalf and that you have provided your therapist with accurate information about them.

## Acknowledged risks of treatment

You understand that massage therapy carries known risks even when performed correctly by a licensed practitioner. These risks include, but are not limited to:

- Minor superficial bruising or skin redness
- Short-term muscle soreness following deeper work
- Temporary lightheadedness, headache, or fatigue
- Brief emotional release tied to the body's relaxation response
- Aggravation of an unknown or pre-existing injury, condition, or sensitivity
- Allergic reaction to oils, lotions, or other products used during the session

You understand that you must tell your therapist immediately if you experience pain, discomfort, dizziness, or anything that does not feel right during the session, so that pressure, technique, positioning, or products can be adjusted, or the session paused or ended.

## Health information and your responsibility

You have provided an accurate and complete health history to the best of your knowledge during intake, including medical conditions, surgeries, injuries, allergies, medications, supplements, and pregnancy status. You understand that incomplete or inaccurate information could expose you to risks your therapist would otherwise help you avoid.

You agree to inform your therapist of any new diagnosis, medication change, injury, surgery, allergy, pregnancy, or significant change in your health before each future session, and to mention anything new during a session if it becomes relevant.

You affirm that, to the best of your knowledge, you do not currently have any contagious or transmissible condition that could pose a risk to your therapist or to other clients. You agree to cancel and reschedule if such a condition develops before a scheduled session.

You authorize your therapist to update your intake record for accuracy when new information surfaces during a session, such as a corrected typo, a newly mentioned medication, or a clarified preference. Your therapist will not alter the substance of your consent or your medical history without speaking with you first.

## Confidentiality and your records

Your session notes, intake information, health history, and personal contact information are kept confidential and will not be disclosed to any third party without your written permission, except as specifically required or permitted by law (for example, a valid subpoena, a mandated report of abuse or neglect, or a credible threat of serious harm).

Your therapist follows privacy practices aligned with the principles of the Health Insurance Portability and Accountability Act (HIPAA) where applicable. Your records are stored securely, accessed only by your therapist or authorized care team members on a need-to-know basis, and are never sold, traded, or shared with third parties for marketing purposes.

You may request a copy of your records, request a correction, or revoke your authorization for future disclosures in writing at any time.

## Appointment confirmations and reminders

Appointments are typically confirmed one to two days before the scheduled time, by email, text, or app notification. If you have not received a confirmation and your session is approaching, please reach out using the contact information in your booking message. You are responsible for keeping your contact information current with your therapist so confirmations and changes reach you.

## Arrival and timing

For your first appointment, please plan to arrive 15 minutes before your scheduled session time so you can complete or review your intake without rushing. For follow-up appointments, please arrive 5 minutes before your scheduled time so the session can begin on time.

If you arrive late, your session will still end at its scheduled stop time so that the next client's appointment is not affected. The full session fee applies regardless of how much of the scheduled time you receive. If you are more than 15 minutes late and your therapist has not heard from you, the appointment may be cancelled and the cancellation policy below applies.

## Cancellation, rescheduling, and no-show policy

If you cannot keep an appointment, please notify your therapist as far in advance as possible. The fees charged depend on how much notice is given:

If you cancel:
- More than 24 hours before your appointment: {cancel_24h_plus}% of the session fee
- Within 24 hours: {cancel_under_24h}% of the session fee
- Within 2 hours: {cancel_under_2h}% of the session fee

If you reschedule:
- More than 24 hours before your appointment: {reschedule_24h_plus}% of the session fee
- Within 24 hours: {reschedule_under_24h}% of the session fee

If you do not appear at your appointment time without notice: {no_show}% of the session fee.

You will see and acknowledge these amounts at the time of booking. Cancellation fees may be waived for verifiable emergencies, illness with reasonable notice, or inclement weather, at your therapist's sole discretion. To keep a payment method on file for these charges, you authorize your therapist to bill the card used at booking for any fees outlined here.

## Illness

If you have any signs or symptoms of a contagious illness (fever, cough, vomiting, diarrhea, active skin infection, flu-like symptoms, or anything you suspect may be transmissible), please reschedule. There is no fee to reschedule for illness when reasonable notice is given. Clients with diagnosed contagious conditions or active infections are asked to disclose the condition to their therapist and reschedule until cleared.

## Draping, physical contact, and your right to comfort

You will be appropriately draped with a sheet or towel throughout the entire session. Only the specific area being worked on will be uncovered at any given time, and that area will be recovered when work moves elsewhere. The breast tissue, genital area, and gluteal cleft are always covered and are not massaged. Other areas you wish to keep covered or excluded from the session will be excluded at your request without explanation.

You may, at any time and for any reason, ask your therapist to adjust pressure, technique, music, temperature, conversation level, or positioning. You may ask your therapist to leave the room while you change, to keep specific clothing on during the session, or to stop work on a particular area. Your comfort is your right, and asking for an adjustment is welcomed at any point.

## Hygiene and environment

For the safety and comfort of everyone, please arrive showered and clean. Please avoid heavy meals during the two hours before your session and avoid alcohol or recreational drug use on the day of your appointment. This practice maintains a smoke-free, fragrance-conscious, and odor-neutral environment. Your therapist takes equivalent care with hygiene, sanitation, and equipment cleanliness between every client.

## Professional conduct and mutual respect

You and your therapist commit to a professional, respectful relationship throughout your time together. The following conduct is grounds for immediate termination of the session by your therapist, with the full session fee still due:

- Harassment of any kind, including sexual, verbal, or threatening
- Sexual advances, sexual requests, or sexualized language
- Physical aggression or threats of harm
- Disrespectful, demeaning, or discriminatory language
- Arriving under the influence of alcohol, recreational drugs, or substances that impair judgment

Your therapist commits to the same standards. Your therapist will never engage in any sexual conduct, sexual contact, sexualized speech, or romantic relationship with a client. Your therapist serves all clients without discrimination based on race, ethnicity, national origin, religion, age, sex, gender identity, sexual orientation, marital status, disability, body size, immigration status, or socioeconomic status. If you ever feel that your therapist has failed to honor these commitments, you have every right to end the session, leave, and report the matter to the appropriate licensing board.

## Right to end the session

You may end the session at any time, for any reason, with no obligation to explain. Your therapist may also end the session at any time, for any reason, including the conduct violations described above or a clinical determination that continuing the session would not be in your best interest. If your therapist ends the session for a conduct violation, the full session fee applies. If your therapist ends the session for a clinical reason, billing will be prorated based on the time used.

## Photography, recording, and identifiable images

Photographs, video, audio recording, or other identifying images of you will not be made during your session or in the practice space without your separate written consent. You may not photograph, record, or live-stream your session. If photography is part of a documented assessment (for example, postural analysis) it will be discussed and consented to in advance, on a per-image basis.

## Limitation of liability

To the fullest extent permitted by law, you release, waive, and discharge your massage therapist and their business, and their respective owners, employees, contractors, agents, and affiliates, from any and all claims, demands, actions, causes of action, costs, expenses, attorneys' fees, damages, and liabilities of any kind, whether known or unknown, arising out of or in connection with the massage therapy services you receive, except for claims arising from gross negligence, willful misconduct, or violation of law on the part of your therapist.

You acknowledge that:

- You have provided accurate health information, and any injury resulting from undisclosed conditions or inaccurate disclosure is not the responsibility of your therapist.
- You have read and understood the acknowledged risks above, and you assume those risks knowingly.
- You have had the opportunity to ask questions about treatment, alternatives, and risks, and your questions were answered to your satisfaction.
- You will inform your therapist promptly if you experience an adverse effect, so that it can be documented and addressed.
- This release applies to you, your heirs, your assigns, and anyone making a claim on your behalf.

Nothing in this release limits any right you have under applicable law that cannot be waived by agreement. If any provision of this release is held to be invalid or unenforceable, the remaining provisions remain in full force and effect.

## Term, updates, and disputes

This agreement applies to all sessions you receive at this practice and remains in effect until you or your therapist ends the practitioner-client relationship. Your therapist may update this agreement from time to time and will notify you of significant changes before your next session, giving you an opportunity to review and re-sign.

This agreement is governed by the laws of the state or province in which the practice operates, without regard to conflict-of-law rules. Any disputes arising from or related to this agreement or your sessions will first be addressed through good-faith conversation between you and your therapist. If a dispute cannot be resolved that way, it will be submitted to mediation before any other formal action is taken.

## Your signature

By signing below, you confirm that:

1. You have read this agreement in full, or have had it read to you, and you understand its terms.
2. Your consent to receive massage therapy is informed, voluntary, and given freely.
3. The health information you have provided is accurate and complete to the best of your knowledge.
4. You agree to the cancellation, rescheduling, and conduct policies described above.
5. You release your therapist from liability as set out in the limitation of liability section, except as the law requires otherwise.

This signature applies to all sessions you receive at this practice unless and until a revised agreement is signed.`;

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

// Render the agreement with the therapist's substitutions:
//   - Business name + therapist name in []
//   - Cancellation policy tokens in {} pulled live from
//     therapist.cancellation_policy JSON. This keeps the agreement
//     text in sync with the actual configured percentages so the
//     therapist edits one place (cancellation policy editor) and
//     the agreement reflects it. Therapists who want fixed numbers
//     can edit their agreement and replace tokens with concrete
//     values; tokens that don't appear in the text are simply
//     ignored.
//
// Token reference:
//   {cancel_24h_plus}        cancel.cancel_24h_plus_percent
//   {cancel_under_24h}       cancel.cancel_2_to_24h_percent
//   {cancel_under_2h}        cancel.cancel_under_2h_percent
//   {reschedule_24h_plus}    cancel.reschedule_24h_plus_percent
//   {reschedule_under_24h}   cancel.reschedule_under_24h_percent
//   {no_show}                cancel.no_show_percent
export function renderAgreementForClient(agreementText, therapist) {
  if (!agreementText) return '';
  const business = therapist?.business_name || therapist?.full_name || 'your therapist';

  // Pull cancellation policy. Default to sensible values when the
  // therapist hasn't set up cancellation yet so the agreement reads
  // cleanly out of the box rather than showing 0% everywhere.
  const cx = therapist?.cancellation_policy || {};
  const enabled = !!therapist?.cancellation_policy_enabled;
  const tokens = {
    cancel_24h_plus:      enabled ? (cx.cancel_24h_plus_percent ?? 0)    : 0,
    cancel_under_24h:     enabled ? (cx.cancel_2_to_24h_percent ?? 50)   : 50,
    cancel_under_2h:      enabled ? (cx.cancel_under_2h_percent ?? 100)  : 100,
    reschedule_24h_plus:  enabled ? (cx.reschedule_24h_plus_percent ?? 0): 0,
    reschedule_under_24h: enabled ? (cx.reschedule_under_24h_percent ?? 0): 0,
    no_show:              enabled ? (cx.no_show_percent ?? 100)          : 100,
  };

  let out = agreementText
    .replace(/\[Business Name\]/g, business)
    .replace(/\[Therapist Name\]/g, therapist?.full_name || business);
  for (const [key, val] of Object.entries(tokens)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
  }
  return out;
}
