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

---

## 1. Start the backend locally

The fastest path is Docker Compose (no local Postgres or Node install needed):

```bash
# From repository root
cp .env.dev.example .env.dev
# Edit .env.dev — at minimum set JWT_SECRET to a random value:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

docker compose -f docker-compose.dev.yml --profile dev up
```

The backend starts on **http://localhost:3001** with hot reload.

Verify it's up:

```bash
curl http://localhost:3001/v1/health
# {"status":"ok","timestamp":"..."}
```

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
  -H "Content-Type: application/json" \
  -d '{"all_devices": true}'
```

---

## 5. Key API areas

All routes are versioned under `/v1/`.

| Area | Base path | Description |
|------|-----------|-------------|
| Auth | `/v1/auth` | Wallet challenge/verify, token refresh, logout |
| Users | `/v1/users` | User profiles (`GET /me`, `PATCH /me`) |
| Creators | `/v1/creators` | Creator profiles and subscription plans |
| Subscriptions | `/v1/subscriptions` | Subscribe, list, check subscription state |
| Posts | `/v1/posts` | Create, list, update, delete posts |
| Comments | `/v1/comments` | Comment CRUD on posts |
| Conversations | `/v1/conversations` | Messaging between users |
| Notifications | `/v1/notifications` | List, mark-read, delete notifications |
| Content | `/v1/content` | Content upload and IPFS pinning |
| Analytics | `/v1/analytics` | Creator analytics data |
| Health | `/v1/health` | Service and subsystem health checks |
| Feature flags | `/v1/feature-flags` | Runtime feature flag state |
| CSRF | `/v1/csrf/token` | Fetch CSRF token for state-mutating requests |

---

## 6. Request and response conventions

### Versioning

All routes use URI versioning: `/v1/...`. The default version is `1`.

### Pagination

List endpoints accept `page` and `limit` query parameters and return a paginated envelope:

```json
{
  "data": [...],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### Correlation IDs

Every request and response carries an `X-Correlation-ID` header. If you send one in the request it is echoed back; otherwise the server generates one. Include it in bug reports to trace a specific request through logs.

```bash
curl -s http://localhost:3001/v1/health \
  -H "X-Correlation-ID: my-debug-request-001" \
  -i | grep -i x-correlation
```

### Content type

All request bodies must be `application/json`. Responses are always `application/json`.

---

## 7. Rate limiting

The API uses tiered rate limits enforced by `@nestjs/throttler`:

| Tier | TTL | Limit | Applied to |
|------|-----|-------|------------|
| `auth` | 60 s | 5 req | Auth endpoints |
| `short` | 60 s | 10 req | Sensitive write endpoints |
| `medium` | 60 s | 50 req | Standard endpoints |
| `long` | 60 s | 100 req | Read-heavy endpoints |

When a limit is exceeded the API returns `429 Too Many Requests`. See [`docs/RATE_LIMITING.md`](./RATE_LIMITING.md) for the full policy.

---

## 8. CSRF protection

State-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) require a valid CSRF token in the `X-CSRF-Token` header. Fetch a token first:

```bash
# 1. Fetch CSRF token (public endpoint — no auth needed)
CSRF_TOKEN=$(curl -s http://localhost:3001/v1/csrf/token | jq -r '.token')

# 2. Use it in state-mutating requests
curl -s -X POST http://localhost:3001/v1/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hello", "body": "World"}'
```

CSRF tokens are double-submit cookies — the server sets a cookie and expects the same value in the header. See [`docs/CORS_AND_SECURITY_HEADERS.md`](./CORS_AND_SECURITY_HEADERS.md) for details.

---

## 9. Idempotency

Certain write endpoints support idempotency keys to prevent duplicate operations on retry. Send an `Idempotency-Key` header with a unique UUID:

```bash
curl -s -X POST http://localhost:3001/v1/subscriptions/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"planId": "<PLAN_ID>"}'
```

If the same key is sent twice, the second request returns the original response instead of creating a duplicate. Keys are scoped per user and expire after 24 hours.

---

## 10. Error format

All errors follow a consistent envelope:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "correlationId": "..."
}
```

Common status codes:

| Code | Meaning |
|------|---------|
| `400` | Validation error — check the request body |
| `401` | Missing or invalid JWT |
| `403` | Authenticated but not authorized |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate subscription) |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error — include `correlationId` in bug reports |

---

## 11. Running backend tests

```bash
cd backend

# Unit tests
npm test

# End-to-end tests (requires a running Postgres)
npm run test:e2e

# OpenAPI drift test — fails if a controller path is undocumented
npm run test:openapi
```

---

## 12. Adding a new endpoint — checklist

1. Add the controller method with the appropriate decorators (`@Get`, `@Post`, etc.).
2. Add `@ApiOperation` / `@ApiResponse` decorators so the route is documented.
3. If the route is internal (health, metrics) or a webhook, mark it excluded from the public spec (see below).
4. Regenerate the spec: `npm run openapi:generate`.
5. Run the drift test: `npm run test:openapi`.
6. Commit both the code change and the updated `backend/openapi.json`.

---

## 13. OpenAPI source of truth

The committed [`backend/openapi.json`](../openapi.json) is generated from the running NestJS app by [`backend/scripts/generate-openapi.ts`](../scripts/generate-openapi.ts). It is the canonical contract for clients and is kept in sync by a CI drift test.

### How drift is detected

The drift test enumerates every controller path registered in `AppModule` and asserts that each one is either:

- present in `openapi.json`, or
- explicitly excluded via the internal/excluded allowlist (health checks, webhooks).

If a controller path is neither documented nor excluded, CI fails. This prevents both **undocumented routes** (shipped but invisible to clients) and **ghost docs** (documented but no longer served).

### Excluded paths

The following are intentionally excluded from the public spec:

| Path | Reason |
|------|--------|
| `/v1/health` | Internal liveness/readiness probe |
| `/v1/health/*` | Internal subsystem health checks |
| Webhook receivers | Third-party callbacks, not client-facing |

### Security schemes

Admin routes must declare a security scheme in the generated spec. A route under an admin path that is exposed without an `@ApiSecurity` / bearer scheme will fail the drift test — admin endpoints must never be publicly documented without authentication.

### Servers

The spec declares the versioned server base path:

```json
"servers": [{ "url": "/v1" }]
```

### Regenerating the baseline

```bash
cd backend
npm run openapi:generate   # writes backend/openapi.json
npm run test:openapi       # verifies no drift
```

Commit the regenerated `openapi.json` alongside any controller change so the baseline stays current.
