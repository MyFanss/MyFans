# Event Indexing — Soroban RPC Poller & Subscription Index

## Overview

The subscription-event-poller polls Soroban RPC for contract events (`subscribed`, `extended`, `cancelled`) and indexes them into the `subscription_index` table. This document describes the idempotency guarantees and the data structure that makes duplicate-free processing possible.

## Idempotency Guarantee

The poller is **idempotent** under at-least-once delivery from Soroban RPC. No duplicate rows or email notifications will be created even if:

- The same event is delivered multiple times (RPC retry / at-least-once semantics).
- Events arrive out-of-order (ledger sequence out of order within a polling cycle).
- The poller crashes and restarts mid-cycle.

### Idempotency Key

Each chain event is uniquely identified by the composite key `(ledgerSeq, eventIndex)`:

- `ledgerSeq`: The Stellar ledger sequence number in which the event occurred.
- `eventIndex`: The zero-based index of the event within that ledger's contract event list.

This pair is guaranteed unique by the Soroban RPC API and serves as a stable, reorg-safe identifier.

### Duplicate Detection

The `subscription_index` table enforces a unique constraint on `(ledgerSeq, eventIndex)`:

```sql
UNIQUE('ledgerSeq', 'eventIndex')
```

When the poller attempts to insert an event already in the index:

1. **Before insert:** The poller calls `findByEventId(ledgerSeq, eventIndex)` to check if the event is already indexed. If found, it skips the event entirely (no database round-trip).
2. **On duplicate insert attempt:** If the event is inserted anyway (race condition between check and insert), the database constraint prevents the duplicate row and raises a unique-violation error (`code 23505`). The repository catches this and fetches the existing row, returning it instead.

### Email Deduplication

The email outbox (`email_outbox` table) has an independent `dedupe_key` unique constraint that serves as a secondary defense layer. When a replayed event publishes the same domain event, the outbox dedupes by `dedupe_key` before enqueueing a duplicate email.

## Idempotency in Practice

### Replay Scenario

1. Poller cycle 1: Receives event `(ledger=100, index=0)`.
   - `findByEventId(100, 0)` returns null (not yet indexed).
   - `upsertEvent()` inserts the row.
   - Domain event `SubscriptionCreatedEvent` is published.
   - Email is enqueued with `dedupe_key = event_100_0_created`.

2. Poller cycle 2: Receives the same event again (RPC retry).
   - `findByEventId(100, 0)` returns the existing row (found).
   - Skips processing; no insert, no domain event, no email.

### Out-of-Order Scenario

Poller cycle receives events in order `[ledger=20, index=0]`, `[ledger=10, index=0]`, `[ledger=15, index=0]`:

1. All three are checked against `findByEventId()` and inserted in the order received.
2. The resulting index contains all three rows, ordered by insertion (query results will show them in any order depending on the query's `ORDER BY` clause).
3. The checkpoint (max `ledgerSeq` in the index) moves forward to `20`, skipping ledgers `10–19` in the next poll cycle.
4. If ledgers `10–19` contained other events, they are fetched in the next cycle and indexed with their correct `ledgerSeq` values.

### Reorg Handling (Future)

The Stellar network is unlikely to undergo a deep reorg, but if one occurs:

- Reorg depth is typically 1–2 ledgers (not structural).
- The poller's checkpoint mechanism (max `ledgerSeq` as cursor) means events from reorg'd ledgers are fetched again in the next poll.
- Because `(ledgerSeq, eventIndex)` uniqueness is enforced, re-indexed events from the reorg'd ledger replace the old ones (or are skipped if already present).

## Configuration

The poller is controlled by the `FEATURE_SOROBAN_POLLER` flag:

- **Default (production):** Enabled if `SOROBAN_RPC_URL` and `CONTRACT_ID_SUBSCRIPTION` are configured; otherwise disabled.
- **Default (test):** Disabled unless explicitly set to `true`.
- **Startup validation:** If enabled in production but `SOROBAN_RPC_URL` is missing, the app exits with a clear error (fail-fast).

See `.env.example` and `docs/FEATURE_FLAGS.md` for details.

## Monitoring

The poller logs:
- **Startup:** Flag resolution (`enabled`, `disabled`, reason with config presence).
- **Each poll cycle:** Processed event counts by type, error counts, checkpoint progression, duration, correlation ID.
- **Duplicate detection:** Warnings when unique violations are caught and existing rows fetched.

Metrics:
- `soroban_events_processed_total` (per type: `subscribed`, `extended`, `cancelled`)
- `soroban_poller_errors_total`
- `soroban_poller_duration_ms` (histogram)
- `soroban_events_duplicates_dropped_total` (incremented when constraint violation is caught)

## Testing

See `backend/src/subscriptions/services/subscription-event-poller-*.spec.ts`:

- `subscription-event-poller-ledger.spec.ts`: Feature flag and RPC resilience tests.
- `subscription-event-poller-idempotency.spec.ts`: Replay, out-of-order, constraint, and email dedup tests.
- `subscription-event-poller-correlation.spec.ts`: Correlation ID propagation and context management.

## Related Issues

- #1581: Feature flag per-environment defaults and fail-fast validation.
- #1582: Idempotency key enforcement and replay/out-of-order testing.
- #1583: Dashboard API (consumes deduplicated index).
- #1584: Subscribers API (consumes deduplicated index).
