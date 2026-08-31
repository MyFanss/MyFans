import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IdempotencyService } from './idempotency.service';

/**
 * Scheduled job that purges expired idempotency key records.
 * Default: every hour. Override with IDEMPOTENCY_CLEANUP_CRON env var
 * (any valid cron expression, e.g. "0 */2 * * *" for every 2 hours).
 */
@Injectable()
export class IdempotencyCleanupService {
  private readonly logger = new Logger(IdempotencyCleanupService.name);

  constructor(private readonly idempotencyService: IdempotencyService) {}

  @Cron(process.env.IDEMPOTENCY_CLEANUP_CRON ?? CronExpression.EVERY_HOUR)
  async handleCron(): Promise<void> {
    this.logger.debug('Running idempotency key expiration cleanup...');
    const deleted = await this.idempotencyService.purgeExpired();
    this.logger.debug(`Cleanup complete. Removed ${deleted} expired record(s).`);
  }
}
