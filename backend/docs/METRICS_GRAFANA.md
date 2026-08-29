# Metrics & Grafana Dashboard

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

## Scrape Configuration

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

## No PII Policy

All metric labels are restricted to:
- HTTP method (`GET`, `POST`, etc.)
- Route pattern (`/v1/users/:id` — never actual IDs)
- Status code class (`4xx`, `5xx`)
- Checkout status (`COMPLETED`, `FAILED`, etc.)
- Error reason (`timeout`, `insufficient_balance`, etc.)

No user IDs, email addresses, IP addresses, or other PII appear in metrics.
