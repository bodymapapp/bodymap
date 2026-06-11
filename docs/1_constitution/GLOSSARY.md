# Glossary

**Purpose:** plain-language definitions of the terms, systems, and people that come up across the MyBodyMap brain, so a newcomer (human or agent) is never lost.
**Last updated:** 2026-06-11
**Canonical:** yes

---

## Core idea

- **The moat:** the visual body map intake (front and back diagram, focus and avoid zones, pressure, medical flags) plus the longitudinal pattern intelligence that accumulates across a client's sessions (heatmap overlays). Competitors cannot copy it because they do not have a therapist's years of session history. It lives in the production database.
- **The brain:** this repo. The knowledge, decisions, procedures, and history that run the business. Distinct from the moat.
- **PracticeIQ:** the in-app name for the intelligence features. Never described to users with AI wording.

## The stack, in plain terms

- **Repo:** the folder of all files (code and docs), stored on GitHub at `bodymapapp/bodymap`. Permanent, with full history.
- **Supabase:** the production database where all customer data lives. The moat lives here.
- **Edge function:** a small backend program that runs on Supabase, used for things like sending emails. Auto-deploys from the repo.
- **RLS (row level security):** database rules that keep each therapist able to see only their own data.
- **Vercel:** the service that builds and serves the website. A push to the main branch deploys it.
- **Stripe Connect / Square:** the two payment systems therapists can connect to take money.
- **Resend:** the service that sends emails.
- **Twilio / A2P 10DLC:** the text-message system. Client texting is currently blocked pending carrier registration; email is the live client channel.

## The feature taxonomy (seven categories)

Find and book, Know your client, Client intelligence, Day of session, Relationships, Money and protection, On your phone. New features go into an existing category, never a new top level.

## People (orientation only, details live in the relevant rooms)

- **Candice** — Grounded Grace. Subject of the May 23 data incident; her account is handled with extra care.
- **Jacquie** — Back2Life Restorative Massage, in Central time. Messaging to her is kept simple and direct.
- **Terra** — runs two businesses, Underthetrees and Ponder.
- **Joy (test)** — the demo therapist and demo client accounts used for testing, business name Healing Hands.
