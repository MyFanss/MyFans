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
- Body over 1 MiB (serialized JSON) → `413 Payload Too Large`, rejected before
  any store lookup. This is a size limit, not a key conflict; do not retry with
  the same key.
- A key is scoped to the route that produced it.

## Tests

Unit tests use the in-memory store and never boot a real Redis. To exercise
cross-instance behavior, back two store instances with the same fake Redis
client and assert that a replay on the second instance does not call the
payment function and that a mismatched body returns `409`.
