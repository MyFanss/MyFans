# Idempotency Middleware — TTL & Collision Behavior

## Overview

The `IdempotencyMiddleware` protects mutating routes (POST, PUT, PATCH) from
duplicate execution. Clients supply an `Idempotency-Key` header; the platform
stores the first response and replays it for any subsequent request carrying the
same key.

---

## Key TTL

| Setting | Value | Source |
|---------|-------|--------|
| Default TTL | **24 hours** | Hard-coded constant `DEFAULT_TTL_MS` |
| Override | Set `IDEMPOTENCY_TTL_HOURS` env var | Read at service startup |

**Rationale:** 24 hours matches the JWT access-token lifetime so a key cannot
outlive the session that created it. After expiry the record is deleted by the
hourly cleanup cron (`IdempotencyCleanupService`) and the key may be reused.

**Cleanup:** `IdempotencyCleanupService` runs `@Cron(EVERY_HOUR)` and calls
`IdempotencyService.purgeExpired()`, which issues a single `DELETE WHERE
expires_at < NOW()`.

---

## Collision / Replay Behavior

A "collision" occurs when a client sends a second request with the same
`Idempotency-Key`. The middleware distinguishes four cases:

| State of existing record | Action |
|--------------------------|--------|
| **No record** | Insert in-flight record; proceed to handler. |
| **In-flight** (`is_complete = false`, not expired) | Return **409 Conflict** — first request still processing. |
| **Complete** (`is_complete = true`, not expired) — same method + path | Return **200/201** replay of cached response body. |
| **Complete** — **different** method or path | Return **422 Unprocessable Entity** — key reuse across endpoints is forbidden. |
| **Expired** (any state) | Delete stale record; treat as new key. |

### Key scoping

Keys are scoped to a `(key, fingerprint)` pair where `fingerprint` is:

- `user:<userId>` — when the request is authenticated.
- `ip:<clientIp>` — for unauthenticated requests.

This prevents one user from replaying another user's key.

### Race condition

Two concurrent requests with the same key arrive simultaneously. The first
writer wins via a PostgreSQL unique constraint on `(key, fingerprint)`. The
loser receives a `23505` unique-violation error which is mapped to **409
Conflict**.

### Error responses

On non-2xx handler responses the in-flight record is **deleted** (via
`release()`), allowing the client to retry with the same key after fixing the
underlying issue.

---

## Configuration

```
IDEMPOTENCY_TTL_HOURS=24   # optional; defaults to 24
```

---

## Manual Checklist (Replay Hardening)

1. Send `POST /v1/posts` with `Idempotency-Key: test-1` → expect `201`.
2. Repeat identical request → expect `201` with same body (replay).
3. Send `PUT /v1/posts/1` with `Idempotency-Key: test-1` → expect `422`
   (method/path mismatch).
4. Send two concurrent requests with `Idempotency-Key: test-2` → one gets
   `201`, the other gets `409`.
5. Wait for TTL expiry (or manually delete the record) → same key accepted
   again as new.
