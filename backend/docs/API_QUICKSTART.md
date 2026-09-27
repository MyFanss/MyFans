# API Quickstart for New Contributors

A practical guide to getting the MyFans backend API running locally, making your first authenticated request, and understanding the conventions you'll encounter when contributing.

> **OpenAPI is the source of truth.** The committed spec at [`backend/openapi.json`](../openapi.json) is generated from the running app and drift-tested in CI. Every controller path registered in `AppModule` must either appear in the spec or be explicitly marked internal/excluded. See [OpenAPI source of truth](#13-openapi-source-of-truth) below.

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
  -H "Authorization: Bearer $TOKEN" \
  -d '{"refreshToken": "<REFRESH_TOKEN>"}'
```

### Logging out

```bash
# Logout from current session
curl -s -X POST http://localhost:3001/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN"

# Logout from all sessions
curl -s -X POST http://localhost:3001/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"all": true}'
```

---

## 5. Key API areas

| Area | Base path | Notes |
|------|-----------|-------|
| Auth | `/v1/auth` | Challenge/verify, refresh, logout |
| Users | `/v1/users` | Profiles, settings |
| Subscriptions | `/v1/subscriptions` | Creator subscription tiers |
| Payments | `/v1/payments` | Stellar/Soroban payment intents |
| Content | `/v1/content` | Posts, media |
| Health | `/v1/health` | Liveness and readiness probes |

---

## 6. Request and response conventions

- All request and response bodies are JSON (`Content-Type: application/json`).
- Timestamps are ISO-8601 UTC strings.
- Monetary amounts are strings to avoid floating-point precision loss.
- IDs are UUIDs unless otherwise noted.
- Successful responses return the resource directly (no envelope).
- Errors use the shared error envelope described in [Error format](#10-error-format).

---

## 7. Rate limiting

Rate limits are enforced per IP (and per user when authenticated). Exceeding a
limit returns `429 Too Many Requests` with a `Retry-After` header.

| Scope | Limit |
|-------|-------|
| Auth endpoints | 5 req / min / IP |
| General API | 100 req / min / IP |

---

## 8. CSRF protection

State-changing requests from browsers must include the CSRF token issued at
login. Non-browser clients using Bearer tokens are exempt.

---

## 9. Idempotency

Mutating endpoints accept an `Idempotency-Key` header. Replaying the same key
returns the original response instead of re-executing the operation.

---

## 10. Error format

All errors are produced by the Nest exception filter and share a single
envelope. Clients should parse this shape rather than assuming a bare string
or a framework-specific body.

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "correlationId": "0f8fad5b-d9cb-469f-a165-70867728950e"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `statusCode` | `number` | HTTP status code, mirrors the response status. |
| `message` | `string` | Human-readable, safe-to-display summary. Never contains stack traces or internal details. |
| `code` | `string` | Stable machine-readable error code (e.g. `VALIDATION_ERROR`, `UNAUTHORIZED`). |
| `correlationId` | `string` | Request correlation id. Surface this to users on fatal errors so support can trace the request. |

### Client parsing notes

- **Non-JSON bodies.** A proxy or gateway may return HTML or an empty body. Treat any body that does not parse as JSON as an unknown error and fall back to the HTTP status.
- **Network failures.** A request that never reaches the server has no envelope. Synthesize one with a client-side code (e.g. `NETWORK_ERROR`) and no `correlationId`.
- **Never render raw server output.** Do not display stack traces, SQL, or internal messages. Only show `message` and, on fatal errors, `correlationId`.

---

## 11. Running backend tests

```bash
cd backend
npm test          # unit tests
npm run test:e2e  # end-to-end tests
```

---

## 12. Adding a new endpoint — checklist

- [ ] Controller method decorated with the appropriate HTTP verb and path.
- [ ] DTOs validated with `class-validator`.
- [ ] `@Public()` only when the route is genuinely unauthenticated.
- [ ] Errors thrown via the shared exception types so the filter emits the standard envelope.
- [ ] OpenAPI spec regenerated (`npm run openapi:generate`).
- [ ] Unit and e2e tests added.

---

## 13. OpenAPI source of truth

The committed spec at [`backend/openapi.json`](../openapi.json) is generated
from the running app and drift-tested in CI. Regenerate it whenever routes or
schemas change.

---

## 14. Ledger clock and skew budget

The backend tolerates a bounded clock skew between the API host and the
Stellar ledger close time. Requests signed outside the skew budget are
rejected with `code: "CLOCK_SKEW"`.
