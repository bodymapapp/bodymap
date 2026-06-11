// Shared HTML email template wrapper.
//
// All MyBodyMap notification emails share the same warm sage/cream
// look so therapists and clients recognize them on sight. This file
// holds the wrapper, the standard CTA button, and helper formatters
// so we don't drift between templates.
//
// HK May 26 2026: built when shipping the 13 new email touchpoints
// (Tier 1, 2, 3 of the notification expansion). Replaces inline
// HTML duplication across send-* functions.

export const EMAIL_COLORS = {
  forest: '#2A5741',
  forestDark: '#1F2937',
  sage: '#6B9E80',
  sageBg: '#EEF3EE',
  cream: '#F9F5EE',
  creamCard: '#FAFAF7',
  gold: '#C9A84C',
  goldBg: '#FAF3DC',
  goldInk: '#92660E',
  ink: '#3D4F43',
  inkSoft: '#6B7F72',
  inkMute: '#9CA3AF',
  lineFaint: '#E8E0D0',
  white: '#FFFFFF',
};

export function emailBaseStyles() {
  return `
    body { margin:0; padding:0; background:${EMAIL_COLORS.cream}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: ${EMAIL_COLORS.ink}; }
    .wrap { max-width: 560px; margin: 0 auto; padding: 24px 16px; }
    .card { background: ${EMAIL_COLORS.white}; border-radius: 16px; padding: 32px 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 26px; font-weight: 700; color: ${EMAIL_COLORS.forest}; line-height: 1.2; margin: 0 0 14px; letter-spacing: -0.3px; }
    h2 { font-family: Georgia, 'Times New Roman', serif; font-size: 19px; font-weight: 700; color: ${EMAIL_COLORS.forest}; margin: 24px 0 10px; }
    p { font-size: 15px; line-height: 1.6; color: ${EMAIL_COLORS.ink}; margin: 0 0 14px; }
    a { color: ${EMAIL_COLORS.forest}; }
    .muted { color: ${EMAIL_COLORS.inkSoft}; }
    .footer { font-size: 11px; color: ${EMAIL_COLORS.inkMute}; text-align: center; margin: 24px 0 0; }
  `;
}

// Standard primary CTA button used across all templates.
export function ctaButton(label: string, href: string) {
  return `<a href="${href}" style="display:block;background:${EMAIL_COLORS.forest};color:#fff !important;text-decoration:none;border-radius:10px;padding:14px 20px;text-align:center;font-size:15px;font-weight:700;margin:18px 0;letter-spacing:0.2px;">${label}</a>`;
}

// Subtler secondary CTA (sage outline).
export function secondaryButton(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;background:transparent;color:${EMAIL_COLORS.forest} !important;text-decoration:none;border:1.5px solid ${EMAIL_COLORS.sage};border-radius:10px;padding:10px 18px;font-size:14px;font-weight:600;margin:8px 0;">${label}</a>`;
}

// Tag at the top of the email establishing the moment.
export function eyebrow(text: string, tone: 'sage' | 'gold' | 'rose' = 'sage') {
  const bg = tone === 'gold' ? EMAIL_COLORS.goldBg : tone === 'rose' ? '#FDF2F2' : EMAIL_COLORS.sageBg;
  const fg = tone === 'gold' ? EMAIL_COLORS.goldInk : tone === 'rose' ? '#9F1239' : EMAIL_COLORS.forest;
  return `<div style="display:inline-block;background:${bg};color:${fg};padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 14px;">${text}</div>`;
}

// Boxed fact rows (date, location, amount). Used in confirmations.
export function factBox(rows: Array<{ label: string, value: string }>) {
  // HK May 29 2026: rewrote from flex divs to a table. Gmail iOS and
  // many other mail clients strip flexbox at delivery time, which
  // collapsed every label+value pair to inline-no-space ("ServiceDeep
  // Tissue", "Duration60 min", "Price$100"). Table layout is the
  // bullet-proof email standard for two-column rows. Also added
  // explicit border-bottom on each row except the last for a clean
  // hairline divider that works everywhere.
  const lastIdx = rows.length - 1;
  const rowHtml = rows.map((r, i) => `
    <tr>
      <td style="font-size:13px;color:${EMAIL_COLORS.inkSoft};font-weight:500;padding:9px 0;text-align:left;border-bottom:${i === lastIdx ? 'none' : `1px solid ${EMAIL_COLORS.lineFaint}`};width:35%;vertical-align:top;">${r.label}</td>
      <td style="font-size:14px;color:${EMAIL_COLORS.forestDark};font-weight:600;padding:9px 0;text-align:right;border-bottom:${i === lastIdx ? 'none' : `1px solid ${EMAIL_COLORS.lineFaint}`};vertical-align:top;">${r.value}</td>
    </tr>
  `).join('');
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${EMAIL_COLORS.creamCard};border-radius:12px;padding:6px 18px;margin:16px 0;border-collapse:collapse;">
      ${rowHtml}
    </table>
  `;
}

// Friendly tip / hint block in warm cream.
export function tipBox(title: string, body: string, tone: 'sage' | 'gold' | 'rose' = 'sage') {
  const bg = tone === 'gold' ? EMAIL_COLORS.goldBg : tone === 'rose' ? '#FDF2F2' : EMAIL_COLORS.sageBg;
  const fg = tone === 'gold' ? EMAIL_COLORS.goldInk : tone === 'rose' ? '#9F1239' : EMAIL_COLORS.forest;
  return `
    <div style="background:${bg};border-radius:12px;padding:14px 18px;margin:16px 0;">
      <p style="font-size:13px;font-weight:700;color:${fg};margin:0 0 4px;">${title}</p>
      <p style="font-size:13px;color:${fg};margin:0;line-height:1.6;">${body}</p>
    </div>
  `;
}

export function emailWrapper(opts: {
  subject: string,
  bodyHtml: string,
  preheader?: string,
}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${opts.subject}</title>
<style>${emailBaseStyles()}</style>
</head>
<body>
${opts.preheader ? `<div style="display:none;font-size:1px;color:${EMAIL_COLORS.cream};line-height:1px;max-height:0;overflow:hidden;">${opts.preheader}</div>` : ''}
<div class="wrap">
  <div class="card">
    ${opts.bodyHtml}
  </div>
  <p class="footer">Sent by MyBodyMap · mybodymap.app</p>
</div>
</body>
</html>`;
}

// Format a Date to a warm human readable string like
// "Tuesday, May 28 at 2:30 PM"
export function formatApptDateTime(dateStr: string, timeStr: string): string {
  try {
    const d = new Date(`${dateStr}T${timeStr}`);
    const day = d.toLocaleDateString('en-US', { weekday: 'long' });
    const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${day}, ${date} at ${time}`;
  } catch (e) {
    return `${dateStr} ${timeStr}`;
  }
}

// Reply-to address  - therapist's email always wins, fallback to support
export function replyToFor(therapist: any): string {
  return therapist?.email || 'support@mybodymap.app';
}

// From address  - uses therapist's business name plus the platform sender
export function fromFor(therapist: any, sender: 'hello' | 'sessions' = 'hello'): string {
  const name = therapist?.business_name || therapist?.full_name || 'MyBodyMap';
  // Escape any quotes in the business name to avoid breaking the header
  const safeName = String(name).replace(/[<>"]/g, '');
  return `${safeName} <${sender}@mybodymap.app>`;
}
