#!/usr/bin/env bash
# scripts/twilio-verify.sh
#
# Verify Twilio credentials and inspect phone numbers on the account.
# Run this LOCALLY in HK's terminal after rotating the Auth Token.
#
# Usage:
#   export TWILIO_ACCOUNT_SID="AC..."
#   export TWILIO_AUTH_TOKEN="..."        # the NEW one after rotation
#   bash scripts/twilio-verify.sh
#
# Optional: test-send an SMS to your own phone.
#   export TEST_TO="+18325551234"         # your iPhone number
#   bash scripts/twilio-verify.sh --send-test

set -e

if [ -z "$TWILIO_ACCOUNT_SID" ] || [ -z "$TWILIO_AUTH_TOKEN" ]; then
  echo "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN env vars first."
  echo "  export TWILIO_ACCOUNT_SID='AC...'"
  echo "  export TWILIO_AUTH_TOKEN='...'"
  exit 1
fi

API="https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID"
AUTH="-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"

echo "=== STEP 1: Verifying account access ==="
ACCT=$(curl -s $AUTH "$API.json")
if echo "$ACCT" | grep -q '"status":"active"'; then
  echo "Account active. Friendly name: $(echo "$ACCT" | grep -o '"friendly_name":"[^"]*"' | cut -d'"' -f4)"
else
  echo "Account check failed. Response:"
  echo "$ACCT"
  exit 1
fi

echo ""
echo "=== STEP 2: Listing phone numbers on account ==="
NUMBERS=$(curl -s $AUTH "$API/IncomingPhoneNumbers.json")
echo "$NUMBERS" | python3 -c '
import sys, json
data = json.load(sys.stdin)
nums = data.get("incoming_phone_numbers", [])
if not nums:
    print("  (no phone numbers on account)")
else:
    for n in nums:
        sms_cap = n.get("capabilities", {}).get("SMS", False)
        print(f"  {n[\"phone_number\"]}  SID: {n[\"sid\"]}  SMS: {sms_cap}")
'

echo ""
echo "=== STEP 3: Checking A2P 10DLC compliance status ==="
# Brand registrations
BRANDS=$(curl -s $AUTH "https://messaging.twilio.com/v1/a2p/BrandRegistrations")
BRAND_COUNT=$(echo "$BRANDS" | python3 -c 'import sys,json; print(len(json.load(sys.stdin).get("brand_registrations", [])))' 2>/dev/null || echo "0")
echo "  Brand registrations: $BRAND_COUNT"
if [ "$BRAND_COUNT" -gt 0 ]; then
  echo "$BRANDS" | python3 -c '
import sys, json
data = json.load(sys.stdin)
for b in data.get("brand_registrations", []):
    print(f"    Brand SID: {b[\"sid\"]}  Status: {b[\"status\"]}  Type: {b.get(\"brand_type\", \"?\")}")
'
fi

# Messaging services
SERVICES=$(curl -s $AUTH "https://messaging.twilio.com/v1/Services")
SVC_COUNT=$(echo "$SERVICES" | python3 -c 'import sys,json; print(len(json.load(sys.stdin).get("services", [])))' 2>/dev/null || echo "0")
echo "  Messaging services: $SVC_COUNT"
if [ "$SVC_COUNT" -gt 0 ]; then
  echo "$SERVICES" | python3 -c '
import sys, json
data = json.load(sys.stdin)
for s in data.get("services", []):
    print(f"    Service SID: {s[\"sid\"]}  Friendly Name: {s[\"friendly_name\"]}")
'
fi

echo ""
if [ "$1" = "--send-test" ]; then
  if [ -z "$TEST_TO" ]; then
    echo "Set TEST_TO env var (your phone in E.164) to send a test SMS."
    echo "  export TEST_TO='+18325551234'"
    exit 1
  fi
  echo "=== STEP 4: Sending test SMS ==="
  echo "  From: +15136133033"
  echo "  To:   $TEST_TO"
  echo "  Body: Test from MyBodyMap. If you see this, Twilio is working."
  RESULT=$(curl -s $AUTH -X POST "$API/Messages.json" \
    --data-urlencode "From=+15136133033" \
    --data-urlencode "To=$TEST_TO" \
    --data-urlencode "Body=Test from MyBodyMap. If you see this, Twilio is working.")
  STATUS=$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status", "unknown"))' 2>/dev/null || echo "error")
  ERR=$(echo "$RESULT" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("message", "")) if "error_code" in d else print("")' 2>/dev/null || echo "")
  echo "  Status: $STATUS"
  if [ -n "$ERR" ]; then
    echo "  Error: $ERR"
    echo ""
    echo "  Note: pre-10DLC sends to non-verified numbers may fail with carrier filtering errors."
    echo "  This is expected — the test confirms your credentials work, even if the SMS itself"
    echo "  is blocked by US carriers until your A2P 10DLC campaign is approved."
  else
    echo "  Check your phone in 5-30 seconds."
  fi
else
  echo "To test-send an SMS to yourself, run:"
  echo "  export TEST_TO='+18325551234'   # your iPhone number"
  echo "  bash scripts/twilio-verify.sh --send-test"
fi

echo ""
echo "=== DONE ==="
