# Idempotency Middleware

## Overview

The `IdempotencyMiddleware` protects mutating routes (POST, PUT, PATCH) from
duplicate execution caused by network retries, user double-clicks, or mobile
app backgrounding. Clients supply an `Idempotency-Key` header; the platform
stores the first successful response in a **PostgreSQL-backed shared store** and
replays it for any subsequent request carrying the same key.

> **Delivery guarantee:** The system provides **at-least-once** delivery of the
> upstream side-effect. If the original handler succeeds but the response is
> lost in transit, the client may retry and receive the cached response.
> However, because on-chain transactions (e.g. Stellar payments) are submitted
> in the handler, the blockchain itself is the source of truth for
> exactly-once settlement. The idempotency layer prevents *duplicate API-level
> processing*, but does **not** guarantee exactly-once on-chain execution on its
> own -- the checkout handler must verify the on-chain transaction status before
> re-submitting.

---

## Header

| Item | Value |
|------|-------|
| **Header name** | `Idempotency-Key` |
| **Max length** | 255 characters |
| **Format** | Free-form string (UUID v4 recommended) |

Clients must generate a unique key per logical operation (e.g. per checkout
attempt). Re-using a key across different endpoints returns **422 Unprocessable
Entity**.

---

## Required Routes

The header is **mandatory** on payment/checkout routes to prevent accidental
double-charges:

| Route prefix | Why required |
|---|---|
| `/v1/subscriptions/checkout` | Initiates a payment -- duplicate execution would double-charge the subscriber. |

On all other mutating routes the header is **optional**. If omitted the request
proceeds normally without idempotency protection.

---

## TTL (Time-To-Live)

| Setting | Value | Source |
|---------|-------|--------|
| Default TTL | **24 hours** | Hard-coded `DEFAULT_TTL_MS` in `idempotency.service.ts` |
| Override | `IDEMPOTENCY_TTL_HOURS` env var | Read once at module load |

**Rationale:** 24 hours matches the JWT access-token lifetime so a key cannot
outlive the session that created it. After expiry the record is eligible for
cleanup and the key may be reused.

```env
# .env or deployment config
IDEMPOTENCY_TTL_HOURS=24   # optional; defaults to 24
```

---

## 409 Conflict Semantics

A `409 Conflict` response is returned in two scenarios:

### 1. Concurrent in-flight retry

The first request with a given key is still being processed (`is_complete =
false`). A second request arrives before the first finishes:

```
Client A  -->  POST /checkout  Idempotency-Key: abc  -->  [processing...]
Client A  -->  POST /checkout  Idempotency-Key: abc  -->  409 Conflict
```

The client should wait and retry after a short back-off.

### 2. Unique-constraint race

Two requests arrive at the exact same instant. The PostgreSQL unique constraint
on `(key, fingerprint)` ensures only one INSERT succeeds; the loser receives a
`23505` unique-violation error mapped to **409 Conflict**.

### Other error codes

| Code | When |
|------|------|
| **400 Bad Request** | `Idempotency-Key` header missing on a required route. |
| **409 Conflict** | Concurrent/in-flight duplicate (see above). |
| **422 Unprocessable Entity** | Key reused across different method/path combinations, or key exceeds 255 chars. |

---

## Key Scoping & Fingerprinting

Keys are scoped to a `(key, fingerprint)` pair where fingerprint is:

- `user:<userId>` -- when the request carries a valid JWT.
- `ip:<clientIp>` -- for unauthenticated requests.

This prevents one user from replaying or colliding with another user's key.

---

## Multi-Instance / Horizontal Scaling

The idempotency store is backed by the **shared PostgreSQL database**, not
in-process memory. This means:

- **Multiple NestJS instances** (e.g. behind a load balancer, in Kubernetes, or
  on Railway with replicas) all read and write the same `idempotency_keys`
  table.
- A request that lands on Instance A and is later retried on Instance B will
  correctly return the cached response written by A.
- The unique constraint on `(key, fingerprint)` is enforced at the database
  level, so race conditions between instances are handled by PostgreSQL rather
  than application code.

No Redis or sticky sessions are required.

```
                   +------------------+
  Client -------> | Load Balancer    |
                   +--------+---------+
                            |
              +-------------+-------------+
              |                           |
       +------+------+            +------+------+
       | Instance A  |            | Instance B  |
       | NestJS      |            | NestJS      |
       +------+------+            +------+------+
              |                           |
              +-------------+-------------+
                            |
                   +--------+---------+
                   |   PostgreSQL     |
                   | idempotency_keys |
                   +------------------+
```

---

## Cleanup: Expired Key Purge

`IdempotencyCleanupService` runs a `@Cron(EVERY_HOUR)` job that calls:

```sql
DELETE FROM idempotency_keys WHERE expires_at < NOW();
```

This keeps the table lean without requiring manual intervention. The
`expires_at` column is indexed for efficient range deletes.

---

## At-Least-Once Delivery

The idempotency layer guarantees that the **API response** is delivered at least
once. The flow is:

1. Client sends `POST /v1/subscriptions/checkout` with `Idempotency-Key: X`.
2. Middleware inserts an in-flight record `(X, fingerprint)`.
3. Handler executes business logic (creates subscription, submits Stellar
   transaction, etc.).
4. On **2xx** response: middleware persists `(status, body)` in the DB record
   and marks `is_complete = true`.
5. On **non-2xx** response: middleware **deletes** the in-flight record so the
   client can retry with the same key.
6. On retry with the same key: middleware replays the cached 2xx response
   without re-executing the handler.

**Important:** This is *at-least-once* at the API layer. If the server crashes
between step 3 (Stellar transaction submitted) and step 4 (response cached),
the in-flight record will remain incomplete. The client's retry will see a
409 Conflict until the record expires or is manually cleaned up. The checkout
handler should therefore be designed to **check on-chain status** before
re-submitting a blockchain transaction.

---

## Manual Verification Checklist

1. `POST /v1/subscriptions/checkout` with `Idempotency-Key: test-1` --> 201.
2. Repeat identical request --> 201 with same body (replay).
3. `PUT /v1/other` with `Idempotency-Key: test-1` --> 422 (method/path mismatch).
4. Two concurrent requests with `Idempotency-Key: test-2` --> one gets 201,
   other gets 409.
5. Wait for TTL expiry (or delete the record) --> same key accepted again.
6. Deploy two instances behind a load balancer and repeat steps 1-5 -- both
   instances must share the same PostgreSQL `idempotency_keys` table.

---

## File Reference

| File | Purpose |
|------|---------|
| `idempotency-key.entity.ts` | TypeORM entity for the `idempotency_keys` table. |
| `idempotency.service.ts` | Core logic: acquire, complete, release, purgeExpired. |
| `idempotency.middleware.ts` | NestJS middleware that intercepts requests. |
| `idempotency-cleanup.service.ts` | Hourly cron that purges expired records. |
| `idempotency.module.ts` | NestJS module wiring. |
| `idempotency.e2e-spec.ts` | Integration tests (DB-backed). |
