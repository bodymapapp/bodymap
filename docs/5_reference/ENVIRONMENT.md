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
- **Google Calendar OAuth / Google Auth Platform.** The Cloud project is named "BodyMap" and is owned by **bodymap01@gmail.com** (the founder login and the account that owns the OAuth project and Search Console). Confirmed from the OAuth Overview and Verification Center on 2026-06-12:
  - App verification: VERIFIED by Google. Branding: VERIFIED and shown to users. So brand and app verification are already done.
  - Verification Center reports verification is NOT required because the project, as declared, is not requesting any sensitive or restricted scopes.
  - No authorized domains are set on the project. No Cloud billing account is linked (minor warning, not blocking).
  - Known mismatch to resolve: the `google-calendar-connect` edge function requests `calendar.events` (a sensitive scope) at runtime, but that scope is NOT declared in the project's Data Access, which is why Google reports no sensitive scopes. Likely net effect is the Track A state: therapists may see a one-time "unverified app" screen when connecting their calendar, with a 100-user cap on that scope.
  - To remove that warning and cap (only if it is actually appearing): declare `calendar.events` under Data Access, add `mybodymap.app` as an authorized domain (needs Search Console domain verification under bodymap01@gmail.com), then submit in the Verification Center with a scope justification and a demo video. Brand and app verification are already done, so that review is lighter.
  - Open check before doing any of the above: connect Google Calendar as a test therapist and watch for the "Google hasn't verified this app" screen. If it does not appear, no further verification is needed.
