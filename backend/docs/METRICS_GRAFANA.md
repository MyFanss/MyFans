# Metrics & Grafana Dashboard

This document describes the Prometheus metrics exposed by the backend and how to
build Grafana dashboards on top of them.

## Available Metrics

### HTTP Metrics (existing)

| Metric | Type | Labels |
|--------|------|--------|
| `backend_http_requests_total` | counter | method, route |
| `backend_http_request_errors_total` | counter | method, route, code |
| `backend_http_request_duration_seconds` | histogram | method, route |

### Soroban RPC Metrics (existing)

| Metric | Type | Labels |
|--------|------|--------|
| `backend_soroban_rpc_calls_total` | counter | method, outcome |
| `backend_soroban_rpc_duration_seconds_total` | counter | method |

### Business Metrics (new)

| Metric | Type | Labels |
|--------|------|--------|
| `myfans_checkout_duration_seconds` | histogram | status |
| `myfans_poller_lag_seconds` | gauge | — |
| `myfans_webhook_hmac_failures_total` | counter | — |
| `myfans_checkout_errors_total` | counter | reason |

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

For the hosted deployment, metrics are also served over HTTPS at
`/v1/metrics/prometheus` and require a scrape token:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'myfans-backend'
    scheme: https
    authorization:
      credentials: '<METRICS_SCRAPE_TOKEN>'
    metrics_path: /v1/metrics/prometheus
    static_configs:
      - targets: ['api.myfans.app:443']
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

## Sample PromQL Queries

### Checkout p95 duration (last 5 min)

```promql
histogram_quantile(0.95,
  rate(myfans_checkout_duration_seconds_bucket[5m])
)
```

### Checkout error rate by reason

```promql
rate(myfans_checkout_errors_total[5m])
```

### Webhook HMAC failure rate

```promql
rate(myfans_webhook_hmac_failures_total[5m])
```

### Subscription poller lag

```promql
myfans_poller_lag_seconds
```

### HTTP error rate > 1%

```promql
sum(rate(backend_http_request_errors_total[5m])) by (method, route)
/
sum(rate(backend_http_requests_total[5m])) by (method, route)
> 0.01
```

## Grafana dashboard

A sample dashboard is committed at
[`backend/docs/grafana/myfans-red-dashboard.json`](./grafana/myfans-red-dashboard.json).
It covers the RED signals for checkout, poller lag, and webhook failures.
Import it via **Dashboards → New → Import** and select the Prometheus data
source used for the scrape job above.

### Panels

| Panel | Query |
| --- | --- |
| Checkout rate | `sum(rate(myfans_checkout_duration_seconds_count[5m]))` |
| Checkout errors | `sum(rate(myfans_checkout_errors_total[5m])) by (reason)` |
| Checkout p95 duration | `histogram_quantile(0.95, sum(rate(myfans_checkout_duration_seconds_bucket[5m])) by (le))` |
| Poller lag | `myfans_poller_lag_seconds` |
| Webhook HMAC failures | `sum(rate(myfans_webhook_hmac_failures_total[5m]))` |

## Horizon finality assumptions

Soroban events are read from Horizon. Horizon only serves ledgers that are
considered final, so the poller does not implement reorg handling. If a gap in
ledger sequence numbers is observed, the poller retries from the last committed
`ledgerSeq` rather than skipping ahead.

## No PII Policy

All metric labels are restricted to:
- HTTP method (`GET`, `POST`, etc.)
- Route pattern (`/v1/users/:id` — never actual IDs)
- Status code class (`4xx`, `5xx`)
- Checkout status (`COMPLETED`, `FAILED`, etc.)
- Error reason (`timeout`, `insufficient_balance`, etc.)

No user IDs, email addresses, IP addresses, or other PII appear in metrics.
Labels are drawn from a fixed, bounded set of enum values; raw pubkeys, user
IDs, and other unbounded identifiers are never used as label values, keeping
cardinality safe.
