#!/usr/bin/env bash
# Category CRUD against /v1/categories.
#
# Usage:
#   scripts/testing/categories.sh list
#   scripts/testing/categories.sh create NAME [PARENT_ID] [ICON] [COLOR]
#   scripts/testing/categories.sh get    ID
#   scripts/testing/categories.sh update ID NAME [PARENT_ID] [ICON] [COLOR]
#   scripts/testing/categories.sh delete ID

set -euo pipefail
source "$(dirname "$0")/_env.sh"

cmd="${1:-list}"; shift || true

build_body() {
    local name="$1" parent="${2:-}" icon="${3:-}" color="${4:-}"
    local parent_json
    if [ -n "$parent" ]; then
        parent_json="\"$parent\""
    else
        parent_json="null"
    fi
    printf '{"name":"%s","parent_id":%s,"icon":"%s","color":"%s"}' \
        "$name" "$parent_json" "$icon" "$color"
}

case "$cmd" in
    list)
        banner "GET /v1/categories"
        api GET /categories | pretty
        ;;
    create)
        name="${1:?name required}"
        body=$(build_body "$name" "${2:-}" "${3:-}" "${4:-}")
        banner "POST /v1/categories ($name)"
        api POST /categories "$body" | pretty
        ;;
    get)
        id="${1:?id required}"
        banner "GET /v1/categories/$id"
        api GET "/categories/$id" | pretty
        ;;
    update)
        id="${1:?id required}"; name="${2:?name required}"
        body=$(build_body "$name" "${3:-}" "${4:-}" "${5:-}")
        banner "PUT /v1/categories/$id"
        api PUT "/categories/$id" "$body" | pretty
        ;;
    delete)
        id="${1:?id required}"
        banner "DELETE /v1/categories/$id"
        api DELETE "/categories/$id" | pretty
        ;;
    *)
        echo "unknown subcommand: $cmd" >&2
        exit 2
        ;;
esac
