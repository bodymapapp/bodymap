// Shared SMS + logging helper for edge functions.
// Only deploy via import — not callable directly.

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

// Log a send attempt to notification_log (non-blocking — fire and forget)
export async function logNotification(supabase, row) {
  try {
    await supabase.from('notification_log').insert(row);
  } catch (e) { /* non-blocking */ }
}
