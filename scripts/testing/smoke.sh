#!/usr/bin/env bash
# Phase-1 end-to-end smoke test.
#
# Walks the verification flow from .claude/plan/budget-app.md:
#   1. health
#   2. register a fresh user
#   3. /me
#   4. create accounts (Cash, Card)
#   5. create categories (Groceries, Transport, Salary)
#   6. POST one income, several expenses, one transfer
#   7. list transactions, filter by uncategorized
#   8. spending-by-category, spending-by-month, top-merchants
#   9. soft-delete one transaction (follow-up GET should 404)
#   10. archive an account
#   11. idempotency-key replay returns the original row
#
# Exits 0 on success; non-zero on first failed assertion.
# Requires the API to be running locally (make infra-up && make run).

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/_env.sh"

EMAIL="${SMOKE_EMAIL:-smoke-$(date +%s)@example.com}"
PASSWORD="${SMOKE_PASSWORD:-correct-horse-battery}"

# Reset cookie jar so we always start fresh.
: > "$COOKIE_JAR"

assert_field() {
    local field="$1" expected="$2" json="$3"
    local got
    got=$(echo "$json" | jq -er "$field")
    if [ "$got" != "$expected" ]; then
        echo "ASSERT FAILED: $field expected '$expected' got '$got'" >&2
        exit 1
    fi
}

# 1. Health.
banner "1) health"
"$HERE/health.sh" >/dev/null

# 2. Register.
banner "2) register $EMAIL"
register_resp=$(api POST /auth/register \
    "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"household_name\":\"Smoke household\"}")
echo "$register_resp" | pretty
USER_ID=$(echo "$register_resp" | jq -er '.user_id')
HOUSEHOLD_ID=$(echo "$register_resp" | jq -er '.household_id')

# 3. /me.
banner "3) /me"
me=$(api GET /me)
echo "$me" | pretty
assert_field '.user_id' "$USER_ID" "$me"

# 4. Accounts.
banner "4) create accounts"
cash=$(api POST /accounts '{"name":"Cash","type":"cash","currency":"KZT","initial_balance":"0"}')
card=$(api POST /accounts '{"name":"Card","type":"card","currency":"KZT","initial_balance":"0"}')
echo "$cash" | pretty; echo "$card" | pretty
CASH_ID=$(echo "$cash" | jq -er '.id')
CARD_ID=$(echo "$card" | jq -er '.id')

# 5. Categories.
banner "5) create categories"
groceries=$(api POST /categories '{"name":"Groceries","parent_id":null,"icon":"","color":""}')
transport=$(api POST /categories '{"name":"Transport","parent_id":null,"icon":"","color":""}')
salary=$(api POST /categories '{"name":"Salary","parent_id":null,"icon":"","color":""}')
echo "$groceries" | pretty; echo "$transport" | pretty; echo "$salary" | pretty
GROCERIES_ID=$(echo "$groceries" | jq -er '.id')
TRANSPORT_ID=$(echo "$transport" | jq -er '.id')
SALARY_ID=$(echo "$salary" | jq -er '.id')

# 6. Transactions: 1 income, 2 expenses, 1 transfer.
banner "6) seed transactions"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
api POST /transactions "{\"account_id\":\"$CARD_ID\",\"type\":\"income\",\"amount\":\"500000\",\"occurred_at\":\"$NOW\",\"description\":\"April salary\",\"merchant\":\"Employer\",\"category_id\":\"$SALARY_ID\"}" | pretty
api POST /transactions "{\"account_id\":\"$CARD_ID\",\"type\":\"expense\",\"amount\":\"15000\",\"occurred_at\":\"$NOW\",\"description\":\"Magnum\",\"merchant\":\"Magnum\",\"category_id\":\"$GROCERIES_ID\"}" | pretty
TRX=$(api POST /transactions "{\"account_id\":\"$CASH_ID\",\"type\":\"expense\",\"amount\":\"500\",\"occurred_at\":\"$NOW\",\"description\":\"Bus\",\"merchant\":\"Bus\",\"category_id\":\"$TRANSPORT_ID\"}")
echo "$TRX" | pretty
TRX_ID=$(echo "$TRX" | jq -er '.id')

# Transfer Card -> Cash.
api POST /transactions/transfer "{\"from_account_id\":\"$CARD_ID\",\"to_account_id\":\"$CASH_ID\",\"amount\":\"10000\",\"occurred_at\":\"$NOW\",\"description\":\"ATM withdrawal\"}" | pretty

# 7. List + uncategorized filter.
banner "7) list transactions / uncategorized"
api GET /transactions | pretty
api GET '/transactions?uncategorized=true' | pretty

# 8. Analytics.
banner "8) analytics"
FROM=$(date -u +"%Y-%m-01T00:00:00Z")
TO=$(date -u +"%Y-%m-%dT23:59:59Z")
api GET "/analytics/spending-by-category?from=${FROM}&to=${TO}" | pretty
api GET '/analytics/spending-by-month?months=3' | pretty
api GET "/analytics/top-merchants?from=${FROM}&to=${TO}&limit=5" | pretty

# 9. Soft-delete one transaction.
banner "9) soft-delete transaction"
api DELETE "/transactions/$TRX_ID" >/dev/null
status=$(curl -sS -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" "${API}/transactions/$TRX_ID" || true)
if [ "$status" != "404" ]; then
    echo "expected 404 after soft-delete, got $status" >&2
    exit 1
fi
echo "OK soft-delete returned 404 for follow-up GET"

# 10. Archive an account.
banner "10) archive Cash account"
api PATCH "/accounts/$CASH_ID/archive" "" >/dev/null
api GET /accounts | pretty
api GET '/accounts?archived=true' | pretty

# 11. Idempotency-Key replay.
banner "11) idempotency-key replay"
KEY="smoke-$(date +%s)-idem"
IDEMPOTENCY_KEY="$KEY" first=$(api POST /transactions "{\"account_id\":\"$CARD_ID\",\"type\":\"expense\",\"amount\":\"123\",\"description\":\"Idem test\"}")
IDEMPOTENCY_KEY="$KEY" second=$(api POST /transactions "{\"account_id\":\"$CARD_ID\",\"type\":\"expense\",\"amount\":\"123\",\"description\":\"Idem test\"}")
first_id=$(echo "$first" | jq -er '.id')
second_id=$(echo "$second" | jq -er '.id')
if [ "$first_id" != "$second_id" ]; then
    echo "idempotency replay produced different IDs: $first_id vs $second_id" >&2
    exit 1
fi
echo "OK idempotency-key replay returned same id $first_id"

banner "ALL CHECKS PASSED ($EMAIL)"
