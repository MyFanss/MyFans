# Metrics & Grafana

This document describes the Prometheus metrics exposed by the backend and how to
build Grafana dashboards on top of them.

## Scrape configuration

The backend exposes Prometheus metrics on `GET /metrics` (default port `9464`).
Add a scrape job to your Prometheus configuration:

```yaml
scrape_configs:
  - job_name: backend
    metrics_path: /metrics
    static_configs:
      - targets: ["backend:9464"]
```

## Subscription event poller

The subscription event poller tails Soroban contract events for the
`TARGET_EVENTS` set (`subscription_created`, `subscription_renewed`,
`subscription_cancelled`) and applies them to the subscription cache. It is
gated behind the `SUBSCRIPTION_EVENT_POLLER_ENABLED` feature flag, which
defaults to **disabled** in production and must be explicitly enabled per
environment.

### Idempotency

Every processed event is keyed by `ledgerSeq:eventIndex`. The poller records
this key in a ledger before dispatching a handler, so duplicate deliveries
(replays, overlapping poll windows, or restarts) are dropped without mutating
the subscription cache or emitting duplicate confirmations.

### Metrics

| Metric | Type | Labels | Description |
| --- | --- | --- | --- |
| `poller_lag` | Gauge | `poller` | Number of ledgers between the latest ingested ledger and the chain tip. |
| `poller_events_processed_total` | Counter | `poller`, `event_type` | Events successfully applied, by event type. |
| `poller_events_duplicate_total` | Counter | `poller`, `event_type` | Events skipped because their `ledgerSeq:eventIndex` key was already seen. |
| `poller_events_failed_total` | Counter | `poller`, `event_type`, `reason` | Events that failed to process (malformed payload, handler error). |
| `poller_poll_duration_seconds` | Histogram | `poller` | Duration of a single poll cycle. |

### Alerting

- **Poller lag**: alert when `poller_lag > 50` for more than 5 minutes — the
  poller is falling behind the chain tip.
- **Poller stalled**: alert when `rate(poller_events_processed_total[10m]) == 0`
  while `poller_lag > 0` — the poller is running but not making progress.
- **Duplicate spike**: alert when `rate(poller_events_duplicate_total[5m])`
  exceeds a small threshold — indicates overlapping poll windows or a replay.

### Grafana panel

A minimal lag panel:

```promql
poller_lag{poller="subscription"}
```

Plot alongside `rate(poller_events_processed_total[5m])` to correlate lag with
throughput.

## Horizon finality assumptions

Soroban events are read from Horizon. Horizon only serves ledgers that are
considered final, so the poller does not implement reorg handling. If a gap in
ledger sequence numbers is observed, the poller retries from the last committed
`ledgerSeq` rather than skipping ahead.
