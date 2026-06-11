# Wrap-up ritual

**Purpose:** the end-of-session procedure that keeps the whole brain true. This is the maintenance engine. Running it is how the brain stays current as a byproduct of the work.
**Last updated:** 2026-06-11
**Canonical:** yes

---

## When to run it

At the end of a working session, or whenever HK says "wrap up."

## The steps

1. **Review what shipped.** List what changed this session: features, fixes, decisions.
2. **Update the live state.** Edit `docs/2_state/BLOCK_PLAN.md` to reflect what shipped and what is now queued. This is the one canonical plan. If you touched the product feature set, also update `src/data/featuresData.js` and the feature taxonomy in `docs/1_constitution/FEATURES_TAXONOMY.md`.
3. **Keep docs and code in sync.** If code moved or was renamed, update any doc that points at it (especially the runbook in `docs/2_state/`). If a doc moved, update any code that reads it by path (the Founder Hub fetches several docs by path). This is the only real coupling between the rooms and the code, so check it every time.
4. **Append any incident.** If something broke, add a dated entry to `docs/4_incidents/INCIDENTS.md`. Append only. Never edit a past entry.
5. **Improve this and other playbooks.** This is the important step. If we learned a better way to do something, write it back into the relevant playbook now, while it is fresh. The procedure is meant to grow. Roughly eighty percent stays the same each cycle; the critical twenty percent is the new rule we just learned.
6. **Freshness sweep.** Skim the headers in `docs/2_state/`. Anything with a stale "last updated" date or a count that no longer matches reality gets fixed or flagged.
7. **Commit.** Use the convention: messages tagged "Shipped but unverified by HK." Nothing is verified until HK confirms.

## Standing rules for all output

- No em dashes anywhere. Use commas or rephrase.
- Always "MyBodyMap" in user-facing text, never just "BodyMap." Always "platform," never "tool" or "app."
- Never claim work is verified when it is not.
