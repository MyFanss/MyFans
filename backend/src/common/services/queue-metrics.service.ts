import { Injectable } from '@nestjs/common';

export interface JobMetrics {
  success: number;
  failure: number;
  retries: number;
  totalLatencyMs: number;
  lastFailureReason?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
}

export interface QueueSnapshot {
  [queueName: string]: {
    [jobName: string]: JobMetrics & { avgLatencyMs: number };
  };
}

@Injectable()
export class QueueMetricsService {
  private readonly metrics = new Map<string, Map<string, JobMetrics>>();

  private key(queue: string, job: string) {
    return `${queue}::${job}`;
  }

  private get(queue: string, job: string): JobMetrics {
    if (!this.metrics.has(queue)) this.metrics.set(queue, new Map());
    const qMap = this.metrics.get(queue)!;
    if (!qMap.has(job)) {
      qMap.set(job, { success: 0, failure: 0, retries: 0, totalLatencyMs: 0 });
    }
    return qMap.get(job)!;
  }

  recordSuccess(queue: string, job: string, latencyMs: number): void {
    const m = this.get(queue, job);
    m.success++;
    m.totalLatencyMs += latencyMs;
    m.lastSuccessAt = new Date().toISOString();
  }

  recordFailure(queue: string, job: string, latencyMs: number, reason: string): void {
    const m = this.get(queue, job);
    m.failure++;
    m.totalLatencyMs += latencyMs;
    m.lastFailureReason = reason;
    m.lastFailureAt = new Date().toISOString();
  }

  recordRetry(queue: string, job: string): void {
    this.get(queue, job).retries++;
  }

  snapshot(): QueueSnapshot {
    const result: QueueSnapshot = {};
    for (const [queue, jobs] of this.metrics) {
      result[queue] = {};
      for (const [job, m] of jobs) {
        const total = m.success + m.failure;
        result[queue][job] = {
          ...m,
          avgLatencyMs: total > 0 ? Math.round(m.totalLatencyMs / total) : 0,
        };
      }
    }
    return result;
  }

  reset(): void {
    this.metrics.clear();
  }
}
