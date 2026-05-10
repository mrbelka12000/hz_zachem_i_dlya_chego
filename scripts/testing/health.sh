#!/usr/bin/env bash
# Liveness + readiness probes (no auth required).
#
# Usage: scripts/testing/health.sh

set -euo pipefail
source "$(dirname "$0")/_env.sh"

banner "GET /healthz"
curl -sS "${BASE_URL}/healthz" | pretty

banner "GET /readyz"
curl -sS "${BASE_URL}/readyz" | pretty
