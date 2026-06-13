// src/pages/FounderStocktake.jsx
//
// Live founder stock-take. Three views: Priorities (3 tiers), the 7
// product Ribbons, and the Roadmap (growth, money, exit). Headline
// numbers are pulled live from the database on load; everything else
// is curated judgement that does not belong in a query.
//
// Access is gated by FounderRoute (HK only). Reads cross-therapist
// data via the same browser RLS path FounderDashboard already uses.
// last_sign_in_at lives in auth.users (not browser-readable), so
// "active" is derived from recent activity (bookings, sessions,
// clients created in the window), consistent with the dashboard.
//
// Per design principles: no dropdowns, no window.confirm, never an
// error page. If the live query fails, the curated views still render
// and a quiet line notes the numbers could not load.

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ADMIN_EMAILS } from "../lib/founderAllowlist";

// Same conservative test-account heuristic as FounderDashboard, kept
// in sync by hand. Catches obvious test shapes and the founder inbox.
function isDummyEmail(email) {
  const e = (email || '').toLowerCase().trim();
  if (!e) return true;
  if (ADMIN_EMAILS.has(e)) return true;
  const patterns = [
    /^hk\d*@/, /^test\d*@/, /^demo\d*@/, /^asdf/, /^qwer/,
    /\+test@/, /@test\./, /@example\./, /@email\.com$/,
    /mailinator/, /guerrilla/, /tempmail/, /throwaway/, /\.test$/,
  ];
  return patterns.some((p) => p.test(e));
}

const TABS = [
  { key: 'prio', label: 'Priorities', n: 'A' },
  { key: 'ribbons', label: '7 Ribbons', n: 'B' },
  { key: 'road', label: 'Roadmap', n: 'C' },
];

// curated content -----------------------------------------------------

const TIERS = [
  {
    key: 'p1', label: 'Tier 1 · Now', desc: 'Money, broken, or HIGH risk',
    items: [
      { t: 'Verify pay-link notifications end to end', d: 'Send a $1 link, confirm client receipt + therapist bell/email + "link sent" record all fire. 401 fix deployed, unconfirmed.', rib: '6 · Money', st: ['hk', 'HK action'] },
      { t: 'Stripe Connect webhook for pay-link completion', d: 'Stripe hosted confirm means completion only reaches us via the Connect webhook. Unconfigured = Stripe links sit pending. Square works.', rib: '6 · Money', st: ['hk', 'HK action'] },
      { t: 'Side panel scroll / close / edit fails on mobile', d: 'DetailPanel closes unexpectedly, loses scroll, hides edit affordances on iPhone. Reproduce on mobile-preview first.', rib: '4 · Day-of', eff: '~2 hr', st: ['risk', '\u25B2 Risk #7'] },
      { t: 'Notification routing fires wrong template', d: 'C2 fires as C1; C11 fires as no-fee notice not payment request. Gate on outcome + charge status.', rib: '5 · Relationships', eff: '~1.5 hr', st: ['risk', '\u25B2 Risk #2'] },
      { t: 'Client BookingManage / self-cancel broken', d: 'Magic link points at /booking/manage which renders empty. Blocks the client self-cancel flow.', rib: '1 · Find & Book', eff: '~2 hr', st: ['risk', '\u25B2 Risk #3'] },
      { t: 'BETAONE coupon should be duration=forever', d: 'Founding therapists get charged at month 13 as written. Trust + revenue risk. Fix in Stripe coupon config.', rib: '6 · Money', eff: '10 min', st: ['hk', 'HK action'] },
      { t: '62-therapist product_update broadcast re-send', d: 'Edge fix live, draft preserved in localStorage, never re-attempted. The audience is waiting.', rib: '7 · On Your Phone', eff: '15 min', st: ['fly', 'in flight'] },
    ],
  },
  {
    key: 'p2', label: 'Tier 2 · Next', desc: 'High leverage, build-ready',
    items: [
      { t: 'Activation: first-session aha + setup checklist', d: 'The retention fix. On import, show the heatmap on their own clients + a lapsed list + what they are owed, within 5 minutes. Maria checklist guides setup.', rib: '3 + 4', eff: '~half day', st: ['build', 'elevated'] },
      { t: 'Coupon Phase 2 + referral rewards (A6)', d: 'Per-client referral links + reward config. The community\u2019s #2 ask. Two-sided growth loop.', rib: '5 · Relationships', eff: '2-3 hr', st: ['build', 'queued'] },
      { t: 'Client login via magic link', d: 'Recurring ask. Optional passwordless portal: pre-fill booking, next appt, balances, history. Guest booking stays.', rib: '1 · Find & Book', eff: 'half day', st: ['build', 'queued'] },
      { t: 'Inline ClientPicker in CheckoutModal', d: 'Recovers NULL-client_id bookings self-serve. Pairs with the import fix to close the loop.', rib: '6 · Money', eff: '~90 min', st: ['build', 'queued'] },
      { t: 'Billing redesign + reconciliation, Phase A', d: 'Maria daily page, receipt cards, and "did I get paid this month?" Money clarity is the strongest habit hook.', rib: '6 · Money', eff: '~3 hr', st: ['build', 'queued'] },
      { t: 'Edit-block UX + blocked_days unique constraint', d: 'Stop delete-and-recreate (Jacquie\u2019s duplicate blocks). Add DB-level dedup.', rib: '1 · Find & Book', eff: '~1 hr', st: ['risk', '\u25B2 Risk #6'] },
      { t: 'Cancellation policy Phase 2 (auto-charge)', d: 'SetupIntent card capture + auto-charge on late cancel / reschedule / no-show. Marketing already promises it.', rib: '6 · Money', eff: 'half day+', st: ['build', 'queued'] },
      { t: 'Production intake wire-up for custom schemas', d: 'IntakeEditor saves but clients still see hardcoded fields. Surgical change in the 4,649-line Demo.jsx.', rib: '2 · Know Client', eff: '3-4 hr', st: ['build', 'queued'] },
      { t: 'BYO-Twilio onboarding for therapists', d: 'Client SMS needs each therapist\u2019s own Twilio (platform A2P stuck in TCR). Unlocks SMS reminders in prod.', rib: '5 · Relationships', eff: 'half day', st: ['build', 'queued'] },
      { t: 'Founder transactions view (Square + Stripe)', d: 'You cannot see Jacquie\u2019s Square charges from your side. square-list-transactions exists, needs a founder UI.', rib: '6 · Money', eff: '~2 hr', st: ['build', 'queued'] },
    ],
  },
  {
    key: 'p3', label: 'Tier 3 · Later', desc: 'Scale, polish, distribution',
    items: [
      { t: 'Per-therapist SEO landing pages', d: 'Auto-generate indexable pages from services + location + bio. Compounding growth loop.', rib: 'distribution', eff: '~half day' },
      { t: '14 .in() unbounded array sites', d: '650+ IDs builds a 30KB URL, Postgres 400s silently. Chunked queries queued.', rib: 'infra', st: ['risk', '\u25B2 Risk #1'] },
      { t: 'AI growth-moments calendar (full build)', d: 'Calendar moments x client intelligence x outreach. Seed shipped, full build behind traction.', rib: '5 · Relationships', eff: 'scoping' },
      { t: 'Apple Pay / Google Pay wallet methods', d: 'Payment Element wallet surfacing. Handles the demographic split automatically. ACH dropped on purpose.', rib: '6 · Money', eff: '~1 day' },
      { t: 'Server-side chunked imports', d: 'Client-side resumable covers ~5K rows. import_jobs + edge chunks needed at 50K+ scale.', rib: '2 · Know Client', eff: '4-5 hr' },
      { t: 'Photo / upload import', d: 'Drop a zip of client photos, match by filename, store in bucket.', rib: '2 · Know Client', eff: '~2 hr' },
      { t: 'Card-on-file migration flag + email', d: 'Imported clients get a re-enter-your-card prompt on first booking. Token cannot transfer (PCI).', rib: '6 · Money', eff: '30 min' },
      { t: 'Niche-finder + pricing benchmark coaching', d: 'Your niche is a community with shared issues, not modalities. Inline pricing-vs-region pill.', rib: '1 · Find & Book', eff: 'scoping' },
      { t: 'ChevronPill standardization sweep', d: 'One CollapsibleCard primitive, replace remaining thin chevrons. Single design grammar.', rib: 'UI', eff: '2-3 hr' },
      { t: 'PWA stale-bundle hardening', d: 'iOS caches the installed PWA. SW v35 banner narrows the window but v33 users may never get v35.', rib: '7 · On Your Phone', st: ['risk', '\u25B2 Risk #4/8'] },
      { t: 'Cloudflare email loop fix', d: 'Welcome BCC loops through reminders@. Switch to +tag or drop it.', rib: 'ops', eff: '30 min' },
      { t: 'Lint + dual-source cleanups', d: 'no-use-before-define (Risk #9), validActions = keys(templates) (Risk #10), orphan modals.', rib: 'infra', st: ['risk', '\u25B2 Risk #9/10'] },
      { t: 'Distribution content engine', d: 'Reddit launch post (drafted), FB access to restore, comparison printable for AMTA handouts.', rib: 'distribution', st: ['fly', 'ongoing'] },
      { t: 'Photo / consent Phase 2-3 (OCR, promote)', d: 'Vision OCR fills name/phone onto consent rows, promote to client on rebook.', rib: '2 · Know Client', eff: 'scoping' },
    ],
  },
];

const RIBBONS = [
  { n: 1, name: 'Find & Book', built: 78, meta: '11 shipped \u00B7 mostly table stakes, 3 differentiators', gap: 'Self-serve client flow is the gap: BookingManage / magic-link login.', opens: [['Client BookingManage broken', 'hot'], ['Client login via magic link', 'warm'], ['Edit-block UX + dedup', 'warm'], ['Niche + pricing coaching', '']] },
  { n: 2, name: 'Know Your Client', built: 82, meta: '8 shipped \u00B7 body-map intake + migration are the moat', gap: 'Custom intake saves but does not render live to clients yet.', opens: [['Production intake wire-up', 'warm'], ['Event consent uploads', 'warm'], ['Photo / zip import', ''], ['Server-side chunked import', '']] },
  { n: 3, name: 'Client Intelligence', built: 90, meta: '5 shipped \u00B7 4 of 5 differentiated, strongest moat', gap: 'Most built-out ribbon. Surface it on day one to fix activation.', opens: [['Aha-on-import (heatmap)', 'warm'], ['Reconciliation overlap', '']] },
  { n: 4, name: 'Day-of-Session', built: 80, meta: '6 shipped \u00B7 cockpit + care-framed insights', gap: 'The mobile side panel intermittently fails. HIGH severity.', opens: [['Side panel mobile failure', 'hot'], ['Insight copy tuning', '']] },
  { n: 5, name: 'Relationships', built: 74, meta: '9 shipped \u00B7 campaigns + lapsed outreach differentiate', gap: 'Notifications route wrong template; referral system still manual; SMS blocked.', opens: [['Notification routing C2/C11', 'hot'], ['Coupon Phase 2 + referral A6', 'warm'], ['BYO-Twilio onboarding', 'warm'], ['AI growth-moments', '']] },
  { n: 6, name: 'Money & Protection', built: 70, meta: '7 shipped \u00B7 dual-processor + real cancellation enforcement', gap: 'Pay-link completion unverified; auto-charge not wired; no payments revenue yet. This ribbon holds the monetization levers.', opens: [['Verify pay-link notifications', 'hot'], ['Stripe Connect webhook', 'hot'], ['BETAONE coupon duration', 'hot'], ['Payments revenue model', 'warm'], ['Cancellation Phase 2', 'warm'], ['Reconciliation view', 'warm'], ['Founder transactions', 'warm']] },
  { n: 7, name: 'On Your Phone', built: 76, meta: '5 shipped \u00B7 PWA + founder voice channel', gap: 'PWA stale-bundle risk on iOS; broadcast re-send still pending.', opens: [['62-send broadcast re-send', 'hot'], ['PWA stale-bundle hardening', 'warm'], ['Push when client logs in', '']] },
];

const VECTORS = [
  { i: '\uD83D\uDED2', t: 'New-client marketplace fee', tag: ['big', 'biggest'], d: 'Surface therapists to clients searching by area + need, charge a fee only on a new client\u2019s first booking. Therapists pay for clients (that is CAC) even when they will not pay a subscription. Fresha / Booksy model, and a two-sided growth loop.' },
  { i: '\uD83D\uDCB3', t: 'Payments spread', tag: ['big', 'biggest'], d: 'A small percent on processing, framed as "we win when you get paid." At ~$100 tickets this can exceed subscription revenue, is sticky, and earns a higher exit multiple. Decision: merchant-of-record vs take-rate on Connect.' },
  { i: '\uD83C\uDFE6', t: 'Embedded fintech', tag: ['mid', 'later, high margin'], d: 'Instant payouts (fee for same-day), cash advance against future bookings (Square Capital model), a therapist card. Highest-margin attach once payment volume exists.' },
  { i: '\uD83C\uDF81', t: 'Gift card float + breakage', tag: ['mid', 'easy'], d: 'Unredeemed gift cards are real money, and the float sits with the platform. You already sell gift cards. Add the economics.' },
  { i: '\uD83E\uDDFE', t: 'Insurance billing + superbills', tag: ['mid', 'willing to pay'], d: 'Many therapists want reimbursement help. Jane App monetizes this. A feature the serious practices pay for directly.' },
  { i: '\uD83D\uDCC8', t: 'Power-user add-ons', tag: ['now', 'now-ish'], d: 'Multi-location / staff seats (Terra runs 3 businesses), SMS credits with margin, extra AI, custom domain, premium campaigns. Charge the practices that grow, not the strugglers.' },
  { i: '\uD83E\uDD1D', t: 'Vendor affiliate marketplace', tag: ['now', 'low effort'], d: 'They need E&O insurance, supplies, CE credits, card readers. Refer, earn. You know exactly what they need and when.' },
];

const RETENTION = [
  ['Deliver an aha on their own data in 5 minutes', 'The second the import finishes, show the body-map heatmap on their real clients, the lapsed list with one-tap outreach, and a "here is what you are owed" reconciliation. Make the moat visible immediately, not three sessions in.'],
  ['Activate the booking page, hard', 'Many have zero bookings because the link was never shared. Bookings flowing in is what creates the habit. Push share + QR as the single most important setup step.'],
  ['A weekly reason to return', 'Practice Pulse email (crons now fixed) + growth insights pull them back with something useful, never nagging. The 70yo persona returns for care prompts, not dashboards.'],
  ['Founder concierge for the heavy importers', 'The practices that imported 300+ clients then left are your warmest leads. A 15-minute personal reach-out can reactivate them. Candice (left after the data incident) is recoverable with care.'],
];

const SIGNUPS = [
  ['Be present in the buying conversations', 'FB massage communities, Reddit, the MassageBook-refugee threads. Empathy first, one differentiator (free Bronze + visual body map), never deflate a competitor.'],
  ['Build the two-sided loop', 'Per-therapist SEO pages + a new-client marketplace mean clients find therapists, therapists get free clients, and they invite peers. Growth that compounds without ad spend.'],
  ['Therapist-to-therapist referral (A6)', 'The community already trades "free massage for referrals." Build it native. Cheapest acquisition channel you have.'],
];

const WHO = ['EverCommerce (vertical-SaaS roll-up)', 'Mindbody', 'Vagaro', 'WellnessLiving', 'Booksy / Fresha', 'Jane App', 'PE wellness platforms'];

// styles --------------------------------------------------------------

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;500&display=swap');
.sk-root{--cream:#F5F1E8;--cream-deep:#ECE5D6;--card:#FBF9F3;--ink:#222C26;--ink-soft:#5A655D;--forest:#2E4636;--sage:#6F9079;--sage-soft:#DEE8DF;--amber:#B57F33;--amber-soft:#F1E4C8;--clay:#A9543F;--clay-soft:#EED9D1;--slate:#8B948C;--line:#E2DBCB;--shadow:0 1px 2px rgba(34,44,38,.05),0 6px 20px rgba(34,44,38,.06);background:var(--cream);color:var(--ink);min-height:100vh;font-family:'Inter',system-ui,-apple-system,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased;padding-bottom:56px;}
.sk-serif{font-family:'Fraunces',Georgia,serif;}
.sk-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;}
.sk-wrap{max-width:1180px;margin:0 auto;padding:0 18px;}
.sk-head{position:relative;overflow:hidden;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#fbf9f3,#f5f1e8);}
.sk-sil{position:absolute;right:-10px;top:-30px;width:220px;opacity:.06;pointer-events:none;}
.sk-hi{padding:28px 0 22px;position:relative;z-index:2;}
.sk-kick{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--sage);font-weight:500;}
.sk-h1{font-weight:500;font-size:clamp(26px,5vw,40px);line-height:1.05;letter-spacing:-.01em;margin:6px 0 8px;color:var(--forest);}
.sk-sub{color:var(--ink-soft);font-size:15px;max-width:640px;}
.sk-meta{margin-top:14px;display:flex;flex-wrap:wrap;gap:8px 16px;font-size:11.5px;color:var(--slate);}
.sk-meta b{color:var(--ink);font-weight:500;}
.sk-meta .live{color:var(--sage);}
.sk-tabs{position:sticky;top:0;z-index:20;background:rgba(245,241,232,.93);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);}
.sk-tabs-in{display:flex;gap:4px;max-width:1180px;margin:0 auto;padding:8px 14px;flex-wrap:wrap;}
.sk-tab{appearance:none;border:0;background:transparent;cursor:pointer;font-family:inherit;font-size:14px;font-weight:500;color:var(--ink-soft);padding:9px 16px;border-radius:999px;transition:.18s;display:flex;align-items:center;gap:8px;}
.sk-tab:hover{color:var(--ink);background:var(--cream-deep);}
.sk-tab.on{background:var(--forest);color:#fff;}
.sk-tab .n{font-size:11px;opacity:.7;}
.sk-vh{margin:24px 0 18px;}
.sk-vh h2{font-family:'Fraunces',Georgia,serif;font-weight:500;font-size:22px;color:var(--forest);}
.sk-vh p{color:var(--ink-soft);font-size:14px;margin-top:3px;max-width:760px;}
.sk-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
@media(max-width:820px){.sk-cols{grid-template-columns:1fr;}}
.sk-col{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;box-shadow:var(--shadow);}
.sk-ch{display:flex;align-items:baseline;justify-content:space-between;padding:2px 4px 12px;border-bottom:1px solid var(--line);margin-bottom:12px;}
.sk-ch .lbl{font-family:'Fraunces',Georgia,serif;font-size:18px;font-weight:600;}
.sk-ch .desc{font-size:11.5px;color:var(--ink-soft);}
.sk-ch .ct{font-size:12px;color:#fff;padding:2px 9px;border-radius:999px;}
.sk-p1 .ct{background:var(--clay);}.sk-p2 .ct{background:var(--amber);}.sk-p3 .ct{background:var(--sage);}
.sk-p1 .lbl{color:var(--clay);}.sk-p2 .lbl{color:var(--amber);}.sk-p3 .lbl{color:var(--sage);}
.sk-item{padding:11px;border-radius:11px;margin-bottom:8px;background:var(--cream);border:1px solid transparent;transition:.15s;}
.sk-item:hover{border-color:var(--line);background:#fff;}
.sk-item .t{font-size:13.5px;font-weight:600;line-height:1.3;}
.sk-item .d{font-size:12px;color:var(--ink-soft);margin-top:3px;}
.sk-foot{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;align-items:center;}
.sk-chip{font-size:10.5px;padding:2px 7px;border-radius:6px;font-weight:500;white-space:nowrap;}
.sk-rib{background:var(--sage-soft);color:var(--forest);}
.sk-eff{background:var(--cream-deep);color:var(--ink-soft);}
.sk-risk{background:var(--clay-soft);color:var(--clay);}
.sk-fly{background:var(--amber-soft);color:var(--amber);}
.sk-hk{background:#E5E0F0;color:#5b4d8a;}
.sk-build{background:var(--sage-soft);color:var(--forest);}
.sk-ribbon{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:10px;box-shadow:var(--shadow);display:grid;grid-template-columns:54px 1fr;gap:14px;align-items:start;}
.sk-rnum{width:54px;height:54px;border-radius:13px;background:var(--forest);color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Fraunces',Georgia,serif;font-size:24px;font-weight:600;}
.sk-rname{font-family:'Fraunces',Georgia,serif;font-size:18px;font-weight:600;color:var(--forest);}
.sk-rmeta{font-size:11px;color:var(--slate);margin:2px 0 8px;}
.sk-bar{height:6px;background:var(--cream-deep);border-radius:999px;overflow:hidden;margin:0 0 10px;max-width:260px;}
.sk-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--sage),var(--forest));border-radius:999px;}
.sk-rgap{font-size:12.5px;color:var(--ink-soft);margin-bottom:8px;}
.sk-rgap b{color:var(--clay);font-weight:600;}
.sk-opens{display:flex;flex-wrap:wrap;gap:6px;}
.sk-open{font-size:11.5px;padding:3px 9px;border-radius:7px;background:var(--cream);border:1px solid var(--line);color:var(--ink);}
.sk-open.hot{border-color:var(--clay-soft);background:var(--clay-soft);color:var(--clay);}
.sk-open.warm{border-color:var(--amber-soft);background:#FBF4E4;color:var(--amber);}
.sk-road{display:grid;gap:14px;}
.sk-panel{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 20px;box-shadow:var(--shadow);}
.sk-panel h3{font-family:'Fraunces',Georgia,serif;font-size:18px;font-weight:600;color:var(--forest);display:flex;align-items:center;gap:9px;margin-bottom:4px;}
.sk-mk{font-size:12px;color:#fff;background:var(--sage);min-width:24px;height:24px;padding:0 6px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;font-weight:500;}
.sk-panel p{font-size:14px;color:var(--ink);margin-top:7px;}
.sk-panel p.muted{color:var(--ink-soft);font-size:13px;}
.sk-panel .hl{color:var(--clay);font-weight:600;}
.sk-g4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:6px;}
@media(max-width:680px){.sk-g4{grid-template-columns:1fr 1fr;}}
.sk-stat{background:var(--cream);border:1px solid var(--line);border-radius:12px;padding:12px 14px;}
.sk-stat .big{font-family:'Fraunces',Georgia,serif;font-size:24px;font-weight:600;color:var(--forest);line-height:1.1;}
.sk-stat .cap{font-size:11.5px;color:var(--ink-soft);margin-top:3px;}
.sk-v{display:grid;grid-template-columns:34px 1fr;gap:12px;padding:11px 0;border-top:1px solid var(--line);}
.sk-v:first-child{border-top:0;}
.sk-vi{font-size:18px;}
.sk-vt{font-size:14px;font-weight:600;}
.sk-vtag{font-size:10.5px;font-weight:500;padding:2px 7px;border-radius:6px;margin-left:7px;vertical-align:middle;}
.sk-tag-now{background:var(--clay-soft);color:var(--clay);}
.sk-tag-mid{background:var(--amber-soft);color:var(--amber);}
.sk-tag-big{background:var(--sage-soft);color:var(--forest);}
.sk-vd{font-size:13px;color:var(--ink-soft);margin-top:2px;}
.sk-lever{background:linear-gradient(135deg,#2E4636,#3c5a47);color:#fff;border:0;}
.sk-lever h3{color:#fff;}.sk-lever .sk-mk{background:rgba(255,255,255,.18);}
.sk-lever p{color:rgba(255,255,255,.92);}
.sk-hl2{color:#F1E4C8;font-weight:600;}
.sk-steps{margin-top:6px;}
.sk-step{display:grid;grid-template-columns:30px 1fr;gap:12px;padding:11px 0;border-top:1px solid var(--line);}
.sk-step:first-child{border-top:0;}
.sk-sn{font-size:13px;font-weight:500;color:#fff;background:var(--forest);width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;}
.sk-st-t{font-size:14px;font-weight:600;}
.sk-st-d{font-size:13px;color:var(--ink-soft);margin-top:2px;}
.sk-two{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
@media(max-width:760px){.sk-two{grid-template-columns:1fr;}}
.sk-opp{border-left:4px solid var(--sage);}
.sk-threat{border-left:4px solid var(--clay);}
.sk-who{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;}
.sk-who span{font-size:12px;padding:4px 11px;border-radius:999px;background:var(--cream);border:1px solid var(--line);}
.sk-cav{font-size:12px;color:var(--slate);border-left:3px solid var(--line);padding:4px 0 4px 12px;margin-top:4px;}
.sk-foot-b{margin-top:32px;padding:18px 0;border-top:1px solid var(--line);font-size:11px;color:var(--slate);display:flex;flex-wrap:wrap;gap:6px 18px;justify-content:space-between;}
`;

function stClass(kind) {
  return { risk: 'sk-risk', fly: 'sk-fly', hk: 'sk-hk', build: 'sk-build' }[kind] || 'sk-build';
}
function tagClass(kind) {
  return { big: 'sk-tag-big', mid: 'sk-tag-mid', now: 'sk-tag-now' }[kind] || 'sk-tag-big';
}

export default function FounderStocktake() {
  const [tab, setTab] = useState('prio');
  const [m, setM] = useState({ loaded: false, ok: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
        const since14 = new Date(Date.now() - 14 * 86400000).toISOString();
        const [thRes, bkRes, seRes, clRes] = await Promise.all([
          supabase.from('therapists').select('id,email,subscription_status,stripe_account_connected,square_connected'),
          supabase.from('bookings').select('therapist_id,created_at'),
          supabase.from('sessions').select('therapist_id,created_at'),
          supabase.from('clients').select('therapist_id,created_at'),
        ]);
        if (thRes.error) throw thRes.error;
        const ths = thRes.data || [];
        const realIds = new Set(ths.filter((t) => !isDummyEmail(t.email)).map((t) => t.id));
        const bookings = bkRes.data || [];
        const everBooked = new Set(bookings.map((b) => b.therapist_id));
        const a30 = new Set();
        const a14 = new Set();
        const mark = (tid, ts) => {
          if (!tid || !ts) return;
          if (ts >= since30) a30.add(tid);
          if (ts >= since14) a14.add(tid);
        };
        bookings.forEach((b) => mark(b.therapist_id, b.created_at));
        (seRes.data || []).forEach((s) => mark(s.therapist_id, s.created_at));
        (clRes.data || []).forEach((c) => mark(c.therapist_id, c.created_at));
        const real = (set) => [...set].filter((id) => realIds.has(id)).length;
        if (!cancelled) {
          setM({
            loaded: true, ok: true,
            signups: ths.length,
            real: realIds.size,
            everBooked: real(everBooked),
            active30: real(a30),
            active14: real(a14),
            paying: ths.filter((t) => t.subscription_status === 'active').length,
            processor: ths.filter((t) => t.stripe_account_connected || t.square_connected).length,
          });
        }
      } catch (e) {
        if (!cancelled) setM({ loaded: true, ok: false });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const val = (k, fallback) => (m.ok && m[k] != null ? m[k] : fallback);

  return (
    <div className="sk-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="sk-head">
        <svg className="sk-sil" viewBox="0 0 100 220" aria-hidden="true">
          <circle cx="50" cy="22" r="18" fill="#2E4636" />
          <path d="M50 42 C30 42 26 56 26 76 L22 130 L30 132 L36 86 L36 210 L46 210 L48 140 L52 140 L54 210 L64 210 L64 86 L70 132 L78 130 L74 76 C74 56 70 42 50 42 Z" fill="#2E4636" />
        </svg>
        <div className="sk-wrap sk-hi">
          <div className="sk-kick sk-mono">MyBodyMap · Founder command center</div>
          <h1 className="sk-h1 sk-serif">Where everything stands</h1>
          <p className="sk-sub">What is left, two ways: by priority and by ribbon. Plus the read on growth, money, and the exit. Headline numbers are live.</p>
          <div className="sk-meta sk-mono">
            <span className="live">{m.loaded ? (m.ok ? 'Live from prod' : 'Live numbers unavailable, showing plan') : 'Loading live numbers...'}</span>
            <span>Signups <b>{val('signups', '\u2013')}</b></span>
            <span>Real (heuristic) <b>{val('real', '\u2013')}</b></span>
            <span>Ever booked <b>{val('everBooked', '\u2013')}</b></span>
            <span>Active 30d <b>{val('active30', '\u2013')}</b></span>
            <span>Paying <b>{val('paying', '\u2013')}</b></span>
            <span>Processor <b>{val('processor', '\u2013')}</b></span>
          </div>
        </div>
      </header>

      <nav className="sk-tabs">
        <div className="sk-tabs-in">
          {TABS.map((t) => (
            <button key={t.key} className={'sk-tab' + (tab === t.key ? ' on' : '')} onClick={() => { setTab(t.key); window.scrollTo({ top: 0 }); }}>
              <span className="n sk-mono">{t.n}</span>{t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="sk-wrap">

        {tab === 'prio' && (
          <div>
            <div className="sk-vh">
              <h2>By priority</h2>
              <p>Three tiers. Tier 1 is revenue-blocking, customer-facing-broken, or HIGH risk. Tier 2 is high-leverage and build-ready. Tier 3 is scale, polish, and distribution. Risk-register items carry a marker.</p>
            </div>
            <div className="sk-cols">
              {TIERS.map((col) => (
                <div key={col.key} className={'sk-col sk-' + col.key}>
                  <div className="sk-ch"><div><div className="lbl">{col.label}</div><div className="desc">{col.desc}</div></div><span className="ct sk-mono">{col.items.length}</span></div>
                  {col.items.map((it, i) => (
                    <div key={i} className="sk-item">
                      <div className="t">{it.t}</div>
                      <div className="d">{it.d}</div>
                      <div className="sk-foot">
                        <span className="sk-chip sk-rib sk-mono">{it.rib}</span>
                        {it.eff && <span className="sk-chip sk-eff sk-mono">{it.eff}</span>}
                        {it.st && <span className={'sk-chip sk-mono ' + stClass(it.st[0])}>{it.st[1]}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="sk-panel" style={{ marginTop: 16 }}>
              <h3><span className="sk-mk sk-mono">!</span>Founder / external track (sitting since May)</h3>
              <p className="muted">Not codeable, but real diligence gates: <b>E&O / Tech E&O insurance</b> (single highest-leverage purchase), <b>LLC veil + signed operating agreement</b>, <b>ToS attorney review</b>, <b>MyBodyMap trade-name filing</b>, <b>security/reliability page</b>. These matter in an exit. Worth a half day this month.</p>
            </div>
          </div>
        )}

        {tab === 'ribbons' && (
          <div>
            <div className="sk-vh">
              <h2>By ribbon</h2>
              <p>The seven product categories. Bar shows roughly how built-out each ribbon is. Differentiator ribbons (3, 6, plus the migration moat in 2 and 7) protect the multiple. Red chips are open Tier-1 items.</p>
            </div>
            {RIBBONS.map((r) => (
              <div key={r.n} className="sk-ribbon">
                <div className="sk-rnum">{r.n}</div>
                <div>
                  <div className="sk-rname">{r.name}</div>
                  <div className="sk-rmeta sk-mono">{r.meta}</div>
                  <div className="sk-bar"><i style={{ width: r.built + '%' }} /></div>
                  <div className="sk-rgap">{r.gap}</div>
                  <div className="sk-opens">
                    {r.opens.map((o, i) => (<span key={i} className={'sk-open ' + (o[1] || '')}>{o[0]}</span>))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'road' && (
          <div>
            <div className="sk-vh">
              <h2>Growth, money, and the exit</h2>
              <p>The honest read, grounded in live prod numbers. Ranges, not promises. Strategy, not financial advice.</p>
            </div>
            <div className="sk-road">

              <div className="sk-panel">
                <h3><span className="sk-mk sk-mono">1</span>Reality, from the database</h3>
                <div className="sk-g4">
                  <div className="sk-stat"><div className="big">{val('signups', '\u2013')}</div><div className="cap">therapist signups (some are yours / test)</div></div>
                  <div className="sk-stat"><div className="big">{val('everBooked', '\u2013')}</div><div className="cap">real practices that ever booked</div></div>
                  <div className="sk-stat"><div className="big">{val('active30', '\u2013')}</div><div className="cap">real practices active in 30 days</div></div>
                  <div className="sk-stat"><div className="big">{val('paying', 0)}</div><div className="cap">paying. {val('processor', '\u2013')} connected a processor</div></div>
                </div>
                <p>The leak is not signups, it is <span className="hl">import-then-ghost</span>. Several practices brought in real rosters then vanished: one imported 606 clients and booked nothing, another 309 then never returned, another 284 clients and 496 bookings then gone. They invested effort to evaluate, looked around once, and left. That is a time-to-value problem, and the hottest reactivation list you have.</p>
                <p className="muted">"Real" excludes test accounts by the same heuristic the founder dashboard uses, so it is approximate. Active is derived from recent activity, since sign-in time is not browser-readable.</p>
              </div>

              <div className="sk-panel sk-lever">
                <h3><span className="sk-mk sk-mono">{'\u2605'}</span>Beyond charging therapists: monetize the transaction and the growth</h3>
                <p>You are right that solo therapists have thin margins and resist subscriptions. Every winner here (Square, Toast, Fresha, GlossGenius) figured this out: <span className="sk-hl2">do not tax the seat, tax the value you create.</span> "We only make money when you make money" is both the better model and the best defense against the backlash that hit MassageBook. Subscription becomes a small floor or stays free; these become the engine:</p>
                {VECTORS.map((v, i) => (
                  <div key={i} className="sk-v">
                    <div className="sk-vi">{v.i}</div>
                    <div>
                      <div className="sk-vt">{v.t}<span className={'sk-vtag sk-mono ' + tagClass(v.tag[0])}>{v.tag[1]}</span></div>
                      <div className="sk-vd" style={{ color: 'rgba(255,255,255,.78)' }}>{v.d}</div>
                    </div>
                  </div>
                ))}
                <p style={{ color: 'rgba(255,255,255,.75)', fontSize: 13 }}>The two marked "biggest" are the exit-defining ones. The rest are margin and stickiness on top.</p>
              </div>

              <div className="sk-panel">
                <h3><span className="sk-mk sk-mono">2</span>Retention: close the import-then-ghost leak</h3>
                <div className="sk-steps">
                  {RETENTION.map((s, i) => (
                    <div key={i} className="sk-step"><div className="sk-sn sk-mono">{i + 1}</div><div><div className="sk-st-t">{s[0]}</div><div className="sk-st-d">{s[1]}</div></div></div>
                  ))}
                </div>
              </div>

              <div className="sk-panel">
                <h3><span className="sk-mk sk-mono">3</span>Signups: go where they already shop</h3>
                <div className="sk-steps">
                  {SIGNUPS.map((s, i) => (
                    <div key={i} className="sk-step"><div className="sk-sn sk-mono">{i + 1}</div><div><div className="sk-st-t">{s[0]}</div><div className="sk-st-d">{s[1]}</div></div></div>
                  ))}
                </div>
              </div>

              <div className="sk-two">
                <div className="sk-panel sk-opp">
                  <h3><span className="sk-mk sk-mono">{'\u2197'}</span>The MassageBook moment is an opening</h3>
                  <p className="muted">MassageBook raised prices and the community is openly angry and shopping right now. That is the single best signup window available. Free Bronze + "switch in minutes" + the import moat is the exact answer to the question they are asking out loud. Ride it deliberately: comparison content, presence in the threads, white-glove switch help.</p>
                </div>
                <div className="sk-panel sk-threat">
                  <h3><span className="sk-mk sk-mono">!</span>What could turn the community against us</h3>
                  <p className="muted">Same thing that burned MassageBook: surprise price hikes, locking data in, and above all <b style={{ color: 'var(--clay)' }}>money going wrong</b>, a payout that does not arrive or a wrong charge. Defenses: never surprise-charge, keep export effortless, be impeccable on payouts, keep support human. The "we win when you win" model is itself the best insurance. This is exactly why verifying pay-link notifications and shipping reconciliation are Tier 1.</p>
                </div>
              </div>

              <div className="sk-panel">
                <h3><span className="sk-mk sk-mono">4</span>The exit math, with the new model</h3>
                <p className="muted">A $100M exit in 2026 vertical SaaS lands around 5x to 8x ARR for a quality, retentive asset. Subscription-only on thin-margin solos asks for tens of thousands of payers, a 5+ year grind. The transaction + marketplace + fintech model is what makes the number reachable, because revenue per active practice moves from ~$300/yr to $1,000 to $2,000+/yr.</p>
                <div className="sk-g4">
                  <div className="sk-stat"><div className="big">$12M-$20M</div><div className="cap">ARR at a 5x to 8x multiple</div></div>
                  <div className="sk-stat"><div className="big">~40k-65k</div><div className="cap">payers if subscription-only</div></div>
                  <div className="sk-stat"><div className="big">~10k-15k</div><div className="cap">active practices with the new model</div></div>
                  <div className="sk-stat"><div className="big">350k-400k</div><div className="cap">US licensed massage therapists</div></div>
                </div>
                <p className="muted" style={{ marginTop: 10 }}>Your moat (body-map heatmaps, pattern intelligence) is a data moat, not a thin AI wrapper, which protects the multiple in a market that now discounts wrappers to 1.5 to 2x. Lean into it.</p>
              </div>

              <div className="sk-panel">
                <h3><span className="sk-mk sk-mono">5</span>Who buys this</h3>
                <p className="muted">Strategics pay a 1.5x to 2x premium over private equity. Likely doors:</p>
                <div className="sk-who">{WHO.map((w, i) => (<span key={i}>{w}</span>))}</div>
                <p className="sk-cav">Market-size figures vary widely by source (massage-specific software read anywhere from ~$270M to over $1.4B by definition). Multiples move quarterly. Every number here is a planning range, not a forecast. Not financial or legal advice.</p>
              </div>

            </div>
          </div>
        )}

        <div className="sk-foot-b sk-mono">
          <span>MyBodyMap · internal stock-take</span>
          <span>Tier 1: 7 · Tier 2: 10 · Tier 3: 14 · Risk register: 10 open</span>
          <span>Numbers live from prod</span>
        </div>
      </main>
    </div>
  );
}
