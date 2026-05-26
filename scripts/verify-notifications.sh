#!/bin/bash
# scripts/verify-notifications.sh
#
# Fire each notification edge function once against Joy demo and
# report results. Run from ~/Documents/bodymap with the service-role
# JWT in scope:
#
#   export SERVICE_ROLE_JWT="eyJhbGc..."
#   bash scripts/verify-notifications.sh
#
# Output: per-touchpoint pass/fail with response body. Check
# bodymap01@gmail.com for the client emails and bodymapdemo@gmail.com
# for the therapist emails.
#
# HK May 26 2026: built during verification of the May 26 notification
# expansion (chunks 1-4 plus safety gates).

set -u

SUPABASE_URL="https://rmnqfrljoknmellbnpiy.supabase.co"

if [ -z "${SERVICE_ROLE_JWT:-}" ]; then
  echo ""
  echo "ERROR: SERVICE_ROLE_JWT env var not set"
  echo ""
  echo "Get it from: Supabase Dashboard -> Project rmnqfrljoknmellbnpiy -> Settings -> API"
  echo "Look for 'service_role' key (NOT anon key)"
  echo ""
  echo "Then run:"
  echo "  export SERVICE_ROLE_JWT=\"eyJhbGc...your-key-here\""
  echo "  bash scripts/verify-notifications.sh"
  echo ""
  exit 1
fi

JOY_THERAPIST_ID="2a2886c3-00f2-4c6f-aaec-4b8150c61fcf"
JOY_CLIENT_ID="ce205279-3800-4335-b1c7-0b5ad1092a14"

# Find the most recent Joy demo booking. Some functions need a
# real booking_id; we use the latest one regardless of status.
echo ""
echo "===================================================="
echo "Notification verification pass for Joy demo"
echo "===================================================="
echo ""
echo "Looking up the latest Joy demo booking..."

BOOKING_RESPONSE=$(curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/bookings?therapist_id=eq.${JOY_THERAPIST_ID}&client_id=eq.${JOY_CLIENT_ID}&order=created_at.desc&limit=1&select=id,booking_date,start_time,service,status" \
  -H "Authorization: Bearer $SERVICE_ROLE_JWT" \
  -H "apikey: $SERVICE_ROLE_JWT")

BOOKING_ID=$(echo "$BOOKING_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data[0]['id'] if data else '')" 2>/dev/null || echo "")

if [ -z "$BOOKING_ID" ]; then
  echo ""
  echo "ERROR: No Joy demo booking found. Either:"
  echo "  - Service role JWT is wrong"
  echo "  - Or Joy demo has no bookings"
  echo ""
  echo "Raw response from booking lookup:"
  echo "$BOOKING_RESPONSE"
  exit 1
fi

echo "Found booking: $BOOKING_ID"
echo ""

# Helper: fire one function, print result
fire() {
  local fn=$1
  local payload=$2
  local label=$3

  echo "----------------------------------------"
  echo "FIRING: $label"
  echo "  Function: $fn"
  echo "  Payload:  $payload"

  local response=$(curl -s -w "\nHTTP %{http_code}" -X POST \
    "${SUPABASE_URL}/functions/v1/${fn}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SERVICE_ROLE_JWT" \
    -H "apikey: $SERVICE_ROLE_JWT" \
    -d "$payload")

  echo "  Response: $response"
  echo ""
  sleep 1
}

# ─── Tier 1 + 2: event-driven ──────────────────────────────────
fire "send-intake-reminder" \
  "{\"booking_id\":\"$BOOKING_ID\"}" \
  "C3 Intake reminder"

fire "send-reminder-48h" \
  "{\"booking_id\":\"$BOOKING_ID\"}" \
  "C4 48-hour reminder"

fire "send-therapist-cancelled" \
  "{\"booking_id\":\"$BOOKING_ID\",\"reason\":\"Test fire from verification script. I caught a cold and need to reschedule.\"}" \
  "C7 Therapist cancelled (client email)"

fire "send-client-cancelled-within-policy" \
  "{\"booking_id\":\"$BOOKING_ID\"}" \
  "C8 Client cancelled within policy"

fire "send-client-cancelled-late" \
  "{\"booking_id\":\"$BOOKING_ID\",\"fee_amount_cents\":5000,\"fee_charged\":true}" \
  "C9 Client cancelled late, fee charged"

fire "send-reschedule-confirmation" \
  "{\"booking_id\":\"$BOOKING_ID\",\"prev_date\":\"2026-05-20\",\"prev_time\":\"10:00:00\"}" \
  "C10 Reschedule confirmation"

fire "send-no-show-charged" \
  "{\"booking_id\":\"$BOOKING_ID\",\"fee_amount_cents\":7500,\"charge_id\":\"ch_test_verification\"}" \
  "C11 No-show charged"

fire "send-no-show-payment-request" \
  "{\"booking_id\":\"$BOOKING_ID\",\"fee_amount_cents\":7500,\"payment_link_url\":\"https://buy.stripe.com/test_verification_link\"}" \
  "C12 No-show payment request"

fire "send-no-show-occurred" \
  "{\"booking_id\":\"$BOOKING_ID\",\"fee_charged\":true,\"fee_amount_cents\":7500}" \
  "T12 No-show occurred (therapist alert)"

# ─── Tier 3: lapse trio (gated, will skip if master toggle off) ──
echo ""
echo "===================================================="
echo "Lapse trio: requires Joy therapist to have"
echo "  lapse_checkins_enabled_at SET in therapists table"
echo "Otherwise these return status=skipped"
echo "===================================================="
echo ""

fire "send-lapse-nudge" \
  "{\"client_id\":\"$JOY_CLIENT_ID\"}" \
  "C14 Lapse nudge"

fire "send-lapse-final-nudge" \
  "{\"client_id\":\"$JOY_CLIENT_ID\"}" \
  "C15 Lapse final nudge"

fire "send-lapse-signal" \
  "{\"therapist_id\":\"$JOY_THERAPIST_ID\"}" \
  "T10 Lapse signal"

# ─── Summary ──────────────────────────────────────────────────
echo ""
echo "===================================================="
echo "ALL TESTS DISPATCHED"
echo "===================================================="
echo ""
echo "Check inboxes:"
echo "  Client emails (C-series):  bodymap01@gmail.com"
echo "  Therapist emails (T-series): bodymapdemo@gmail.com"
echo ""
echo "Note: anything with status='skipped' likely needs a master"
echo "toggle ON in the therapists table. Run this SQL to enable"
echo "all three on Joy:"
echo ""
echo "  UPDATE therapists SET"
echo "    intake_reminders_enabled_at = NOW(),"
echo "    lapse_checkins_enabled_at = NOW(),"
echo "    renewal_alerts_enabled_at = NOW()"
echo "  WHERE id = '$JOY_THERAPIST_ID';"
echo ""
echo "Then re-run this script."
echo ""
