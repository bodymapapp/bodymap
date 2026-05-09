# Help Articles Maintenance Guide

**Last updated:** May 7, 2026
**Audience:** HK and any future team member maintaining the public help center
**Companion docs:** `docs/HELP_ARTICLES/*.md` (the articles), `scripts/build-help-articles.js` (the build), `src/pages/Help.jsx` (the UI)

This document explains how the public help center works, how articles get updated, and how the article taxonomy maps to the product feature taxonomy.

## How the help center works

The `/help` page on mybodymap.app is a search-first knowledge base. Visitors type a question, see relevant articles, click to read. Email Joy if not satisfied. Cost to operate: $0/month forever (all client-side, no API calls).

### The pipeline in three steps

1. **Articles live as markdown.** Each article is a `.md` file in `docs/HELP_ARTICLES/` with YAML frontmatter (id, title, category, order, keywords, taxonomy) and a markdown body.

2. **Build script bundles them.** `scripts/build-help-articles.js` reads every markdown file, parses the frontmatter, and emits `src/data/helpArticles.js` as a sorted JS array. Runs automatically before every Vercel deploy via the `prebuild` npm script.

3. **React app renders them.** `src/pages/Help.jsx` imports the bundled array, builds a FlexSearch index in the browser, and renders the search UI plus article content.

### Why bundle at build time instead of fetching at runtime

Help articles are static reference content. Bundling means:
- Search is instant (no network round-trip)
- Works offline once the page loads (matches our PWA behavior)
- One less moving part (no GitHub raw fetch for help corpus)

The Founder Hub, by contrast, fetches docs at runtime because those docs are live-updating and internal-only. Different design choice for a different use case.

## Updating an article

When the platform changes (new feature ships, an existing feature updates, a price changes), the relevant help articles need to update too. The flow is:

1. Identify which article(s) need updating. Use the taxonomy mapping table below.
2. Edit the markdown file in `docs/HELP_ARTICLES/`.
3. Push to main.
4. Vercel rebuilds (about 90 seconds), running `build-help-articles.js` in prebuild.
5. The updated article ships to all visitors.

### Editing rules

- **Voice:** Joy persona. Warm, plain English, no buzzwords. See `docs/email-voice-guide.md`.
- **No em dashes anywhere.** Use periods, commas, parens, or middots.
- **"MyBodyMap" not "BodyMap"** in customer-facing text.
- **Numbered prose paragraphs** rather than bullet points where possible. Bullets are OK for actual step-by-step instructions.
- **End with a "Related articles" section.** Three to five entries.
- **Frontmatter must stay valid.** id, title, category, order, keywords, taxonomy.

### Adding a new article

1. Create a new `.md` file in `docs/HELP_ARTICLES/`. Filename should be the article id with hyphens.
2. Add YAML frontmatter with all required fields (see "Frontmatter format" below).
3. Write the body in markdown.
4. Push to main. Build picks it up automatically. Search indexes it.

### Removing an article

Delete the file. Push. The build picks up that the file is gone and rebuilds without it. Existing URL hashes pointing to the removed article fall back to the first article.

### Frontmatter format

Every article needs:

```yaml
---
id: a-unique-slug-no-spaces
title: The user-visible title (sentence case)
category: Getting started | Booking and scheduling | Intake forms | Sessions and notes | Payments | Practical
order: 1   # integer, sorts within category
keywords: comma, separated, search, terms
taxonomy: 6.2   # see taxonomy mapping below
---
```

The `taxonomy` field is the bridge between the help content and the product feature catalog. When the cancellation policy feature changes, you can quickly find the article(s) tagged 6.2 and update them.

## Taxonomy mapping

The product features taxonomy is documented in `FEATURES_TAXONOMY.md` (seven ribbons, 41 cards). Each help article either maps to a specific feature card (e.g., 6.2 for cancellation policy) or to a cross-cutting category (overview, onboarding, pricing, comparison, trust).

### Current article mapping

| Article id | Taxonomy | Feature card name |
|---|---|---|
| what-is-mybodymap | overview | (no specific card; intro content) |
| how-to-sign-up | onboarding | (cross-cutting; signup funnel) |
| what-does-it-cost | pricing | (cross-cutting; pricing page) |
| import-client-list | onboarding | (cross-cutting; switching from competitor) |
| setting-up-services | 1.3 | Services catalog |
| calendar-and-hours | 1.4 | Availability and hours |
| stripe-or-square | 6.5 | Stripe + Square, both fully |
| cancellation-policy | 6.2 | Cancellation policy |
| refunds-and-disputes | 6.7 | One-tap refunds |
| card-on-file | 6.6 | Card on file at booking |
| can-i-use-my-bank | 6.5 | Stripe + Square (related to processors) |
| intake-forms-overview | 2.1 | Visual body map intake |
| customizing-intake | 2.2 | Customize your intake |
| session-notes-and-soap | 4.3 | Post-session SOAP notes |
| ai-features-overview | 3.3 | Practice Assistant |
| mobile-app-pwa | 7.1 | Install to home screen |
| switching-from-vagaro-massagebook | comparison | (cross-cutting) |
| what-if-you-go-out-of-business | trust | (cross-cutting) |

### Cross-cutting categories explained

Articles with non-numeric taxonomy values do not map to a specific feature card. They are content categories the product needs but no single card represents:

- **overview:** Intro content explaining what MyBodyMap is at a high level
- **onboarding:** Articles about the signup, setup, and first-week experience
- **pricing:** Plan, tier, and cost information
- **comparison:** How we differ from competitors
- **trust:** Privacy, security, business continuity, what happens if we shut down

If a future article does not fit any feature card, it likely fits one of these cross-cutting categories. If it does not fit any of them either, propose a new cross-cutting category before shipping.

### When a feature ships, this is the trigger

Whenever the product team ships a meaningful feature change, the help articles tagged with that feature's taxonomy must be reviewed and possibly updated. Process:

1. After shipping a feature change, look up the taxonomy id (e.g., 6.2).
2. Search `docs/HELP_ARTICLES/*.md` for articles with that taxonomy.
3. Read each one. Update anything that no longer matches reality.
4. Push the updates with the same commit (or a follow-up commit).

The reverse also holds: if a help article is updated, the underlying feature it documents should match. If they drift, the article gets confusing fast.

## Search behavior

The help center uses FlexSearch (browser-side) to index three fields per article:

- **title** (heaviest weight)
- **keywords** (medium weight)
- **body** (lightest weight)

Adding a new article does not require special configuration. The build emits the data file, the page loads it, the index builds on first render, search is instant.

To improve searchability of an existing article without changing its content, expand the `keywords` field in frontmatter. This is the lever for fixing "users cannot find this article when they search X" complaints.

## URL behavior

Each article has a stable URL hash, e.g., `/help#cancellation-policy`. This is shareable in DMs, emails, and social posts. When an article is renamed (id changed), old URLs break. Renaming is rare and should be intentional.

## Related articles links

At the bottom of every article, a "Related articles" section links to two to four other articles by name. These are written manually in the markdown body, not auto-generated. Keeping them manual ensures they actually answer the natural follow-up questions, not just topically similar articles.

## Where this document lives

`docs/HELP_ARTICLES_GUIDE.md` in the bodymap repo. Update when the help center architecture changes, when the taxonomy mapping evolves, or when the editorial rules need refining.
