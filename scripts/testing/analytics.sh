#!/usr/bin/env bash
# Analytics endpoints under /v1/analytics.
#
# Usage:
#   scripts/testing/analytics.sh by-category [FROM] [TO]
#   scripts/testing/analytics.sh by-month   [MONTHS]
#   scripts/testing/analytics.sh top-merchants [FROM] [TO] [LIMIT]
#
# FROM/TO are RFC3339 (e.g. 2026-01-01T00:00:00Z). Defaults: last 30 days.

set -euo pipefail
source "$(dirname "$0")/_env.sh"

cmd="${1:-by-category}"; shift || true

iso_days_ago() {
    local days="$1"
    if date -v-1d +%s >/dev/null 2>&1; then
        date -u -v-${days}d +"%Y-%m-%dT%H:%M:%SZ"           # macOS / BSD
    else
        date -u -d "-${days} days" +"%Y-%m-%dT%H:%M:%SZ"    # GNU
    fi
}

now_iso() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

case "$cmd" in
    by-category)
        from="${1:-$(iso_days_ago 30)}"
        to="${2:-$(now_iso)}"
        banner "GET /v1/analytics/spending-by-category"
        api GET "/analytics/spending-by-category?from=${from}&to=${to}" | pretty
        ;;
    by-month)
        months="${1:-6}"
        banner "GET /v1/analytics/spending-by-month?months=$months"
        api GET "/analytics/spending-by-month?months=${months}" | pretty
        ;;
    top-merchants)
        from="${1:-$(iso_days_ago 30)}"
        to="${2:-$(now_iso)}"
        limit="${3:-10}"
        banner "GET /v1/analytics/top-merchants"
        api GET "/analytics/top-merchants?from=${from}&to=${to}&limit=${limit}" | pretty
        ;;
    *)
        echo "unknown subcommand: $cmd" >&2
        exit 2
        ;;
esac
