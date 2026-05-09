# Customer Service Chat Research

**Last updated:** May 7, 2026
**Status:** Research artifact, not built. Decision deferred to a later stage.
**Owner:** HK
**Trigger to revisit:** Email volume becomes unmanageable for HK to answer personally. Estimated trigger: 500+ active therapists, or ~30+ inbound emails per week.

This document captures the full thinking behind whether (and how) MyBodyMap should build a customer-facing chat interface. Recorded so HK or a future team can pick up the decision when the trigger conditions hit, without having to rediscover everything.

---

## The decision in one paragraph

For MyBodyMap's current stage (pre-revenue, under 100 founding therapists), an AI chat is the wrong investment. The right answer is a great help center plus an "Email Joy" button that keeps every customer-service interaction as a relationship-building moment with the founder. AI chat becomes the right answer once email volume exceeds the founder's bandwidth, which is unlikely to happen before late 2026. When that trigger hits, this document has the architecture ready to ship.

---

## What the chat actually needs to do

Two distinct user groups, two distinct purposes:

**Public site visitors (pre-signup):**
- "How does cancellation policy work?"
- "Do you support insurance billing?"
- "What's the difference between Bronze and Silver?"
- "Can I import my existing client list?"
- Most of these are pre-purchase questions. Conversion-influencing.

**Authenticated therapists (post-signup):**
- "How do I change my cancellation policy tiers?"
- "Where do I export my client list?"
- "How do I connect Square?"
- "Why didn't my client get their reminder?"
- These are operational support questions. Retention-influencing.

The Practice Assistant (already built) handles a different category: "show me my own client data, draft me an SMS." Different enough that it shouldn't be conflated with customer-service chat.

---

## Options analyzed (May 2026)

Seven options were evaluated. Each is documented below with honest tradeoffs so future decisions can be made on the same baseline.

### Option 1: Help center only, no chat

A `/help` page with categorized articles, browser-side search, no AI.

**Cost:** $0 forever
**Quality:** High for "where is X" questions, weak for nuanced ones
**Industry signal:** Stripe, Linear, Vercel, Notion all lead with this pattern. They added AI chat only after reaching massive scale.
**Best for:** stages 0 through 5,000+ therapists
**Tradeoff:** No conversational capability; users with follow-ups must email

This is the foundation. Even at scale, the help center remains; AI chat layers on top.

### Option 2: Pure search with content snippets

Bottom-right widget that returns the top 3-5 relevant document paragraphs with keyword highlighting. No synthesized answer.

**Tools:**
- FlexSearch (browser-side, $0 forever) · recommended
- Lunr.js (browser-side, $0 forever)
- Algolia DocSearch ($50-500/month for commercial)
- Typesense (open-source, ~$10-30/month self-hosted)
- MeiliSearch (open-source, similar)

**Best zero-cost choice: FlexSearch.** Index built at compile time, ships ~50-100KB to client, runs entirely offline after page load. Same architecture used by many docs sites.

**Quality:** Excellent for keyword-matchable questions. Users see the actual source text, no hallucination risk.
**Tradeoff:** Requires the user to read excerpts; doesn't compose an answer for them.

### Option 3: Self-hosted small LLM (Llama 3.2 3B or similar)

Run an open-source model on a GPU server you control.

**Cost:** $30-80/month flat (small GPU instance always-on)
**Quality:** ~60-70% as good as Haiku for grounded Q&A
**Maintenance:** Real ongoing engineering (model updates, security, scaling)

**Why this is worse than it looks:** at MyBodyMap's projected scale, Haiku via API is cheaper than self-hosted because flat $30-80/month exceeds Haiku usage cost until you hit very high query volumes. Self-hosting only makes sense at tens of thousands of queries per day, which is not the use case here. Skip.

### Option 4: Hybrid (search-first with AI escalation)

User types question. Search runs first, returns top doc snippets instantly free. If user clicks "Get a synthesized answer" or no snippets matched, an API call fires.

**Cost projection at 10K therapists × 5 questions/month:**
- 80% answered by search: $0
- 20% escalate to AI: ~$50/month total

**Quality:** Combines speed of search with composition of AI. Best of both worlds.
**Best for:** stage where the help center has good coverage but long-tail questions need synthesis. Probably the right answer at 1,000-10,000 therapists.

### Option 5: Email-first with personal founder responses

No chat at all. A "Send Joy a question" button that opens an email with pre-filled context.

**Cost:** $0
**Quality:** Highest possible for early stage. Personal founder responses convert and retain better than any chatbot.
**Capacity:** ~5-20 emails per week comfortably handled by HK at 100 therapists. Scales to about 500 therapists before becoming unmanageable.
**Brand fit:** Matches the founding-therapist program perfectly. Each email is a relationship-building moment.

**Why this is the right answer for MyBodyMap today:** the human touch IS the differentiator at this stage. Vagaro and MassageBook have chatbots because they have 10K+ users. MyBodyMap has fewer than 100. The chatbot replaces the very thing that's working.

### Option 6: Open-source extractive RAG (no generative LLM)

Use a non-generative retrieval system. Tools like Haystack, txtai, or LangChain in retrieval-only mode index docs and return the exact passage that answers the question.

**Cost:** $0 per query, $10-30/month for hosting
**Quality:** Between Option 2 (keyword search) and Option 4 (search + AI). The retrieval IS the answer.
**Why this is interesting:** zero hallucination because nothing is generated.
**Tradeoff:** Adds infrastructure (a vector DB or embedding service) for marginal quality improvement over good keyword search.

### Option 7: External free chat tools (Crisp, Tidio, Tawk.to)

Third-party chat widgets with free tiers.

- **Tawk.to** is genuinely free, you respond personally
- **Crisp** has a free tier with a basic bot
- **Tidio** free tier is limited
- **HubSpot** free CRM includes a chat widget

**Best free option for email-first:** Tawk.to as a chat widget where HK responds, with zero AI cost. Same pattern as Option 5 but with synchronous chat instead of email.

**Tradeoff:** synchronous chat creates pressure to respond immediately, which is worse for HK's calendar than batched email.

---

## Decision matrix

| Option | $0 cost? | Scales to 10K therapists? | Right for stage 0-500? | Right for stage 500-5000? | Right for stage 5000+? |
|---|---|---|---|---|---|
| 1. Help center only | Yes | Yes | Yes | Yes (alongside others) | Yes (alongside AI) |
| 2. Pure search | Yes | Yes | Probably overkill | Yes | Yes |
| 3. Self-hosted LLM | No ($30-80/mo) | Maybe | No (overengineered) | Maybe | Maybe |
| 4. Hybrid search + AI | Mostly (~$50/mo at 10K) | Yes | No (premature) | **Yes (sweet spot)** | Yes |
| 5. Email-first | Yes | No (~500 cap) | **Yes (best fit)** | Becoming strained | No |
| 6. Extractive RAG | Mostly (~$10-30/mo) | Yes | No (overengineered) | Maybe | Yes |
| 7. Tawk.to | Yes | No | Maybe | No (synchronous burden) | No |

---

## Recommended staged rollout

### Stage 1 (now to 500 therapists): Help Center + Email Joy
- Build `/help` with FlexSearch (~3 hours)
- Floating widget bottom-right with two buttons: "Search help" and "Email Joy"
- Write 15-20 initial help articles in `docs/HELP_ARTICLES/`
- HK responds to emails personally within 24 hours
- Cost: $0
- Time investment: ~30-60 minutes per week answering emails

### Stage 2 (500-5000 therapists): Add AI Escalation
- Trigger: HK can no longer answer all emails within 24 hours, OR email volume exceeds 30/week
- Build customer-chat edge function with Haiku 4.5
- IP-based rate limit: 5 questions per IP per day for anonymous, 20 per day for authenticated therapists
- Daily cost ceiling: $5/day across all callers (~$150/month worst case)
- Scope-locked prompt: only answers MyBodyMap topics, redirects everything else
- Search still runs first, AI fires only when search has no good match or user asks for synthesis
- Cost: $50-150/month at full scale
- Build estimate: 4-6 hours

### Stage 3 (5000+ therapists): Mature AI Chat
- Trigger: stable revenue, multiple support channels working, AI chat now strategic
- Possibly add fine-tuned model on logged conversations
- Possibly add multi-turn conversation memory in Supabase
- Possibly add language support for international expansion
- Cost: scales with usage, $500-2000/month at maturity, paid out of subscription revenue

---

## Architecture for Stage 2 (when triggered)

Specific design decisions made and ready to implement when the trigger fires. Saving this so it doesn't have to be rediscovered.

### Corpus split (CRITICAL · DO NOT SHIP WITHOUT THIS)

The customer service chat must NOT have access to internal documents. Specifically:

**Public-safe corpus (OK to expose):**
- `docs/MARKETING_THERAPIST_PLAYBOOK.md`
- `docs/email-voice-guide.md`
- `docs/PRODUCT_GUIDE.md` (will be written specifically for this purpose)
- Public-facing parts of `docs/BILLING_STRATEGY.md` (processors supported, fee structures only · NOT internal liability discussions)

**Internal docs that MUST NEVER reach the public chat:**
- `docs/FOUNDER_RUNBOOK.md` (credentials, vendor relationships, internal strategy)
- `docs/MARKETING_MYBODYMAP.md` (internal market analysis, persona thinking, pricing logic, raise/no-raise reasoning)
- `BLOCK_PLAN.md` (roadmap, deferred work, demand signals)
- `OTHER_NOTES.md` (founder scratchpad)
- `FEATURES_TAXONOMY.md` (taxonomy, design principles, differentiation flags · competitive intelligence)

### Rate limiting design

Three concentric defenses:

**Defense 1 (Prompt-level):** Scope-locked system prompt that redirects off-topic questions immediately. Makes the chat useless for someone trying to get free ChatGPT and they bounce.

**Defense 2 (Per-caller):** IP-based rate limit. 5 questions per IP per day for anonymous, 20 per day for authenticated therapists.

**Defense 3 (Global):** Daily cost cap. If $5 in API costs accumulate in a day, return "Chat temporarily unavailable, please email hello@mybodymap.app." Hard backstop against abuse storms.

### Scope-lock prompt template

Reusable prompt that ensures the chat only answers MyBodyMap questions:

> You are the MyBodyMap support assistant. You only answer questions about MyBodyMap (the practice management platform for solo licensed massage therapists) and adjacent practical topics for running a massage therapy practice.
>
> If asked about anything else (weather, news, general knowledge, other software, off-topic things), politely redirect: "I only answer questions about MyBodyMap. For other topics, please use a general assistant."
>
> Be warm, concise, and practical. When citing how a feature works, point to the specific Settings location or page.
>
> Style: no em dashes, plain language, no buzzwords. Match the Joy persona voice from the marketing materials.

### Tables required (Stage 2)

```sql
CREATE TABLE customer_chat_usage_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  date_utc date NOT NULL,
  question_count integer NOT NULL DEFAULT 0,
  is_authenticated boolean NOT NULL DEFAULT false,
  last_question_at timestamptz,
  UNIQUE (ip_hash, date_utc)
);

CREATE TABLE customer_chat_global_usage (
  date_utc date PRIMARY KEY,
  total_questions integer NOT NULL DEFAULT 0,
  total_cost_cents integer NOT NULL DEFAULT 0,
  cost_ceiling_hit boolean NOT NULL DEFAULT false
);

CREATE TABLE customer_chat_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text,
  ip_hash text,
  therapist_id uuid REFERENCES therapists(id),
  source_page text,
  created_at timestamptz NOT NULL DEFAULT now(),
  thumbs text CHECK (thumbs IN ('up', 'down', null))
);
```

### Learning loop design

Every conversation logs to `customer_chat_log` with thumbs feedback. At end of each working session, Claude reviews the log and:

1. Identifies questions the chat couldn't answer well (weekly digest)
2. Surfaces emerging themes
3. Flags answers HK rated negatively
4. Updates `docs/PRODUCT_GUIDE.md` to fill the gaps

The corpus IS the learning surface. Improvements compound automatically because every doc update reflects in the next chat query without redeploying anything.

---

## Why I almost recommended the wrong thing

Honest record so this mistake doesn't repeat. When HK first asked about a customer service chat, I jumped to "AI chat with citations and a learning loop" because it was the most exciting thing to build. HK pushed back twice on cost. The correct answer was actually obvious in retrospect: at MyBodyMap's current scale, email-first IS the chat. The founder voice IS the moat.

The lesson: at very early stage, the "boring" answer (good docs, human responses) is almost always better than the "AI-powered" answer. AI chat is a cost layered on top of solving the right problem with humans first. If you can't answer questions well via email, you can't answer them well via AI either, because the AI needs your written answers as training material.

---

## Trigger conditions to revisit

Build Stage 2 (AI escalation) when ANY of these become true:

1. **HK is responding to >30 emails per week** with materially repetitive questions
2. **Average email response time exceeds 24 hours** for a sustained week
3. **A founding therapist explicitly says** "I wish there was a chat where I could ask quick questions"
4. **Total active therapists exceeds 500** regardless of email volume
5. **MyBodyMap is profitable** and there's budget for the operational ongoing cost

Until then, do not build it. The architecture above is ready when the trigger hits.

---

## Where this document lives

`docs/CUSTOMER_CHAT_RESEARCH.md` in the bodymap repo. Linked from the Founder Hub. Update when:
- Trigger conditions change
- A new option emerges (different free tier, new tool, market shift)
- Stage 2 ships and learnings need to be recorded for Stage 3

Recommended cadence: review once per quarter, update if anything has changed.
