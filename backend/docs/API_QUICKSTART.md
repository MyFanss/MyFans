# API Quickstart for New Contributors

A practical guide to getting the MyFans backend API running locally, making your first authenticated request, and understanding the conventions you'll encounter when contributing.

> **OpenAPI is the source of truth.** The committed spec at [`backend/openapi.json`](../openapi.json) is generated from the running app and drift-tested in CI. Every controller path registered in `AppModule` must either appear in the spec or be explicitly marked internal/excluded. See [OpenAPI source of truth](#13-openapi-source-of-truth) below.

> **Mounted routes only.** `AppModule` only registers modules whose files exist in `backend/src`. Modules that are not implemented yet are not mounted, so their routes return `404` until the module lands and is added back to the `imports` array. See [Routes not yet mounted](#routes-not-yet-mounted) below.

---

## Table of Contents

1. [Start the backend locally](#1-start-the-backend-locally)
2. [Explore the API with Swagger UI](#2-explore-the-api-with-swagger-ui)
3. [Authentication flow](#3-authentication-flow)
4. [Making authenticated requests](#4-making-authenticated-requests)
5. [Key API areas](#5-key-api-areas)
6. [Request and response conventions](#6-request-and-response-conventions)
7. [Rate limiting](#7-rate-limiting)
8. [CSRF protection](#8-csrf-protection)
9. [Idempotency](#9-idempotency)
10. [Error format](#10-error-format)
11. [Running backend tests](#11-running-backend-tests)
12. [Adding a new endpoint — checklist](#12-adding-a-new-endpoint--checklist)
13. [OpenAPI source of truth](#13-openapi-source-of-truth)
14. [Ledger clock and skew budget](#14-ledger-clock-and-skew-budget)

---

## 1. Start the backend locally

The fastest path is Docker Compose (no local Postgres or Node install needed).
All services — API, Postgres, Redis, email-outbox worker, and Soroban-event
poller — are started in one command.

```bash
# From repository root
cp backend/.env.example backend/.env.dev
# Edit backend/.env.dev — at minimum set:
#   JWT_SECRET  (generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
#   DB_PASSWORD (any strong password)

docker compose -f docker-compose.dev.yml --profile dev up
```

The backend starts on **http://localhost:3001** with hot reload.

### Services started by compose

| Service | Description | Port |
|---------|-------------|------|
| `postgres` | PostgreSQL 15 (persistent volume) | 5432 |
| `redis` | Redis 7 cache / session store | 6379 |
| `api` | NestJS backend (hot-reload) | 3001 |
| `worker-poller` | Soroban event poller — indexes chain events so subscription state stays current | — |
| `worker-outbox` | Transactional email outbox processor — delivers queued emails | — |
| `frontend` | Next.js dev server | 3000 |

All services must report **healthy** before dependent services start.
The API readiness probe (`/v1/health/ready`) is used as the gate — it
checks Postgres and Redis before the frontend is allowed to connect.

### Verifying compose health

```bash
# All services should show "healthy"
docker compose -f docker-compose.dev.yml ps

# Tail logs for a specific service
docker compose -f docker-compose.dev.yml logs -f worker-poller
docker compose -f docker-compose.dev.yml logs -f worker-outbox
```

Verify it's up:

```bash
curl http://localhost:3001/v1/health
# {"status":"up","timestamp":"2026-08-28T00:00:00.000Z"}
```

### Health and readiness probes

The backend exposes two distinct probe endpoints (both public, no token needed):

| Endpoint | Purpose | Example response / status |
|----------|---------|---------------------------|
| `GET /v1/health` | **Liveness** — the process is up and able to handle requests. It is deliberately cheap and never probes dependencies, so a DB/Redis/RPC outage does not trigger an orchestrator restart. | `200` with `{"status":"up","timestamp":"..."}` |
| `GET /v1/health/ready` | **Readiness** — the instance is fit to receive traffic. Probes the database (mandatory) and Redis when configured (mandatory); Soroban RPC is probed but optional. | `200` when ready, `503` when the database or a configured Redis is down |

```bash
# Liveness (process up only)
curl -s http://localhost:3001/v1/health

# Readiness (probes DB, Redis-if-configured, and optional RPC)
curl -s http://localhost:3001/v1/health/ready
# 200 {"status":"up","checks":{"database":{"status":"up",...},...}}
```

Kubernetes probe example — point the liveness probe at `/v1/health` and the
readiness probe at `/v1/health/ready` so traffic is only routed to instances
whose dependencies are actually reachable:

```yaml
livenessProbe:
  httpGet:
    path: /v1/health
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /v1/health/ready
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 3
```

The same split applies to Docker Compose / load-balancer healthchecks: use
`/v1/health` for "is the container alive" and `/v1/health/ready` for "is it
safe to route traffic here".

### Manual setup (without Docker)

```bash
# 1. Start PostgreSQL (example using Docker for just the DB)
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=myfans \
  -e POSTGRES_USER=myfans \
  postgres:15

# 2. Configure the backend
cd backend
cp .env.example .env
# Edit .env — set DB_*, JWT_SECRET, STELLAR_NETWORK, SOROBAN_RPC_URL

# 3. Install dependencies and start
npm install
npm run start:dev
# Runs on http://localhost:3000 (or PORT from .env)
```

See [`DEVELOPMENT.md`](../../DEVELOPMENT.md) for the full local dev guide.

---

## 2. Explore the API with Swagger UI

Once the backend is running, open:

```
http://localhost:3001/api-docs
```

Swagger UI lists every endpoint with request/response schemas, lets you try requests directly in the browser, and shows which routes require authentication.

The same document is committed as [`backend/openapi.json`](../openapi.json) and is the canonical, machine-readable contract for the API. Regenerate it with:

```bash
cd backend
npm run openapi:generate
```

---

## 3. Authentication flow

The API uses **JWT Bearer tokens** issued after a Stellar wallet challenge-response. All endpoints are protected by default; use `@Public()` to opt out.

### Step 1 — Request a challenge

```bash
curl -s -X POST http://localhost:3001/v1/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"address": "<YOUR_STELLAR_PUBLIC_KEY>"}'
```

Response:

```json
{
  "nonce": "abc123...",
  "expiresAt": "2026-05-30T12:05:00.000Z"
}
```

### Step 2 — Sign the nonce with your Stellar key

Use the Stellar SDK or Freighter wallet to sign the nonce string with your Ed25519 private key. The signature must be hex-encoded.

```typescript
// Example using @stellar/stellar-sdk
import { Keypair } from '@stellar/stellar-sdk';

const keypair = Keypair.fromSecret('<YOUR_SECRET_KEY>');
const signature = keypair.sign(Buffer.from(nonce)).toString('hex');
```

### Step 3 — Verify the signature and receive a JWT

```bash
curl -s -X POST http://localhost:3001/v1/auth/challenge/verify \
  -H "Content-Type: application/json" \
  -d '{
    "address": "<YOUR_STELLAR_PUBLIC_KEY>",
    "nonce": "<NONCE_FROM_STEP_1>",
    "signature": "<HEX_SIGNATURE>"
  }'
```

Response:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> **Rate limit:** Auth endpoints are limited to 5 requests per minute per IP. See [Rate limiting](#7-rate-limiting).

---

## 4. Making authenticated requests

Include the JWT as a Bearer token in the `Authorization` header:

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Get current user profile
curl -s http://localhost:3001/v1/users/me \
  -H "Authorization: Bearer $TOKEN"

# Health check (public — no token needed)
curl -s http://localhost:3001/v1/health
```

### Refreshing tokens

```bash
curl -s -X POST http://localhost:3001/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 5. Key API areas

| Area | Base path | Notes |
|------|-----------|-------|
| Auth | `/v1/auth` | Challenge/verify, refresh, logout |
| Users | `/v1/users` | Profiles, settings |
| Plans | `/v1/plans` | Creator subscription plans and metadata |
| Subscriptions | `/v1/subscriptions` | Subscribe, cancel, renew |
| Creators | `/v1/creators` | Creator directory and search (see below) |
| Webhooks | `/v1/webhooks` | HMAC-signed provider callbacks |

### Creators list response

`GET /v1/creators` returns a page of creators. Each item uses `handle` (not `username`) for the public name.

Query parameters:

| Parameter | Description |
|-----------|-------------|
| `limit` | Page size, 1–50. Defaults to `12`. |
| `cursor` | Pagination cursor. Accepted, but the response does not currently return a next cursor. |
| `q` | Search term. Trimmed and capped at 100 characters. Ignored when shorter than 2 characters. |

```bash
curl -s "http://localhost:3001/v1/creators?limit=2&q=ann"
```

```json
{
  "creators": [
    {
      "id": "7f3c2a1e-0b9d-4c8e-9a51-2d6f4b8e1a10",
      "handle": "annbuilds",
      "displayName": "Ann Builds",
      "avatarUrl": null,
      "bio": "Weekly tutorials on indie game art.",
      "subscriberCount": 128,
      "isVerified": false
    }
  ],
  "total": 1,
  "updatedAt": "2026-08-28T00:00:00.000Z"
}
```

- `creators` — the page of items above.
- `total` — the number of items in this response, not the total number of creators.
- `updatedAt` — ISO 8601 UTC time the response was built.

> **Not mounted yet.** `CreatorsController` exists, but `CreatorsModule` is not in the `AppModule` imports, so `GET /v1/creators` returns `404` until it is added.

### Plan metadata `asset` field

The `asset` field on plan metadata accepts **either** of two forms:

1. **Classic Stellar asset code** — 2 to 12 uppercase alphanumeric characters, e.g. `USDC`. Lowercase codes are rejected; short codes are uppercased before storage.
2. **Soroban contract address** — a 56-character string starting with `C`, e.g. `CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`. This is the identifier the subscription contract actually charges, and it is stored unchanged.

Empty strings, URLs (e.g. `javascript:`, `http://...`), and values containing spaces are rejected. Before checkout confirms, the stored `asset` is compared against the asset the chain returns for the plan.

### Plan metadata `interval` field

The `interval` field on plan metadata stores a **raw ledger count** (a positive
integer), which is directly comparable to the `u64` `interval` the subscription
contract stores. A zero interval is rejected.

For convenience the write API also accepts a compact **day label** such as `30d`,
which is converted to ledgers using the five-second ledger assumption
(`LEDGERS_PER_DAY = 17_280`, matching the contract's `PERIOD_LEDGERS`):
`30d` becomes `518400`. The converted ledger count — not the label — is what is
stored.

Every plan also returns an `intervalLabel` derived from the stored ledgers:
day-aligned counts render as the compact `Nd` form (e.g. `30d`), while any other
count is marked explicitly as `N ledgers` so it can never be mistaken for a
month-length plan.

**Temporary rule (no chain lookup yet):** the metadata service does not yet read
the plan back from the chain, so it cannot reject a metadata update whose ledger
count differs from the on-chain plan. Until chain lookup lands, callers must set
`interval` to the exact ledger count used by `create_plan` on-chain; the derived
label is authoritative only for display.

---

## 6. Request and response conventions

- All request bodies are JSON (`Content-Type: application/json`).
- Timestamps are ISO 8601 UTC strings.
- Monetary amounts are strings to avoid floating-point precision loss.
- Pagination uses `?limit=&cursor=` query parameters.

---

## 7. Rate limiting

Rate limits are applied per IP (and per user where authenticated). Auth endpoints are limited to 5 requests per minute per IP. Exceeding a limit returns `429 Too Many Requests` with a `Retry-After` header.

---

## 8. CSRF protection

State-changing requests from browsers must include the CSRF token issued by the API. Server-to-server calls using Bearer tokens are exempt.

---

## 9. Idempotency

Mutating endpoints accept an `Idempotency-Key` header. Replaying a request with the same key returns the original response instead of re-executing the operation.

### Sending `Idempotency-Key` on checkout confirm

`POST /v1/checkout/confirm` **requires** the `Idempotency-Key` header. Use a unique value per checkout attempt (for example, a UUID), and reuse it only when retrying the same request.

```bash
curl -s -X POST http://localhost:3001/v1/checkout/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 5f0c2b1e-9d3a-4c7b-8e2f-1a2b3c4d5e6f" \
  -d '{"planId": "plan_example_123"}'
```

| Outcome | When it happens | Response |
|---------|-----------------|----------|
| Replay | Same key, same body, after the first request finished | Original response is returned |
| Conflict | Same key, different body, or the first request is still in flight | `409 Conflict` |
| Missing header | No `Idempotency-Key` sent | `400 Bad Request` |

For the detailed rules (key scoping, TTL, storage backends, and failure modes), see [`IDEMPOTENCY.md`](./IDEMPOTENCY.md).

---

## 10. Error format

Errors follow a consistent shape:

```json
{
  "statusCode": 400,
  "message": "Human-readable description",
  "error": "Bad Request"
}
```

---

## 11. Running backend tests

```bash
cd backend
npm test
```

---

## 12. Adding a new endpoint — checklist

1. Create the controller/service in `backend/src/<area>`.
2. Register the module in `AppModule`.
3. Add DTOs with validation decorators.
4. Add tests in a `.spec.ts` file.
5. Regenerate `openapi.json` with `npm run openapi:generate`.

---

## 13. OpenAPI source of truth

The committed spec at [`backend/openapi.json`](../openapi.json) is generated from the running app and drift-tested in CI. Every controller path registered in `AppModule` must either appear in the spec or be explicitly marked internal/excluded.

---

## 14. Ledger clock and skew budget

The API tolerates a bounded clock skew between the host and the Stellar ledger. Requests whose ledger timestamp falls outside the skew budget are rejected.
