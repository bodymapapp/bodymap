# MyBodyMap Environment Variables and Secrets

**Last updated:** May 6, 2026 (after HK pointed out that secrets I asked for were already set)

This is the canonical list of environment variables and Supabase Edge Function secrets that already exist for MyBodyMap. **Future Claude sessions: check this file BEFORE asking HK to set up secrets.** Most things you might think need setting up are already done.

## Operating principle

**Verify, don't assume.** Before asking HK to create a secret or env var, do at least one of:
1. Check this file for the canonical name
2. Check `git grep "ENV_VAR_NAME"` to find existing usage
3. Ask HK to share a screenshot of their current Supabase secrets

If a secret exists under a slightly different name than what new code expects, **rename the code, not the secret**. The secret has been working in production for months; new code is the thing that needs to fit the existing convention.

## Supabase Edge Function secrets

These are set in Supabase project Settings → Edge Functions → Secrets, and exposed to edge functions via `Deno.env.get()`.

| Secret name | Set since | Purpose | Read by |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Mar 16, 2026 | AI session prep, intake summaries | session-summary, intake-prep |
| `CAL_API_KEY` | Mar 16, 2026 | Cal.com calendar sync (legacy) | cal-sync (deprecated) |
| `CAL_CLIENT_ID` | Mar 29, 2026 | Cal.com OAuth | cal-oauth (deprecated) |
| `CAL_CLIENT_SECRET` | Mar 22, 2026 | Cal.com OAuth | cal-oauth (deprecated) |
| `STRIPE_SECRET_KEY` | Apr 4, 2026 | Stripe REST API auth (platform key) | All Stripe edge functions |
| `STRIPE_PUBLISHABLE_KEY` | Mar 22, 2026 | Stripe Elements client-side init | Frontend env (REACT_APP_) |
| `RESEND_API_KEY` | Mar 30, 2026 | Transactional email sending | All email-sending edge functions |
| `FB_PAGE_ACCESS_TOKEN` | Apr 14, 2026 | Facebook page posting | fb-post |
| **`SQUARE_APP_ID`** | **Apr 18, 2026** | **Square OAuth + Web Payments SDK application id** | **square-oauth, square-oauth-callback, _shared/providers/square/v1.ts** |
| **`SQUARE_APP_SECRET`** | **Apr 18, 2026** | **Square OAuth client secret** | **square-oauth-callback** |
| `VAPID_PUBLIC_KEY` | Apr 18, 2026 | Web Push notifications (browser-side) | Frontend env |
| `VAPID_PRIVATE_KEY` | Apr 18, 2026 | Web Push notifications (server-side) | push-send |
| `VAPID_SUBJECT` | Apr 18, 2026 | Web Push notifications (mailto:) | push-send |
| `SUPABASE_URL` | (auto) | Supabase project URL | All edge functions |
| `SUPABASE_SERVICE_ROLE_KEY` | (auto) | Service-role auth from edge functions | All edge functions |

## Naming conventions established in this codebase

- **Square:** `SQUARE_APP_ID` (NOT `SQUARE_APPLICATION_ID`). This abbreviated form is what was set Apr 18, 2026 and what `square-oauth` + `square-oauth-callback` already use.
- **Stripe:** `STRIPE_SECRET_KEY` for platform secret, `STRIPE_PUBLISHABLE_KEY` for client-side. No `_API_KEY` suffix.
- **Frontend env vars** (loaded by Create React App): prefix with `REACT_APP_`, defined in Vercel project settings, NOT in Supabase secrets. Example: `REACT_APP_SUPABASE_URL`, `REACT_APP_STRIPE_PUBLISHABLE_KEY`.

## Frontend environment variables (Vercel)

Set in Vercel dashboard → project → Settings → Environment Variables.

| Var | Purpose |
|---|---|
| `REACT_APP_SUPABASE_URL` | Supabase project URL for client SDK |
| `REACT_APP_SUPABASE_ANON_KEY` | Anonymous public key for client SDK |
| `REACT_APP_STRIPE_PUBLISHABLE_KEY` | Stripe Elements client-side init |

## Things that DON'T need a separate env var

- **Square Application ID for the frontend** — not needed as a separate env var. The frontend gets it from the `init-card-setup` edge function response, which reads it from `SQUARE_APP_ID` server-side. Frontend never sees it directly.
- **Therapist's Stripe account id** — stored on the therapist row (`therapists.stripe_account_id`), not in env.
- **Therapist's Square access token** — stored on the therapist row (`therapists.square_access_token`), not in env.

## Common Claude failure modes (to avoid)

1. **Assuming a secret needs creating because the variable name in code is new.** Search the codebase first; the secret may exist under a similar name (e.g. `SQUARE_APP_ID` vs `SQUARE_APPLICATION_ID`). Rename the code to match the existing secret.

2. **Asking HK to "set up Stripe Connect" or "configure Stripe webhooks".** Stripe Connect is already configured. Webhooks are already configured. The platform secret key has been in production since April 4, 2026.

3. **Asking HK to "create a Supabase project" or "configure a database".** The project (`rmnqfrljoknmellbnpiy`) has been in production for over a year. All core tables exist. Migrations are additive only.

4. **Confusing OAuth client_id with the merchant id.** The Square Application ID is the OAuth app's id (used by Web Payments SDK and OAuth). The merchant id is a per-therapist value stored on the therapist row.

## What to do if a secret is genuinely missing

If after searching the codebase + this file + Supabase secrets dashboard, a needed secret really doesn't exist:
1. Confirm with HK with the exact name and purpose
2. Have HK set it via Supabase dashboard or `supabase secrets set NAME=value`
3. **Add a row to this file documenting the new secret**
4. Note the date and the function(s) that read it

This file is the source of truth. Keep it updated.

## Integration and infrastructure status

Last updated: 2026-06-12 by [engineering]. Current state of long-running integrations and infra, so any agent can answer "is it on right now" without digging through the done feed. Update the line when status changes.

- **Deuce gate (main branch protection):** LIVE since 2026-06-12. Ruleset "Deuce: protect main" on the default branch requires a pull request, the "Vercel" status check, and an up-to-date branch, with no bypass for anyone (including the shared bodymapapp account the agents use). Direct pushes to main are blocked. Submit work with `bash scripts/submit-pr.sh "title"`. Merge queue is deferred until the repo moves to a GitHub organization (merge queue is unavailable on personal-account repos). Emergency rollback: disable or delete the ruleset in repo Settings.
- **Google OAuth verification (Google Auth Platform).** Project "BodyMap", owner/login **bodymap01@gmail.com**. Supabase project ref `rmnqfrljoknmellbnpiy` (also listed as an authorized domain). DNS for mybodymap.app is at **Cloudflare** (nameservers `cleo.ns.cloudflare.com`, `meg.ns.cloudflare.com`); the site is proxied through Cloudflare to Vercel. Scopes in use: `calendar.events` (sensitive, shown as "View and edit events on all your calendars") plus `userinfo.email`; no restricted scopes. Goal: remove the "Google hasn't verified this app" warning therapists see on calendar connect, and lift the 100-user cap.
  - Brand and app verification: already DONE (verified by Google, branding shown to users).
  - Part 1, domain verification: DONE. mybodymap.app auto-verified in Search Console under bodymap01@gmail.com via the Cloudflare provider integration. Do NOT delete the verification DNS record at Cloudflare.
  - Part 2, authorized domains (Branding): DONE. Authorized domains are `mybodymap.app` and `rmnqfrljoknmellbnpiy.supabase.co`. Home page `https://mybodymap.app`, privacy `https://mybodymap.app/privacy`, terms `https://mybodymap.app/terms`.
  - Part 3, declare scope (Data Access): DONE. `calendar.events` added as a sensitive scope; Google now shows "verification required."
  - Part 4, justification plus demo video: IN PROGRESS. Justification text is drafted (below). The demo video is NOT yet recorded; this is the current blocker, the same point a prior attempt stopped at.
  - Part 5, submit (Verification Center): PENDING the video.
  - Ready-to-paste scope justification: "MyBodyMap is a scheduling app for independent massage therapists. When a therapist connects their Google Calendar, the app uses calendar.events to create an event on the therapist's own calendar for each session booked in MyBodyMap, and to update or delete that event when the session is rescheduled or cancelled. We only create and manage the events MyBodyMap itself generates for the signed-in therapist; we do not read or use their other calendar data. A narrower scope is not sufficient because the feature must create and modify calendar events on the therapist's behalf, which calendar.events provides at the minimum level needed."
  - Demo video requirements (per support.google.com/cloud/answer/13464321): show the end-to-end flow including the OAuth grant; show the same app (name MyBodyMap and branding); show the complete OAuth consent screen with the exact `calendar.events` scope visible and the consent screen language set to English (toggle at bottom-left); and demonstrate the functionality that uses the scope (a session being written to the therapist's Google Calendar). Upload to YouTube (unlisted is fine) and paste the link in the Data Access "Demo video" field.
  - Possible Google pushback: `calendar.events` covers "all your calendars," so Google may recommend a narrower scope such as `calendar.app.created` or `calendar.events.owned`. If they do, reply to their email to confirm downscoping or explain why calendar.events is needed. Do not remove an approved scope until Google instructs.
  - Security Assessment (the third-party audit in the requirements doc): NOT required for MyBodyMap. That requirement applies to RESTRICTED scopes only; `calendar.events` is a sensitive scope, not restricted. No annual third-party security assessment, no cost on that front.
  - Brand verification section of the requirements (homepage, branding, domain ownership, project contact): already satisfied. Google has marked branding "verified and shown to users," which means those checks passed.
  - Privacy policy (limited-use disclosure): the one content item still worth confirming. The policy is already linked from both the homepage and the consent screen (brand verification passed), but for the sensitive-scope review it must also DISCLOSE that the app accesses Google Calendar via calendar.events, what it does with it (create, update, delete the therapist's session events), and that the data is not sold or transferred. ACTION: confirm `https://mybodymap.app/privacy` says this in plain language; add a short paragraph if missing. Not yet verified by engineering (could not load the live page).
  - Timeline: brand and app are already verified, so expect roughly 3 to 5 business days for the sensitive-scope review when clean.
