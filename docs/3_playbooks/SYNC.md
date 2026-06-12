# SYNC.md

How every agent and human keeps the brain (this repo) true and current.
Read this once, then follow it every session. Purpose: no agent ever acts
on stale truth, and every change is traceable to who made it.

Last updated: 2026-06-11. Canonical home for the sync and attribution rules.

## The one rule

The brain is not live. Git is pull-based. You only see another agent's
work after they push and you pull. So: pull before you act, push after
every change.

## Every session

1. Start: pull. Your startup ritual already runs git clone or git pull.
   That is how you pull in everyone else's latest work.
2. While working: after each meaningful change, commit and push. Do not
   save a dozen commits for the end. Local commits are invisible to other
   agents until they are pushed.
3. Before you push: fetch first. If main moved, merge it in, then push.
   Pattern: git fetch origin, then git merge origin/main, then push.
4. End: run the WRAP_UP playbook, then push.

## Stay out of each other's way

- Each agent owns its own files. Engineering owns the code and the
  engineering rooms. Customer Support owns the support and incident drafts.
  Marketing owns the marketing docs. Strategy owns the strategy docs.
  Chief of Staff keeps the state room and the cross-agent view current.
  Two agents almost never edit the same file, so git merges them cleanly.
- The block plan is the one file everyone shares. Append to your own dated
  section. Do not rewrite another agent's lines.

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
