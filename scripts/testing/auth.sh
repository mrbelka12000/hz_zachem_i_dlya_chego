#!/usr/bin/env bash
# Auth flows: register / login / refresh / me / logout.
#
# Usage:
#   scripts/testing/auth.sh register [EMAIL] [PASSWORD]
#   scripts/testing/auth.sh login    [EMAIL] [PASSWORD]
#   scripts/testing/auth.sh refresh
#   scripts/testing/auth.sh me
#   scripts/testing/auth.sh logout
#
# Defaults: EMAIL=user@example.com, PASSWORD=correct-horse-battery
#
# A cookie jar at $COOKIE_JAR is written so subsequent scripts inherit auth.

set -euo pipefail
source "$(dirname "$0")/_env.sh"

cmd="${1:-me}"
email="${2:-user@example.com}"
password="${3:-correct-horse-battery}"

case "$cmd" in
    register)
        banner "POST /v1/auth/register ($email)"
        api POST /auth/register \
            "{\"email\":\"$email\",\"password\":\"$password\",\"household_name\":\"My household\"}" \
            | pretty
        ;;
    login)
        banner "POST /v1/auth/login ($email)"
        api POST /auth/login \
            "{\"email\":\"$email\",\"password\":\"$password\"}" \
            | pretty
        ;;
    refresh)
        banner "POST /v1/auth/refresh"
        api POST /auth/refresh "" | pretty
        ;;
    me)
        banner "GET /v1/me"
        api GET /me | pretty
        ;;
    logout)
        banner "POST /v1/auth/logout"
        api POST /auth/logout "" | pretty
        ;;
    *)
        echo "unknown subcommand: $cmd" >&2
        echo "usage: $0 {register|login|refresh|me|logout} [email] [password]" >&2
        exit 2
        ;;
esac
