# scripts/testing

Curl-based smoke scripts for the Phase 1 API.

## Prereqs

- Postgres + RabbitMQ running locally: `make infra-up`
- API running: `make run`
- `jq` installed (`brew install jq` / `apt install jq`)

## Layout

| Script            | Purpose                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `_env.sh`         | Sourced by everything else. Sets `BASE_URL`, helpers `req`/`api`/`pretty`. |
| `health.sh`       | `GET /healthz` and `/readyz`.                                    |
| `auth.sh`         | `register`, `login`, `refresh`, `me`, `logout` subcommands.      |
| `accounts.sh`     | Account CRUD + archive/unarchive/delete.                         |
| `categories.sh`   | Category CRUD.                                                   |
| `transactions.sh` | Transaction CRUD + transfer + filtered list.                     |
| `analytics.sh`    | `by-category`, `by-month`, `top-merchants`.                      |
| `smoke.sh`        | End-to-end runner that exercises every endpoint and asserts. Exits non-zero on first failure. |

All scripts share the cookie jar at `/tmp/hz_zachem_cookies.txt`, so once
you `auth.sh register` (or `smoke.sh` does it for you) the rest run
authenticated.

## Quick start

```bash
# One-shot smoke against a fresh user.
scripts/testing/smoke.sh

# Or step through manually.
scripts/testing/auth.sh register me@example.com hunter2pwhunter2
scripts/testing/accounts.sh create Cash cash KZT 0
scripts/testing/categories.sh create Groceries
scripts/testing/transactions.sh list
```

## Env knobs

| Var               | Default                              |
| ----------------- | ------------------------------------ |
| `BASE_URL`        | `http://localhost:8080`              |
| `API_PREFIX`      | `/v1`                                |
| `COOKIE_JAR`      | `/tmp/hz_zachem_cookies.txt`         |
| `IDEMPOTENCY_KEY` | unset (set per call to test replay)  |
| `SMOKE_EMAIL`     | `smoke-<unix>@example.com`           |
| `SMOKE_PASSWORD`  | `correct-horse-battery`              |

## Idempotency

`transactions.sh create` and `smoke.sh` honor `IDEMPOTENCY_KEY`:

```bash
IDEMPOTENCY_KEY=$(uuidgen) scripts/testing/transactions.sh create $ACC expense 1500 "Test"
# Re-running with the same key returns the original transaction.
```

## CI

`smoke.sh` is suitable for CI as a black-box check after `make run`.
Failure modes:

- Missing `jq` → exit 1 with a hint.
- API unreachable → curl error.
- Any assertion mismatch (`.user_id`, soft-delete 404, idempotency
  replay returns different `.id`) → exits non-zero with the field name.
