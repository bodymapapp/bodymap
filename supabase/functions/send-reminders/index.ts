import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  // Find bookings in next 24-48 hours that haven't been reminded yet
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const today24 = in24h.toISOString().split('T')[0];
  const today48 = in48h.toISOString().split('T')[0];

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*, therapists(full_name, business_name, custom_url, email), services(name, duration)')
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
    const therapist = booking.therapists;
    const service = booking.services;
    const firstName = booking.client_name?.split(' ')[0] || 'there';
    const therapistName = therapist?.business_name || therapist?.full_name || 'Your therapist';
    const intakeUrl = `https://www.mybodymap.app/${therapist?.custom_url}`;

    // Format date nicely
    const bookingDate = new Date(booking.booking_date + 'T12:00:00');
    const dateStr = bookingDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    // Format time
    const [h, m] = booking.start_time.split(':').map(Number);
    const timeStr = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:32px;">🌿</span>
      <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#2A5741;margin:8px 0 0;">BodyMap</h1>
    </div>

    <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
      <h2 style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1A1A2E;margin:0 0 8px;">
        Your session is tomorrow, ${firstName} 👋
      </h2>
      <p style="color:#6B7280;font-size:15px;margin:0 0 24px;line-height:1.6;">
        Just a friendly reminder about your upcoming massage appointment.
      </p>

      <div style="background:#F5F0E8;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="font-size:14px;color:#6B7280;">📅 <strong style="color:#1A1A2E;">${dateStr}</strong></div>
          <div style="font-size:14px;color:#6B7280;">🕐 <strong style="color:#1A1A2E;">${timeStr}</strong></div>
          <div style="font-size:14px;color:#6B7280;">💆 <strong style="color:#1A1A2E;">${service?.name || 'Session'} · ${service?.duration || 60} min</strong></div>
          <div style="font-size:14px;color:#6B7280;">👤 <strong style="color:#1A1A2E;">${therapistName}</strong></div>
        </div>
      </div>

      <div style="background:linear-gradient(135deg,#F0FDF4,#DCFCE7);border:1.5px solid #86EFAC;border-radius:12px;padding:20px;margin-bottom:24px;">
        <h3 style="font-size:15px;font-weight:700;color:#2A5741;margin:0 0 8px;">📋 Complete your intake form</h3>
        <p style="font-size:13px;color:#374151;margin:0 0 16px;line-height:1.6;">
          Takes 60 seconds. Map out where you're holding tension so your therapist knows exactly where to focus before you arrive.
        </p>
        <a href="${intakeUrl}" style="display:block;background:#2A5741;color:#fff;text-decoration:none;border-radius:10px;padding:14px 20px;text-align:center;font-size:15px;font-weight:700;">
          Fill My Intake Form →
        </a>
      </div>

      <p style="font-size:12px;color:#9CA3AF;text-align:center;margin:0;line-height:1.6;">
        Need to reschedule? Reply to this email or contact ${therapistName} directly.
      </p>
    </div>

    <p style="font-size:11px;color:#9CA3AF;text-align:center;margin:24px 0 0;">
      Sent by BodyMap · mybodymap.app
    </p>
  </div>
</body>
</html>`;

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BodyMap <onboarding@resend.dev>',
        to: [booking.client_email],
        subject: `Your massage is tomorrow at ${timeStr} — please fill your intake form`,
        html: emailHtml,
      }),
    });

    const resendData = await resendRes.json();

    if (resendRes.ok) {
      // Mark as sent
      await supabase.from('bookings').update({
        reminder_sent_at: new Date().toISOString(),
        reminder_email_id: resendData.id,
      }).eq('id', booking.id);
      results.push({ booking_id: booking.id, client: booking.client_name, status: 'sent', email_id: resendData.id });
    } else {
      results.push({ booking_id: booking.id, client: booking.client_name, status: 'failed', error: resendData });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
