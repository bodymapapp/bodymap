# Incidents

**Purpose:** an append-only log of things that broke and what we learned. A learning tool, and evidence of care if our handling of customer data is ever questioned.
**Last updated:** 2026-06-11
**Canonical:** yes

---

## How to use this log

Add new entries at the top. Never edit or delete a past entry. Each entry: date, what happened, root cause, how it was resolved, and the lesson or safeguard that came out of it.

Older incident records are still scattered across the block plan, the design principles, and the runbook. Pulling them all into this log is a separate reviewable step (see the block plan). The entries below are the confirmed seed.

---

## 2026-06-01 — Payment notifications silently blocked (401)

**What happened:** completed pay-link payments flipped to paid but notified no one.
**Root cause:** the `notify-payment-event` function was missing from the deploy no-JWT allowlist, so it was 401-blocked.
**Resolved:** added to the allowlist; therapist and client notifications now fire on completion.
**Lesson:** a function returning success at the queue step is not proof of delivery. Verify the real response, not the queue.

## 2026-05-23 — Comprehensive data wipe on the wrong account

**What happened:** a wipe meant for one therapist ran against Candice Peek's account, deleting clients, bookings, services, and related records.
**Root cause:** an identity mix-up in a white-glove script; the script trusted the operator without confirming identity.
**Resolved:** recovery from the Supabase daily backup over roughly seven hours.
**Lesson:** this triggered the data-safeguards program: a confirmation gate that prints a full identity card before any destructive action, an append-only audit log, soft-delete instead of hard delete, and per-therapist snapshots. Never propose deletion of customer data without explicit confirmation from HK.
