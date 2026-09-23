# Event Indexing

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

## Idempotency

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

## Out of scope

Substreams-based indexing is out of scope for this poller.

## References

- `backend/docs/EVENT_INDEXING.md` (this document)
- `backend/docs/METRICS_GRAFANA.md`
- `backend/docs/EVENTS.md`
