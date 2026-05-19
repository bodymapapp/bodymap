// export-therapist-data edge function
//
// Therapist taps 'Download all my data' in Settings -> Account. This
// function:
//   1. Verifies caller is the therapist (JWT email lookup)
//   2. Creates a 'pending' row in data_exports
//   3. Fetches all rows from ~13 tables for that therapist_id
//   4. Builds the CSVs + README + profile.json
//   5. Packages into a ZIP using JSZip
//   6. Uploads to data-exports storage bucket
//   7. Generates a 7-day signed URL
//   8. Updates the data_exports row to 'ready' with the URL
//   9. Sends therapist an email with the download link via Resend
//
// Per HK May 19 2026: free for all therapists, marketing differentiator
// ('your data is yours'). Per the FB thread with Colleen Eidemiller:
// download capability is what makes 'owned by therapists' real.
//
// Inclusion list (HK approved):
//   - clients, bookings, sessions (without SOAP), soap_notes,
//     session_payments, intake_responses (latest), intake_edit_history,
//     services, service_addons, availability,
//     memberships_and_packages, gift_certificates, waiver_signatures
//     (metadata only), profile.json, README.txt
//
// Excluded: outreach history, push subscriptions, AI logs, signup
// attempts, internal events, signature images, Stripe IDs.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CSV escaping: quote any field that contains comma, quote, or newline.
// Double internal quotes per RFC 4180.
function csvCell(v: any): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(values: any[]): string {
  return values.map(csvCell).join(',') + '\n';
}

function buildCSV(headers: string[], rows: any[][]): string {
  return csvRow(headers) + rows.map(r => csvRow(r)).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const respond = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return respond({ error: 'Server misconfigured' }, 500);
    }

    // Pull caller email from JWT
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    let callerEmail = '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      callerEmail = (payload?.email || '').toLowerCase();
    } catch {
      return respond({ error: 'Invalid token' }, 401);
    }
    if (!callerEmail) return respond({ error: 'No caller email' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Look up the therapist
    const { data: therapist } = await supabase
      .from('therapists')
      .select('*')
      .eq('email', callerEmail)
      .single();

    if (!therapist) return respond({ error: 'Therapist not found' }, 404);

    const therapistId = therapist.id;

    // Guard: if there's an in-progress export less than 5 minutes old,
    // return its status rather than starting a new one. Prevents the
    // therapist from double-tapping and getting multiple emails.
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentPending } = await supabase
      .from('data_exports')
      .select('*')
      .eq('therapist_id', therapistId)
      .in('status', ['pending', 'building'])
      .gte('created_at', fiveMinAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentPending) {
      return respond({
        status: 'in_progress',
        message: 'Your export is being prepared. We will email you when it is ready.',
        export_id: recentPending.id,
      });
    }

    // Create a pending row, return immediately, then continue building
    // in the background. The therapist gets a fast response and the
    // email shows up when done.
    const { data: exportRow, error: insertErr } = await supabase
      .from('data_exports')
      .insert({
        therapist_id: therapistId,
        status: 'building',
      })
      .select()
      .single();

    if (insertErr || !exportRow) {
      console.error('Failed to insert export row:', insertErr);
      return respond({ error: 'Could not start export' }, 500);
    }

    // Respond fast, then continue building in the background
    const buildAndEmail = async () => {
      try {
        const zip = new JSZip();
        let totalRows = 0;

        // ─── profile.json ─────────────────────────────────────────
        // Strip Stripe IDs and internal-only fields.
        const profile = {
          business_name: therapist.business_name,
          full_name: therapist.full_name,
          email: therapist.email,
          phone: therapist.phone,
          custom_url: therapist.custom_url,
          address: therapist.address,
          city: therapist.city,
          state: therapist.state,
          postal_code: therapist.postal_code,
          country: therapist.country,
          bio: therapist.bio,
          time_zone: therapist.time_zone,
          deposit_enabled: therapist.deposit_enabled,
          deposit_percent: therapist.deposit_percent,
          buffer_enabled: therapist.buffer_enabled,
          buffer_minutes: therapist.buffer_minutes,
          accept_tips: therapist.accept_tips,
          tip_preset_1: therapist.tip_preset_1,
          tip_preset_2: therapist.tip_preset_2,
          tip_preset_3: therapist.tip_preset_3,
          minimum_advance_hours: therapist.minimum_advance_hours,
          maximum_advance_days: therapist.maximum_advance_days,
          scheduling_mode: therapist.scheduling_mode,
          intake_schema: therapist.intake_schema,
          export_generated_at: new Date().toISOString(),
        };
        zip.file('profile.json', JSON.stringify(profile, null, 2));

        // ─── README.txt ───────────────────────────────────────────
        const readme = [
          'Your MyBodyMap Data Export',
          '==========================',
          '',
          `Generated: ${new Date().toLocaleString('en-US', { timeZone: therapist.time_zone || 'UTC' })}`,
          `Practice: ${therapist.business_name || therapist.full_name}`,
          '',
          'What is in this ZIP',
          '-------------------',
          '',
          'profile.json',
          '  Your account settings, business address, booking policies,',
          '  deposit configuration, intake form schema.',
          '',
          'clients.csv',
          '  Every client record: name, email, phone, address, notes,',
          '  tags, lifetime spend, total visits, last visit date.',
          '',
          'bookings.csv',
          '  Every appointment ever booked: date, time, service, status,',
          '  client info, location, deposit info, cancellation reason.',
          '',
          'sessions.csv',
          '  Completed sessions with intake answers (focus areas, pressure',
          '  preference, music, draping, etc). SOAP notes are kept',
          '  separate (see soap_notes.csv).',
          '',
          'soap_notes.csv',
          '  Your clinical session notes per client. Kept separately so',
          '  you can secure or share independently of the rest of the',
          '  export.',
          '',
          'session_payments.csv',
          '  Payment records per session: amount, tip, method, status.',
          '',
          'intake_responses.csv',
          '  Latest intake form answers per client.',
          '',
          'intake_edit_history.csv',
          '  Full audit trail of changes clients made to their intake',
          '  answers over time. Useful for verifying disclosures.',
          '',
          'services.csv',
          '  Your service menu: name, duration, price, group, sort order,',
          '  description, visibility.',
          '',
          'service_addons.csv',
          '  Add-ons offered alongside services.',
          '',
          'availability.csv',
          '  Your weekly working hours.',
          '',
          'memberships_and_packages.csv',
          '  Membership plans and package definitions, active client',
          '  subscriptions, remaining session credits.',
          '',
          'gift_certificates.csv',
          '  Gift certificates issued, balances remaining, redemption',
          '  status.',
          '',
          'waiver_signatures.csv',
          '  Metadata for signed waivers (who, when, agreement version).',
          '  Signature images are not included in this export.',
          '',
          'Questions',
          '---------',
          '',
          'If you have questions about your export, reply to the email',
          'you received with this download link.',
          '',
          'Your data is yours.',
          '',
        ].join('\n');
        zip.file('README.txt', readme);

        // ─── clients.csv ──────────────────────────────────────────
        const { data: clients } = await supabase
          .from('clients')
          .select('*')
          .eq('therapist_id', therapistId);
        const clientHeaders = ['id', 'name', 'email', 'phone', 'address', 'city', 'state', 'postal_code', 'notes', 'tags', 'lifetime_spend', 'total_visits', 'last_visit', 'created_at'];
        const clientRows = (clients || []).map(c => [
          c.id, c.name, c.email, c.phone, c.address, c.city, c.state, c.postal_code,
          c.notes, (c.tags || []).join('; '), c.lifetime_spend, c.total_visits, c.last_visit, c.created_at,
        ]);
        zip.file('clients.csv', buildCSV(clientHeaders, clientRows));
        totalRows += clientRows.length;

        // ─── bookings.csv ─────────────────────────────────────────
        const { data: bookings } = await supabase
          .from('bookings')
          .select(`
            id, client_id, client_name, client_email, client_phone,
            partner_name, partner_email, booking_date, start_time, end_time,
            status, notes, deposit_required, deposit_amount, deposit_paid,
            cancellation_reason, cancelled_at, location, created_at,
            service:services(name, duration, price),
            therapist_location:therapist_locations(name)
          `)
          .eq('therapist_id', therapistId)
          .order('booking_date', { ascending: false });
        const bookingHeaders = ['id', 'client_id', 'client_name', 'client_email', 'client_phone', 'partner_name', 'partner_email', 'date', 'start_time', 'end_time', 'service_name', 'service_duration', 'service_price', 'status', 'location', 'notes', 'deposit_required', 'deposit_amount', 'deposit_paid', 'cancellation_reason', 'cancelled_at', 'created_at'];
        const bookingRows = (bookings || []).map(b => [
          b.id, b.client_id, b.client_name, b.client_email, b.client_phone,
          b.partner_name, b.partner_email, b.booking_date, b.start_time, b.end_time,
          b.service?.name, b.service?.duration, b.service?.price,
          b.status,
          b.therapist_location?.name || b.location,
          b.notes, b.deposit_required, b.deposit_amount, b.deposit_paid,
          b.cancellation_reason, b.cancelled_at, b.created_at,
        ]);
        zip.file('bookings.csv', buildCSV(bookingHeaders, bookingRows));
        totalRows += bookingRows.length;

        // ─── sessions.csv (without SOAP) ──────────────────────────
        const { data: sessions } = await supabase
          .from('sessions')
          .select('*')
          .eq('therapist_id', therapistId)
          .order('created_at', { ascending: false });
        const sessionHeaders = ['id', 'client_id', 'booking_id', 'completed', 'front_focus', 'front_avoid', 'back_focus', 'back_avoid', 'pressure', 'draping', 'lighting', 'music', 'oil_pref', 'room_temp', 'table_temp', 'goal', 'client_notes', 'public_notes', 'med_flag', 'med_note', 'medical_conditions', 'custom_intake_answers', 'created_at'];
        const sessionRows = (sessions || []).map(s => [
          s.id, s.client_id, s.booking_id, s.completed,
          s.front_focus, s.front_avoid, s.back_focus, s.back_avoid,
          s.pressure, s.draping, s.lighting, s.music, s.oil_pref,
          s.room_temp, s.table_temp, s.goal, s.client_notes, s.public_notes,
          s.med_flag, s.med_note,
          (s.medical_conditions || []).join('; '),
          s.custom_intake_answers,
          s.created_at,
        ]);
        zip.file('sessions.csv', buildCSV(sessionHeaders, sessionRows));
        totalRows += sessionRows.length;

        // ─── soap_notes.csv (SOAP only, separate file) ────────────
        const soapHeaders = ['session_id', 'client_id', 'booking_id', 'therapist_notes', 'conversation', 'created_at'];
        const soapRows = (sessions || [])
          .filter(s => s.therapist_notes || s.conversation)
          .map(s => [s.id, s.client_id, s.booking_id, s.therapist_notes, s.conversation, s.created_at]);
        zip.file('soap_notes.csv', buildCSV(soapHeaders, soapRows));
        totalRows += soapRows.length;

        // ─── session_payments.csv ─────────────────────────────────
        const { data: payments } = await supabase
          .from('session_payments')
          .select('*')
          .eq('therapist_id', therapistId)
          .order('created_at', { ascending: false });
        const paymentHeaders = ['id', 'session_id', 'booking_id', 'client_id', 'amount', 'tip', 'currency', 'payment_method', 'status', 'created_at'];
        const paymentRows = (payments || []).map(p => [
          p.id, p.session_id, p.booking_id, p.client_id,
          p.amount, p.tip, p.currency, p.payment_method, p.status, p.created_at,
        ]);
        zip.file('session_payments.csv', buildCSV(paymentHeaders, paymentRows));
        totalRows += paymentRows.length;

        // ─── intake_responses.csv + intake_edit_history.csv ───────
        // intake_edits is the audit trail. Latest per (client, field)
        // is the 'current' intake response.
        const { data: intakeEdits } = await supabase
          .from('intake_edits')
          .select('*')
          .eq('therapist_id', therapistId)
          .order('created_at', { ascending: false });
        const intakeHistoryHeaders = ['id', 'client_id', 'booking_id', 'field_id', 'old_value', 'new_value', 'edited_by', 'created_at'];
        const intakeHistoryRows = (intakeEdits || []).map(e => [
          e.id, e.client_id, e.booking_id, e.field_id, e.old_value, e.new_value, e.edited_by, e.created_at,
        ]);
        zip.file('intake_edit_history.csv', buildCSV(intakeHistoryHeaders, intakeHistoryRows));
        totalRows += intakeHistoryRows.length;

        // Latest intake per (client, field)
        const latestByKey: Record<string, any> = {};
        for (const e of intakeEdits || []) {
          const key = `${e.client_id}::${e.field_id}`;
          if (!latestByKey[key]) latestByKey[key] = e;
        }
        const intakeResponseHeaders = ['client_id', 'field_id', 'value', 'last_updated'];
        const intakeResponseRows = Object.values(latestByKey).map((e: any) => [
          e.client_id, e.field_id, e.new_value, e.created_at,
        ]);
        zip.file('intake_responses.csv', buildCSV(intakeResponseHeaders, intakeResponseRows));
        totalRows += intakeResponseRows.length;

        // ─── services.csv ─────────────────────────────────────────
        const { data: services } = await supabase
          .from('services')
          .select('*')
          .eq('therapist_id', therapistId)
          .is('archived_at', null)
          .order('sort_order', { ascending: true });
        const serviceHeaders = ['id', 'name', 'duration', 'price', 'description', 'active', 'visibility', 'is_couples', 'service_group', 'sort_order', 'created_at'];
        const serviceRows = (services || []).map(s => [
          s.id, s.name, s.duration, s.price, s.description, s.active, s.visibility, s.is_couples, s.service_group, s.sort_order, s.created_at,
        ]);
        zip.file('services.csv', buildCSV(serviceHeaders, serviceRows));
        totalRows += serviceRows.length;

        // ─── service_addons.csv ───────────────────────────────────
        const { data: addons } = await supabase
          .from('service_addons')
          .select('*')
          .eq('therapist_id', therapistId);
        const addonHeaders = ['id', 'name', 'price', 'extra_minutes', 'description', 'active', 'display_order', 'created_at'];
        const addonRows = (addons || []).map(a => [
          a.id, a.name, a.price, a.extra_minutes, a.description, a.active, a.display_order, a.created_at,
        ]);
        zip.file('service_addons.csv', buildCSV(addonHeaders, addonRows));
        totalRows += addonRows.length;

        // ─── availability.csv ─────────────────────────────────────
        const { data: avail } = await supabase
          .from('availability')
          .select('*')
          .eq('therapist_id', therapistId);
        const availHeaders = ['id', 'day_of_week', 'start_time', 'end_time', 'service_id', 'active', 'created_at'];
        const availRows = (avail || []).map(a => [
          a.id, a.day_of_week, a.start_time, a.end_time, a.service_id, a.active, a.created_at,
        ]);
        zip.file('availability.csv', buildCSV(availHeaders, availRows));
        totalRows += availRows.length;

        // ─── memberships_and_packages.csv ─────────────────────────
        const [{ data: memberships }, { data: packages }, { data: memSubs }, { data: pkgPurchases }] = await Promise.all([
          supabase.from('memberships').select('*').eq('therapist_id', therapistId),
          supabase.from('packages').select('*').eq('therapist_id', therapistId),
          supabase.from('member_subscriptions').select('*, membership:memberships(name)').eq('therapist_id', therapistId),
          supabase.from('package_purchases').select('*, package:packages(name)').eq('therapist_id', therapistId),
        ]);
        const mpHeaders = ['type', 'id', 'name', 'client_id', 'price', 'sessions_or_credits', 'status', 'started_at', 'expires_at', 'created_at'];
        const mpRows: any[][] = [];
        for (const m of memberships || []) {
          mpRows.push(['membership_plan', m.id, m.name, null, m.monthly_price, m.monthly_session_credits, m.active ? 'active' : 'inactive', null, null, m.created_at]);
        }
        for (const p of packages || []) {
          mpRows.push(['package_plan', p.id, p.name, null, p.price, p.session_count, p.active ? 'active' : 'inactive', null, null, p.created_at]);
        }
        for (const s of memSubs || []) {
          mpRows.push(['member_subscription', s.id, s.membership?.name, s.client_id, s.monthly_price, s.current_credits, s.status, s.started_at, s.current_period_end, s.created_at]);
        }
        for (const p of pkgPurchases || []) {
          mpRows.push(['package_purchase', p.id, p.package?.name, p.client_id, p.price_paid, p.sessions_remaining, p.status, p.purchased_at, p.expires_at, p.purchased_at]);
        }
        zip.file('memberships_and_packages.csv', buildCSV(mpHeaders, mpRows));
        totalRows += mpRows.length;

        // ─── gift_certificates.csv ────────────────────────────────
        const { data: gifts } = await supabase
          .from('gift_certificates')
          .select('*')
          .eq('therapist_id', therapistId);
        const giftHeaders = ['id', 'code', 'amount', 'remaining', 'status', 'recipient_name', 'recipient_email', 'purchaser_name', 'purchaser_email', 'message', 'created_at', 'redeemed_at'];
        const giftRows = (gifts || []).map(g => [
          g.id, g.code, g.amount, g.remaining, g.status,
          g.recipient_name, g.recipient_email, g.purchaser_name, g.purchaser_email,
          g.message, g.created_at, g.redeemed_at,
        ]);
        zip.file('gift_certificates.csv', buildCSV(giftHeaders, giftRows));
        totalRows += giftRows.length;

        // ─── waiver_signatures.csv (metadata only) ────────────────
        const { data: waivers } = await supabase
          .from('waiver_signatures')
          .select('id, client_id, booking_id, agreement_version, signed_at, created_at')
          .eq('therapist_id', therapistId);
        const waiverHeaders = ['id', 'client_id', 'booking_id', 'agreement_version', 'signed_at', 'created_at'];
        const waiverRows = (waivers || []).map(w => [
          w.id, w.client_id, w.booking_id, w.agreement_version, w.signed_at, w.created_at,
        ]);
        zip.file('waiver_signatures.csv', buildCSV(waiverHeaders, waiverRows));
        totalRows += waiverRows.length;

        // ─── Build the ZIP ────────────────────────────────────────
        const zipBlob = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });

        // ─── Upload to Supabase Storage ──────────────────────────
        const fileName = `${therapistId}/${new Date().toISOString().replace(/[:.]/g, '-')}-mybodymap-export.zip`;
        const { error: uploadErr } = await supabase
          .storage
          .from('data-exports')
          .upload(fileName, zipBlob, {
            contentType: 'application/zip',
            upsert: false,
          });

        if (uploadErr) {
          console.error('Upload failed:', uploadErr);
          await supabase
            .from('data_exports')
            .update({ status: 'failed', error_message: uploadErr.message, completed_at: new Date().toISOString() })
            .eq('id', exportRow.id);
          return;
        }

        // 7-day signed URL
        const { data: signed } = await supabase
          .storage
          .from('data-exports')
          .createSignedUrl(fileName, 60 * 60 * 24 * 7);

        const signedUrl = signed?.signedUrl || '';

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await supabase
          .from('data_exports')
          .update({
            status: 'ready',
            storage_path: fileName,
            signed_url: signedUrl,
            file_size_bytes: zipBlob.byteLength,
            row_count: totalRows,
            expires_at: expiresAt,
            completed_at: new Date().toISOString(),
          })
          .eq('id', exportRow.id);

        // ─── Send the email ──────────────────────────────────────
        if (RESEND_API_KEY && signedUrl) {
          const mbCount = Math.max(0.1, zipBlob.byteLength / 1024 / 1024).toFixed(1);
          const expiresFmt = new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          const emailHtml = `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1F4131;">
              <h1 style="font-size: 28px; font-weight: 600; margin: 0 0 16px;">Your data export is ready</h1>
              <p style="font-size: 15px; line-height: 1.6; color: #2A5741;">
                Hi ${therapist.full_name?.split(' ')[0] || 'there'},
              </p>
              <p style="font-size: 15px; line-height: 1.6; color: #2A5741;">
                Your complete MyBodyMap data export is ready to download. The ZIP file is ${mbCount} MB and contains ${totalRows.toLocaleString()} records across all your clients, sessions, services, and settings.
              </p>
              <div style="margin: 24px 0; text-align: center;">
                <a href="${signedUrl}" style="display: inline-block; background: #2A5741; color: #fff; padding: 14px 28px; border-radius: 24px; text-decoration: none; font-weight: 700; font-size: 15px;">Download your data</a>
              </div>
              <p style="font-size: 13px; line-height: 1.6; color: #6B7280; font-style: italic;">
                This link expires on ${expiresFmt}. If you need a fresh export after that, you can generate one anytime from Settings -> Your data.
              </p>
              <p style="font-size: 13px; line-height: 1.6; color: #6B7280;">
                The ZIP includes a README explaining what each file contains. Your data is yours. You can keep this, share it with an accountant, migrate it to another system, or just have it as a backup.
              </p>
              <p style="font-size: 13px; line-height: 1.6; color: #6B7280; margin-top: 24px;">
                Reply to this email if you have any questions.
              </p>
              <p style="font-size: 13px; color: #2A5741; margin-top: 16px;">
                MyBodyMap
              </p>
            </div>
          `;
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: 'MyBodyMap <hello@mybodymap.app>',
              to: [therapist.email],
              subject: 'Your MyBodyMap data export is ready',
              html: emailHtml,
            }),
          });
        }
      } catch (err) {
        console.error('Export build failed:', err);
        await supabase
          .from('data_exports')
          .update({
            status: 'failed',
            error_message: String(err?.message || err),
            completed_at: new Date().toISOString(),
          })
          .eq('id', exportRow.id);
      }
    };

    // Fire and forget in the background. Deno supports waitUntil-style
    // background work via Promise; we don't await it before responding.
    // The frontend gets a fast 200 and the email comes when ready.
    EdgeRuntime.waitUntil(buildAndEmail());

    return respond({
      status: 'building',
      message: 'Building your export. We will email you when it is ready, usually within a minute.',
      export_id: exportRow.id,
    });
  } catch (err) {
    console.error('Top-level error:', err);
    return respond({ error: 'Server error', detail: String((err as any)?.message || err) }, 500);
  }
});
