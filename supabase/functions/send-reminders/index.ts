import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSmsViaTwilio, shouldSend, logNotification } from "../_shared/notifications.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const today24 = in24h.toISOString().split('T')[0];
  const today48 = in48h.toISOString().split('T')[0];

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      *,
      therapists(
        id, full_name, business_name, custom_url, email,
        notification_prefs,
        twilio_account_sid, twilio_auth_token, twilio_phone_number
      ),
      services(name, duration)
    `)
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .gte('booking_date', today24)
    .lte('booking_date', today48)
    .order('booking_date')
    .order('start_time');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const results = [];

  for (const booking of bookings || []) {
    // HK May 27 2026: throttle to stay under Resend's 5 req/sec limit.
    // send-reminder-48h already does this; send-reminders did not, so a
    // busy day could trip 429s and silently drop reminders. 250ms gives
    // ~4 req/sec with headroom.
    await new Promise(r => setTimeout(r, 250));
    const therapist = booking.therapists;
    const service = booking.services;
    const firstName = booking.client_name?.split(' ')[0] || 'there';
    const therapistName = therapist?.business_name || therapist?.full_name || 'Your therapist';
    const intakeUrl = `https://www.mybodymap.app/${therapist?.custom_url}`;
    const bookingDate = new Date(booking.booking_date + 'T12:00:00');
    const dateStr = bookingDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const [h, m] = booking.start_time.split(':').map(Number);
    const timeStr = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;

    const sendEmail = shouldSend(therapist, 'client', 'reminder_24h', 'email');
    const sendSms = shouldSend(therapist, 'client', 'reminder_24h', 'sms') && booking.sms_opted_in === true;

    let emailStatus = 'skipped_prefs';
    let smsStatus = 'skipped_prefs';
    let emailId = null;

    if (sendEmail && booking.client_email) {
      const emailHtml = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#F5F0E8;"><div style="max-width:540px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.06);"><div style="background:linear-gradient(135deg,#2A5741 0%,#4B8A6A 100%);padding:28px 24px;text-align:center;"><div style="color:rgba(255,255,255,0.85);font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">🌿 Reminder</div><div style="color:#fff;font-family:Georgia,serif;font-size:22px;font-weight:700;">Your session is tomorrow</div></div><div style="padding:28px 28px 20px;"><p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px;">Hi ${firstName},</p><p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 18px;">This is a friendly reminder that your session with <strong>${therapistName}</strong> is <strong>${dateStr}</strong> at <strong>${timeStr}</strong>${service?.name ? `, ${service.name} (${service.duration || 60} min)` : ''}.</p><div style="background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:12px;padding:18px 20px;margin:22px 0;"><div style="font-size:11px;font-weight:700;color:#92400E;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:6px;">Please fill your intake</div><div style="font-size:13px;color:#78350F;line-height:1.6;margin-bottom:12px;">It takes 90 seconds and helps me prepare the perfect session for you.</div><a href="${intakeUrl}" style="display:inline-block;background:#2A5741;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:700;">Open intake form →</a></div><p style="font-size:13px;color:#6B7280;line-height:1.6;margin:16px 0 0;">Need to reschedule? Reply to this email.</p></div><p style="font-size:11px;color:#9CA3AF;text-align:center;margin:24px 0 16px;">Sent by MyBodyMap · mybodymap.app</p></div></body></html>`;

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'MyBodyMap <reminders@mybodymap.app>',
          to: [booking.client_email],
          subject: `Your massage is tomorrow at ${timeStr}. Please fill your intake form`,
          html: emailHtml,
        }),
      });
      const resendData = await resendRes.json();
      emailStatus = resendRes.ok ? 'sent' : 'failed';
      emailId = resendData.id;

      await logNotification(supabase, {
        therapist_id: therapist.id,
        booking_id: booking.id,
        notification_type: 'reminder_24h',
        audience: 'client',
        channel: 'email',
        recipient: booking.client_email,
        status: emailStatus,
        provider_id: emailId,
      });
    }

    if (sendSms && booking.client_phone) {
      const smsMsg = `Hi ${firstName}, reminder: your session at ${therapistName} is ${dateStr} at ${timeStr}. Please fill your intake: ${intakeUrl}  Reply STOP to opt out.`;
      const smsRes = await sendSmsViaTwilio(therapist, booking.client_phone, smsMsg);
      smsStatus = smsRes.ok ? 'sent' : (smsRes.skipped || 'failed');
      await logNotification(supabase, {
        therapist_id: therapist.id,
        booking_id: booking.id,
        notification_type: 'reminder_24h',
        audience: 'client',
        channel: 'sms',
        recipient: booking.client_phone,
        status: smsStatus,
        provider_id: smsRes.sid,
        error_message: smsRes.error,
      });
    } else if (shouldSend(therapist, 'client', 'reminder_24h', 'sms') && !booking.sms_opted_in) {
      smsStatus = 'skipped_consent';
    }

    if (emailStatus === 'sent' || smsStatus === 'sent') {
      await supabase.from('bookings').update({
        reminder_sent_at: new Date().toISOString(),
        reminder_email_id: emailId,
      }).eq('id', booking.id);
    }

    results.push({
      booking_id: booking.id,
      client: booking.client_name,
      email: emailStatus,
      sms: smsStatus,
    });
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
