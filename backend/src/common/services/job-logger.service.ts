import { Injectable, Logger } from '@nestjs/common';
import { QueueMetricsService } from './queue-metrics.service';

export interface JobContext {
  queue: string;
  jobName: string;
  jobId?: string;
  attempt?: number;
  [key: string]: unknown;
}

@Injectable()
export class JobLoggerService {
  private readonly logger = new Logger(JobLoggerService.name);

  constructor(private readonly metrics: QueueMetricsService) {}

  /** Call at job start; returns a function to call on completion. */
  start(ctx: JobContext): { done: (error?: Error) => void } {
    const startedAt = Date.now();
    const { queue, jobName, jobId, attempt = 1, ...extra } = ctx;

    this.logger.log(
      JSON.stringify({
        event: 'job.started',
        queue,
        jobName,
        jobId,
        attempt,
        ...extra,
        timestamp: new Date().toISOString(),
      }),
    );

    if (attempt > 1) {
      this.metrics.recordRetry(queue, jobName);
      this.logger.warn(
        JSON.stringify({
          event: 'job.retry',
          queue,
          jobName,
          jobId,
          attempt,
          timestamp: new Date().toISOString(),
        }),
      );
    }

    return {
      done: (error?: Error) => {
        const latencyMs = Date.now() - startedAt;
        if (error) {
          this.metrics.recordFailure(queue, jobName, latencyMs, error.message);
          this.logger.error(
            JSON.stringify({
              event: 'job.failed',
              queue,
              jobName,
              jobId,
              attempt,
              latencyMs,
              error: error.message,
              timestamp: new Date().toISOString(),
            }),
          );
        } else {
          this.metrics.recordSuccess(queue, jobName, latencyMs);
          this.logger.log(
            JSON.stringify({
              event: 'job.succeeded',
              queue,
              jobName,
              jobId,
              attempt,
              latencyMs,
              timestamp: new Date().toISOString(),
            }),
          );
        }
      },
    };
  }
}
