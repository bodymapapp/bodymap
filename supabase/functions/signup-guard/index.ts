// signup-guard edge function
// Called BEFORE a new therapist row is created. Returns one of:
//   { outcome: 'allowed', risk_score, flag_reasons }  → proceed with signup
//   { outcome: 'blocked', reason, message }           → stop signup, show friendly error
//
// Always logs to signup_attempts table for monitoring.
//
// Security rules enforced:
//   1. Rate limit: max 3 signups per IP in 60 minutes (hard block)
//   2. Rate limit: max 10 signups per IP in 24 hours (hard block)
//   3. Disposable email domain blocklist (hard block)
//   4. Obvious fake patterns in name (hard block): all numbers, <2 chars, spammy URLs
//   5. Soft flags (let through but mark): name-email mismatch, all-caps, numbers in name

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Comprehensive disposable email domain list. Expand over time from abuse logs.
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', 'temp-mail.org', 'guerrillamail.com', 'guerrillamail.net',
  '10minutemail.com', '10minutemail.net', 'throwawaymail.com', 'trashmail.com', 'maildrop.cc',
  'getnada.com', 'nada.email', 'yopmail.com', 'yopmail.net', 'fakeinbox.com', 'fakemail.net',
  'sharklasers.com', 'grr.la', 'pokemail.net', 'spam4.me', 'tempinbox.com', 'tempmailaddress.com',
  'dispostable.com', 'tempail.com', 'mohmal.com', 'mailnesia.com', 'inboxkitten.com',
  'mintemail.com', 'emailondeck.com', 'mytemp.email', 'burnermail.io', 'emailsensei.com',
  'tempmail.email', 'mailnull.com', 'mailnull.email', 'trbvm.com', 'mailcatch.com',
  'mytrashmail.com', 'minuteinbox.com', 'anonbox.net', 'emailmiser.com', 'spam.la',
  'dropmail.me', 'vomoto.com', 'temporary-mail.net', 'spikio.com', 'owlymail.com',
  'e4ward.com', 'getairmail.com', 'tempr.email', 'tempomail.fr', 'safetymail.info',
  'easytrashmail.com', 'correotemporal.org', 'emailfake.com', 'mailfake.me',
  'thrott.com', 'tempinbox.co.uk', 'inboxbear.com', 'mohmal.in', 'mailpoof.com',
  '1secmail.com', '1secmail.net', '1secmail.org', 'trxyy.com', 'vipmail.net',
  'tmail.ws', 'wegwerfemail.de', 'byom.de', 'rootfest.net', 'burpcollaborator.net',
]);

// Run the heuristic analyses. Returns { block, flags, score }
function analyzeInput(email: string, fullName: string, businessName: string) {
  const flags: string[] = [];
  let score = 0;
  let block: { reason: string; message: string } | null = null;

  const emailLower = (email || '').trim().toLowerCase();
  const nameTrim = (fullName || '').trim();
  const bizTrim = (businessName || '').trim();

  // Basic email shape
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    return { block: { reason: 'invalid_email', message: 'Please use a valid email address.' }, flags: [], score: 100 };
  }

  // Disposable email
  const domain = emailLower.split('@')[1];
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    block = { reason: 'disposable_email', message: 'Please use a real email address so we can reach you about your practice.' };
  }
  // Plus-alias used for throwaways (jane+spam1@gmail.com) — soft flag, don't block
  const localPart = emailLower.split('@')[0];
  if (localPart.includes('+')) {
    flags.push('plus_alias_email');
    score += 10;
  }

  // Name length
  if (nameTrim.length < 2) {
    block = block || { reason: 'name_too_short', message: 'Please enter your full name.' };
  }
  if (nameTrim.length > 80) {
    block = block || { reason: 'name_too_long', message: 'Name seems too long. Please use your real name.' };
  }

  // Name is all numbers or spammy
  if (/^\d+$/.test(nameTrim)) {
    block = block || { reason: 'name_all_numbers', message: 'Please enter your actual name.' };
  }
  if (/https?:\/\/|www\.|\.com|\.ru|\.xyz/i.test(nameTrim) || /https?:\/\/|www\.|\.com|\.ru|\.xyz/i.test(bizTrim)) {
    block = block || { reason: 'url_in_name', message: 'Please enter your actual name.' };
  }
  // Excessive digits in name (>30%)
  const nameDigits = (nameTrim.match(/\d/g) || []).length;
  if (nameTrim.length > 0 && nameDigits / nameTrim.length > 0.3) {
    flags.push('numeric_name');
    score += 25;
  }
  // All caps (but allow short names like "BO")
  if (nameTrim.length > 4 && nameTrim === nameTrim.toUpperCase() && /[A-Z]/.test(nameTrim)) {
    flags.push('all_caps_name');
    score += 15;
  }
  // All lowercase
  if (nameTrim.length > 4 && nameTrim === nameTrim.toLowerCase() && /[a-z]/.test(nameTrim)) {
    flags.push('all_lowercase_name');
    score += 5;
  }
  // Name-email mismatch (the "Linda" case)
  // We check: does the email local-part contain any word from the name?
  const nameWords = nameTrim.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
  const emailLocalLower = localPart.toLowerCase().replace(/[^a-z0-9]/g, '');
  const anyNameInEmail = nameWords.some(w => emailLocalLower.includes(w.slice(0, Math.min(w.length, 5))));
  if (nameWords.length > 0 && !anyNameInEmail) {
    flags.push('email_name_mismatch');
    score += 30;
  }

  // Repeated characters ("aaaaaa", "testtesttest")
  if (/(.)\1{4,}/.test(nameTrim)) {
    flags.push('repeated_chars_name');
    score += 20;
  }
  // "test", "asdf", "qwerty" type
  if (/^(test|asdf|qwer|zxcv|aaaa|xxxx|fake|spam|admin)$/i.test(nameTrim.replace(/\s/g, ''))) {
    block = block || { reason: 'test_name', message: 'Please enter your actual name.' };
  }

  return { block, flags, score };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

    const body = await req.json();
    const email = body.email || '';
    const fullName = body.full_name || body.fullName || '';
    const businessName = body.business_name || body.businessName || '';

    // Get client IP from x-forwarded-for (Supabase gateway sets this)
    const fwd = req.headers.get('x-forwarded-for') || '';
    const ip = fwd.split(',')[0].trim() || 'unknown';
    const userAgent = (req.headers.get('user-agent') || '').slice(0, 300);
    const country = req.headers.get('x-country') || req.headers.get('cf-ipcountry') || null;

    // 1. Rate limit by IP: 3 per hour, 10 per day
    if (ip && ip !== 'unknown') {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: hourCount } = await supabase.from('signup_attempts').select('id', { count: 'exact', head: true }).eq('ip', ip).gte('created_at', hourAgo);
      const { count: dayCount } = await supabase.from('signup_attempts').select('id', { count: 'exact', head: true }).eq('ip', ip).gte('created_at', dayAgo);
      if ((hourCount || 0) >= 3) {
        await supabase.from('signup_attempts').insert({ email, full_name: fullName, business_name: businessName, ip, user_agent: userAgent, country, outcome: 'blocked', block_reason: 'rate_limit_hour', risk_score: 100 });
        return new Response(JSON.stringify({ outcome: 'blocked', reason: 'rate_limit_hour', message: 'Too many signups from this location. Please try again in an hour.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if ((dayCount || 0) >= 10) {
        await supabase.from('signup_attempts').insert({ email, full_name: fullName, business_name: businessName, ip, user_agent: userAgent, country, outcome: 'blocked', block_reason: 'rate_limit_day', risk_score: 100 });
        return new Response(JSON.stringify({ outcome: 'blocked', reason: 'rate_limit_day', message: 'Too many signups from this location. Please try again tomorrow.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // 2-4. Content heuristics
    const { block, flags, score } = analyzeInput(email, fullName, businessName);

    if (block) {
      await supabase.from('signup_attempts').insert({ email, full_name: fullName, business_name: businessName, ip, user_agent: userAgent, country, outcome: 'blocked', block_reason: block.reason, risk_score: 100, flag_reasons: flags });
      return new Response(JSON.stringify({ outcome: 'blocked', reason: block.reason, message: block.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Log allowed attempt with any soft flags
    const outcome = flags.length > 0 ? 'flagged' : 'allowed';
    await supabase.from('signup_attempts').insert({ email, full_name: fullName, business_name: businessName, ip, user_agent: userAgent, country, outcome, risk_score: score, flag_reasons: flags });

    // Return allowed + flags so the client can pass them on for the therapist row
    return new Response(JSON.stringify({ outcome: 'allowed', risk_score: score, flag_reasons: flags }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('signup-guard error:', err);
    // Fail open — never block legitimate signups because of a bug in the guard.
    return new Response(JSON.stringify({ outcome: 'allowed', risk_score: 0, flag_reasons: [], guard_error: err?.message || String(err) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
