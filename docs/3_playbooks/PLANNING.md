# Daily planning, run by the Chief of Staff

The goal is that HK approves a plan instead of writing every task. Once a
day, or whenever HK says "plan today," the Chief of Staff agent does this.

## What the Chief of Staff reads
1. docs/2_state/BLOCK_PLAN.md, for the real priorities and the current
   "Assignments by agent" block.
2. docs/2_state/DONE_FEED.md, for what every agent shipped since yesterday.
3. The Risk Register and anything in docs/2_state that changed.

## What it hands back
A short plan for the day, in this shape:

- Top of mind: the one or two things that matter most today, and why.
- Per agent: the two or three tasks to run next, each with its tier
  (green, amber, red) and a one-line reason it is next.
- For each top task, a full prompt the agent can run as is. Write the
  prompt the way the Agent Board's "Generate full prompt" button would:
  goal, specifics, the MyBodyMap rules, and what done looks like.
- Waiting on HK: anything red, or anything that needs a decision before it
  can move.

Keep it plain and short. HK reads it, reorders or trims, then dispatches by
saying "run engineering 1" and so on.

## Rules
- Recommend, do not act. The Chief of Staff plans and writes prompts. It
  does not push code or send anything to customers.
- Green can be queued to run on its own. Amber is draft for HK. Red is HK
  only. Never plan a red task to run unattended.
- The plan is a recommendation. HK always has the final say on order.

## Later
This is run by hand today: HK says "plan today" in the Chief of Staff chat.
When it earns its place, we add a timer so the plan is waiting each morning.
