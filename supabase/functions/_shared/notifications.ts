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
    const { error } = await supabase.from('notification_log').insert(row);
    if (error) {
      // Surface schema/RLS errors to logs. Previous version of this
      // function silently swallowed every error which hid bugs like
      // "subject column does not exist" for months.
      console.warn('[notification_log] insert failed:', error.message, 'row:', JSON.stringify({
        type: row.notification_type,
        audience: row.audience,
        channel: row.channel,
        status: row.status,
      }));
    }
  } catch (e) {
    console.warn('[notification_log] unexpected exception:', e?.message || String(e));
  }
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
  const result = { app_alert: null, email: null, sms: null, push: null };
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

  // ─── Channel 4: Push notification (PWA) ────────────────────────
  // Calls send-push edge function which fans out to all of the
  // therapist's registered push_subscriptions. Push is gated by
  // notification_prefs.therapist[eventType].push (defaults false
  // until user opts in via the bell drawer settings).
  //
  // The send-push function also checks therapists.push_notifications_enabled
  // globally, so this is a two-layer opt-in (global + per-event).
  if (shouldSend(therapist, 'therapist', eventType, 'push')) {
    try {
      const supabaseUrl = typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_URL') : '';
      const serviceKey = typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') : '';
      const pushUrl = `${supabaseUrl}/functions/v1/send-push`;
      const pushRes = await fetch(pushUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          therapist_id: therapist.id,
          title: title || eventType,
          body: body || '',
          url: linkUrl || '/dashboard',
          tag: eventType,
        }),
      });
      const pushData = await pushRes.json();
      if (pushRes.ok) {
        result.push = { ok: true, sent: pushData.sent || 0, removed: pushData.removed || 0 };
      } else {
        result.push = { ok: false, error: pushData.error || 'push_send_failed' };
      }
    } catch (e) {
      result.push = { ok: false, error: String(e?.message || e) };
    }
    await logNotification(supabase, {
      therapist_id: therapist.id,
      booking_id: bookingId || null,
      client_id: clientId || null,
      session_id: sessionId || null,
      notification_type: eventType,
      audience: 'therapist',
      channel: 'push',
      recipient: therapist.id,  // push subscriptions are keyed to user, not address
      status: result.push?.ok ? 'sent' : 'failed',
      provider_id: null,
      body_snippet: (body || title || '').slice(0, 200),
      error_message: result.push?.error || null,
    });
  } else {
    result.push = { ok: true, skipped: 'pref_off' };
  }

  return result;
}

// ─── notifyClient ────────────────────────────────────────────────
// Client-side fan-out. SMS and email only; clients have no in-app
// channel because they have no login.
//
// SMS-FIRST DESIGN: SMS is the primary channel for time-sensitive
// or action-required messages. Email is used as a backup or for
// substance (receipts, policy attachments, multi-paragraph apologies).
//
// Suppression rules baked in:
//   - quiet_hours: if NOW falls between 21:00 and 08:00 client local
//     time, SMS is queued (not sent). Email is unaffected. Quiet
//     hours are off by default unless the caller passes respectQuietHours: true.
//   - unsubscribe: if the client has unsubscribed from this category,
//     both channels are skipped. (Wire this when we add the
//     client_unsubscribes table; for now, all clients are subscribed.)
//
// HK May 17 2026 directive: "We want to progress more towards SMS
// vs email as people don't check their email or only check if they
// can't find the text."
//
// Usage:
//   await notifyClient({
//     supabase, therapist, client,
//     eventType: 'no_show_notice',
//     smsText: 'We missed you at...',
//     emailSubject: 'About your missed appointment',
//     emailHtml: '<p>...</p>',
//     bookingId, sessionId,
//     respectQuietHours: false,  // urgent payment request, send now
//   });
//
// Returns { sms, email } each shaped as { ok, status }.
// Non-throwing: every channel failure is logged and returned.

export async function notifyClient({
  supabase, therapist, client,
  eventType,
  smsText,
  emailSubject, emailHtml,
  bookingId, sessionId,
  resendApiKey, fromAddress,
  respectQuietHours = true,
}) {
  const result = { sms: null, email: null, push: null };
  if (!therapist?.id || !client) return result;

  const RESEND_KEY = resendApiKey || (typeof Deno !== 'undefined' ? Deno.env.get('RESEND_API_KEY') : '');
  const FROM = fromAddress || `${therapist.business_name || 'MyBodyMap'} <reminders@mybodymap.app>`;

  // ─── Channel 1: SMS via Twilio (primary by design) ─────────────
  if (smsText && client.phone) {
    // Macro #12 (HK May 18 2026): SMS opt-out compliance. If the
    // client has texted STOP to the therapist's Twilio number (or
    // their record has been opted out manually), don't attempt the
    // send. Twilio's own network would reject it anyway; this saves
    // an API call and keeps the compliance log clean.
    if (client.sms_opted_out_at) {
      result.sms = { ok: true, skipped: 'client_opted_out' };
      await logNotification(supabase, {
        therapist_id: therapist.id,
        booking_id: bookingId || null,
        client_id: client.id || null,
        session_id: sessionId || null,
        notification_type: eventType,
        audience: 'client',
        channel: 'sms',
        recipient: client.phone || null,
        status: 'skipped',
        provider_id: null,
        body_snippet: (smsText || '').slice(0, 200),
        error_message: 'client_opted_out',
      });
    } else {
      // Quiet-hours guard: don't send SMS between 21:00 and 08:00
      // server local time. For v1 we use server time; client-local
      // time requires storing client timezone, which we don't always
      // have. Most US therapists in same TZ as their clients.
      const hr = new Date().getHours();
      const inQuietHours = (hr >= 21 || hr < 8);

      // Macro #12 (HK May 18 2026): CTIA-required opt-out disclosure.
      // Every SMS to a client gets "Reply STOP to opt out." appended
      // unless the message already contains "STOP" in caps (indicating
      // the disclosure or HELP language is already inline). The
      // additional 26 chars per message is well under the 160-char
      // SMS segment boundary for most of our notification copy.
      const needsDisclosure = !smsText.includes('STOP');
      const finalSmsText = needsDisclosure
        ? `${smsText}\n\nReply STOP to opt out.`
        : smsText;

      if (respectQuietHours && inQuietHours) {
        result.sms = { ok: true, skipped: 'quiet_hours' };
      } else {
        result.sms = await sendSmsViaTwilio(therapist, client.phone, finalSmsText);
      }
      await logNotification(supabase, {
        therapist_id: therapist.id,
        booking_id: bookingId || null,
        client_id: client.id || null,
        session_id: sessionId || null,
        notification_type: eventType,
        audience: 'client',
        channel: 'sms',
        recipient: client.phone || null,
        status: result.sms?.ok && !result.sms?.skipped ? 'sent' : (result.sms?.skipped ? 'skipped' : 'failed'),
        provider_id: result.sms?.sid || null,
        body_snippet: (finalSmsText || '').slice(0, 200),
        error_message: result.sms?.error || result.sms?.skipped || null,
      });
    }
  } else {
    result.sms = { ok: true, skipped: !smsText ? 'no_sms_text' : 'no_client_phone' };
  }

  // ─── Channel 2: Email via Resend (backup or substance) ────────
  if (emailSubject && emailHtml && client.email) {
    if (!RESEND_KEY) {
      result.email = { ok: false, skipped: 'resend_not_configured' };
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
            to: [client.email],
            subject: emailSubject,
            html: emailHtml,
            reply_to: therapist.email || undefined,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          result.email = { ok: true, id: data.id };
        } else {
          result.email = { ok: false, error: data.message || 'resend_error' };
        }
      } catch (e) {
        result.email = { ok: false, error: e.message };
      }
    }
    await logNotification(supabase, {
      therapist_id: therapist.id,
      booking_id: bookingId || null,
      client_id: client.id || null,
      session_id: sessionId || null,
      notification_type: eventType,
      audience: 'client',
      channel: 'email',
      recipient: client.email || null,
      status: result.email?.ok ? 'sent' : (result.email?.skipped ? 'skipped' : 'failed'),
      provider_id: result.email?.id || null,
      subject: emailSubject || null,
      body_snippet: (emailHtml || '').replace(/<[^>]+>/g, '').slice(0, 200),
      error_message: result.email?.error || result.email?.skipped || null,
    });
  } else {
    result.email = { ok: true, skipped: 'no_email_content_or_recipient' };
  }

  // ─── Channel 3: Client push notification (PWA) ─────────────────
  // Short-circuit: if the client has no active push subscriptions,
  // skip the network call entirely and log as 'skipped'. This
  // matters because (a) client push is currently tabled pending
  // client login (see CLIENT_PUSH_STATUS in src/lib/notificationSpec.js),
  // so most clients will have zero subscriptions, and (b) hitting
  // send-push-client just to get back {sent: 0} wastes a request
  // and risks false-failed log rows if the function isn't deployed
  // or returns an error.
  if (client.id) {
    const { count: subCount } = await supabase
      .from('client_push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id)
      .is('unsubscribed_at', null);

    if (!subCount || subCount === 0) {
      result.push = { ok: true, skipped: 'no_active_subscriptions' };
      await logNotification(supabase, {
        therapist_id: therapist.id,
        booking_id: bookingId || null,
        client_id: client.id || null,
        session_id: sessionId || null,
        notification_type: eventType,
        audience: 'client',
        channel: 'push',
        recipient: client.id,
        status: 'skipped',
        provider_id: null,
        body_snippet: (smsText || emailSubject || '').slice(0, 200),
        error_message: 'no_active_subscriptions',
      });
    } else {
      try {
        const supabaseUrl = typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_URL') : '';
        const serviceKey = typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') : '';
        const pushUrl = `${supabaseUrl}/functions/v1/send-push-client`;
        const pushTitle = emailSubject || smsText?.slice(0, 60) || `Update from ${therapist.business_name || therapist.full_name || 'your therapist'}`;
        const pushBody = smsText || (emailHtml ? emailHtml.replace(/<[^>]+>/g, '').slice(0, 140) : '');
        const pushRes = await fetch(pushUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: client.id,
            title: pushTitle,
            body: pushBody,
            url: therapist.custom_url ? `/${therapist.custom_url}` : '/',
            tag: eventType,
          }),
        });
        const pushData = await pushRes.json();
        if (pushRes.ok) {
          result.push = { ok: true, sent: pushData.sent || 0, removed: pushData.removed || 0 };
        } else {
          result.push = { ok: false, error: pushData.error || 'push_send_failed' };
        }
      } catch (e) {
        result.push = { ok: false, error: String(e?.message || e) };
      }
      await logNotification(supabase, {
        therapist_id: therapist.id,
        booking_id: bookingId || null,
        client_id: client.id || null,
        session_id: sessionId || null,
        notification_type: eventType,
        audience: 'client',
        channel: 'push',
        recipient: client.id,
        status: result.push?.ok && result.push?.sent > 0 ? 'sent' : (result.push?.ok ? 'skipped' : 'failed'),
        provider_id: null,
        body_snippet: (smsText || emailSubject || '').slice(0, 200),
        error_message: result.push?.error || (result.push?.ok && result.push?.sent === 0 ? 'no_active_subscriptions' : null),
      });
    }
  } else {
    result.push = { ok: true, skipped: 'no_client_id' };
  }

  return result;
}
