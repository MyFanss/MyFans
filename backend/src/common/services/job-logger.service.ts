import { Injectable, Logger } from '@nestjs/common';
import { QueueMetricsService } from './queue-metrics.service';
import { RequestContextService } from './request-context.service';

export interface JobContext {
  queue: string;
  jobName: string;
  jobId?: string;
  attempt?: number;
  correlationId?: string;
  [key: string]: unknown;
}

@Injectable()
export class JobLoggerService {
  private readonly logger = new Logger(JobLoggerService.name);

  constructor(
    private readonly metrics: QueueMetricsService,
    private readonly requestContext: RequestContextService,
  ) {}

  /** Call at job start; returns a function to call on completion. */
  start(ctx: JobContext): { done: (error?: Error) => void } {
    const startedAt = Date.now();
    const { queue, jobName, jobId, attempt = 1, ...extra } = ctx;

    // Prefer explicitly passed correlationId, then fall back to the active
    // request context (e.g. when a job is enqueued inside an HTTP request).
    const correlationId =
      (ctx.correlationId as string | undefined) ??
      this.requestContext.getCorrelationId() ??
      undefined;

    this.logger.log(
      JSON.stringify({
        event: 'job.started',
        queue,
        jobName,
        jobId,
        attempt,
        correlationId,
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
          correlationId,
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
              correlationId,
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
              correlationId,
              latencyMs,
              timestamp: new Date().toISOString(),
            }),
          );
        }
      },
    };
  }
}
