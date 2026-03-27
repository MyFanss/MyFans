# Queue Observability – Dashboard & Runbook

## Overview

All async job processing in MyFans emits **structured JSON logs** and accumulates
**in-memory metrics** (success/failure counts, retry counts, average latency).

---

## Metrics Endpoint

```
GET /v1/health/queue-metrics
```

### Response shape

```json
{
  "timestamp": "2026-03-26T04:34:29.709Z",
  "queues": {
    "subscriptions": {
      "confirm-subscription": {
        "success": 42,
        "failure": 3,
        "retries": 1,
        "totalLatencyMs": 18500,
        "avgLatencyMs": 411,
        "lastSuccessAt": "2026-03-26T04:30:00.000Z",
        "lastFailureAt": "2026-03-26T04:28:00.000Z",
        "lastFailureReason": "Checkout session has expired"
      },
      "fail-checkout": {
        "success": 3,
        "failure": 0,
        "retries": 0,
        "totalLatencyMs": 120,
        "avgLatencyMs": 40
      }
    }
  }
}
```

### Fields

| Field | Description |
|---|---|
| `success` | Jobs completed without error |
| `failure` | Jobs that threw an error |
| `retries` | Jobs started with `attempt > 1` |
| `avgLatencyMs` | Mean wall-clock time per job (success + failure) |
| `lastFailureReason` | Error message of the most recent failure |
| `lastSuccessAt` / `lastFailureAt` | ISO timestamps for last outcome |

---

## Structured Log Events

Every job emits JSON log lines. Filter by `event` field:

| `event` | When |
|---|---|
| `job.started` | Job begins processing |
| `job.retry` | `attempt > 1` (job is being retried) |
| `job.succeeded` | Job completed successfully |
| `job.failed` | Job threw an error |

### Example log line

```json
{
  "event": "job.succeeded",
  "queue": "subscriptions",
  "jobName": "confirm-subscription",
  "jobId": "abc-123",
  "attempt": 1,
  "latencyMs": 312,
  "timestamp": "2026-03-26T04:34:29.709Z"
}
```

---

## Instrumenting a New Job

Inject `JobLoggerService` and wrap your async work:

```typescript
import { JobLoggerService } from '../common/services/job-logger.service';

@Injectable()
export class MyWorkerService {
  constructor(private readonly jobLogger: JobLoggerService) {}

  async processPayment(jobId: string, attempt = 1) {
    const job = this.jobLogger.start({
      queue: 'payments',
      jobName: 'process-payment',
      jobId,
      attempt,
    });
    try {
      // ... do work ...
      job.done();
    } catch (err) {
      job.done(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }
}
```

Import `LoggingModule` in your feature module to get `JobLoggerService` injected.

---

## Alerting Rules (recommended)

| Condition | Action |
|---|---|
| `failure / (success + failure) > 0.05` over 5 min | Page on-call |
| `avgLatencyMs > 5000` | Investigate slow jobs |
| `retries > 10` in 1 min | Check downstream service health |
| `lastFailureAt` within last 60 s | Slack alert to #backend-alerts |

---

## Grafana / Datadog Setup

Since metrics are exposed via the REST endpoint, scrape them with a cron or
Prometheus push-gateway adapter:

```bash
# Example: scrape every 30 s and push to Prometheus pushgateway
curl -s http://localhost:3000/v1/health/queue-metrics | \
  jq -r '.queues | to_entries[] | .key as $q |
    .value | to_entries[] |
    "myfans_job_success{queue=\"\($q)\",job=\"\(.key)\"} \(.value.success)\n" +
    "myfans_job_failure{queue=\"\($q)\",job=\"\(.key)\"} \(.value.failure)\n" +
    "myfans_job_avg_latency_ms{queue=\"\($q)\",job=\"\(.key)\"} \(.value.avgLatencyMs)"' | \
  curl --data-binary @- http://pushgateway:9091/metrics/job/myfans
```

For **Datadog**, forward the structured JSON logs (stdout) via the Datadog Agent
log pipeline; use `event` as a facet and `latencyMs` as a measure.

---

## Notes

- Metrics are **in-memory** and reset on process restart. For persistence, replace
  `QueueMetricsService` storage with Redis or a time-series DB.
- The `JobLoggerService.start()` pattern is synchronous-safe; it works with both
  sync and async job handlers.
