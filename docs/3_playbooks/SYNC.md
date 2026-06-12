# SYNC.md

How every agent and human keeps the brain (this repo) true and current.
Read this once, then follow it every session. Purpose: no agent ever acts
on stale truth, and every change is traceable to who made it.

Last updated: 2026-06-12. Canonical home for the sync and attribution rules. As of Jun 12 2026 agents work on branches and merge through the gate named Deuce; they no longer push to main directly (see below, and the runbook section "Operating model: many agents, one gate named Deuce").

## The one rule

The brain is not live. Git is pull-based. You only see another agent's
work after it reaches main and you pull. So: pull main before you act, and
push your branch after every change. The gate, Deuce, merges your branch
into main. You never push to main directly.

## How a change reaches main now (Deuce)

Old way (solo): you pushed straight to main, and main builds the live site.
That is off now.

New way: you push a branch, open a PR, and the gate named Deuce checks it
and merges it to main when it is clean (current with main, and the build
passes). Main still builds the live site. The gate just sits between your
branch and main so a broken or conflicting change cannot land. No human
approval is in the path; clean changes merge on their own, one at a time,
in arrival order. The one-time setup of the gate is an engineering task in
docs/3_playbooks/DEUCE_SETUP.md.

## Every session

1. Start: pull main. Your startup ritual already runs git clone or git pull.
   That is how you pull in everyone else's latest work.
2. Make a branch for your task before you touch anything:
   git checkout -b <yourtag>/<short-task-name>
   example: engineering/coupon-phase-2
3. Work on your branch. Commit and push the BRANCH (never main) after each
   meaningful change, with your [tag] message:
   git push -u origin <branch>
   Do not save a dozen commits for the end; pushed branch commits are how
   other agents and the gate see your work.
4. When the task is done, open a pull request and turn on auto-merge:
   gh pr create --fill
   gh pr merge --auto --squash
   Deuce takes it from here: it waits until your branch is current and the
   build passes, then merges it to main on its own. You never push to main.
5. End: run the WRAP_UP playbook, add your DONE_FEED line, and make sure
   your PR is in (auto-merge on, or already merged).

If Deuce stops your change, the build failed or your branch conflicts with
another lane. Fix it on your branch and push again. No other lane is
affected; everyone else keeps flowing.

## Stay out of each other's way

- Each agent owns its own files. Engineering owns the code and the
  engineering rooms. Customer Support owns the support and incident drafts.
  Marketing owns the marketing docs. Strategy owns the strategy docs.
  Chief of Staff keeps the state room and the cross-agent view current.
  When two agents do touch the same file, Deuce catches the conflict at the
  gate instead of letting a bad merge reach the live site. You no longer
  merge origin/main by hand before pushing; your branch plus the gate
  handle it.
- The block plan and the done feed are shared. Append to your own dated
  lines. Do not rewrite another agent's lines.

## Attribution: every change is signed

Each agent commits under its own fixed identity and tags its commit
message, so the history reads like a signed logbook.

Set once, right after the clone line, in each agent's project instructions:

    Engineering:  git config user.name "MyBodyMap Engineering" && git config user.email "engineering@mybodymap.app"
    Customer Support:  git config user.name "MyBodyMap Customer Support" && git config user.email "support@mybodymap.app"
    Marketing:    git config user.name "MyBodyMap Marketing" && git config user.email "marketing@mybodymap.app"
    Strategy:     git config user.name "MyBodyMap Strategy" && git config user.email "strategy@mybodymap.app"
    Chief of Staff:  git config user.name "MyBodyMap Chief of Staff" && git config user.email "chief@mybodymap.app"
    A human:      git config user.name "Your Real Name" && git config user.email "your@email"

Then add this to each agent's project instructions so it works on a branch,
never on main directly:

    Start each task on a fresh branch:
      git checkout -b <yourtag>/<short-task-name>
    Commit and push the BRANCH as you work, with [tag] messages:
      git push -u origin <branch>
    When done, open a PR and enable auto-merge:
      gh pr create --fill
      gh pr merge --auto --squash
    Deuce merges your branch to main once it is current and the build
    passes. Never push to main. If Deuce reports a failure or conflict, fix
    it on your branch and push again.

Start every commit message with your tag in brackets, then keep the
existing convention:

    [engineering] what changed (Shipped but unverified by HK)
    [support] what changed (Shipped but unverified by HK)
    [marketing] what changed (Shipped but unverified by HK)
    [strategy] what changed (Shipped but unverified by HK)
    [chief] what changed (Shipped but unverified by HK)

## How HK checks who pushed what

- Ask any agent: "what got pushed to the brain in the last day, and by
  which agent." It reads the log and answers in plain English.
- GitHub on your phone: open the repo, tap Commits. Each line shows the
  agent, the message, and the time. Tap one to see the files it changed.
- One suspect fact: ask "who last changed this line, and when." Git points
  to the exact commit and the agent behind it.

## The done feed: how agents tell each other what got done

We keep it simple. No agent has to figure out who needs what. When you
finish a task, add ONE line to the top of docs/2_state/DONE_FEED.md:

    2026-06-12  [engineering]  Coupon Phase 2 shipped, referral codes live.

Then read the recent lines in DONE_FEED.md at the start of every session,
so you always know what the other agents have shipped. That is the whole
mechanism: everyone writes one line when done, everyone reads the feed at
the start. Keep each line short and plain.

## Running a numbered task: "run engineering 1"

When HK opens the Agent Board and publishes, the numbered tasks and their
full prompts get written into the "Assignments by agent" block at the top
of docs/2_state/BLOCK_PLAN.md.

When HK says "run engineering 1" or "complete marketing 2" (your own name
and a number), find that exact heading, for example "**Engineering 1**",
in the assignments block, and do what the prompt under it says. The tag in
brackets is how it should run:

- GREEN: safe to run on its own. Do it and report back.
- AMBER: draft it and bring it to HK before anything goes live.
- RED: HK does this one. Do not run it yourself.

If there is no prompt written under the heading, use the title as the goal
and ask HK for anything you need.
