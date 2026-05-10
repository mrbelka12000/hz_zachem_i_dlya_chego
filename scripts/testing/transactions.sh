#!/usr/bin/env bash
# Transactions against /v1/transactions and /v1/transactions/transfer.
#
# Usage:
#   scripts/testing/transactions.sh list [QUERY_STRING]
#   scripts/testing/transactions.sh create   ACCOUNT_ID TYPE AMOUNT [DESCRIPTION] [MERCHANT] [CATEGORY_ID]
#   scripts/testing/transactions.sh transfer FROM_ACCOUNT TO_ACCOUNT AMOUNT [DESCRIPTION]
#   scripts/testing/transactions.sh get      ID
#   scripts/testing/transactions.sh update   ID AMOUNT [DESCRIPTION] [MERCHANT] [CATEGORY_ID]
#   scripts/testing/transactions.sh delete   ID
#
# TYPE in {expense, income, adjustment}. transfer endpoint sets type itself.
# Set IDEMPOTENCY_KEY=<uuid> to test idempotent re-POST.

set -euo pipefail
source "$(dirname "$0")/_env.sh"

cmd="${1:-list}"; shift || true

now_iso() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

case "$cmd" in
    list)
        qs="${1:-}"
        if [ -n "$qs" ]; then
            banner "GET /v1/transactions?$qs"
            api GET "/transactions?$qs" | pretty
        else
            banner "GET /v1/transactions"
            api GET /transactions | pretty
        fi
        ;;
    create)
        acc="${1:?account_id required}"; type="${2:?type required}"; amount="${3:?amount required}"
        desc="${4:-}"; merchant="${5:-}"; cat="${6:-}"
        cat_json="null"; [ -n "$cat" ] && cat_json="\"$cat\""
        body=$(printf '{"account_id":"%s","type":"%s","amount":"%s","occurred_at":"%s","description":"%s","merchant":"%s","category_id":%s}' \
            "$acc" "$type" "$amount" "$(now_iso)" "$desc" "$merchant" "$cat_json")
        banner "POST /v1/transactions ($type $amount)"
        api POST /transactions "$body" | pretty
        ;;
    transfer)
        from="${1:?from_account_id required}"; to="${2:?to_account_id required}"; amount="${3:?amount required}"; desc="${4:-Transfer}"
        body=$(printf '{"from_account_id":"%s","to_account_id":"%s","amount":"%s","occurred_at":"%s","description":"%s"}' \
            "$from" "$to" "$amount" "$(now_iso)" "$desc")
        banner "POST /v1/transactions/transfer"
        api POST /transactions/transfer "$body" | pretty
        ;;
    get)
        id="${1:?id required}"
        banner "GET /v1/transactions/$id"
        api GET "/transactions/$id" | pretty
        ;;
    update)
        id="${1:?id required}"; amount="${2:?amount required}"
        desc="${3:-}"; merchant="${4:-}"; cat="${5:-}"
        cat_json="null"; [ -n "$cat" ] && cat_json="\"$cat\""
        body=$(printf '{"amount":"%s","occurred_at":"%s","description":"%s","merchant":"%s","category_id":%s}' \
            "$amount" "$(now_iso)" "$desc" "$merchant" "$cat_json")
        banner "PUT /v1/transactions/$id"
        api PUT "/transactions/$id" "$body" | pretty
        ;;
    delete)
        id="${1:?id required}"
        banner "DELETE /v1/transactions/$id"
        api DELETE "/transactions/$id" | pretty
        ;;
    *)
        echo "unknown subcommand: $cmd" >&2
        exit 2
        ;;
esac
