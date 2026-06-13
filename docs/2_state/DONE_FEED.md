# Done feed

The shared "what got done" log. When any agent finishes a task, it adds one
short line at the TOP, newest first. Every agent reads the recent lines at
the start of a session, so everyone knows what the others have shipped
without anyone having to route messages. See docs/3_playbooks/SYNC.md.

Format:  YYYY-MM-DD  [agent]  one plain sentence.

---

2026-06-12  [engineering]  Confirmed the Google "unverified app" warning shows on Google Calendar connect (Joy therapist account), so the calendar.events sensitive scope needs to be declared and the app submitted for verification. Light path because brand and app verification are already done. Updated the Google note in ENVIRONMENT.md from open-check to confirmed.
2026-06-12  [engineering]  Recorded Google Auth Platform status in ENVIRONMENT.md: the Cloud project "BodyMap" (owner bodymap01@gmail.com) is already app-verified and branding-verified by Google, and the Verification Center reports no sensitive scopes declared even though the calendar-connect code requests calendar.events. Logged the mismatch and the steps to fully verify the calendar scope if the unverified warning is actually showing.
2026-06-12  [engineering]  Deuce gate is live: scripts/submit-pr.sh helper on main, plus a main-branch ruleset requiring a pull request, the Vercel check, and an up-to-date branch, with no bypass for anyone, so direct pushes to main are now blocked. Merge queue deferred (it needs an organization-owned repo; ours is on a personal account). Verified: direct push rejected, clean PR auto-merges when green, broken-build PR refused.
2026-06-12  [engineering]  Agent Board mobile redesign: lane grid replaces scrolling tabs (all lanes visible), bigger lane header, collapsible legend, tier stripe on cards. Founder Hub now has an always-visible Back to app button to /dashboard, fixing the no-way-out trap. Desktop unchanged. Shipped but unverified by HK.
2026-06-12  [engineering]  Agent Board now mobile-friendly: one lane at a time with a tab row, bigger card and check tap targets, stacked legend and publish bar. Desktop unchanged. Shipped but unverified by HK.
2026-06-12  [engineering]  Agent Board rebuilt Trello-style: drag and drop, Doing/Done buttons, green/amber/red tier, click-in detail with Generate full prompt.
