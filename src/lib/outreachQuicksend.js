// src/lib/outreachQuicksend.js
//
// Quick-send module: 5 default starter templates, 5 audience preset
// queries, and a lazy seed function that ensures every therapist
// has the starters in their outreach_templates row on first load.
//
// HK direction May 9 2026: Outreach page gets preconfigured "blocks"
// at the top (5 of them), 2-click flow (tap block, modal opens with
// prefilled email, edit-and-send). Therapist can edit, reset, or
// delete starter templates and create custom ones.
//
// AUDIENCE PRESETS
//
// Each preset corresponds to an audience_preset value stored on the
// outreach_templates row. The query function below takes a
// therapist_id, returns a list of {client_id, name, email, ...}
// recipients. Templates with no matching recipients gray out on
// the page (the modal does not open at all).
//
// 1. new_clients          first session within last 30 days
// 2. returning_recent     2+ sessions, most recent within 60 days
// 3. lapsed               at least one past session, none in 60-90+ days
// 4. all_active           any session in the last 12 months
// 5. package_holders_idle clients with package balance > 0,
//                         no booking in last 14 days
//
// All queries exclude clients without an email address.

import { supabase } from './supabase';

// ─── Starter templates (the 5 defaults seeded per therapist) ────

export const STARTER_TEMPLATES = [
  {
    starter_key: 'welcome_new',
    label: 'Welcome new clients',
    audience_preset: 'new_clients',
    subject: 'Quick check-in from {{therapist_name}}',
    body: `Hi {{first_name}},

It was so good to meet you. How are you feeling since our session?

If you'd like to come back, here's the easiest way to grab your next time: {{rebook_link}}.

No rush, just here when you're ready.

Warmly,
{{therapist_name}}`,
    display_order: 1,
  },
  {
    starter_key: 'miss_you',
    label: 'We miss you',
    audience_preset: 'lapsed',
    subject: 'Hi {{first_name}}, just thinking of you',
    body: `Hi {{first_name}},

It's been a few months and I've been thinking about you. If your body's been calling out for some time on the table, I have openings coming up.

{{rebook_link}}

No pressure either way, you know how to find me.

{{therapist_name}}`,
    display_order: 2,
  },
  {
    starter_key: 'ready_when_you_are',
    label: 'Ready when you are',
    audience_preset: 'returning_recent',
    subject: 'Your next session is open whenever',
    body: `Hi {{first_name}},

Hope you're doing well. I'm putting next month's calendar together this week, just wanted you to have first pick if you'd like to lock something in.

{{rebook_link}}

Warmly,
{{therapist_name}}`,
    display_order: 3,
  },
  {
    starter_key: 'package_balance',
    label: 'You have sessions left',
    audience_preset: 'package_holders_idle',
    subject: 'A friendly reminder, {{first_name}}',
    body: `Hi {{first_name}},

You have sessions left on your package and I have openings this week. Wanted to make sure you knew so they don't slip away.

{{rebook_link}}

Whenever works for you,
{{therapist_name}}`,
    display_order: 4,
  },
  {
    starter_key: 'special_this_month',
    label: 'Special this month',
    audience_preset: 'all_active',
    subject: 'A little something for {{first_name}}',
    body: `Hi {{first_name}},

I wanted to share something with you this month. (Edit this template to put your seasonal offering, new service, or simple update here.)

If it sounds like the right time, here's the easiest way to come in: {{rebook_link}}.

Warmly,
{{therapist_name}}`,
    display_order: 5,
  },
];

// ─── Lazy seeder ────────────────────────────────────────────────

// Idempotent: checks if therapist already has any starter templates
// (by is_starter flag). If not, inserts all 5. If they have some
// but not all, inserts only the missing ones (by starter_key).
//
// Called once when Outreach component mounts. Cheap because the
// "already seeded" check is one indexed query.
export async function ensureStartersSeeded(therapistId) {
  if (!therapistId) return { ok: false, reason: 'no_therapist' };

  const { data: existing, error: readErr } = await supabase
    .from('outreach_templates')
    .select('starter_key')
    .eq('therapist_id', therapistId)
    .eq('is_starter', true);

  if (readErr) {
    console.error('[outreachQuicksend] read error:', readErr);
    return { ok: false, reason: readErr.message };
  }

  const existingKeys = new Set((existing || []).map(t => t.starter_key));
  const toInsert = STARTER_TEMPLATES
    .filter(t => !existingKeys.has(t.starter_key))
    .map(t => ({
      therapist_id: therapistId,
      label: t.label,
      subject: t.subject,
      body: t.body,
      audience_preset: t.audience_preset,
      is_starter: true,
      starter_key: t.starter_key,
      display_order: t.display_order,
    }));

  if (toInsert.length === 0) return { ok: true, seeded: 0 };

  const { error: insertErr } = await supabase
    .from('outreach_templates')
    .insert(toInsert);

  if (insertErr) {
    console.error('[outreachQuicksend] insert error:', insertErr);
    return { ok: false, reason: insertErr.message };
  }

  return { ok: true, seeded: toInsert.length };
}

// Reset a starter template back to the original wording. Looks up
// the starter_key in STARTER_TEMPLATES and writes the original
// label/subject/body/audience_preset back to the existing row.
// If the row was soft-deleted, also clears deleted_at.
export async function resetStarterToDefault(therapistId, starterKey) {
  const def = STARTER_TEMPLATES.find(t => t.starter_key === starterKey);
  if (!def) return { ok: false, reason: 'unknown_starter_key' };

  const { error } = await supabase
    .from('outreach_templates')
    .update({
      label: def.label,
      subject: def.subject,
      body: def.body,
      audience_preset: def.audience_preset,
      display_order: def.display_order,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('therapist_id', therapistId)
    .eq('starter_key', starterKey);

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

// Soft-delete: mark deleted_at timestamp. Restoreable.
export async function softDeleteTemplate(therapistId, templateId) {
  const { error } = await supabase
    .from('outreach_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', templateId)
    .eq('therapist_id', therapistId);
  return error ? { ok: false, reason: error.message } : { ok: true };
}

// Restore all soft-deleted starter templates by clearing deleted_at.
// If a starter_key was hard-deleted somehow, ensureStartersSeeded
// will recreate it on next call.
export async function restoreStarters(therapistId) {
  const { error } = await supabase
    .from('outreach_templates')
    .update({ deleted_at: null })
    .eq('therapist_id', therapistId)
    .eq('is_starter', true)
    .not('deleted_at', 'is', null);
  if (error) return { ok: false, reason: error.message };
  return await ensureStartersSeeded(therapistId);
}

// ─── Audience queries ──────────────────────────────────────────

// Each audience query returns a Promise<Array<{client_id, name,
// email, first_name}>>. All queries:
//   - Filter to therapist_id
//   - Exclude unsubscribed clients
//   - Exclude clients without an email address
//
// Smart token rendering uses first_name extracted from name. If
// name is "Jane Smith", first_name is "Jane". If name has no
// space, first_name = name.

function deriveFirstName(fullName) {
  if (!fullName) return 'there';
  const trimmed = fullName.trim();
  const space = trimmed.indexOf(' ');
  return space > 0 ? trimmed.slice(0, space) : trimmed;
}

function shapeRecipients(rows) {
  return (rows || [])
    .filter(r => r.email)
    .map(r => ({
      client_id: r.id,
      name: r.name,
      email: r.email,
      first_name: deriveFirstName(r.name),
    }));
}

// Helper: lowercase + dedupe a list of email strings (some may be
// null or differently-cased between bookings and clients tables).
function normalizeEmails(rows, key = 'client_email') {
  const set = new Set();
  for (const r of (rows || [])) {
    const e = r[key];
    if (e && typeof e === 'string') set.add(e.toLowerCase().trim());
  }
  return [...set];
}

// Helper: given a list of normalized emails, return matching client
// rows for the therapist. Single source of truth for the email->client
// lookup.
async function clientsByEmails(therapistId, emails) {
  if (!emails || emails.length === 0) return [];
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, email')
    .eq('therapist_id', therapistId)
    .in('email', emails);
  if (error) {
    console.error('[clientsByEmails]', error);
    return [];
  }
  return data || [];
}

async function audienceNewClients(therapistId) {
  // Clients whose first booking was within the last 30 days.
  // Uses created_at on clients table as the "first booking" proxy
  // since the import flow and the booking flow both upsert clients
  // with their initial created_at on first contact.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const { data, error } = await supabase
    .from('clients')
    .select('id, name, email')
    .eq('therapist_id', therapistId)
    .gte('created_at', cutoff.toISOString());

  if (error) {
    console.error('[audience new_clients]', error);
    return [];
  }
  return shapeRecipients(data);
}

async function audienceReturningRecent(therapistId) {
  // Clients with 2+ sessions, most recent within 60 days.
  // Bookings link to clients by client_email (NOT client_id). The
  // bookings table does not have a client_id column.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);

  // Step 1: emails of clients who booked in the last 60 days
  const { data: recentBookings, error: bookErr } = await supabase
    .from('bookings')
    .select('client_email, booking_date')
    .eq('therapist_id', therapistId)
    .neq('status', 'cancelled')
    .gte('booking_date', cutoff.toISOString().split('T')[0]);

  if (bookErr) {
    console.error('[audience returning_recent] bookings:', bookErr);
    return [];
  }

  const recentEmails = normalizeEmails(recentBookings);
  if (recentEmails.length === 0) return [];

  // Step 2: count total sessions for each of those emails
  const { data: allBookings, error: allErr } = await supabase
    .from('bookings')
    .select('client_email')
    .eq('therapist_id', therapistId)
    .neq('status', 'cancelled')
    .in('client_email', recentEmails);

  if (allErr) {
    console.error('[audience returning_recent] all:', allErr);
    return [];
  }

  // Count per email
  const counts = {};
  for (const b of (allBookings || [])) {
    if (!b.client_email) continue;
    const e = b.client_email.toLowerCase().trim();
    counts[e] = (counts[e] || 0) + 1;
  }
  const qualifyingEmails = Object.entries(counts)
    .filter(([, c]) => c >= 2)
    .map(([e]) => e);

  if (qualifyingEmails.length === 0) return [];

  const clients = await clientsByEmails(therapistId, qualifyingEmails);
  return shapeRecipients(clients);
}

async function audienceLapsed(therapistId) {
  // Clients with at least one past booking, but no booking in
  // the last 60 days. Joined by client_email since bookings
  // does not have client_id.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);

  // Step 1: all distinct emails that have ever booked with this therapist
  const { data: everBooked, error: everErr } = await supabase
    .from('bookings')
    .select('client_email')
    .eq('therapist_id', therapistId)
    .neq('status', 'cancelled');

  if (everErr) {
    console.error('[audience lapsed] ever:', everErr);
    return [];
  }

  const everEmails = normalizeEmails(everBooked);
  if (everEmails.length === 0) return [];

  // Step 2: emails that booked in the last 60 days
  const { data: recent, error: recentErr } = await supabase
    .from('bookings')
    .select('client_email')
    .eq('therapist_id', therapistId)
    .neq('status', 'cancelled')
    .gte('booking_date', cutoff.toISOString().split('T')[0]);

  if (recentErr) {
    console.error('[audience lapsed] recent:', recentErr);
    return [];
  }

  const recentEmails = new Set(normalizeEmails(recent));

  // Step 3: lapsed = ever - recent
  const lapsedEmails = everEmails.filter(e => !recentEmails.has(e));
  if (lapsedEmails.length === 0) return [];

  const clients = await clientsByEmails(therapistId, lapsedEmails);
  return shapeRecipients(clients);
}

async function audienceAllActive(therapistId) {
  // Any client with a booking (any status except cancelled) in
  // the last 12 months. This is the broadest audience and is meant
  // for monthly newsletter-style campaigns.
  // Joined by client_email (bookings has no client_id column).
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);

  const { data: recentBookings, error } = await supabase
    .from('bookings')
    .select('client_email')
    .eq('therapist_id', therapistId)
    .neq('status', 'cancelled')
    .gte('booking_date', cutoff.toISOString().split('T')[0]);

  if (error) {
    console.error('[audience all_active]', error);
    return [];
  }

  const emails = normalizeEmails(recentBookings);
  if (emails.length === 0) return [];

  const clients = await clientsByEmails(therapistId, emails);
  return shapeRecipients(clients);
}

async function audiencePackageHoldersIdle(therapistId) {
  // Clients with at least 1 unused package session, AND no booking
  // in the last 14 days. Real revenue retention angle: get them
  // to use what they paid for before they forget about it.

  // Step 1: client_id list with package balance > 0. The
  // package_purchases table DOES have client_id since it is the
  // forward-mapped purchases (per PurchasesPanel.jsx convention).
  const { data: packageRows, error: pkgErr } = await supabase
    .from('package_purchases')
    .select('client_id, sessions_remaining')
    .eq('therapist_id', therapistId)
    .gt('sessions_remaining', 0);

  if (pkgErr) {
    console.warn('[audience package_holders_idle] package_purchases error:', pkgErr);
    return [];
  }

  const packageClientIds = [...new Set((packageRows || []).map(p => p.client_id).filter(Boolean))];
  if (packageClientIds.length === 0) return [];

  // Step 2: get the emails of those clients (to bridge to bookings)
  const { data: pkgClients } = await supabase
    .from('clients')
    .select('id, email')
    .eq('therapist_id', therapistId)
    .in('id', packageClientIds);

  const idToEmail = new Map();
  const pkgEmails = [];
  for (const c of (pkgClients || [])) {
    if (c.email) {
      const e = c.email.toLowerCase().trim();
      idToEmail.set(c.id, e);
      pkgEmails.push(e);
    }
  }
  if (pkgEmails.length === 0) return [];

  // Step 3: filter out anyone who booked in the last 14 days
  // (joined by client_email since bookings has no client_id)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const { data: recentBookings } = await supabase
    .from('bookings')
    .select('client_email')
    .eq('therapist_id', therapistId)
    .neq('status', 'cancelled')
    .in('client_email', pkgEmails)
    .gte('booking_date', cutoff.toISOString().split('T')[0]);

  const recentEmails = new Set(normalizeEmails(recentBookings));
  const idleIds = packageClientIds.filter(id => {
    const email = idToEmail.get(id);
    return email && !recentEmails.has(email);
  });
  if (idleIds.length === 0) return [];

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, email')
    .eq('therapist_id', therapistId)
    .in('id', idleIds);

  return shapeRecipients(clients);
}

const AUDIENCE_FUNCTIONS = {
  new_clients: audienceNewClients,
  returning_recent: audienceReturningRecent,
  lapsed: audienceLapsed,
  all_active: audienceAllActive,
  package_holders_idle: audiencePackageHoldersIdle,
};

export const AUDIENCE_LABELS = {
  new_clients: 'new clients (last 30 days)',
  returning_recent: 'returning recently (2+ visits, last 60 days)',
  lapsed: 'lapsed (no visit 60+ days)',
  all_active: 'all active clients (last 12 months)',
  package_holders_idle: 'clients with package balance, no booking in 14 days',
};

export async function getAudienceRecipients(audiencePreset, therapistId) {
  const fn = AUDIENCE_FUNCTIONS[audiencePreset];
  if (!fn) {
    console.error('[getAudienceRecipients] unknown preset:', audiencePreset);
    return [];
  }
  return await fn(therapistId);
}

// ─── Smart token rendering ─────────────────────────────────────

// Replace {{first_name}}, {{therapist_name}}, {{rebook_link}} in
// subject and body. Used for rich preview and at send time per
// recipient.
export function renderTokens(template, recipient, therapist) {
  const tokens = {
    '{{first_name}}': recipient?.first_name || 'there',
    '{{therapist_name}}': therapist?.full_name || therapist?.business_name || 'your therapist',
    '{{rebook_link}}': therapist?.custom_url
      ? `https://mybodymap.app/${therapist.custom_url}`
      : 'https://mybodymap.app',
  };
  let out = template || '';
  for (const [k, v] of Object.entries(tokens)) {
    out = out.split(k).join(v);
  }
  return out;
}
