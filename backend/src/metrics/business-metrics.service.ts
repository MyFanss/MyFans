import { Injectable } from '@nestjs/common';

/** Histogram bucket upper bounds in ms for checkout duration. */
const CHECKOUT_BUCKETS = [100, 500, 1000, 2500, 5000, 10000, 30000, 60000, Infinity];

interface HistogramEntry {
  buckets: Record<number, number>;
  sum: number;
  count: number;
}

@Injectable()
export class BusinessMetricsService {
  private readonly checkoutDurations = new Map<string, HistogramEntry>();
  private pollerLagMs = 0;
  private hmacFailures = 0;
  private readonly checkoutErrors = new Map<string, number>();
  private creatorRegistryDriftCount = 0;

  recordCheckoutDuration(durationMs: number, status: string): void {
    let entry = this.checkoutDurations.get(status);
    if (!entry) {
      const buckets: Record<number, number> = {};
      for (const b of CHECKOUT_BUCKETS) buckets[b] = 0;
      entry = { buckets, sum: 0, count: 0 };
      this.checkoutDurations.set(status, entry);
    }
    entry.sum += durationMs;
    entry.count++;
    for (const b of CHECKOUT_BUCKETS) {
      if (durationMs <= b) {
        entry.buckets[b]++;
        break;
      }
    }
  }

  recordPollerLag(lagMs: number): void {
    this.pollerLagMs = lagMs;
  }

  incrementHmacFailures(): void {
    this.hmacFailures++;
  }

  incrementCheckoutError(reason: string): void {
    this.checkoutErrors.set(reason, (this.checkoutErrors.get(reason) ?? 0) + 1);
  }

  recordCreatorRegistryDrift(count: number): void {
    this.creatorRegistryDriftCount = count;
  }

  toPrometheus(): string {
    const lines: string[] = [];

    // Checkout duration histogram
    lines.push('# HELP myfans_checkout_duration_seconds Histogram of checkout flow duration');
    lines.push('# TYPE myfans_checkout_duration_seconds histogram');
    for (const [status, entry] of this.checkoutDurations) {
      const cumulative = this.cumulativeBuckets(entry.buckets);
      for (const [bound, count] of Object.entries(cumulative)) {
        const le = bound === 'Infinity' ? '+Inf' : (Number(bound) / 1000).toFixed(3);
        lines.push(`myfans_checkout_duration_seconds_bucket{status="${esc(status)}",le="${le}"} ${count}`);
      }
      lines.push(`myfans_checkout_duration_seconds_sum{status="${esc(status)}"} ${entry.sum / 1000}`);
      lines.push(`myfans_checkout_duration_seconds_count{status="${esc(status)}"} ${entry.count}`);
    }

    // Poller lag gauge
    lines.push('# HELP myfans_poller_lag_seconds Last observed subscription event poller lag');
    lines.push('# TYPE myfans_poller_lag_seconds gauge');
    lines.push(`myfans_poller_lag_seconds ${this.pollerLagMs / 1000}`);

    // Webhook HMAC failure counter
    lines.push('# HELP myfans_webhook_hmac_failures_total Webhook HMAC signature verification failures');
    lines.push('# TYPE myfans_webhook_hmac_failures_total counter');
    lines.push(`myfans_webhook_hmac_failures_total ${this.hmacFailures}`);

    // Checkout error counter
    lines.push('# HELP myfans_checkout_errors_total Checkout errors by reason');
    lines.push('# TYPE myfans_checkout_errors_total counter');
    for (const [reason, count] of this.checkoutErrors) {
      lines.push(`myfans_checkout_errors_total{reason="${esc(reason)}"} ${count}`);
    }

    // Creator registry drift gauge (latest reconcile result)
    lines.push('# HELP myfans_creator_registry_drift_count Creator-registry mappings flagged as drifted by the latest reconcile');
    lines.push('# TYPE myfans_creator_registry_drift_count gauge');
    lines.push(`myfans_creator_registry_drift_count ${this.creatorRegistryDriftCount}`);

    return lines.join('\n') + '\n';
  }

  private cumulativeBuckets(buckets: Record<number, number>): Record<string, number> {
    const ordered = Object.keys(buckets)
      .map((k) => (k === 'Infinity' ? Infinity : Number(k)))
      .sort((a, b) => a - b);
    const result: Record<string, number> = {};
    let running = 0;
    for (const bound of ordered) {
      running += buckets[bound];
      result[String(bound)] = running;
    }
    return result;
  }
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
