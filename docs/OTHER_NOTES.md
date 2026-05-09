# Other Notes

**Last updated:** May 7, 2026
**Purpose:** Catch-all for documentation that does not fit the other nine sections of the Founder Hub. Anything that needs to be written down but does not yet have a permanent home.

When something here grows past a few paragraphs, promote it to its own document and link from here.

---

## Research library

Permanent research artifacts that do not need their own Founder Hub section but should be findable when relevant. View on GitHub or fetch via the Founder Hub backup download.

| Document | Topic | Trigger to revisit |
|---|---|---|
| [docs/CUSTOMER_CHAT_RESEARCH.md](https://github.com/bodymapapp/bodymap/blob/main/docs/CUSTOMER_CHAT_RESEARCH.md) | Customer service chat options analysis. Seven options evaluated (help center, search, self-hosted LLM, hybrid, email-first, extractive RAG, third-party widgets). Stage 1 recommendation: email-first plus help center. Architecture for Stage 2 ready when triggered. | HK responds to over 30 emails/week, OR 500+ active therapists, OR a founding therapist explicitly requests chat |
| [docs/HELP_ARTICLES_GUIDE.md](https://github.com/bodymapapp/bodymap/blob/main/docs/HELP_ARTICLES_GUIDE.md) | Maintenance guide for the public help center at /help. Covers the markdown-to-bundle-to-UI pipeline, editorial rules (Joy voice, no em dashes, MyBodyMap not BodyMap), the article taxonomy mapping table (which articles map to which feature cards), the "when a feature ships, update matching articles" process, frontmatter format, and how to add or remove articles. | Whenever a feature in FEATURES_TAXONOMY.md changes meaningfully and might affect a help article; whenever new help articles are added; whenever the help center architecture is reconsidered |
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
