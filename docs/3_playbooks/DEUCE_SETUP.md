# DEUCE_SETUP.md

One-time setup of the gate named Deuce. Owner: the engineering agent.
Decided by HK Jun 12 2026. Background and reasoning: FOUNDER_RUNBOOK.md,
section "Operating model: many agents, one gate named Deuce" and the
Jun 12 2026 decision-log entry.

## Tier: RED. HK dispatches this. Do not self-run.

This changes account-level GitHub settings and affects all 30 agents at
once. The engineering agent runs it only when HK says go, and only after
the chief confirms the prerequisites below are met. The chief sequences and
verifies. It is reversible (you can disable the rule again).

## Prerequisites, all three must be true before you start

1. **Token rotated.** HK has replaced the GitHub token that was exposed and
   issued per-agent credentials. The chief confirms this. Do not run on the
   old shared token.
2. **Agents already on the branch flow.** SYNC.md is updated (done Jun 12)
   and every building agent's project instructions now say "branch, push,
   open PR, auto-merge" (the block in SYNC.md, attribution section). This
   must be true FIRST. If main is protected while any agent is still told to
   push to main, that agent wedges. The chief confirms all agents are
   switched.
3. **HK has said go**, and the chief has picked a low-traffic window so
   in-flight pushes are not interrupted.

## Steps

1. **Confirm a per-PR build check exists.** Vercel's Git integration runs a
   preview build on every PR and posts a status check. That check is what
   Deuce will require. If the Vercel Git integration is not connected to the
   repo, connect it first (Vercel dashboard, the bodymap project, Git
   settings). Open one throwaway PR and confirm a Vercel check appears on it;
   note its exact name, you will select it in step 3.

2. **Allow auto-merge on the repo.** GitHub, repo Settings, General, scroll
   to Pull Requests, tick "Allow auto-merge." This is what lets agents arm
   `gh pr merge --auto` so clean PRs merge without a human.

3. **Protect main and require the gate.** GitHub, repo Settings, Rules,
   Rulesets (or Branches, classic protection), add a ruleset targeting the
   `main` branch with:
   - Require a pull request before merging (this blocks direct pushes to
     main).
   - Require status checks to pass, and select the Vercel build check from
     step 1.
   - Require branches to be up to date before merging.
   - Require merge queue (this IS Deuce: it sequences PRs, rebases each on
     the latest main, re-runs the check, and merges only when green).
   - Do not grant agents bypass. HK may keep a personal bypass for
     emergencies; that is HK's call, note it if so.
   - Merge method: squash (matches the agent flow `gh pr merge --auto
     --squash`).

4. **Verify (do not skip).**
   - Try to push a trivial commit straight to main. It must be rejected.
   - Open a clean test PR. It should pass the check and merge through the
     queue on its own with auto-merge on.
   - Open a PR that intentionally breaks the build. Deuce must refuse to
     merge it.
   - Delete the test branches.

5. **Report to the chief** with what you set and the verification results.
   The chief confirms to HK that Deuce is live.

## Rollback

Fully reversible. To turn Deuce off, disable or delete the `main` ruleset
in repo Settings, Rules. Direct pushes to main resume immediately. Do this
only on HK instruction.

## Notes

- Before the protection flip, agents on the branch flow already open PRs and
  auto-merge will merge them when the check is green. The flip does not break
  that; it just makes the queue strict and blocks the direct-push escape
  hatch. So the transition is smooth: branch flow first, protection second.
- Exact GitHub labels move around as GitHub ships UI changes. The four things
  that must end up true: no direct pushes to main, a required build check,
  required up-to-date branches, and the merge queue on. Match those, whatever
  the screen calls them.
