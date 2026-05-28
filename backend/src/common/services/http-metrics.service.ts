import { Injectable } from '@nestjs/common';

export interface EndpointBucket {
  /** Total requests observed */
  requests: number;
  /** Requests that completed with 5xx status */
  errors5xx: number;
  /** Requests that completed with 4xx status */
  errors4xx: number;
  /** Sum of all latencies (ms) — used to compute mean */
  totalLatencyMs: number;
  /** Latency histogram buckets (ms upper-bounds) */
  histogram: Record<number, number>;
  /** Minimum observed latency (ms) */
  minLatencyMs: number;
  /** Maximum observed latency (ms) */
  maxLatencyMs: number;
  /** Sorted sample buffer for p50/p95/p99 (capped at SAMPLE_CAP) */
  samples: number[];
  /** ISO timestamp of last request */
  lastSeenAt: string;
}

export interface EndpointSummary extends Omit<EndpointBucket, 'samples'> {
  route: string;
  method: string;
  avgLatencyMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
}

export interface MetricsSnapshot {
  collectedAt: string;
  totalRequests: number;
  endpoints: EndpointSummary[];
}

/** Upper-bound buckets in ms for the latency histogram */
const HISTOGRAM_BUCKETS = [
  5,
  10,
  25,
  50,
  100,
  250,
  500,
  1000,
  2500,
  5000,
  Infinity,
];

/** Max latency samples kept per endpoint (reservoir sampling keeps memory bounded) */
const SAMPLE_CAP = 1024;

@Injectable()
export class HttpMetricsService {
  private readonly buckets = new Map<string, EndpointBucket>();

  /**
   * Record a completed HTTP request.
   * @param method  HTTP verb (GET, POST, …)
   * @param route   Normalised route pattern, e.g. /v1/users/:id
   * @param status  HTTP status code
   * @param latencyMs  Wall-clock duration in milliseconds
   */
  record(
    method: string,
    route: string,
    status: number,
    latencyMs: number,
  ): void {
    const key = `${method.toUpperCase()} ${route}`;
    let b = this.buckets.get(key);

    if (!b) {
      const histogram: Record<number, number> = {};
      for (const bound of HISTOGRAM_BUCKETS) histogram[bound] = 0;
      b = {
        requests: 0,
        errors5xx: 0,
        errors4xx: 0,
        totalLatencyMs: 0,
        histogram,
        minLatencyMs: Infinity,
        maxLatencyMs: 0,
        samples: [],
        lastSeenAt: '',
      };
      this.buckets.set(key, b);
    }

    b.requests++;
    b.totalLatencyMs += latencyMs;
    if (status >= 500) b.errors5xx++;
    else if (status >= 400) b.errors4xx++;
    if (latencyMs < b.minLatencyMs) b.minLatencyMs = latencyMs;
    if (latencyMs > b.maxLatencyMs) b.maxLatencyMs = latencyMs;
    b.lastSeenAt = new Date().toISOString();

    // Histogram
    for (const bound of HISTOGRAM_BUCKETS) {
      if (latencyMs <= bound) {
        b.histogram[bound]++;
        break;
      }
    }

    // Reservoir sample (random replacement once cap is reached)
    if (b.samples.length < SAMPLE_CAP) {
      b.samples.push(latencyMs);
    } else {
      const idx = Math.floor(Math.random() * b.requests);
      if (idx < SAMPLE_CAP) b.samples[idx] = latencyMs;
    }
  }

  /** Return a point-in-time snapshot of all endpoint metrics. */
  snapshot(): MetricsSnapshot {
    const endpoints: EndpointSummary[] = [];
    let totalRequests = 0;

    for (const [key, b] of this.buckets) {
      const [method, ...routeParts] = key.split(' ');
      const route = routeParts.join(' ');
      const sorted = [...b.samples].sort((a, c) => a - c);

      endpoints.push({
        route,
        method,
        requests: b.requests,
        errors5xx: b.errors5xx,
        errors4xx: b.errors4xx,
        totalLatencyMs: b.totalLatencyMs,
        histogram: b.histogram,
        minLatencyMs: b.minLatencyMs === Infinity ? 0 : b.minLatencyMs,
        maxLatencyMs: b.maxLatencyMs,
        avgLatencyMs:
          b.requests > 0 ? Math.round(b.totalLatencyMs / b.requests) : 0,
        p50Ms: percentile(sorted, 50),
        p95Ms: percentile(sorted, 95),
        p99Ms: percentile(sorted, 99),
        errorRate:
          b.requests > 0 ? (b.errors5xx + b.errors4xx) / b.requests : 0,
        lastSeenAt: b.lastSeenAt,
      });

      totalRequests += b.requests;
    }

    endpoints.sort((a, b) => b.requests - a.requests);

    return { collectedAt: new Date().toISOString(), totalRequests, endpoints };
  }

  /** Reset all counters (useful in tests). */
  reset(): void {
    this.buckets.clear();
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
