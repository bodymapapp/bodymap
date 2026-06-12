#!/usr/bin/env bash
#
# scripts/submit-pr.sh
# Hand the current branch to Deuce: push it, open a PR into main, arm auto-merge (squash).
#
# Usage: bash scripts/submit-pr.sh "short title of the change"
#
# Sandbox has git, node, npm, curl. It does NOT have gh and does NOT have jq,
# so this helper uses only git, curl, and node. It never prints the token and
# never writes it to a file.

set -euo pipefail

REPO="bodymapapp/bodymap"
API="https://api.github.com"

die() { echo "submit-pr: $*" >&2; exit 1; }

# --- 0. Title and branch ---------------------------------------------------
TITLE="${1:-}"
[ -n "$TITLE" ] || die 'missing PR title. Usage: bash scripts/submit-pr.sh "short title"'

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" != "main" ]  || die "refusing to run on main. Switch to a feature branch first."
[ "$BRANCH" != "HEAD" ]  || die "detached HEAD. Check out a named branch first."

# --- 1. Token: env first, else the token embedded in the origin URL --------
# Never printed, never written to a file.
TOKEN="${GITHUB_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  ORIGIN_URL="$(git remote get-url origin)"
  TOKEN="$(printf '%s' "$ORIGIN_URL" | sed -nE 's#https://[^:]+:([^@]+)@github\.com/.*#\1#p')"
fi
[ -n "$TOKEN" ] || die "no token found in GITHUB_TOKEN or the origin remote URL."

# --- 2. Push the branch ----------------------------------------------------
# Use the remote name so the tokenized URL is never echoed.
echo "submit-pr: pushing branch $BRANCH ..."
git push -u origin "$BRANCH" || die "git push failed for branch $BRANCH"

# --- 3. Open the PR (or find an existing open one) -------------------------
echo "submit-pr: opening PR $BRANCH into main ..."
CREATE_BODY="$(BR="$BRANCH" TT="$TITLE" node -e 'process.stdout.write(JSON.stringify({title:process.env.TT, head:process.env.BR, base:"main"}))')"

CREATE_RESP="$(curl -sS -w $'\n%{http_code}' -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  "$API/repos/$REPO/pulls" \
  -d "$CREATE_BODY")"
CREATE_CODE="$(printf '%s' "$CREATE_RESP" | tail -n1)"
CREATE_JSON="$(printf '%s' "$CREATE_RESP" | sed '$d')"

PR_INFO=""
if [ "$CREATE_CODE" = "201" ]; then
  PR_INFO="$(printf '%s' "$CREATE_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);process.stdout.write(`${r.number}\t${r.node_id}\t${r.html_url}`);})')"
elif [ "$CREATE_CODE" = "422" ]; then
  # A PR for this head likely already exists. Look it up with a GET.
  echo "submit-pr: create returned 422, looking up an existing open PR for $BRANCH ..."
  LIST_JSON="$(curl -sS -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
    "$API/repos/$REPO/pulls?head=bodymapapp:$BRANCH&base=main&state=open")"
  PR_INFO="$(printf '%s' "$LIST_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);if(!Array.isArray(a)||!a.length){process.stderr.write("none");process.exit(0);}const r=a[0];process.stdout.write(`${r.number}\t${r.node_id}\t${r.html_url}`);})')"
  [ -n "$PR_INFO" ] || die "create returned 422 but no open PR found for head $BRANCH. GitHub said: $CREATE_JSON"
else
  die "PR create failed (HTTP $CREATE_CODE). GitHub said: $CREATE_JSON"
fi

PR_NUMBER="$(printf '%s' "$PR_INFO" | cut -f1)"
PR_NODE="$(printf '%s' "$PR_INFO" | cut -f2)"
PR_URL="$(printf '%s' "$PR_INFO" | cut -f3)"
echo "submit-pr: PR #$PR_NUMBER is open -> $PR_URL"

# --- 4. Arm auto-merge (squash) via GraphQL -------------------------------
# No-gh equivalent of: gh pr merge --auto --squash
echo "submit-pr: arming auto-merge (squash) ..."
GQL_BODY="$(PID="$PR_NODE" node -e 'process.stdout.write(JSON.stringify({query:"mutation($id:ID!){enablePullRequestAutoMerge(input:{pullRequestId:$id, mergeMethod:SQUASH}){pullRequest{number autoMergeRequest{enabledAt mergeMethod}}}}", variables:{id:process.env.PID}}))')"

GQL_RESP="$(curl -sS -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$API/graphql" \
  -d "$GQL_BODY")"

AM_RESULT="$(printf '%s' "$GQL_RESP" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let r;try{r=JSON.parse(s);}catch(e){console.log("PARSE_ERROR: "+s.slice(0,400));return;}if(r.errors&&r.errors.length){console.log("ERROR: "+r.errors.map(e=>e.message).join(" | "));return;}const am=r.data&&r.data.enablePullRequestAutoMerge&&r.data.enablePullRequestAutoMerge.pullRequest&&r.data.enablePullRequestAutoMerge.pullRequest.autoMergeRequest;if(am){console.log("ARMED");}else{console.log("NOT_ARMED: response had no autoMergeRequest");}})')"

if [ "$AM_RESULT" = "ARMED" ]; then
  echo "submit-pr: auto-merge armed (squash). Deuce will merge $BRANCH when it is current and the build is green."
  echo "submit-pr: done -> $PR_URL"
else
  echo "submit-pr: PR is open at $PR_URL but auto-merge could NOT be armed." >&2
  echo "submit-pr: $AM_RESULT" >&2
  die "auto-merge arming failed. Fix the cause and rerun, the PR is already open so this will reuse it."
fi
