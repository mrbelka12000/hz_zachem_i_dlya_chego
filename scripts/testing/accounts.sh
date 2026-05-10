#!/usr/bin/env bash
# Account CRUD against /v1/accounts.
#
# Usage:
#   scripts/testing/accounts.sh list [archived]
#   scripts/testing/accounts.sh create NAME TYPE CURRENCY [INITIAL_BALANCE]
#   scripts/testing/accounts.sh get      ID
#   scripts/testing/accounts.sh update   ID NAME TYPE CURRENCY [INITIAL_BALANCE]
#   scripts/testing/accounts.sh archive  ID
#   scripts/testing/accounts.sh unarchive ID
#   scripts/testing/accounts.sh delete   ID
#
# Type in {cash, card, bank, other}. Currency = ISO 4217 (e.g. KZT).

set -euo pipefail
source "$(dirname "$0")/_env.sh"

cmd="${1:-list}"; shift || true

case "$cmd" in
    list)
        banner "GET /v1/accounts"
        if [ "${1:-}" = "archived" ]; then
            api GET '/accounts?archived=true' | pretty
        else
            api GET /accounts | pretty
        fi
        ;;
    create)
        name="${1:?name required}"
        type="${2:?type required}"
        currency="${3:?currency required}"
        balance="${4:-0}"
        banner "POST /v1/accounts ($name)"
        api POST /accounts \
            "{\"name\":\"$name\",\"type\":\"$type\",\"currency\":\"$currency\",\"initial_balance\":\"$balance\"}" \
            | pretty
        ;;
    get)
        id="${1:?id required}"
        banner "GET /v1/accounts/$id"
        api GET "/accounts/$id" | pretty
        ;;
    update)
        id="${1:?id required}"; name="${2:?name required}"; type="${3:?type required}"
        currency="${4:?currency required}"; balance="${5:-0}"
        banner "PUT /v1/accounts/$id"
        api PUT "/accounts/$id" \
            "{\"name\":\"$name\",\"type\":\"$type\",\"currency\":\"$currency\",\"initial_balance\":\"$balance\"}" \
            | pretty
        ;;
    archive)
        id="${1:?id required}"
        banner "PATCH /v1/accounts/$id/archive"
        api PATCH "/accounts/$id/archive" "" | pretty
        ;;
    unarchive)
        id="${1:?id required}"
        banner "PATCH /v1/accounts/$id/unarchive"
        api PATCH "/accounts/$id/unarchive" "" | pretty
        ;;
    delete)
        id="${1:?id required}"
        banner "DELETE /v1/accounts/$id"
        api DELETE "/accounts/$id" | pretty
        ;;
    *)
        echo "unknown subcommand: $cmd" >&2
        exit 2
        ;;
esac
