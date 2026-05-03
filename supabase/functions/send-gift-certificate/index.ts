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

    // Pull therapist for business name and booking-link slug.
    const { data: therapist } = await supabase
      .from('therapists')
      .select('id, full_name, business_name, custom_url')
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

    // ─────────── HTML email ───────────
    // Soft cream + dusty rose palette to match the gift card create UI
    // (mirrors the pink banner the therapist sees in the dashboard).
    // Mobile-responsive single-column layout. Inline styles only because
    // many email clients strip <style> blocks.
    const html = `
      <div style="background:#FCF8EE;padding:32px 16px;font-family:Georgia,'Iowan Old Style',serif;">
        <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header band: dusty rose -->
          <div style="background:linear-gradient(135deg,#FCE8E0 0%,#F5D5C8 100%);padding:36px 32px 28px;text-align:center;position:relative;">
            <div style="font-family:system-ui,sans-serif;font-size:11px;font-weight:700;color:#A87468;letter-spacing:2px;margin-bottom:8px;">
              ♡ A GIFT FOR YOU
            </div>
            <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:700;color:#5C2E27;margin:0 0 6px;letter-spacing:-0.01em;">
              Dear ${escapeHtml(recipientName)},
            </h1>
          </div>

          <!-- Amount + redemption code panel -->
          <div style="padding:32px 32px 24px;text-align:center;">
            <div style="font-family:system-ui,sans-serif;font-size:13px;color:#7A5C53;margin-bottom:6px;letter-spacing:0.5px;">
              Worth
            </div>
            <div style="font-family:Georgia,serif;font-size:48px;font-weight:700;color:#2A5741;line-height:1;margin-bottom:6px;">
              $${amount.toFixed(0)}
            </div>
            <div style="font-family:system-ui,sans-serif;font-size:13px;color:#7A5C53;letter-spacing:0.5px;">
              of care
            </div>

            ${personalNote ? `
              <div style="margin:28px 0 0;padding:18px 22px;background:#FAF6EE;border-left:3px solid #C99488;border-radius:8px;text-align:left;">
                <div style="font-family:Georgia,serif;font-size:15px;color:#5C3A33;line-height:1.6;font-style:italic;">
                  "${escapeHtml(personalNote)}"
                </div>
              </div>
            ` : ''}

            <div style="margin-top:24px;font-family:system-ui,sans-serif;font-size:13px;color:#5C3A33;">
              With love, <strong>${escapeHtml(purchaserName)}</strong>
            </div>
          </div>

          <!-- Dashed divider -->
          <div style="border-top:1.5px dashed #E5D5C8;margin:0 32px;"></div>

          <!-- Redemption code panel -->
          <div style="padding:24px 32px 16px;text-align:center;">
            <div style="font-family:system-ui,sans-serif;font-size:11px;font-weight:700;color:#A87468;letter-spacing:2px;margin-bottom:10px;">
              REDEMPTION CODE
            </div>
            <div style="font-family:'Courier New',monospace;font-size:24px;font-weight:700;color:#2A5741;letter-spacing:3px;background:#F5EFE0;padding:14px 20px;border-radius:10px;display:inline-block;">
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
