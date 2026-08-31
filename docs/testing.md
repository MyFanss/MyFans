# Testing Guide

## Overview

MyFans uses three layers of automated testing:

| Layer | Runner | Scope |
|-------|--------|-------|
| Backend unit | Jest | Services, guards, pipes, DTOs |
| Backend e2e | Jest + Supertest | Full HTTP stack against real Postgres |
| Frontend e2e | Playwright | Critical user flows in a real browser |

Security suites (CSRF, RBAC, rate-limit, security-hardening, CORS) run as
part of the backend e2e job on every PR so auth and IDOR bugs are caught
before merge.

---

## Backend — unit tests

```bash
cd backend
npm test                  # run all unit tests once
npm run test:watch        # watch mode (development)
npm run test:cov          # with coverage report
```

Test files live alongside source as `*.spec.ts`. Property-based tests use
[fast-check](https://fast-check.dev/) and end in `*.properties.spec.ts`.

---

## Backend — e2e tests

E2e tests require a running PostgreSQL instance. The fastest option is the
dev compose stack:

```bash
# Start only Postgres and Redis (no app containers needed)
docker compose -f docker-compose.dev.yml up postgres redis -d

# Wait for Postgres to be healthy, then run the full e2e suite
cd backend
npm run test:e2e
```

Or using the minimal env file:

```bash
cd backend
DB_HOST=localhost DB_PORT=5432 DB_USER=myfans DB_PASSWORD=myfans_dev \
DB_NAME=myfans JWT_SECRET=dev-secret WEBHOOK_SECRET=dev-webhook \
STELLAR_NETWORK=testnet SOROBAN_RPC_URL=http://localhost:8000 \
STARTUP_MODE=degraded STARTUP_PROBE_RPC=false \
npm run test:e2e
```

### Security suites

The following suites are included in the required CI e2e job and must pass
on every PR:

| Suite | File | What it covers |
|-------|------|----------------|
| Security hardening | `test/security-hardening.e2e-spec.ts` | Helmet headers, rate-limit on auth, brute-force protection |
| CSRF | `test/csrf.e2e-spec.ts` | Double-submit cookie enforcement on all mutating routes |
| RBAC | `test/rbac.e2e-spec.ts` | Role-based access control: creator vs fan vs admin |
| Rate limiting | `test/rate-limit.e2e-spec.ts` | Throttle tiers per endpoint |
| CORS | `test/cors-security.e2e-spec.ts` | Allowed origins, preflight, credentials |

**Soroban RPC** is not required — the e2e suite uses `STARTUP_PROBE_RPC=false`
and `FEATURE_SOROBAN_POLLER=false` by default in CI.

### Artifacts

When the CI e2e job fails, logs are uploaded to GitHub Actions as
`backend-e2e-logs` and retained for 7 days.

---

## Frontend — Playwright e2e

Required specs run on every PR (sharded across 2 runners):

| Spec file | Covers |
|-----------|--------|
| `smoke.spec.ts` | Homepage, wallet connect, gated content gate, subscribe page |
| `subscribe-flow-complete.spec.ts` | Full subscribe → access gated content journey |
| `cancel-renew-flow.spec.ts` | Cancel subscription, renew expired subscription |
| `content-actions.spec.ts` | Like optimistic update, error rollback, banner dismiss |
| `network-status.spec.ts` | Operational / degraded / offline / connection-lost states |

All specs mock Stellar/Soroban RPC and the backend API via Playwright
`route()` interception — no live infrastructure is required.

### Run locally

```bash
cd frontend
npm ci
npx playwright install --with-deps chromium

# Run all required PR specs
npx playwright test smoke.spec.ts subscribe-flow-complete.spec.ts \
  cancel-renew-flow.spec.ts content-actions.spec.ts network-status.spec.ts

# Run the full suite
npm run test:e2e

# Open the HTML report
npx playwright show-report
```

### Flake policy

Target: **≥ 95 % pass rate** across 30-day rolling window.

Flaky tests are tracked in `frontend/docs/PLAYWRIGHT_FLAKE_TRIAGE.md`.
A test that flakes more than twice in a week must be:
1. Fixed and stabilised, **or**
2. Quarantined (moved to a non-required optional workflow) with a tracking
   issue opened, **within 5 business days**.

### Artifacts

When the CI Playwright job fails, the HTML report and raw test results are
uploaded as `playwright-report-shard-*` and retained for 7 days.

---

## CI matrix

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `ci.yml` | PR + push to main | backend-unit, backend-e2e (Postgres service), frontend-unit |
| `e2e-pr.yml` | PR to main | Playwright required specs (2 shards) |
| `security-audit.yml` | PR + push to main + weekly schedule | npm audit backend, npm audit frontend, cargo audit |
