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

/** Max RPC call samples kept per method (reservoir sampling keeps memory bounded) */
const SAMPLE_CAP = 1024;

@Injectable()
export class RpcMetricsService {
  private readonly records = new Map<string, RpcCallRecord[]>();

  /**
   * Record a completed Soroban RPC call.
   * @param method  RPC method name, e.g. getHealth, getLedgerEntries, loadAccount
   * @param success Whether the call succeeded
   * @param latencyMs  Wall-clock duration in milliseconds
   */
  record(method: string, success: boolean, latencyMs: number): void {
    const key = method;
    let bucket = this.records.get(key);

    if (!bucket) {
      bucket = [];
      this.records.set(key, bucket);
    }

    // Reservoir sampling to keep memory bounded
    if (bucket.length < SAMPLE_CAP) {
      bucket.push({ method, success, latencyMs, timestamp: new Date().toISOString() });
    } else {
      const idx = Math.floor(Math.random() * (bucket.length + 1));
      if (idx < SAMPLE_CAP) {
        bucket[idx] = { method, success, latencyMs, timestamp: new Date().toISOString() };
      }
    }
  }

  /** Return a point-in-time snapshot of all RPC metrics. */
  snapshot(): RpcMetricsSnapshot {
    const endpoints: RpcEndpointSummary[] = [];
    let totalCalls = 0;

    for (const [method, bucket] of this.records) {
      const successes = bucket.filter((r) => r.success).length;
      const failures = bucket.filter((r) => !r.success).length;
      const totalLatencyMs = bucket.reduce((sum, r) => sum + r.latencyMs, 0);
      const calls = bucket.length;

      endpoints.push({
        method,
        calls,
        successes,
        failures,
        totalLatencyMs,
        avgLatencyMs: calls > 0 ? Math.round(totalLatencyMs / calls) : 0,
        errorRate: calls > 0 ? failures / calls : 0,
        lastCallAt: bucket.length > 0 ? bucket[bucket.length - 1].timestamp : '',
      });

      totalCalls += calls;
    }

    endpoints.sort((a, b) => b.calls - a.calls);

    return { collectedAt: new Date().toISOString(), totalCalls, endpoints };
  }

  /** Reset all counters (useful in tests). */
  reset(): void {
    this.records.clear();
  }
}
