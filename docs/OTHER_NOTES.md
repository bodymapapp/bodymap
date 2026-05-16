# Other Notes

**Last updated:** May 16, 2026
**Purpose:** Catch-all for documentation that does not fit the other ten sections of the Founder Hub. Anything that needs to be written down but does not yet have a permanent home.

When something here grows past a few paragraphs, promote it to its own document and link from here.

---

## Research library

Permanent research artifacts that do not need their own Founder Hub section but should be findable when relevant. View on GitHub or fetch via the Founder Hub backup download.

| Document | Topic | Trigger to revisit |
|---|---|---|
| [docs/CUSTOMER_CHAT_RESEARCH.md](https://github.com/bodymapapp/bodymap/blob/main/docs/CUSTOMER_CHAT_RESEARCH.md) | Customer service chat options analysis. Seven options evaluated (help center, search, self-hosted LLM, hybrid, email-first, extractive RAG, third-party widgets). Stage 1 recommendation: email-first plus help center. Architecture for Stage 2 ready when triggered. | HK responds to over 30 emails/week, OR 500+ active therapists, OR a founding therapist explicitly requests chat |
| [docs/HELP_ARTICLES_GUIDE.md](https://github.com/bodymapapp/bodymap/blob/main/docs/HELP_ARTICLES_GUIDE.md) | Maintenance guide for the public help center at /help. Covers the markdown-to-bundle-to-UI pipeline, editorial rules (MyBodyMap brand voice / we / never a fictional individual, no em dashes, MyBodyMap not BodyMap), the article taxonomy mapping table (which articles map to which feature cards), the "when a feature ships, update matching articles" process, frontmatter format, and how to add or remove articles. | Whenever a feature in FEATURES_TAXONOMY.md changes meaningfully and might affect a help article; whenever new help articles are added; whenever the help center architecture is reconsidered |
| [docs/PAYMENT_QA_CHECKLIST.md](https://github.com/bodymapapp/bodymap/blob/main/docs/PAYMENT_QA_CHECKLIST.md) | Comprehensive verification checklist for all four processor configurations (Square only, Stripe only, both connected, both disconnected). Each config covers therapist setup, booking page flows, cancellation, refunds, offers, billing dashboard, and edge cases. Used to confirm payment parity before declaring features battle-tested. | Whenever a major payment change ships (new processor, new payment method, routing logic change). Re-run the entire checklist for any meaningful change to the payment surface area |

When new research artifacts get written (competitive deep-dives, market analyses, technical scoping docs), add a row above with the trigger condition for revisiting.

---

## Active scratchpad

This section is for notes during the working week. Older items get archived below or promoted to permanent docs.

### Friday May 9 prep checklist

For the Square activation appointment with mom.
- Confirm mom has photo ID ready
- Confirm bank account routing and account numbers (BodyMap LLC checking)
- Block ninety minutes on the calendar
- Be in front of laptop with squareup.com/activate already open
- Have HK driver's license ready as backup

**Status May 8 morning:** Square activation completed May 7 evening (a day early). First production payment received. BodyMap LLC merchant identity verified.

### May 8 morning QA setup

Working through the payment QA checklist (`docs/PAYMENT_QA_CHECKLIST.md`). Test mode (Path A) shipped to avoid 3% on every test transaction. Vercel preview environment uses `REACT_APP_PAYMENT_MODE=test` plus parallel `_TEST` env vars.

Test cards reference (no real money exposure when used on the preview URL):
- Stripe success: `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP
- Stripe decline: `4000 0000 0000 0002`
- Stripe 3DS required: `4000 0027 6000 3184`
- Square sandbox success: `4111 1111 1111 1111`, any future expiry, CVC `111`, ZIP `94103`
- Square sandbox decline: `4000 0000 0000 0002`

Test/sandbox keys live in Vercel and Supabase env vars. Never paste keys in chat or commit them to the repo. Architecture detailed in `docs/BILLING_STRATEGY.md` "Test mode" section.

### Notes from recent founding therapist conversations

Capture themes here as they come in. When a theme repeats three times, promote it to a real document.

- Katelynn (May 7, 2026) asked about bank-direct payments. Resolved by explaining card networks require merchant in the middle. Logged in BLOCK_PLAN as demand signal. If two more therapists ask, promote ACH back into roadmap consideration.

### Quick decisions this week

- Dropped ACH from payment roadmap. Phase 1 (wallets) and Phase 3 (FedNow) only.
- Built Founder Hub at `/founder` for HK only.
- Cream demo frame is a design principle, never tuned per-demo.
- May 15-16 2026: Standard Connect added alongside Express. Daya Gupta and Candice connections fixed via the new architecture. Disconnect button removed from Settings (replaced with "Manage in Stripe" link).

### Friday-Saturday May 15-16 2026: Stripe marathon session

Long session focused on Stripe Connect. 14 commits ranging from
client agreement UX rebuild to Standard Connect to comprehensive
docs. Net state at end:

**Stripe Connect architecture finalized.** Standard Connect built
alongside Express. New therapists default to Standard (15-second
OAuth into their existing account). Express stays as fallback
for therapists new to Stripe or with Express accounts created
by other platforms. Architecture documented in BILLING_STRATEGY
under "Stripe Connect architecture" section. Recovery procedures
documented in FOUNDER_RUNBOOK under "Stripe Connect operations
and recovery."

**HK (Daya Gupta) connected to `acct_1TXWhfQvokGFD9FY`** (Enabled,
charges_enabled, payouts_enabled, details_submitted all true).
Customer payments verified working via Stripe Dashboard
"Connected Accounts. Payouts active." indicator.

**Candice connected to `acct_1TXXY1JAq6V9VAbg`** via SQL update
after the architectural fix. Same Enabled status. Customer
payments verified working.

**The 31 orphan Express accounts on the platform.** Inert. Not
attached to any therapist row. Created by the pre-fix
disconnect/reconnect loop that minted a new Express account on
every tap. The architectural fix (auto-match by email before
creating) prevents future orphans. Stripe Connect dashboard can
reject them manually one by one; not urgent.

**Joy persona purge complete.** Removed from HelpWidget,
FounderDashboard, StripeConnect, Help.jsx, can-i-use-my-bank.md,
helpArticles.js, and the FOUNDER_RUNBOOK glossary. Public voice
is always "MyBodyMap" / "we" / "the team." Fictional therapist
demo names (Joy, Lindsey) in CampaignsDemo and SmartScheduleDemo
are kept as sample personas, not brand voice.

**Open question parked for next session.** HK said before sleep:
"earlier I believe the daya gupta account was connected to my
stripe in platform but now it is not." Investigation script in
HANDOVER_2026-05-15.md. Three possible interpretations: (1)
architectural misunderstanding about platform vs connected
accounts, (2) genuine disconnect from tonight's work (unlikely),
(3) HK processing the Express-vs-Standard insight from the late
session. Start with HK clarifying what they saw before doing
anything else.

**HK's platform Stripe account is unverified / sandbox.** Does
not affect customer payments (which flow through the connected
accounts). HK should spend 15-20 min activating the platform
account at some point so they can view things in live mode in
Stripe Dashboard. Not urgent.

**Deferred from this session:** StatusStrip Agreement tile
(~75 min). All design decisions confirmed by HK. Deferred when
Stripe became urgent. Tracked in BLOCK_PLAN section 8.

---

## Personal reminders

Things HK wants to remember but does not want to forget by spreading across multiple tools.

- Check Stripe Connect dashboard once a week for any platform alerts
- Check Vercel deploy logs after any Friday afternoon push
- Update FOUNDER_RUNBOOK.md whenever a vendor relationship changes
- Block one full Saturday per month for strategy review and BLOCK_PLAN cleanup

---

## Ideas not yet committed

Half-formed ideas. Not ready for BLOCK_PLAN. Not ready for taxonomy. Just thinking out loud.

- Could a therapist refer another therapist? Single-tap referral with both getting an extra month free. Network effect lever.
- Annual founder gathering. In Texas. Bring twenty founding therapists for a long weekend. Costs maybe ten thousand dollars. Builds an unbreakable customer base.
- Voice-only intake. Therapist talks into the phone, AI structures it. Faster than typing for a 65-year-old persona.
- Gift card pricing tiers. Not just dollar amounts but session counts (one session, three sessions, six sessions).

---

## Where this document lives

`docs/OTHER_NOTES.md` in the bodymap repo. Free-form, updated whenever something comes up that needs a home. Promote items out of here as they mature.
