# Metrics & Observability

- **HTTP:** Request count, latency histogram, and status code are recorded by `MetricsMiddleware`. Paths are normalized (UUIDs/numeric IDs replaced with `_id`) so no PII appears in labels.
- **RPC:** Use `MetricsService.recordRpcCall(operation, durationSeconds, error)` or `withRpcMetrics(metrics, operation, fn)` when calling Soroban RPC or other external RPCs. Use generic operation names (e.g. `getLedger`, `simulate`); do not put user/account IDs in labels.
- **Exposure:** `GET /metrics` returns Prometheus text format. Point Prometheus at `http://<host>:<PORT>/metrics` to scrape.
- **Alerting:** See `prometheus/alerts.yml` for rules (high error rate, high latency, RPC errors). Load this file in your Prometheus `rule_files` and configure Alertmanager if needed.
