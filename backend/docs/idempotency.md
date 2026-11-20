# Idempotency

Checkout confirm (and other money-path routes) accept an `Idempotency-Key`
header. The server records the first response for a key and replays it for
subsequent requests with the same key and body.

> **Warning: the default store is in memory.** Unless `REDIS_URL` is set, the
> checkout controller uses `InMemoryIdempotencyStore`, which is process-local. A
> restart drops every key, so a retry after a deploy or crash runs as a new
> request. A second instance will not see the first instance's keys, so the
> same key can execute once per instance. Until the shared store is wired in,
> running more than one instance is unsafe for payments.

## Store selection

The controller depends on the `IDEMPOTENCY_STORE` token, which resolves to one
of two implementations of the `IdempotencyStore` interface:

- **Redis-backed store** — used when `REDIS_URL` is set. Records are shared
  across every API instance, so a retry that lands on a different process
  replays the original response instead of running `processCheckout` again.
  Records survive process restarts.
- **In-memory store** (`InMemoryIdempotencyStore`) — used when `REDIS_URL` is
  not set. This is the default for unit tests and local development. It keeps
  records in a `Map` and is **not** safe across multiple instances or across
  restarts.

Production deployments that run more than one API process, or that submit a
transaction during confirm, **must** set `REDIS_URL` so the shared store is
used. Without it, a retry against a different instance can double charge.

## Semantics

- Same key + same body → the first response is returned; the payment function
  is not called again.
- Same key + different body → `409 Conflict`, on every instance.
- A key is scoped to the route that produced it.

## Tests

Unit tests use the in-memory store and never boot a real Redis. To exercise
cross-instance behavior, back two store instances with the same fake Redis
client and assert that a replay on the second instance does not call the
payment function and that a mismatched body returns `409`.

The creator earnings withdraw flow follows this pattern:

- `prepareWithdraw(creatorId, amount, idempotencyKey)` validates the creator's
  available balance and pause state, reserves the amount, and returns a
  `prepareId`. It does **not** move funds.
- `confirmWithdraw(creatorId, prepareId, idempotencyKey)` verifies the reserved
  operation, requires the creator's authorization (the on-chain withdraw is
  gated by `require_auth(creator)`), and settles exactly once.

### Fee accounting

Subscription payments are already split at payment time: the protocol fee is
removed before the remainder is credited to the creator's earnings balance.
The withdraw path therefore **must not** re-apply the protocol fee. Withdrawing
`amount` debits exactly `amount` from the creator's balance and pays out exactly
`amount`. Applying a fee again here would double-charge the creator.

### Failure modes

- **Withdraw more than balance** — rejected during prepare; no reservation is
  created.
- **Concurrent withdraws** — the balance reservation is atomic, so two
  in-flight prepares cannot both reserve the same funds; the second fails
  validation.
- **Wrong signer** — confirm rejects when the authorization does not match the
  creator that owns the reservation.
- **Paused earnings** — prepare rejects while earnings are paused; existing
  pending reservations are not settled until unpaused.

## Admin operations

Administrative drains or overrides are not part of the normal withdraw path and
must be gated by the `AUTH_MATRIX` role checks. There is no silent admin drain:
any privileged movement of creator funds requires an explicit, audited role and
is recorded with the same idempotency guarantees.

Keys are scoped to a `(key, fingerprint)` pair where `fingerprint` encodes:

- **Caller identity:** `user:<userId>` (authenticated) or `ip:<clientIp>` (anonymous).
- **Body hash:** SHA-256 of the canonical JSON form of the request body (see
  below).

#### Canonical JSON

Before hashing, the body is serialised with object keys sorted recursively, so
two bodies that differ only in key order produce the same hash:

- Object keys are sorted by UTF-16 code unit order, at every nesting level.
- Array element order is preserved; arrays are never sorted.
- Values are serialised as standard `JSON.stringify` output (no whitespace),
  with `undefined` properties omitted and a missing body hashed as `null`.

For example, `{ "a": 1, "b": 2 }` and `{ "b": 2, "a": 1 }` both hash as
`{"a":1,"b":2}`, while `[1, 2]` and `[2, 1]` hash differently and a changed
amount always produces a different hash.

The combined fingerprint format is `<identity>|<bodyHash>`. This ensures:

1. One user cannot replay another user's key.
2. The same key used with a **different request body** is rejected with
   **409 Conflict** (body mismatch detection).

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

## Checkout & Money Paths

Checkout confirm and other money-moving endpoints (`POST /v1/checkout/confirm`,
`POST /v1/subscriptions`, `POST /v1/payments`) **require** an `Idempotency-Key`
header. Requests missing the header are rejected with **400 Bad Request** before
the handler runs, so a retried checkout can never double-charge or
double-fulfill.

### Body fingerprinting

For money paths the stored record includes a hash of the request body
(`body_hash = sha256(canonical_json(body))`, canonical form defined above). A
client that reorders JSON keys on a retry is treated as an identical retry. This
tightens the replay rules:

| Existing record | Incoming request | Action |
|-----------------|------------------|--------|
| Complete, same method + path, **same body hash** | identical retry | Replay cached response (200/201). |
| Complete, same method + path, **different body hash** | key reused with new payload | **409 Conflict** — the key is bound to the original body. |
| In-flight | any | **409 Conflict** — first request still processing. |

A `409` body is `{ "statusCode": 409, "error": "Conflict", "message": "Idempotency-Key already used with a different request body" }`.

### Storage backend

Records are stored in **Redis** when `REDIS_URL` is configured, so replay works
across multiple application instances. The Redis entry is written with
`SET key value EX <ttl> NX`; the `NX` flag makes the first concurrent writer win
and the loser observe the existing record (mapped to **409**). When Redis is not
configured the middleware falls back to the PostgreSQL store described above.

### Failure modes

- **Key reuse after TTL** — the record has expired and been purged, so the key
  is treated as new. Clients must not reuse a key beyond the TTL window.
- **Concurrent first requests** — resolved by `SET ... NX` (Redis) or the unique
  constraint (Postgres); exactly one proceeds, the rest get **409**.
- **Huge bodies** — only the `sha256` digest of the body is persisted, never the
  raw payload, so request size does not inflate stored records.
- **5xx responses** — server errors are **not** cached; the in-flight record is
  released so the client can safely retry with the same key.

### Security

Idempotency keys are **not** secrets and must not be treated as authorization.
Every replayed request still passes through the normal auth guard, so a replayed
response is only returned to a caller that is authorized for the original
`(key, fingerprint)` scope.

---

## Configuration

```
IDEMPOTENCY_TTL_HOURS=24              # optional; defaults to 24
IDEMPOTENCY_CLEANUP_CRON="0 * * * *"  # optional; defaults to every hour
IDEMPOTENCY_CLEANUP_BATCH_SIZE=1000   # optional; defaults to 1000
REDIS_URL=redis://...                 # optional; enables multi-instance Redis store
```

## Multi-Instance Safety

The idempotency store is backed by PostgreSQL with a unique constraint on
`(key, fingerprint)`. This makes it safe for horizontally-scaled deployments —
all instances share the same database and contention is handled via the unique
constraint (loser gets 409). No in-memory state is used.

---

## Manual Checklist (Replay Hardening)

1. Send `POST /v1/posts` with `Idempotency-Key: test-1` → expect `201`.
2. Repeat identical request → expect `201` with same body (replay).
3. Send `PUT /v1/posts/1` with `Idempotency-Key: test-1` → expect `422`
   (method/path mismatch).
4. Send two concurrent requests with `Idempotency-Key: test-2` → one gets
   `201`, the other gets `409`.
5. Send `POST /v1/posts` with `Idempotency-Key: test-1` but a **different
   body** → expect `409` (body mismatch).
6. Wait for TTL expiry (or manually delete the record) → same key accepted
   again as new.
6. Send `POST /v1/checkout/confirm` with `Idempotency-Key: checkout-1` and body
   `A` → expect `201`; repeat with body `B` → expect `409`.
7. Send `POST /v1/checkout/confirm` without an `Idempotency-Key` header →
   expect `400`.
