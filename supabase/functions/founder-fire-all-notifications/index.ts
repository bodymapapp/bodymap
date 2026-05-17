// supabase/functions/founder-fire-all-notifications/index.ts
//
// FOUNDER-ONLY: fires every notification in the spec for a given
// therapist+client pair, in test mode. Each notification gets a
// distinctive title/body so HK can recognize them as test events.
//
// HK May 17 2026 ~6am: 'If I will need to replicate 28 events, we
// will be here all day. We can not scale with that mindset.'
//
// This is the auto-fire half of the scalability fix. Bulk-confirm
// (the other half) is in the dashboard UI.
//
// Auth: callable only by HK's account. Validates via the auth
// token. NOT exposed to therapists or anyone else.
//
// Body: { therapist_id: uuid, client_id: uuid }
// Returns: { fired: [...], errors: [...] }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyTherapist, notifyClient } from "../_shared/notifications.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FOUNDER_EMAILS = ['bodymapdemo@gmail.com', 'hk@mybodymap.app'];

// Each entry mirrors NOTIFICATION_SPEC in src/lib/notificationSpec.js.
// The shape is: { id, eventType, audience, title, body, smsText, channels }
// channels is the subset of [app_alert, push, email, sms] that should fire.
const SPEC = [
  // C-series
  { id: 'C1', eventType: 'booking_confirmation', audience: 'client',
    title: 'Welcome to Healing Hands',
    body: 'TEST C1: Your first session is confirmed. This is a synthetic test message from the Notification Compliance Dashboard.',
    smsText: 'TEST C1: Welcome to Healing Hands. Your first session is confirmed. (test event)',
    channels: ['email', 'sms'] },
  { id: 'C2', eventType: 'booking_confirmation_returning', audience: 'client',
    title: 'Session confirmed',
    body: 'TEST C2: Returning client booking confirmation. (synthetic test)',
    smsText: 'TEST C2: Confirmed Tue 12pm with Joy. (test event)',
    channels: ['email', 'sms'] },
  { id: 'C3', eventType: 'intake_reminder', audience: 'client',
    title: 'Quick intake before your session',
    body: 'TEST C3: 90 seconds to fill your intake. (synthetic test)',
    smsText: 'TEST C3: Quick favor before Tuesday with Joy: 90 sec intake. (test event)',
    channels: ['sms', 'email'] },
  { id: 'C4', eventType: 'reminder_48h', audience: 'client',
    title: 'Reminder: session in 48 hours',
    body: 'TEST C4: 48-hour pre-session reminder. (synthetic test)',
    smsText: 'TEST C4: Heads up: Tue 12pm with Joy. Need to change? (test event)',
    channels: ['sms', 'email'] },
  { id: 'C5', eventType: 'reminder_2h', audience: 'client',
    title: null,
    body: null,
    smsText: 'TEST C5: 2-hour reminder for first-timers. See you at 12pm. (test event)',
    channels: ['sms'] },
  { id: 'C6', eventType: 'post_session', audience: 'client',
    title: 'Thank you for today',
    body: 'TEST C6: Post-session warmth message at +24h. (synthetic test)',
    smsText: 'TEST C6: Thanks for coming today. Hope you felt the difference. (test event)',
    channels: ['email', 'sms'] },
  { id: 'C7', eventType: 'client_cancelled_within_policy', audience: 'client',
    title: 'Your cancellation is confirmed',
    body: 'TEST C7: Free-cancel confirmation. (synthetic test)',
    smsText: 'TEST C7: Cancellation confirmed, no fee. (test event)',
    channels: ['email', 'sms'] },
  { id: 'C8', eventType: 'client_cancelled_late', audience: 'client',
    title: 'Your cancellation and fee',
    body: 'TEST C8: Itemized late-cancel receipt. (synthetic test)',
    smsText: 'TEST C8: Late cancel logged, $45 fee charged. (test event)',
    channels: ['email', 'sms'] },
  { id: 'C9', eventType: 'no_show_notice_no_fee', audience: 'client',
    title: 'We missed you on Tuesday',
    body: 'TEST C9: Polite no-show notice, no fee. (synthetic test)',
    smsText: 'TEST C9: Hi Joy, Joy missed you on Tue. Whenever you are ready. (test event)',
    channels: ['sms', 'email'] },
  { id: 'C10', eventType: 'no_show_charged', audience: 'client',
    title: 'About your missed appointment',
    body: 'TEST C10: No-show, fee auto-charged. (synthetic test)',
    smsText: 'TEST C10: No-show, $45 charged per your booking policy. (test event)',
    channels: ['email', 'sms'] },
  { id: 'C11', eventType: 'no_show_payment_request', audience: 'client',
    title: 'About your missed appointment',
    body: 'TEST C11: Polite payment request, no card on file. (synthetic test)',
    smsText: 'TEST C11: No-show fee due, tap to pay: link. (test event)',
    channels: ['sms', 'email'] },
  { id: 'C12', eventType: 'therapist_cancelled', audience: 'client',
    title: 'About your Tuesday session',
    body: 'TEST C12: Therapist-cancel apology + rebook. (synthetic test)',
    smsText: 'TEST C12: So sorry, Joy needs to reschedule Tue. Pick a new time. (test event)',
    channels: ['sms', 'email'] },
  { id: 'C13', eventType: 'reschedule_confirmation', audience: 'client',
    title: 'Your new session time',
    body: 'TEST C13: Reschedule confirmation. (synthetic test)',
    smsText: 'TEST C13: Moved to Wed 12pm with Joy. (test event)',
    channels: ['email', 'sms'] },
  { id: 'C14', eventType: 'lapse_nudge', audience: 'client',
    title: null,
    body: null,
    smsText: 'TEST C14: Your Tuesday slot is open this week. (test event)',
    channels: ['sms'] },
  { id: 'C15', eventType: 'lapse_final_nudge', audience: 'client',
    title: 'Whenever you are ready',
    body: 'TEST C15: 120-day final touch. (synthetic test)',
    smsText: 'TEST C15: Whenever you are ready, Joy will be here. (test event)',
    channels: ['sms', 'email'] },

  // T-series
  { id: 'T1', eventType: 'new_booking', audience: 'therapist',
    title: 'TEST T1: New booking',
    body: 'Joy Client booked a 60-min session for Tue 12pm. (synthetic test)',
    smsText: 'TEST T1: New booking from Joy Client, Tue 12pm. (test event)',
    channels: ['app_alert', 'push', 'email', 'sms'] },
  { id: 'T2', eventType: 'new_client_signup', audience: 'therapist',
    title: 'TEST T2: New client signed up',
    body: 'Joy Client just became a client. (synthetic test)',
    smsText: 'TEST T2: Joy Client signed up. (test event)',
    channels: ['app_alert', 'push', 'email', 'sms'] },
  { id: 'T3', eventType: 'intake_filled', audience: 'therapist',
    title: 'TEST T3: Joy Client filled intake',
    body: 'Intake submitted for upcoming session. (synthetic test)',
    smsText: null,
    channels: ['app_alert', 'push', 'email'] },
  { id: 'T4', eventType: 'payment_received', audience: 'therapist',
    title: 'TEST T4: Payment received',
    body: 'Joy Client paid $90. (synthetic test)',
    smsText: null,
    channels: ['app_alert', 'push', 'email'] },
  { id: 'T5', eventType: 'booking_cancelled', audience: 'therapist',
    title: 'TEST T5: Joy Client cancelled',
    body: "Joy Client's Tue 12pm session was cancelled. (synthetic test)",
    smsText: 'TEST T5: Joy Client cancelled Tue 12pm. (test event)',
    channels: ['app_alert', 'push', 'email', 'sms'] },
  { id: 'T6', eventType: 'booking_rescheduled', audience: 'therapist',
    title: 'TEST T6: Joy Client rescheduled',
    body: 'Moved from Tue 12pm to Wed 12pm. (synthetic test)',
    smsText: null,
    channels: ['app_alert', 'push', 'email'] },
  { id: 'T7', eventType: 'no_show_recorded', audience: 'therapist',
    title: 'TEST T7: Joy Client marked no-show',
    body: 'Joy Client did not show for Tue 12pm. (synthetic test)',
    smsText: 'TEST T7: No-show: Joy Client, Tue 12pm. (test event)',
    channels: ['app_alert', 'push', 'email', 'sms'] },
  { id: 'T8', eventType: 'agreement_signed', audience: 'therapist',
    title: 'TEST T8: Joy Client signed your practice agreement',
    body: 'Agreement signed at this moment. (synthetic test)',
    smsText: null,
    channels: ['app_alert', 'push', 'email'] },
  { id: 'T9', eventType: 'gift_purchased', audience: 'therapist',
    title: 'TEST T9: Gift certificate purchased',
    body: 'Someone bought a $100 gift card on your booking page. (synthetic test)',
    smsText: null,
    channels: ['app_alert', 'push', 'email'] },
  { id: 'T10', eventType: 'lapse_signal', audience: 'therapist',
    title: 'TEST T10: A regular is going quiet',
    body: 'Joy Client has not booked in 5 weeks. (synthetic test)',
    smsText: null,
    channels: ['app_alert', 'push'] },
  { id: 'T11', eventType: 'daily_pulse', audience: 'therapist',
    title: 'TEST T11: Your daily pulse',
    body: 'Today: 3 sessions, 1 new client. Outreach: nudge Maria L. (synthetic test)',
    smsText: null,
    channels: ['email'] },
  { id: 'T12', eventType: 'cancellation_fee_charged', audience: 'therapist',
    title: 'TEST T12: Cancellation fee charged',
    body: 'Charged $45 to Joy Client for late cancel. (synthetic test)',
    smsText: null,
    channels: ['app_alert', 'push', 'email'] },
  { id: 'T13', eventType: 'system_failure', audience: 'therapist',
    title: 'TEST T13: System needs attention',
    body: 'A reminder failed to send for 3 consecutive attempts. (synthetic test)',
    smsText: null,
    channels: ['app_alert', 'push', 'email'] },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const respond = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });

  try {
    const { therapist_id, client_id } = await req.json();
    if (!therapist_id || !client_id) {
      return respond({ error: 'therapist_id and client_id required' }, 400);
    }

    // Auth check: this is destructive enough that we want the caller
    // to be HK. Validate the auth token's email against FOUNDER_EMAILS.
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) return respond({ error: 'auth required' }, 401);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    // Validate caller via the user's own JWT against the anon-key client
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: userErr } = await authClient.auth.getUser();
    if (userErr || !user) return respond({ error: 'invalid auth' }, 401);
    if (!FOUNDER_EMAILS.includes(user.email || '')) {
      return respond({ error: 'forbidden, founder only' }, 403);
    }

    // From here on, use service-role client for the actual fires
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch therapist + client to pass into the fan-out helpers
    const { data: therapist } = await supabase
      .from('therapists')
      .select('id, email, phone, full_name, business_name, custom_url, notification_prefs, twilio_account_sid, twilio_auth_token, twilio_phone_number')
      .eq('id', therapist_id)
      .maybeSingle();

    const { data: client } = await supabase
      .from('clients')
      .select('id, name, email, phone')
      .eq('id', client_id)
      .maybeSingle();

    if (!therapist) return respond({ error: 'therapist_not_found' }, 404);
    if (!client) return respond({ error: 'client_not_found' }, 404);

    // For each spec entry, fire via the appropriate fan-out helper.
    // The fan-out helper will internally check notification_prefs and
    // log every attempt to notification_log. So all the dashboard
    // needs to do afterward is re-read notification_log.
    const fired: any[] = [];
    const errors: any[] = [];

    for (const spec of SPEC) {
      try {
        let result;
        if (spec.audience === 'therapist') {
          result = await notifyTherapist({
            supabase, therapist,
            eventType: spec.eventType,
            title: spec.title,
            body: spec.body,
            icon: '🧪',  // tag synthetic tests for visual distinction
            linkUrl: '/founder/notifications',
            emailSubject: spec.title,
            emailHtml: spec.body ? `<p>${spec.body}</p><p style="color:#6B7280;font-size:11px;font-style:italic;">Sent by Notification Compliance Dashboard auto-fire.</p>` : null,
            smsText: spec.smsText,
          });
        } else {
          // audience === 'client'
          result = await notifyClient({
            supabase, therapist, client,
            eventType: spec.eventType,
            smsText: spec.smsText,
            emailSubject: spec.title,
            emailHtml: spec.body ? `<p>${spec.body}</p><p style="color:#6B7280;font-size:11px;font-style:italic;">Sent by Notification Compliance Dashboard auto-fire.</p>` : null,
            respectQuietHours: false,  // testing, override quiet hours
          });
        }
        fired.push({ id: spec.id, eventType: spec.eventType, audience: spec.audience, result });
      } catch (e) {
        errors.push({ id: spec.id, eventType: spec.eventType, error: String(e?.message || e) });
      }
    }

    return respond({
      ok: true,
      total: SPEC.length,
      fired_count: fired.length,
      error_count: errors.length,
      fired,
      errors,
    });
  } catch (e) {
    console.error('[founder-fire-all-notifications] error', e);
    return respond({ error: String(e?.message || e) }, 500);
  }
});
