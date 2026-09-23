# Content Likes Interface

Status: **Accepted** (ADR-1749)

## Problem

Historically, content likes were tracked in two places:

1. **On-chain** — a `content-likes` contract that recorded like/unlike events and
   maintained an on-chain like count per content id.
2. **`LikesModule`** — a backend module that persisted likes in the database and
   served the UI count.

Both writers existed at the same time. Counts diverged, gas was spent on
redundant writes, and there was no reconciliation path. This document is the
ADR that picks a single source of truth and defines the interface that the
contract, backend, and UI must implement.

## Decision

**Option C — chain anchor + DB cache.**

The on-chain `content-likes` contract is the **single writer** and the
**source of truth** for like state. `LikesModule` becomes a **read-through
cache** that is populated exclusively by replaying on-chain events. It never
accepts a client-originated like/unlike write.

Rationale:

- Likes are a public, fan-facing signal; anchoring them on-chain keeps the
  graph verifiable and portable across clients.
- A DB cache is still needed for cheap pagination, aggregation, and UI count
  reads without an RPC round-trip per render.
- Option A (DB-only) loses verifiability; Option B (chain-only) makes list
  reads and counts prohibitively expensive. Option C keeps both properties.

## Single-writer rule

- The **only** writer of like state is the `content-likes` contract.
- `LikesModule` MUST NOT expose a write endpoint that mutates like state
  directly. Any legacy `POST /likes` / `DELETE /likes` handler is removed.
- The cache is updated **only** by the event indexer consuming
  `LikeAdded` / `LikeRemoved` events. No dual-write path may exist behind any
  production flag.

## Interface

### Contract (source of truth)

```
like(content_id: ContentId) -> Result<(), LikeError>
unlike(content_id: ContentId) -> Result<(), LikeError>
like_count(content_id: ContentId) -> u64
has_liked(content_id: ContentId, account: AccountId) -> bool
```

Events:

```
LikeAdded   { content_id, account, count }
LikeRemoved { content_id, account, count }
```

`count` is the post-mutation count emitted by the contract so the indexer can
apply events idempotently without recomputing.

### Backend (`LikesModule`, cache only)

```
GET /content/:id/likes          -> { count, hasLiked }
GET /content/:id/likes/list     -> paginated likers
```

Reads are served from the cache. On a cache miss the module reads
`like_count` / `has_liked` from the contract and backfills the cache row.

### UI

The like button submits a transaction to the contract and then refreshes the
count from `GET /content/:id/likes`. The UI never optimistically writes to the
backend.

## Idempotency and concurrency

- Each event is keyed by `(tx_hash, log_index)`. The indexer stores processed
  event keys and skips duplicates, so replay is idempotent.
- `LikeAdded` / `LikeRemoved` are applied as upserts on
  `(content_id, account)`. A repeated `LikeAdded` for an existing row is a
  no-op; a repeated `LikeRemoved` for a missing row is a no-op.
- Concurrent like/unlike from the same account is serialized by the contract;
  the indexer applies events in log order, so the cache converges to the
  on-chain count.
- The cache stores the contract-emitted `count` and rejects an event whose
  `count` is older than the stored value (stale replay guard).

## Post deletion / GC

When a creator deletes a post, the contract emits `ContentDeleted`. The
indexer deletes all like rows for that `content_id` and drops the cached
count. No orphan like rows are retained.

## Privacy and abuse

- The like graph is public on-chain and can deanonymize fans. This is
documented in the product privacy notice; the UI does not surface individual
likers beyond the public list endpoint.
- The contract enforces one like per `(content_id, account)` and the backend
  rate-limits the read endpoints. Write rate limiting is enforced at the
  transaction submission layer.

## Migration

- Deploy the `content-likes` contract and start the event indexer.
- Backfill the cache by replaying historical `LikeAdded` / `LikeRemoved`
  events from the contract deployment block.
- Remove the legacy `LikesModule` write endpoints and any dual-write feature
  flag. After removal, the backend has no code path that writes like state
  outside the indexer.

## Out of scope

Emoji reactions.

## References

- `contract/docs/interfaces/content-likes.md` (this document)
- `backend/test/likes.e2e-spec.ts`
