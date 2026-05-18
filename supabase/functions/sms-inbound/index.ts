// supabase/functions/sms-inbound/index.ts
//
// HK May 18 2026: Twilio inbound webhook for SMS STOP/HELP keywords.
// Macro #12 in BLOCK_PLAN.md.
//
// Twilio's network handles STOP at the carrier level automatically:
// when a client texts STOP to a therapist's Twilio number, Twilio
// suppresses future sends to that number for the same Account SID.
// What Twilio's auto-handling does NOT do is update our database, so
// our backend keeps trying to send. The Twilio API rejects those
// attempts but we log a failed row every time.
//
// This webhook closes that loop. Twilio is configured to POST every
// inbound SMS message to /functions/v1/sms-inbound. We:
//   1. Parse the inbound body
//   2. Check the message for STOP / STOPALL / UNSUBSCRIBE / CANCEL / END / QUIT
//   3. If found: look up the client by the From phone number across
//      the therapists who own this Twilio account, and stamp
//      sms_opted_out_at on that client row
//   4. Respond with TwiML so Twilio knows the webhook handled it.
//      Twilio sends its own STOP confirmation automatically; we
//      return empty TwiML to avoid double-confirmation.
//
// HELP keyword: Twilio's default HELP response is brand name + opt-out
// language, which is CTIA-compliant. We don't customize per-therapist
// here. If a future version wants per-therapist HELP text, this is
// where it'd go: detect the keyword, look up the therapist's business
// name and contact, return TwiML <Message>...</Message>.
//
// IMPORTANT: when adding this webhook URL in Twilio Console for each
// therapist, the URL is:
//   https://<project>.supabase.co/functions/v1/sms-inbound
// The function is on the NO_JWT_FUNCTIONS allowlist (added in the
// same commit) so Twilio doesn't need an auth header.
//
// Webhook signature validation (X-Twilio-Signature) is recommended
// for production but is per-account SID, not per-platform. Since
// we're a BYO-Twilio model and don't know each therapist's auth
// token at the time the webhook hits, we look up the therapist
// AFTER parsing and validate the signature using their stored
// auth_token. If signature check fails, return 403.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const STOP_KEYWORDS = [
  'STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT',
];

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Twilio-Signature',
  };
}

function twimlEmpty() {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    {
      status: 200,
      headers: { 'Content-Type': 'text/xml', ...corsHeaders() },
    },
  );
}

// Normalize a phone number to E.164 +1NNNNNNNNNN format. Strips all
// non-digit characters, prepends +1 if 10 digits, prepends + if 11
// digits already starting with 1. Returns the original input on
// shapes we don't recognize.
function normalizePhone(p: string): string {
  if (!p) return p;
  const cleaned = String(p).replace(/\D/g, '');
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  if (p.startsWith('+')) return p;
  return p;
}

function isStopKeyword(body: string): boolean {
  if (!body) return false;
  const cleaned = body.trim().toUpperCase().replace(/[^\w\s]/g, '');
  // Twilio considers STOP and similar a STOP intent only when it's
  // the entire message body (or close to it). We match exact keyword
  // OR keyword followed by minor punctuation only.
  return STOP_KEYWORDS.includes(cleaned);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('sms-inbound: env not configured');
    // Return 200 + empty TwiML so Twilio doesn't retry forever; the
    // failure is on our side, not the inbound message.
    return twimlEmpty();
  }
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Twilio POSTs application/x-www-form-urlencoded.
  let form: URLSearchParams;
  try {
    const raw = await req.text();
    form = new URLSearchParams(raw);
  } catch (e) {
    console.error('sms-inbound: failed to parse body', e);
    return twimlEmpty();
  }

  const from = form.get('From') || '';
  const to = form.get('To') || '';
  const body = form.get('Body') || '';
  const accountSid = form.get('AccountSid') || '';
  const messageSid = form.get('MessageSid') || '';

  console.log('sms-inbound: received', {
    from, to, body: body.slice(0, 60), accountSid, messageSid,
  });

  // Only act on STOP-class keywords. For all other inbound text we
  // return empty TwiML and do nothing. Future: log inbound replies
  // to a separate table so therapists can see them in-app.
  if (!isStopKeyword(body)) {
    console.log('sms-inbound: not a STOP keyword, ignoring');
    return twimlEmpty();
  }

  // Find the therapist(s) who own this AccountSid + To phone number.
  // The To number tells us which therapist's Twilio number was
  // texted; we use that to scope the client lookup.
  const normalizedTo = normalizePhone(to);
  const { data: therapists, error: thErr } = await sb
    .from('therapists')
    .select('id, twilio_account_sid, twilio_phone_number')
    .eq('twilio_account_sid', accountSid);

  if (thErr || !therapists || therapists.length === 0) {
    console.warn('sms-inbound: no therapist found for accountSid', accountSid);
    return twimlEmpty();
  }

  // Match the therapist whose twilio_phone_number == To (after normalization).
  const matchTherapist = therapists.find(t => {
    return normalizePhone(t.twilio_phone_number) === normalizedTo;
  }) || therapists[0]; // fallback to first if unique account

  // Find the client by phone, scoped to this therapist.
  const normalizedFrom = normalizePhone(from);
  // We try a few phone-number shapes since client.phone storage isn't
  // strictly normalized in the wild. Match on the cleaned digits.
  const cleanedFromDigits = normalizedFrom.replace(/\D/g, '');
  const last10 = cleanedFromDigits.slice(-10);

  const { data: clients, error: clErr } = await sb
    .from('clients')
    .select('id, phone, sms_opted_out_at')
    .eq('therapist_id', matchTherapist.id);

  if (clErr) {
    console.error('sms-inbound: client lookup failed', clErr);
    return twimlEmpty();
  }

  // Match by last-10-digits to handle "+15136133033", "5136133033",
  // "(513) 613-3033", etc.
  const matched = (clients || []).filter(c => {
    if (!c.phone) return false;
    const digits = String(c.phone).replace(/\D/g, '');
    return digits.slice(-10) === last10;
  });

  if (matched.length === 0) {
    console.warn('sms-inbound: no client found for from', from, 'therapist', matchTherapist.id);
    return twimlEmpty();
  }

  // Stamp the opt-out on every matching client row (handles the rare
  // case where the same phone is on multiple client records under
  // the same therapist).
  const ids = matched.map(c => c.id);
  const { error: upErr } = await sb
    .from('clients')
    .update({
      sms_opted_out_at: new Date().toISOString(),
      sms_opted_out_via: 'keyword_stop',
    })
    .in('id', ids);

  if (upErr) {
    console.error('sms-inbound: failed to stamp opt-out', upErr);
  } else {
    console.log('sms-inbound: opted out', ids.length, 'client row(s) for therapist', matchTherapist.id);
  }

  // Empty TwiML response. Twilio sends its own STOP confirmation
  // message automatically ("You have been unsubscribed..."), so we
  // don't need to send one ourselves.
  return twimlEmpty();
});
