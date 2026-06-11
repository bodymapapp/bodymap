# MyBodyMap — START HERE

**Purpose:** the front door to the MyBodyMap brain. Read this first. It orients anyone, human or agent, in about five minutes and points to everything else.
**Last updated:** 2026-06-11
**Canonical:** yes

---

## What MyBodyMap is

MyBodyMap is a practice-management and scheduling platform for solo licensed massage practitioners. The moat is the visual body map intake plus longitudinal pattern intelligence that builds up across a client's sessions. That moat data lives in the production database (Supabase), not in this repo. This repo is the brain: the knowledge, decisions, procedures, and history that run the business.

## Where the current state lives

Do not look for the current state in this file. It lives in `docs/2_state/BLOCK_PLAN.md`, which is the one canonical plan. The end-of-cycle wrap-up keeps it true. If any other doc disagrees with the block plan about what is happening right now, the block plan wins.

## The map: one front door, five rooms, an archive

Read broadly across the rooms. Write only to the room you own.

- `docs/1_constitution/` — the rules and the voice. Design principles, email and copy voice, the feature taxonomy, and the glossary. Rarely changes.
- `docs/2_state/` — what is true right now. The block plan, the risk register, pending migrations and tests, the runbook, and the latest handover snapshot.
- `docs/3_playbooks/` — repeatable procedures, kept alive. The wrap-up ritual, the image spec, the QA and verification checklists.
- `docs/4_incidents/` — an append-only history of what broke and what we learned. Never edited, only added to.
- `docs/5_reference/` — analysis and system specs that inform decisions. Billing and marketing strategy, benchmarks, the notification map, the environment reference (where secrets live, never the secrets themselves).
- `docs/9_archive/` — stale, superseded, and historical files kept for the record. Old handovers, retired duplicates, old phase notes.

The code is separate and is never reorganized by this structure: `src/` is the website and app, `supabase/` is the backend, with `api/`, `public/`, and `scripts/` alongside.

## Read order for a newcomer

1. This file.
2. `docs/2_state/BLOCK_PLAN.md` to see where things stand.
3. `docs/1_constitution/DESIGN_PRINCIPLES.md` for how we build and the voice.
4. `docs/1_constitution/GLOSSARY.md` for the terms and the people.
5. Whatever room is relevant to the task in front of you.

## The one safety rule, always

Every body that works on MyBodyMap obeys the same blast-radius rule:

- Green: reversible, internal, no customer contact. Act alone.
- Amber: customer-facing drafts, our own data writes, money below a set threshold. Draft it, queue it for HK to approve.
- Red: anything sent to a customer, anything irreversible, any money movement, and anything that touches a therapist's own clients. HK only, every time.

The full version lives in `docs/1_constitution/`.

## How this brain stays true

The wrap-up ritual in `docs/3_playbooks/WRAP_UP.md` is the maintenance engine. At the end of a working session it updates the state, appends any incident, refreshes the playbooks, and sweeps for anything that has gone stale. Because maintenance rides on a ritual we already run, the brain stays current as a byproduct of the work.
