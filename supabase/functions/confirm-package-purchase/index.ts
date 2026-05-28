// supabase/functions/confirm-package-purchase/index.ts
//
// Single-package confirmation. After hosted checkout returns, verifies
// payment and creates the package_purchases row. Idempotent.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, respond, getSupabaseClient, loadTherapist,
  getProvider, ProviderError,
} from '../_shared/payment-provider.ts';
import { notifyTherapist } from '../_shared/notifications.ts';

function escapeHtmlLocal(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      processor, session_id, order_id,
      package_id, therapist_id: therapistIdParam,
      client_email, client_name, client_phone,
    } = await req.json();

    console.log('[confirm-package-purchase] start', { processor, package_id });

    if (!package_id) return respond({ error: 'package_id required' }, 400);

    const supabase = getSupabaseClient();

    // Look up the package, derive therapist_id from it if not passed.
    const { data: pkg } = await supabase
      .from('packages').select('*').eq('id', package_id).single();
    if (!pkg) return respond({ error: 'package_not_found' }, 404);

    const therapist_id = therapistIdParam || pkg.therapist_id;
    const therapist = await loadTherapist(supabase, therapist_id);

    let policy: 'auto' | 'stripe-required' = 'auto';
    if (processor === 'stripe') policy = 'stripe-required';
    const provider = await getProvider(therapist, policy);

    const paymentRefId = processor === 'square' ? order_id : (session_id || order_id);
    if (!paymentRefId) return respond({ error: 'session_id or order_id required' }, 400);

    const verified = await provider.verifyCheckout({ therapist, paymentRefId });
    if (!verified.paid) {
      return respond({ error: 'payment_not_completed', status: verified.status }, 400);
    }

    // Idempotency by paymentRefId
    const { data: existing } = await supabase
      .from('package_purchases')
      .select('id, sessions_remaining, sessions_purchased, client_email, client_name, client_id')
      .eq('stripe_payment_id', verified.paymentRefId)
      .maybeSingle();
    if (existing) {
      return respond({
        ok: true,
        idempotent: true,
        purchase_id: existing.id,
        sessions_remaining: existing.sessions_remaining,
        sessions_purchased: existing.sessions_purchased,
        package_name: pkg.name,
        client_email: existing.client_email,
        client_name: existing.client_name,
        client_id: existing.client_id,
      });
    }

    // Find client by email
    const verifiedEmail = (verified.customerEmail || client_email || '').toLowerCase();
    let clientId: string | null = null;
    if (verifiedEmail) {
      const { data: c } = await supabase
        .from('clients').select('id')
        .eq('therapist_id', therapist_id).eq('email', verifiedEmail).maybeSingle();
      if (c) clientId = c.id;
    }

    const expiresAt = pkg.expires_in_days
      ? new Date(Date.now() + pkg.expires_in_days * 86400000).toISOString()
      : null;

    const amountCents = verified.totalCents || verified.lineItems[0]?.amountCents || 0;

    const { data: inserted, error: insErr } = await supabase
      .from('package_purchases')
      .insert({
        therapist_id, package_id,
        client_id: clientId,
        client_email: verifiedEmail,
        client_name: client_name || null,
        sessions_purchased: pkg.session_count,
        sessions_remaining: pkg.session_count,
        price_paid: amountCents / 100,
        stripe_payment_id: verified.paymentRefId,
        expires_at: expiresAt,
        status: 'active',
      })
      .select('id')
      .single();

    if (insErr) {
      console.error('[confirm-package-purchase] insert failed', insErr);
      return respond({ error: 'insert_failed: ' + insErr.message }, 500);
    }

    // HK May 27 2026: notify the therapist that a package was bought.
    // Previously package purchases fired no therapist notification at
    // all, so the therapist had no idea a client prepaid. Uses the
    // shared notifyTherapist helper (email + in-app + log, prefs-gated).
    // Fire-and-forget; never block the purchase confirmation on it.
    try {
      const dollars = (amountCents / 100).toFixed(0);
      const who = client_name || verifiedEmail || 'A client';
      const tSubject = `${who} bought your ${pkg.name} package`;
      const tHtml = `<!DOCTYPE html><html><body style="margin:0;background:#FAFAF7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:28px 22px;">
    <div style="background:#fff;border:1px solid #ECE7DC;border-radius:16px;padding:24px;">
      <h2 style="font-family:Georgia,serif;color:#1A2E22;margin:0 0 6px;font-size:21px;">New package purchase</h2>
      <p style="font-size:14px;color:#6B7280;margin:0 0 16px;line-height:1.6;">${escapeHtmlLocal(who)} just bought your <strong>${escapeHtmlLocal(pkg.name)}</strong> package (${pkg.session_count} session${pkg.session_count !== 1 ? 's' : ''}) for $${dollars}. They can now book those sessions against the package, and each booking will draw from the prepaid balance.</p>
      <a href="https://mybodymap.app/dashboard/clients" style="display:inline-block;background:#2A5741;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:13px;font-weight:700;">Open clients</a>
      <div style="font-size:11px;color:#6B7280;margin-top:22px;line-height:1.6;">You are getting this because package and payment notifications are on in your settings.</div>
    </div>
  </div>
</body></html>`;
      await notifyTherapist({
        supabase,
        therapist,
        eventType: 'package_purchased',
        title: tSubject,
        body: `${who} bought ${pkg.name} ($${dollars}).`,
        linkUrl: '/dashboard/clients',
        emailSubject: tSubject,
        emailHtml: tHtml,
        smsText: null,
      });
    } catch (notifyErr) {
      console.error('[confirm-package-purchase] notify failed (non-blocking)', notifyErr);
    }

    // HK May 27 2026 Ship 3: return enough context for the booking
    // page to render the 'schedule your sessions now' bulk picker
    // immediately, without a separate refetch. The picker needs the
    // purchase id, how many sessions, and the client email so the
    // bookings it creates can be linked to this package.
    return respond({
      ok: true,
      purchase_id: inserted.id,
      sessions_remaining: pkg.session_count,
      sessions_purchased: pkg.session_count,
      package_name: pkg.name,
      client_email: verifiedEmail,
      client_name: client_name || null,
      client_id: clientId,
    });

  } catch (e) {
    if (e instanceof ProviderError) {
      console.error('[confirm-package-purchase] provider error', e.code, e.message);
      return respond({ error: e.message, code: e.code }, 400);
    }
    console.error('[confirm-package-purchase] uncaught', e);
    return respond({ error: String(e) }, 500);
  }
});
