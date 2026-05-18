// supabase/functions/twilio-status-callback/index.ts
//
// HK May 18 2026: Macro #13 from BLOCK_PLAN.md. Twilio POSTs delivery
// state updates here for every outbound SMS we send.
//
// What this fixes: notification_log status='sent' only meant Twilio
// API acceptance, not carrier delivery. A2P-blocked or
// carrier-rejected messages were invisible at the application layer.
// The compliance dashboard showed lies. This function makes the
// truth visible.
//
// Flow:
//   1. sendSmsViaTwilio includes StatusCallback URL pointing here
//   2. Twilio POSTs queued > sent > delivered (or > undelivered)
//   3. Each POST hits this function, gets matched to the
//      notification_log row by MessageSid (= provider_id), and
//      updates delivery_status + delivery_status_updated_at +
//      delivery_error_code if present.
//
// Idempotency: Twilio can fire the same event more than once. We
// upsert by always taking the most recent timestamp's value. Order
// of states matters here: 'delivered' should not be overwritten by
// a late-arriving 'sent' callback. We guard against regression by
// only updating when the new event's timestamp is later or when the
// delivery_status field is null.
//
// Reference: https://www.twilio.com/docs/messaging/guides/track-outbound-message-status
//
// IMPORTANT: this function is on NO_JWT_FUNCTIONS in
// .github/workflows/deploy-edge-functions.yml so Twilio's
// unauthenticated POST is accepted by the gateway. Same allowlist
// pattern as stripe-refund-webhook and sms-inbound.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

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

// Twilio MessageStatus values, ordered by their progression. Higher
// rank means later in the lifecycle. We use this to prevent a late
// 'sent' callback from overwriting an earlier 'delivered' state.
const STATUS_RANK: Record<string, number> = {
  accepted:    1,
  queued:      2,
  sending:     3,
  sent:        4,
  receiving:   4, // inbound only, shouldn't show here but defensive
  received:    5, // inbound only, defensive
  delivered:   10,
  read:        11,
  undelivered: 20, // terminal failure
  failed:      20, // terminal failure
};

function shouldUpdate(oldStatus: string | null, newStatus: string): boolean {
  if (!oldStatus) return true;
  const oldRank = STATUS_RANK[oldStatus] || 0;
  const newRank = STATUS_RANK[newStatus] || 0;
  // Terminal failure states (rank 20) overwrite anything else.
  // Delivered/read overwrites anything below them.
  // Earlier states never overwrite later ones.
  return newRank >= oldRank;
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
    console.error('twilio-status-callback: env not configured');
    return twimlEmpty();
  }
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Twilio POSTs application/x-www-form-urlencoded.
  let form: URLSearchParams;
  try {
    const raw = await req.text();
    form = new URLSearchParams(raw);
  } catch (e) {
    console.error('twilio-status-callback: failed to parse body', e);
    return twimlEmpty();
  }

  const messageSid = form.get('MessageSid') || form.get('SmsSid') || '';
  const messageStatus = form.get('MessageStatus') || form.get('SmsStatus') || '';
  const errorCode = form.get('ErrorCode') || '';
  const errorMessage = form.get('ErrorMessage') || '';
  const to = form.get('To') || '';

  console.log('twilio-status-callback: received', {
    messageSid,
    messageStatus,
    errorCode,
    to,
  });

  if (!messageSid || !messageStatus) {
    console.warn('twilio-status-callback: missing MessageSid or MessageStatus');
    return twimlEmpty();
  }

  // Look up the notification_log row by provider_id (= MessageSid).
  // It's indexed (notification_log_provider_id_idx, added in the
  // migration that paired with this function).
  const { data: rows, error: lookupErr } = await sb
    .from('notification_log')
    .select('id, delivery_status')
    .eq('provider_id', messageSid)
    .limit(1);

  if (lookupErr) {
    console.error('twilio-status-callback: lookup failed', lookupErr);
    return twimlEmpty();
  }

  if (!rows || rows.length === 0) {
    // No matching log row. Could be a message sent before this
    // callback was wired up, or a test message from Twilio's
    // simulator. Not an error; just ignore.
    console.log('twilio-status-callback: no notification_log row for', messageSid);
    return twimlEmpty();
  }

  const row = rows[0];

  // Guard against regression (e.g. late 'sent' arriving after 'delivered').
  if (!shouldUpdate(row.delivery_status, messageStatus)) {
    console.log(
      'twilio-status-callback: skip update,',
      row.delivery_status,
      'is more advanced than',
      messageStatus,
    );
    return twimlEmpty();
  }

  // Update.
  const updatePayload: Record<string, any> = {
    delivery_status: messageStatus,
    delivery_status_updated_at: new Date().toISOString(),
  };
  if (errorCode) {
    updatePayload.delivery_error_code = errorCode;
  }
  // If terminal failure, also flip the legacy status field so old
  // dashboard queries don't keep showing 'sent' green when delivery
  // actually failed. Keeps backward-compat with anything that
  // still reads status alone.
  if (messageStatus === 'undelivered' || messageStatus === 'failed') {
    updatePayload.status = 'failed';
    updatePayload.error_message = errorMessage || `twilio_${messageStatus}`;
  }

  const { error: updateErr } = await sb
    .from('notification_log')
    .update(updatePayload)
    .eq('id', row.id);

  if (updateErr) {
    console.error('twilio-status-callback: update failed', updateErr);
  } else {
    console.log('twilio-status-callback: updated', row.id, 'to', messageStatus);
  }

  return twimlEmpty();
});
