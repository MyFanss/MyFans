import { Injectable } from '@nestjs/common';

export interface RpcCallRecord {
  method: string;
  success: boolean;
  latencyMs: number;
  timestamp: string;
}

export interface RpcEndpointSummary {
  method: string;
  calls: number;
  successes: number;
  failures: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  errorRate: number;
  lastCallAt: string;
}

export interface RpcMetricsSnapshot {
  collectedAt: string;
  totalCalls: number;
  endpoints: RpcEndpointSummary[];
}

interface RpcMetricBucket {
  records: RpcCallRecord[];
  calls: number;
  successes: number;
  failures: number;
  totalLatencyMs: number;
  lastCallAt: string;
}

/** Max RPC call samples kept per method (reservoir sampling keeps memory bounded) */
const SAMPLE_CAP = 1024;

@Injectable()
export class RpcMetricsService {
  private readonly buckets = new Map<string, RpcMetricBucket>();

  /**
   * Record a completed Soroban RPC call.
   * @param method  RPC method name, e.g. getHealth, getLedgerEntries, loadAccount
   * @param success Whether the call succeeded
   * @param latencyMs  Wall-clock duration in milliseconds
   */
  record(method: string, success: boolean, latencyMs: number): void {
    const timestamp = new Date().toISOString();
    let bucket = this.buckets.get(method);

    if (!bucket) {
      bucket = {
        records: [],
        calls: 0,
        successes: 0,
        failures: 0,
        totalLatencyMs: 0,
        lastCallAt: '',
      };
      this.buckets.set(method, bucket);
    }

    bucket.calls += 1;
    bucket.successes += success ? 1 : 0;
    bucket.failures += success ? 0 : 1;
    bucket.totalLatencyMs += latencyMs;
    bucket.lastCallAt = timestamp;

    if (bucket.records.length < SAMPLE_CAP) {
      bucket.records.push({ method, success, latencyMs, timestamp });
    } else {
      const idx = Math.floor(Math.random() * bucket.records.length);
      bucket.records[idx] = { method, success, latencyMs, timestamp };
    }
  }

  /** Return a point-in-time snapshot of all RPC metrics. */
  snapshot(): RpcMetricsSnapshot {
    const endpoints: RpcEndpointSummary[] = [];
    let totalCalls = 0;

    for (const [method, bucket] of this.buckets) {
      endpoints.push({
        method,
        calls: bucket.calls,
        successes: bucket.successes,
        failures: bucket.failures,
        totalLatencyMs: bucket.totalLatencyMs,
        avgLatencyMs:
          bucket.calls > 0 ? Math.round(bucket.totalLatencyMs / bucket.calls) : 0,
        errorRate: bucket.calls > 0 ? bucket.failures / bucket.calls : 0,
        lastCallAt: bucket.lastCallAt,
      });

      totalCalls += bucket.calls;
    }

    endpoints.sort((a, b) => b.calls - a.calls);

    return { collectedAt: new Date().toISOString(), totalCalls, endpoints };
  }

  /** Reset all counters (useful in tests). */
  reset(): void {
    this.buckets.clear();
  }
}
