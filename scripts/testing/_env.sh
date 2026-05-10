#!/usr/bin/env bash
# Shared env + helpers for the Phase 1 API smoke scripts.
# Source this from every script: `source "$(dirname "$0")/_env.sh"`.

set -euo pipefail

: "${BASE_URL:=http://localhost:8080}"
: "${COOKIE_JAR:=/tmp/hz_zachem_cookies.txt}"
: "${API_PREFIX:=/v1}"

API="${BASE_URL}${API_PREFIX}"

if ! command -v jq >/dev/null 2>&1; then
    echo "scripts/testing requires jq (brew install jq)" >&2
    exit 1
fi

# Pretty-print the response. Falls back to raw text if not JSON.
pretty() {
    if [ -t 1 ]; then
        jq . 2>/dev/null || cat
    else
        cat
    fi
}

# req METHOD PATH [JSON_BODY]
# Sends a request with the cookie jar attached. Idempotency-Key honored if set.
req() {
    local method="$1"
    local path="$2"
    local body="${3:-}"
    local args=(-sS -X "$method" -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
        -H 'Content-Type: application/json' \
        -H 'Accept: application/json')
    if [ -n "${IDEMPOTENCY_KEY:-}" ]; then
        args+=(-H "Idempotency-Key: ${IDEMPOTENCY_KEY}")
    fi
    if [ -n "$body" ]; then
        args+=(--data "$body")
    fi
    curl "${args[@]}" "${BASE_URL}${path}"
}

# api METHOD PATH [JSON_BODY] — like req but prepends $API_PREFIX.
api() {
    local method="$1"
    local path="$2"
    shift 2
    req "$method" "${API_PREFIX}${path}" "$@"
}

# Extract a JSON field, abort on missing.
require_field() {
    local field="$1"
    local value
    value=$(jq -er "$field" 2>/dev/null) || {
        echo "missing field $field in response" >&2
        return 1
    }
    printf '%s' "$value"
}

banner() { printf '\n=== %s ===\n' "$*"; }
