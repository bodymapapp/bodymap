// supabase/functions/send-gift-certificate/index.ts
//
// Sends a beautiful HTML email to the gift certificate recipient when a
// therapist creates a gift card from their dashboard (or when a client
// purchases one through the future public gift card buy flow).
//
// REQUEST BODY:
//   {
//     gift_certificate_id: string  (UUID of the row in gift_certificates)
//   }
//
// The function pulls everything else it needs from the database so the
// caller doesn't have to pass therapist info, code, amount, etc. This
// keeps the contract simple and avoids drift between caller and email.
//
// Idempotency: the function looks for a flag email_sent_at on the row;
// if present, returns early without resending. The caller can pass
// { force: true } to override (e.g., if the recipient lost their email).
//
// Failure tolerance: never throws, always returns a JSON response. If
// the email fails to send, we log to notification_log with status:failed
// so the founder dashboard surfaces it.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Server config missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { gift_certificate_id, force } = await req.json();

    if (!gift_certificate_id) {
      return new Response(JSON.stringify({ error: 'gift_certificate_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Pull the gift cert + therapist in one go.
    const { data: cert, error: certErr } = await supabase
      .from('gift_certificates')
      .select('*')
      .eq('id', gift_certificate_id)
      .maybeSingle();

    if (certErr || !cert) {
      return new Response(JSON.stringify({ error: 'Gift certificate not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!cert.recipient_email) {
      return new Response(JSON.stringify({ error: 'No recipient email on this certificate' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Idempotency check — don't double-fire unless caller passes force:true.
    if (cert.email_sent_at && !force) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'already_sent' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Pull therapist for business name, booking-link slug, and branding.
    // gift_card_theme picks the palette; gift_card_message is the
    // therapist's free-form note that appears on every card; photo_url
    // is the small image (logo or personal photo) shown on the card.
    const { data: therapist } = await supabase
      .from('therapists')
      .select('id, full_name, business_name, custom_url, photo_url, gift_card_theme, gift_card_message')
      .eq('id', cert.therapist_id)
      .maybeSingle();

    const businessName = therapist?.business_name || therapist?.full_name || 'Your therapist';
    const therapistFirstName = (therapist?.full_name || '').split(' ')[0] || '';
    const bookingLink = therapist?.custom_url
      ? `https://mybodymap.app/book/${therapist.custom_url}`
      : 'https://mybodymap.app';

    const recipientName = cert.recipient_name || 'friend';
    const purchaserName = cert.purchaser_name || 'Someone who cares';
    const amount = Number(cert.amount || 0);
    const code = cert.code;
    const personalNote = (cert.message || '').trim();
    // Per-card branding resolution: cert columns win, fall back to
    // therapist defaults. Same precedence as the dashboard preview and
    // print page.
    const brandMessage = (cert.card_brand_message || therapist?.gift_card_message || '').trim();
    const photoUrl = (cert.card_image_url || therapist?.photo_url || '').trim();
    const themeKey = cert.theme || therapist?.gift_card_theme || 'rose';
    const designKey = cert.design_template || 'just-because';

    // Design metadata mirrored from src/lib/giftCardDesigns.js. Inline
    // here because edge functions can't import from src/. Keep in sync.
    // Greeting is a function: pass recipientName, get the formatted
    // line ('Happy Birthday, Sarah!' vs 'Dear Sarah,' etc).
    const DESIGNS: Record<string, any> = {
      'just-because': {
        eyebrow: '♡ A GIFT FOR YOU',
        greeting: (r: string) => r ? `Dear ${r},` : 'For someone special,',
        closingLine: null,
        decorationHtml: (a: string, ad: string) =>
          `<div style="position:absolute;top:6px;right:10px;font-size:24px;opacity:0.35;color:${a};">❋</div>` +
          `<div style="position:absolute;bottom:6px;left:10px;font-size:20px;opacity:0.3;color:${a};">❋</div>`,
      },
      'birthday': {
        eyebrow: '🎂 A BIRTHDAY GIFT',
        greeting: (r: string) => r ? `Happy Birthday, ${r}!` : 'Happy Birthday!',
        closingLine: 'A whole hour of care, just for you this year.',
        decorationHtml: (a: string, ad: string) => {
          const seeds = [
            { top: 8, left: 10, size: 8, shape: '2px', rotate: 12 },
            { top: 12, left: 78, size: 6, shape: '50%' },
            { top: 18, left: 38, size: 5, shape: '2px', rotate: 28 },
            { top: 6, left: 56, size: 7, shape: '50%' },
            { top: 70, left: 14, size: 6, shape: '50%' },
            { top: 78, left: 86, size: 6, shape: '2px', rotate: 45 },
            { top: 88, left: 48, size: 7, shape: '50%' },
          ];
          return seeds.map((s, i) => {
            const c = i % 2 === 0 ? a : ad;
            const rot = s.rotate ? `transform:rotate(${s.rotate}deg);` : '';
            return `<div style="position:absolute;top:${s.top}%;left:${s.left}%;width:${s.size}px;height:${s.size}px;background:${c};border-radius:${s.shape};${rot}opacity:0.7;"></div>`;
          }).join('');
        },
      },
      'anniversary': {
        eyebrow: '♥ CELEBRATING YOU',
        greeting: (r: string) => r ? `For ${r},` : 'For your special day,',
        closingLine: 'On this beautiful day, time to be cared for.',
        decorationHtml: (a: string, ad: string) => {
          const seeds = [
            { top: 8, left: 8, size: 18 },
            { top: 12, left: 84, size: 14 },
            { top: 82, left: 10, size: 16 },
            { top: 78, left: 86, size: 12 },
          ];
          return seeds.map((s, i) => {
            const c = i % 2 === 0 ? a : ad;
            return `<div style="position:absolute;top:${s.top}%;left:${s.left}%;font-size:${s.size}px;color:${c};opacity:0.4;line-height:1;">♥</div>`;
          }).join('');
        },
      },
      'thank-you': {
        eyebrow: '🙏 THANK YOU',
        greeting: (r: string) => r ? `${r},` : 'Thank you,',
        closingLine: 'For everything you do. This is for you.',
        decorationHtml: (a: string, ad: string) => {
          const seeds = [
            { top: 8, left: 10 }, { top: 10, left: 88 },
            { top: 88, left: 14 }, { top: 92, left: 82 },
          ];
          return seeds.map(s =>
            `<div style="position:absolute;top:${s.top}%;left:${s.left}%;width:4px;height:4px;background:${a};border-radius:50%;opacity:0.5;"></div>`
          ).join('');
        },
      },
      'sympathy': {
        eyebrow: '🕊 THINKING OF YOU',
        greeting: (r: string) => r ? `${r},` : 'Thinking of you,',
        closingLine: 'A moment of peace, for whenever you need it.',
        decorationHtml: (a: string, ad: string) =>
          `<div style="position:absolute;bottom:14px;left:25%;right:25%;height:2px;border-top:1.5px solid ${a};opacity:0.4;border-radius:50%;"></div>`,
      },
      'holiday': {
        eyebrow: '✨ SEASON\'S GREETINGS',
        greeting: (r: string) => r ? `Dear ${r},` : 'Season\'s Greetings,',
        closingLine: 'The gift of rest, for this season of giving.',
        decorationHtml: (a: string, ad: string) => {
          const seeds = [
            { top: 8, left: 10, size: 18 },
            { top: 14, left: 82, size: 14 },
            { top: 26, left: 24, size: 12 },
            { top: 80, left: 14, size: 14 },
            { top: 86, left: 60, size: 18 },
            { top: 70, left: 88, size: 12 },
          ];
          return seeds.map((s, i) => {
            const c = i % 2 === 0 ? a : ad;
            return `<div style="position:absolute;top:${s.top}%;left:${s.left}%;font-size:${s.size}px;color:${c};opacity:0.5;line-height:1;">✻</div>`;
          }).join('');
        },
      },
    };
    const design = DESIGNS[designKey] || DESIGNS['just-because'];

    // Theme map mirrored from src/lib/giftCardThemes.js. Inline here
    // because edge functions cannot import from src/. Keep in sync.
    const THEMES: Record<string, any> = {
      rose: { headerStart: '#FCE8E0', headerEnd: '#F5D5C8', eyebrow: '#A87468', ink: '#5C2E27', amount: '#2A5741', warm: '#7A5C53', noteBg: '#FAF6EE', noteBorder: '#C99488', codeBg: '#F5EFE0', codeInk: '#2A5741', pageBg: '#FCF8EE', divider: '#E5D5C8', accent: '#E85C79', accentDeep: '#D14560' },
      sage: { headerStart: '#E4EBDE', headerEnd: '#C7D5C0', eyebrow: '#5A7064', ink: '#1C2B22', amount: '#2D4A35', warm: '#4A5C50', noteBg: '#F4F7F2', noteBorder: '#7A9683', codeBg: '#EEF3EE', codeInk: '#2D4A35', pageBg: '#F9F5EE', divider: '#D2DCCC', accent: '#4A6B54', accentDeep: '#2D4A35' },
      forest: { headerStart: '#BFD2C0', headerEnd: '#94B098', eyebrow: '#3D5443', ink: '#0F1F16', amount: '#14281E', warm: '#34453A', noteBg: '#F0F4F1', noteBorder: '#5D7A66', codeBg: '#E6EDE7', codeInk: '#14281E', pageBg: '#F5F2EA', divider: '#C5D4C8', accent: '#1F4030', accentDeep: '#14281E' },
      ocean: { headerStart: '#CDDDE7', headerEnd: '#97B5C7', eyebrow: '#4F6F82', ink: '#13293A', amount: '#1A3E54', warm: '#3D5566', noteBg: '#F0F6F9', noteBorder: '#5D8AA8', codeBg: '#E5EEF3', codeInk: '#1A3E54', pageBg: '#F5F7F9', divider: '#C7D5DE', accent: '#2D5A78', accentDeep: '#1A3E54' },
      lavender: { headerStart: '#D9CBE2', headerEnd: '#A892BB', eyebrow: '#6E5784', ink: '#2D1C3E', amount: '#4A2F5A', warm: '#523E63', noteBg: '#F6F1F8', noteBorder: '#9576AE', codeBg: '#EDE5F0', codeInk: '#4A2F5A', pageBg: '#F8F5F9', divider: '#D2C5DC', accent: '#6A4A7E', accentDeep: '#4A2F5A' },
      terracotta: { headerStart: '#E8C8AC', headerEnd: '#C9986F', eyebrow: '#8E6647', ink: '#3E2814', amount: '#6D3F1F', warm: '#624230', noteBg: '#F8EFE6', noteBorder: '#B68250', codeBg: '#F0E2D2', codeInk: '#6D3F1F', pageBg: '#FAF3EA', divider: '#E5D0BC', accent: '#9D5E36', accentDeep: '#6D3F1F' },
    };
    const t = THEMES[themeKey] || THEMES.rose;
    const decorationHtml = design.decorationHtml(t.accent, t.accentDeep);

    // ─────────── HTML email ───────────
    // Theme + design driven: every color from `t`, every textual element
    // (eyebrow, greeting, closing line, decorations) from `design`. So the
    // email matches the dashboard preview and the printable card.
    // Mobile-responsive single-column. Inline styles only because many
    // email clients strip <style> blocks.
    const html = `
      <div style="background:${t.pageBg};padding:32px 16px;font-family:Georgia,'Iowan Old Style',serif;">
        <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header band: themed gradient with design-specific decorations -->
          <div style="background:linear-gradient(135deg,${t.headerStart} 0%,${t.headerEnd} 100%);padding:36px 32px 28px;text-align:center;position:relative;overflow:hidden;">
            ${decorationHtml}
            <div style="position:relative;z-index:2;">
              <div style="font-family:system-ui,sans-serif;font-size:11px;font-weight:700;color:${t.eyebrow};letter-spacing:2px;margin-bottom:8px;">
                ${design.eyebrow}
              </div>
              <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:700;color:${t.ink};margin:0 0 6px;letter-spacing:-0.01em;">
                ${escapeHtml(design.greeting(recipientName))}
              </h1>
            </div>
          </div>

          <!-- Amount + redemption code panel -->
          <div style="padding:32px 32px 24px;text-align:center;">
            <div style="font-family:system-ui,sans-serif;font-size:13px;color:${t.warm};margin-bottom:6px;letter-spacing:0.5px;">
              Worth
            </div>
            <div style="font-family:Georgia,serif;font-size:48px;font-weight:700;color:${t.amount};line-height:1;margin-bottom:6px;">
              $${amount.toFixed(0)}
            </div>
            <div style="font-family:system-ui,sans-serif;font-size:13px;color:${t.warm};letter-spacing:0.5px;">
              of care
            </div>

            ${personalNote ? `
              <div style="margin:28px 0 0;padding:18px 22px;background:${t.noteBg};border-left:3px solid ${t.noteBorder};border-radius:8px;text-align:left;">
                <div style="font-family:Georgia,serif;font-size:15px;color:${t.ink};line-height:1.6;font-style:italic;">
                  "${escapeHtml(personalNote)}"
                </div>
              </div>
            ` : ''}

            ${design.closingLine ? `
              <div style="margin:18px 0 0;font-family:Georgia,serif;font-size:14px;color:${t.warm};font-style:italic;line-height:1.5;">
                ${escapeHtml(design.closingLine)}
              </div>
            ` : ''}

            ${(photoUrl || brandMessage) ? `
              <div style="margin:22px 0 0;display:flex;align-items:center;gap:14px;justify-content:center;">
                ${photoUrl ? `
                  <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(businessName)}" width="56" height="56" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid ${t.noteBorder};display:block;" />
                ` : ''}
                ${brandMessage ? `
                  <div style="font-family:Georgia,serif;font-size:13px;color:${t.warm};font-style:italic;line-height:1.45;max-width:340px;text-align:left;">
                    ${escapeHtml(brandMessage)}
                  </div>
                ` : ''}
              </div>
            ` : ''}

            <div style="margin-top:24px;font-family:system-ui,sans-serif;font-size:13px;color:${t.ink};">
              With love, <strong>${escapeHtml(purchaserName)}</strong>
            </div>
          </div>

          <!-- Dashed divider -->
          <div style="border-top:1.5px dashed ${t.divider};margin:0 32px;"></div>

          <!-- Redemption code panel -->
          <div style="padding:24px 32px 16px;text-align:center;">
            <div style="font-family:system-ui,sans-serif;font-size:11px;font-weight:700;color:${t.eyebrow};letter-spacing:2px;margin-bottom:10px;">
              REDEMPTION CODE
            </div>
            <div style="font-family:'Courier New',monospace;font-size:24px;font-weight:700;color:${t.codeInk};letter-spacing:3px;background:${t.codeBg};padding:14px 20px;border-radius:10px;display:inline-block;">
              ${escapeHtml(code)}
            </div>
          </div>

          <!-- How to redeem section -->
          <div style="padding:0 32px 28px;">
            <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:20px 22px;margin-top:20px;">
              <h2 style="font-family:Georgia,serif;font-size:17px;font-weight:700;color:#1A3A28;margin:0 0 8px;">
                How to use it
              </h2>
              <ol style="font-family:system-ui,sans-serif;font-size:14px;color:#3D4A38;line-height:1.7;margin:0;padding-left:20px;">
                <li>Book your appointment with ${escapeHtml(businessName)}.</li>
                <li>Paste the code above when prompted at checkout.</li>
                <li>Enjoy. The code stays valid until the full amount is used.</li>
              </ol>
            </div>

            <div style="text-align:center;margin-top:24px;">
              <a href="${bookingLink}" style="display:inline-block;background:#2A5741;color:white;text-decoration:none;font-family:system-ui,sans-serif;font-size:15px;font-weight:600;padding:14px 32px;border-radius:99px;box-shadow:0 4px 12px rgba(42,87,65,0.22);">
                Book your session →
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background:#FAF6EE;padding:20px 32px;border-top:1px solid #E5D5C8;text-align:center;">
            <p style="font-family:system-ui,sans-serif;font-size:11px;color:#9C8E70;line-height:1.6;margin:0;">
              ${therapistFirstName ? escapeHtml(therapistFirstName) + ' uses MyBodyMap to manage their practice.' : 'Sent through MyBodyMap.'}<br/>
              Questions? Reply to this email and we will help.
            </p>
          </div>

        </div>
      </div>
    `;

    const subjectLine = `${purchaserName} sent you a gift, worth $${amount.toFixed(0)} of care`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${businessName} via MyBodyMap <reminders@mybodymap.app>`,
        to: [cert.recipient_email],
        bcc: ['bodymapdemo@gmail.com'],
        subject: subjectLine,
        html,
      }),
    });

    const data = await res.json();

    // Mark as sent (idempotency) and log to notification_log.
    if (res.ok) {
      try {
        await supabase
          .from('gift_certificates')
          .update({ email_sent_at: new Date().toISOString() })
          .eq('id', gift_certificate_id);
      } catch (_e) { /* non-blocking; column may not exist yet */ }
    }

    try {
      await supabase.from('notification_log').insert({
        therapist_id: cert.therapist_id,
        notification_type: 'gift_certificate',
        audience: 'client',
        channel: 'email',
        recipient: cert.recipient_email,
        status: res.ok ? 'sent' : 'failed',
        provider_id: data?.id || null,
        subject: subjectLine,
        body_snippet: `Gift cert ${code}, $${amount} from ${purchaserName} to ${recipientName}`,
      });
    } catch (_err) { /* non-blocking */ }

    return new Response(JSON.stringify({ ok: res.ok, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Minimal HTML escaper. We only ever interpolate user-controlled values
// like names and personal notes into the email body. Recipient name,
// purchaser name, and message all run through this so a quote or angle
// bracket can't break the layout (or worse, inject markup).
function escapeHtml(s: string): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
