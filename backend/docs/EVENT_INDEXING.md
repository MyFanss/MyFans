# Event Indexing — Soroban RPC Poller & Subscription Index

This document describes how the backend indexes Soroban contract events for
subscriptions. It covers the poller worker, the idempotency model, the
subscription event handlers, the feature flag that gates the poller, and the
Prometheus metrics that expose poller health.

## Overview

The subscription event poller is a background worker that polls Soroban RPC for
contract events emitted by the subscription contract. It is the single writer
for subscription state derived from on-chain events: it consumes events, applies
idempotent handlers, and updates the subscription cache and confirmation state.

Without an idempotent poller, duplicate deliveries corrupt the subscription
cache and confirmations. The poller therefore guarantees that every event is
processed at most once, keyed by `ledgerSeq:eventIndex`.

The poller polls Soroban RPC for contract events (`subscribed`, `extended`,
`cancelled`) and indexes them into the `subscription_index` table. This document
describes the idempotency guarantees and the data structure that makes
duplicate-free processing possible.

## TARGET_EVENTS

The poller only processes the subscription lifecycle events listed in
`TARGET_EVENTS`. Any other event emitted by the contract is ignored.

| Event | Handler | Effect |
| --- | --- | --- |
| `subscription_created` | `handleCreated` | Insert subscription into cache, mark pending confirmation |
| `subscription_renewed` | `handleRenewed` | Extend expiry, refresh cache entry, mark confirmed |
| `subscription_cancelled` | `handleCancelled` | Mark subscription cancelled, stop renewals |

Handlers are pure with respect to the event payload: given the same event they
produce the same state transition, which makes replay safe.

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

Every event is assigned an idempotency key of the form:

```
ledgerSeq:eventIndex
```

`ledgerSeq` is the ledger sequence number in which the event was emitted and
`eventIndex` is the position of the event within that ledger. Together they
uniquely identify an event on the canonical chain.

Before a handler runs, the poller checks the idempotency ledger for the key. If
the key is already present, the event is skipped. If it is absent, the handler
runs and the key is recorded in the same transaction as the state update, so a
crash between the handler and the ledger write cannot cause a double apply.

This makes duplicate delivery safe: replaying the same ledger range, receiving
the same event twice from RPC, or restarting the poller mid-batch all converge
to the same subscription state.

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

## Feature flag

The poller is gated by the `FEATURE_FLAGS` poller flag:

```
FEATURE_FLAGS=poller
```

**Default for production: disabled.** The poller must be explicitly enabled in
production by adding `poller` to `FEATURE_FLAGS`. This allows the worker to be
rolled out and observed before it becomes the source of truth for subscription
state. In staging and local development the flag may be enabled by default via
the compose profile.

The poller is also controlled by the `FEATURE_SOROBAN_POLLER` flag:

- **Default (production):** Enabled if `SOROBAN_RPC_URL` and `CONTRACT_ID_SUBSCRIPTION` are configured; otherwise disabled.
- **Default (test):** Disabled unless explicitly set to `true`.
- **Startup validation:** If enabled in production but `SOROBAN_RPC_URL` is missing, the app exits with a clear error (fail-fast).

See `.env.example` and `docs/FEATURE_FLAGS.md` for details.

## Metrics

The poller exposes Prometheus metrics. The primary health signal is poller lag:

```
poller_lag_ledgers{contract="subscription"}
```

`poller_lag_ledgers` is the difference between the latest ledger known to the
RPC node and the last ledger fully processed by the poller. A steadily growing
value indicates the poller is falling behind. See
`backend/docs/METRICS_GRAFANA.md` for the dashboard panels and alert thresholds.

Additional counters:

- `poller_events_processed_total{event="created|renewed|cancelled"}`
- `poller_events_skipped_total{reason="duplicate"}`
- `poller_errors_total{stage="fetch|decode|apply"}`

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

## Edge cases and failure modes

- **Duplicate delivery.** Safe. The `ledgerSeq:eventIndex` key is checked before
  the handler runs and recorded atomically with the state update.
- **Gap in ledgers.** The poller tracks the last processed ledger and resumes
  from `lastProcessed + 1`. If a gap is detected, it re-fetches the missing
  range rather than skipping ahead.
- **Malformed payload.** Events that fail to decode are counted in
  `poller_errors_total{stage="decode"}` and skipped without advancing the
  idempotency ledger, so they can be retried after a fix.
- **Reorg.** Horizon/Soroban RPC finality is assumed once a ledger is closed and
  confirmed. The poller only processes ledgers at or below the RPC's latest
  confirmed ledger and does not attempt to unwind reorgs; operators should treat
  confirmed ledgers as final.

## Security considerations

- The poller uses a least-privilege RPC credential scoped to read-only event
  access. It does not hold admin or signing keys.
- The poller does not process unauthenticated admin callbacks. All state changes
  originate from on-chain events fetched by the poller itself; there is no
  inbound HTTP endpoint that can mutate subscription state.

## Testing

See `backend/src/subscriptions/services/subscription-event-poller-*.spec.ts`:

- `subscription-event-poller-ledger.spec.ts`: Feature flag and RPC resilience tests.
- `subscription-event-poller-idempotency.spec.ts`: Replay, out-of-order, constraint, and email dedup tests.
- `subscription-event-poller-correlation.spec.ts`: Correlation ID propagation and context management.

## Out of scope

Substreams-based indexing is out of scope for this poller.

## Related Issues

- #1581: Feature flag per-environment defaults and fail-fast validation.
- #1582: Idempotency key enforcement and replay/out-of-order testing.
- #1583: Dashboard API (consumes deduplicated index).
- #1584: Subscribers API (consumes deduplicated index).

## References

- `backend/docs/EVENT_INDEXING.md` (this document)
- `backend/docs/METRICS_GRAFANA.md`
- `backend/docs/EVENTS.md`
