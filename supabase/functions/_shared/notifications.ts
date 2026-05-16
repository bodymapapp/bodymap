// Shared SMS + logging helper for edge functions.
// Only deploy via import, not callable directly.

export async function sendSmsViaTwilio(therapist, toPhone, message) {
  if (!therapist?.twilio_account_sid || !therapist?.twilio_auth_token || !therapist?.twilio_phone_number) {
    return { ok: false, skipped: 'twilio_not_configured' };
  }
  if (!toPhone) return { ok: false, skipped: 'no_phone' };

  const cleaned = String(toPhone).replace(/\D/g, '');
  const e164 = cleaned.startsWith('1') ? `+${cleaned}` : `+1${cleaned}`;

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${therapist.twilio_account_sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${therapist.twilio_account_sid}:${therapist.twilio_auth_token}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: e164,
          From: therapist.twilio_phone_number.startsWith('+') ? therapist.twilio_phone_number : `+${therapist.twilio_phone_number}`,
          Body: message,
        }),
      }
    );
    const data = await res.json();
    if (res.ok) return { ok: true, sid: data.sid };
    return { ok: false, error: data.message || 'twilio_error' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Read notification pref with sensible default
export function shouldSend(therapist, audience, type, channel) {
  try {
    return !!therapist?.notification_prefs?.[audience]?.[type]?.[channel];
  } catch (e) {
    return false;
  }
}

// Log a send attempt to notification_log (non-blocking, fire and forget)
export async function logNotification(supabase, row) {
  try {
    await supabase.from('notification_log').insert(row);
  } catch (e) { /* non-blocking */ }
}

// ─── notifyTherapist ─────────────────────────────────────────────
// One call to fan an event out to all three therapist channels:
// in-app drawer, email, SMS. Each channel is gated by the
// therapist's notification_prefs.therapist[eventType][channel].
//
// HK May 16 2026: "There should be also some type of notification
// for these items on my platform for certain important things
// like when a new client signs up, a deposit or anything to do
// with a client or money, there should be communication on
// platform, email and sms."
//
// Usage:
//   await notifyTherapist({
//     supabase, therapist,
//     eventType: 'payment_received',
//     title: 'Maria L. paid $90',
//     body: 'Deposit for 60-min session on Thursday.',
//     icon: '💚',
//     linkUrl: '/dashboard/billing',
//     emailSubject: 'Payment received: $90 from Maria L.',
//     emailHtml: '<p>...</p>',
//     smsText: '$90 deposit from Maria L. for Thursday 60-min.',
//     payload: { booking_id, client_id, amount_cents, currency },
//     bookingId, clientId, sessionId,
//   });
//
// Returns { app_alert, email, sms } each shaped as { ok, status }.
// Non-throwing: every channel failure is logged and returned but
// never propagated, because notifications are observability and
// should never break the primary business flow.
//
// resendApiKey + fromAddress can be passed in or read from env.
export async function notifyTherapist({
  supabase, therapist,
  eventType,
  title, body, icon, linkUrl, payload,
  emailSubject, emailHtml, smsText,
  bookingId, clientId, sessionId,
  resendApiKey, fromAddress,
}) {
  const result = { app_alert: null, email: null, sms: null };
  if (!therapist?.id) return result;

  const RESEND_KEY = resendApiKey || (typeof Deno !== 'undefined' ? Deno.env.get('RESEND_API_KEY') : '');
  const FROM = fromAddress || 'MyBodyMap <reminders@mybodymap.app>';

  // ─── Channel 1: in-app drawer ──────────────────────────────────
  if (shouldSend(therapist, 'therapist', eventType, 'app_alert')) {
    try {
      const { error } = await supabase.from('in_app_notifications').insert({
        therapist_id: therapist.id,
        event_type: eventType,
        title: title || eventType,
        body: body || null,
        icon: icon || null,
        link_url: linkUrl || null,
        payload: payload || null,
      });
      if (error) {
        result.app_alert = { ok: false, error: error.message };
      } else {
        result.app_alert = { ok: true };
      }
    } catch (e) {
      result.app_alert = { ok: false, error: String(e?.message || e) };
    }
    await logNotification(supabase, {
      therapist_id: therapist.id,
      booking_id: bookingId || null,
      client_id: clientId || null,
      session_id: sessionId || null,
      notification_type: eventType,
      audience: 'therapist',
      channel: 'app_alert',
      recipient: null,
      status: result.app_alert?.ok ? 'sent' : 'failed',
      error_message: result.app_alert?.error || null,
    });
  } else {
    result.app_alert = { ok: true, skipped: 'pref_off' };
  }

  // ─── Channel 2: email via Resend ───────────────────────────────
  if (shouldSend(therapist, 'therapist', eventType, 'email')) {
    if (!therapist.email) {
      result.email = { ok: false, skipped: 'no_therapist_email' };
    } else if (!RESEND_KEY) {
      result.email = { ok: false, skipped: 'no_resend_key' };
    } else if (!emailSubject) {
      result.email = { ok: false, skipped: 'no_email_subject' };
    } else {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: FROM,
            to: [therapist.email],
            subject: emailSubject,
            html: emailHtml || `<p>${title || eventType}${body ? '<br/>' + body : ''}</p>`,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          result.email = { ok: true, id: data.id };
        } else {
          result.email = { ok: false, error: data?.message || 'resend_error' };
        }
      } catch (e) {
        result.email = { ok: false, error: String(e?.message || e) };
      }
    }
    await logNotification(supabase, {
      therapist_id: therapist.id,
      booking_id: bookingId || null,
      client_id: clientId || null,
      session_id: sessionId || null,
      notification_type: eventType,
      audience: 'therapist',
      channel: 'email',
      recipient: therapist.email || null,
      status: result.email?.ok ? 'sent' : (result.email?.skipped ? 'skipped' : 'failed'),
      provider_id: result.email?.id || null,
      subject: emailSubject || null,
      body_snippet: (body || title || '').slice(0, 200),
      error_message: result.email?.error || result.email?.skipped || null,
    });
  } else {
    result.email = { ok: true, skipped: 'pref_off' };
  }

  // ─── Channel 3: SMS via Twilio ─────────────────────────────────
  if (shouldSend(therapist, 'therapist', eventType, 'sms')) {
    if (!smsText) {
      result.sms = { ok: false, skipped: 'no_sms_text' };
    } else if (!therapist.phone) {
      result.sms = { ok: false, skipped: 'no_therapist_phone' };
    } else {
      result.sms = await sendSmsViaTwilio(therapist, therapist.phone, smsText);
    }
    await logNotification(supabase, {
      therapist_id: therapist.id,
      booking_id: bookingId || null,
      client_id: clientId || null,
      session_id: sessionId || null,
      notification_type: eventType,
      audience: 'therapist',
      channel: 'sms',
      recipient: therapist.phone || null,
      status: result.sms?.ok ? 'sent' : (result.sms?.skipped ? 'skipped' : 'failed'),
      provider_id: result.sms?.sid || null,
      body_snippet: (smsText || '').slice(0, 200),
      error_message: result.sms?.error || result.sms?.skipped || null,
    });
  } else {
    result.sms = { ok: true, skipped: 'pref_off' };
  }

  return result;
}
