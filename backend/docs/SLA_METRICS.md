# SLA Metrics

This document defines the service-level metrics that the backend exposes for
launch operations. Metrics are exported in Prometheus text format from the
`MetricsModule` and are intended to be scraped by Prometheus and rendered in
Grafana (see `METRICS_GRAFANA.md`).

## Endpoint

- Path: `GET /metrics`
- Format: Prometheus text exposition format (`text/plain; version=0.0.4`)
- In production the endpoint MUST be network-restricted (private ingress / VPC
  only) or protected by auth. Do not expose `/metrics` on the public internet.

## Metric families

### Checkout (RED)

Checkout is instrumented with the RED pattern (Rate, Errors, Duration).

| Metric | Type | Labels | Description |
| --- | --- | --- | --- |
| `checkout_requests_total` | counter | `status` | Total checkout requests, partitioned by outcome (`success`, `error`). |
| `checkout_errors_total` | counter | `reason` | Total checkout failures, partitioned by a bounded reason code. |
| `checkout_duration_seconds` | histogram | `status` | Checkout request latency in seconds. |

### Poller lag

| Metric | Type | Labels | Description |
| --- | --- | --- | --- |
| `poller_lag_seconds` | gauge | `poller` | Seconds between the latest processed ledger/event and now. |
| `poller_runs_total` | counter | `poller`, `status` | Poller iterations, partitioned by outcome. |

### Webhook failures

| Metric | Type | Labels | Description |
| --- | --- | --- | --- |
| `webhook_deliveries_total` | counter | `status` | Webhook delivery attempts, partitioned by outcome. |
| `webhook_failures_total` | counter | `reason` | Webhook delivery failures, partitioned by a bounded reason code. |

## Cardinality safety

Labels MUST be bounded. Do **not** use raw public keys, account IDs, request
IDs, URLs, or any other unbounded value as a label. Use small enumerated sets
(e.g. `status`, `reason`, `poller`) so the number of time series stays stable.

## Scrape configuration

Example Prometheus scrape config:

```yaml
scrape_configs:
  - job_name: backend
    metrics_path: /metrics
    scheme: http
    static_configs:
      - targets: ["backend.internal:8080"]
```

## Verification

- Scrape the staging `/metrics` endpoint and confirm the families above are
  present.
- Unit tests assert that counters/histograms increment on the corresponding
  code paths.
