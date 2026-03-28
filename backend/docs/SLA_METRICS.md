# SLA Metrics — Query & Dashboard Guide

The backend exposes an in-process HTTP metrics endpoint at **`GET /v1/metrics`**.
No external time-series database is required; all data lives in memory and resets on restart.

---

## Endpoint

```
GET /v1/metrics
GET /v1/metrics?route=/v1/auth        # filter to a route prefix
```

### Response shape

```jsonc
{
  "collectedAt": "2026-03-28T11:00:00.000Z",
  "totalRequests": 4821,
  "endpoints": [
    {
      "route": "/v1/subscriptions/checkout/:id/confirm",
      "method": "POST",
      "requests": 312,
      "errors4xx": 5,
      "errors5xx": 1,
      "totalLatencyMs": 78432,
      "avgLatencyMs": 251,
      "p50Ms": 210,
      "p95Ms": 480,
      "p99Ms": 920,
      "minLatencyMs": 45,
      "maxLatencyMs": 1840,
      "errorRate": 0.019,           // (4xx + 5xx) / total
      "histogram": {
        "5": 0, "10": 2, "25": 18, "50": 44, "100": 89,
        "250": 102, "500": 48, "1000": 8, "2500": 1,
        "5000": 0, "Infinity": 0
      },
      "lastSeenAt": "2026-03-28T10:59:58.123Z"
    }
  ]
}
```

---

## SLO definitions

| SLO | Target | Field to check |
|-----|--------|----------------|
| Availability | ≥ 99.9 % | `1 - errorRate` (5xx only) |
| Latency p50  | ≤ 200 ms | `p50Ms` |
| Latency p95  | ≤ 500 ms | `p95Ms` |
| Latency p99  | ≤ 1 000 ms | `p99Ms` |
| Error rate   | ≤ 1 %    | `errorRate` |

---

## Query examples (curl + jq)

### 1. All endpoints breaching p95 > 500 ms

```bash
curl -s http://localhost:3000/v1/metrics | \
  jq '[.endpoints[] | select(.p95Ms > 500)] | sort_by(-.p95Ms)'
```

### 2. Endpoints with error rate > 1 %

```bash
curl -s http://localhost:3000/v1/metrics | \
  jq '[.endpoints[] | select(.errorRate > 0.01)] | sort_by(-.errorRate)'
```

### 3. Top 5 slowest endpoints by p99

```bash
curl -s http://localhost:3000/v1/metrics | \
  jq '[.endpoints[]] | sort_by(-.p99Ms) | .[0:5]'
```

### 4. Auth-only metrics

```bash
curl -s "http://localhost:3000/v1/metrics?route=/v1/auth" | jq .
```

### 5. Availability per endpoint (5xx-based)

```bash
curl -s http://localhost:3000/v1/metrics | \
  jq '[.endpoints[] | {route, method, requests, availability: (1 - (.errors5xx / .requests))}]'
```

### 6. Latency histogram for a specific route

```bash
curl -s http://localhost:3000/v1/metrics | \
  jq '.endpoints[] | select(.route == "/v1/subscriptions/checkout/:id/confirm") | .histogram'
```

---

## Grafana / dashboard integration

Because the endpoint returns JSON, you can scrape it with any HTTP data source.

### Grafana — JSON API data source

1. Install the **Infinity** or **JSON API** plugin.
2. Add a data source pointing to `http://<host>:3000/v1/metrics`.
3. Use JSONPath expressions:
   - `$.endpoints[*].p95Ms` — p95 latency per endpoint
   - `$.endpoints[*].errorRate` — error rate per endpoint
   - `$.endpoints[*].requests` — request volume

### Prometheus scrape (optional future upgrade)

To export to Prometheus, replace `HttpMetricsService.snapshot()` with a
`/metrics` endpoint that emits the standard text format:

```
http_request_duration_ms{method="POST",route="/v1/auth/login",status="200",quantile="0.95"} 320
http_requests_total{method="POST",route="/v1/auth/login",status="200"} 1042
```

This requires adding `prom-client` as a dependency — no other code changes needed.

---

## Alerting rules (pseudo-code)

```yaml
# Alert if any endpoint p99 exceeds 1 s over a 5-minute window
- alert: HighLatencyP99
  expr: max(endpoint_p99_ms) > 1000
  for: 5m

# Alert if error rate exceeds 1 % over a 5-minute window
- alert: HighErrorRate
  expr: max(endpoint_error_rate) > 0.01
  for: 5m

# Alert if availability drops below 99.9 %
- alert: LowAvailability
  expr: min(1 - endpoint_5xx_rate) < 0.999
  for: 5m
```
