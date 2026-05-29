// supabase/functions/_shared/clientEmail.ts
//
// HK May 29 2026: shared helper for every client-facing notification
// email. Implements the universal 6-section frame from
// docs/EMAIL_COPY_SPEC.md so every C-series email feels written by a
// person, not a system, and always tells the client:
//   1. WHO   - the therapist
//   2. WHAT  - what happened (eyebrow + headline)
//   3. WHEN  - the session date/time (and previous time for reschedules)
//   4. SERVICE - what session (not just "session")
//   5. CHANGED - the delta (cancelled, moved, charged, refunded) + reason
//   6. NEXT  - one clear CTA + therapist sign-off
//
// Centralising this means we fix copy once and every email improves.
// Functions still own their subject, opener line, and CTA wording, so
// each touchpoint stays distinct - but the frame and tone is consistent.

import {
  EMAIL_COLORS,
  emailWrapper,
  formatApptDateTime,
  factBox,
  eyebrow,
  ctaButton,
  secondaryButton,
  tipBox,
} from './emailTemplate.ts';

export type Tone = 'sage' | 'gold' | 'rose';

function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface ClientEmailInput {
  // Branding / who
  therapist: any;                 // therapist row (uses full_name, business_name, custom_url)
  toneEyebrow?: string;           // small eyebrow text above title ("Booking cancelled" etc)
  toneEyebrowKind?: Tone;         // color tone for the eyebrow band
  title: string;                  // big H1 line
  opener: string;                 // first warm sentence in therapist's voice
  // What service / when
  serviceName?: string | null;
  bookingDate?: string | null;    // YYYY-MM-DD
  startTime?: string | null;      // HH:MM:SS
  durationMin?: number | null;
  locationAddress?: string | null;
  // For reschedules - the prior slot
  previousDate?: string | null;
  previousTime?: string | null;
  // The delta - shown in a quoted block or fact rows
  reason?: string | null;         // therapist-supplied reason, shown italic
  feeAmountCents?: number | null;
  feeChargedTo?: string | null;   // e.g. "card ending 4242" - shown in fee row
  refundAmountCents?: number | null;
  refundedTo?: string | null;
  policyInline?: string | null;   // cancellation policy text, rendered inline when relevant
  // Custom fact rows appended to the standard set (Method, Tip, Total for receipts).
  extraFactRows?: Array<{ label: string, value: string }>;
  // What next
  primaryCta?: { label: string, href: string } | null;
  secondaryCta?: { label: string, href: string } | null;
  // Final touches
  closingLine?: string | null;    // line just before sign-off, e.g. "See you then"
  // Footer
  prefName?: string;              // which pref controls this (for the unsubscribe footer)
}

function formatMoney(cents: number | null | undefined): string {
  if (cents == null) return '';
  return `$${(cents / 100).toFixed(2)}`;
}

function quotedReason(reason: string | null | undefined): string {
  if (!reason || !reason.trim()) return '';
  return `<div style="border-left:3px solid ${EMAIL_COLORS.sage};background:${EMAIL_COLORS.sageBg};padding:10px 14px;margin:14px 0;font-style:italic;color:${EMAIL_COLORS.ink};font-size:14px;line-height:1.55;">${esc(reason.trim())}</div>`;
}

function policyBlock(policy: string | null | undefined): string {
  if (!policy || !policy.trim()) return '';
  return `<div style="background:${EMAIL_COLORS.creamCard};border:1px solid ${EMAIL_COLORS.lineFaint};border-radius:8px;padding:12px 14px;margin:14px 0;font-size:13px;color:${EMAIL_COLORS.inkSoft};line-height:1.55;">
    <div style="font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:0.06em;color:${EMAIL_COLORS.inkSoft};margin-bottom:6px;">Cancellation policy</div>
    ${esc(policy)}
  </div>`;
}

function buildFactRows(opts: ClientEmailInput): Array<{ label: string, value: string }> {
  const rows: Array<{ label: string, value: string }> = [];
  if (opts.serviceName) rows.push({ label: 'Service', value: opts.serviceName });
  if (opts.bookingDate && opts.startTime) {
    rows.push({ label: 'When', value: formatApptDateTime(opts.bookingDate, opts.startTime) });
  }
  if (opts.previousDate && opts.previousTime) {
    rows.push({ label: 'Previously', value: formatApptDateTime(opts.previousDate, opts.previousTime) });
  }
  if (opts.durationMin) rows.push({ label: 'Duration', value: `${opts.durationMin} min` });
  if (opts.locationAddress) rows.push({ label: 'Where', value: opts.locationAddress });
  if (typeof opts.feeAmountCents === 'number' && opts.feeAmountCents > 0) {
    const target = opts.feeChargedTo ? ` to ${opts.feeChargedTo}` : '';
    rows.push({ label: 'Fee charged', value: `${formatMoney(opts.feeAmountCents)}${target}` });
  }
  if (typeof opts.refundAmountCents === 'number' && opts.refundAmountCents > 0) {
    const target = opts.refundedTo ? ` to ${opts.refundedTo}` : '';
    rows.push({ label: 'Refund', value: `${formatMoney(opts.refundAmountCents)}${target}` });
  }
  // Custom rows from caller (receipts: Method, Tip, Total).
  if (Array.isArray(opts.extraFactRows)) {
    for (const r of opts.extraFactRows) {
      if (r && r.label && r.value != null) rows.push(r);
    }
  }
  return rows;
}

// Build the complete inner HTML for a client email following the
// 6-section frame. Wrap the result with emailWrapper(subject, html)
// from the caller (so each function still owns its own subject line).
export function renderClientEmail(opts: ClientEmailInput): string {
  const t = opts.therapist || {};
  const therapistName = t.full_name || t.business_name || 'Your therapist';
  const therapistFirst = (t.full_name || therapistName).split(' ')[0];
  const businessName = t.business_name || therapistName;

  const eyebrowHtml = opts.toneEyebrow
    ? eyebrow(opts.toneEyebrow, opts.toneEyebrowKind || 'sage')
    : '';

  const factRows = buildFactRows(opts);
  const factBoxHtml = factRows.length ? factBox(factRows) : '';

  const reasonHtml = quotedReason(opts.reason);
  const policyHtml = policyBlock(opts.policyInline);

  const ctaHtml = opts.primaryCta
    ? `<div style="margin:22px 0 6px;">${ctaButton(opts.primaryCta.label, opts.primaryCta.href)}</div>`
    : '';
  const secondaryHtml = opts.secondaryCta
    ? `<div style="margin:0 0 6px;">${secondaryButton(opts.secondaryCta.label, opts.secondaryCta.href)}</div>`
    : '';

  const closing = opts.closingLine
    ? `<p style="font-size:15px;color:${EMAIL_COLORS.ink};line-height:1.65;margin:16px 0 4px;">${esc(opts.closingLine)}</p>`
    : '';

  const signOff = `<p style="font-size:15px;color:${EMAIL_COLORS.ink};line-height:1.5;margin:18px 0 6px;">${esc(therapistFirst)}</p>
    <p style="font-size:12px;color:${EMAIL_COLORS.inkMute};line-height:1.5;margin:0 0 0;">${esc(businessName)}</p>`;

  const prefFooter = opts.prefName
    ? `<p style="font-size:11px;color:${EMAIL_COLORS.inkMute};line-height:1.55;margin:22px 0 0;">You are getting this because "${esc(opts.prefName)}" is on in your notification settings.</p>`
    : '';

  return `
${eyebrowHtml}
<h1 style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:${EMAIL_COLORS.forest};margin:0 0 10px;line-height:1.25;">${esc(opts.title)}</h1>
<p style="font-size:15px;color:${EMAIL_COLORS.ink};line-height:1.65;margin:0 0 16px;">${esc(opts.opener)}</p>
${factBoxHtml}
${reasonHtml}
${policyHtml}
${ctaHtml}
${secondaryHtml}
${closing}
${signOff}
${prefFooter}
`;
}

// Convenience: wrap + render in one call. Returns full HTML doc.
export function renderClientEmailDoc(subject: string, opts: ClientEmailInput, preheader?: string): string {
  const bodyHtml = renderClientEmail(opts);
  return emailWrapper({ subject, bodyHtml, preheader });
}
