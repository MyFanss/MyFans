import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IdempotencyService } from './idempotency.service';

/**
 * Scheduled job that purges expired idempotency key records.
 * Runs every hour — keeps the table lean without hammering the DB.
 */
@Injectable()
export class IdempotencyCleanupService {
  private readonly logger = new Logger(IdempotencyCleanupService.name);

  constructor(private readonly idempotencyService: IdempotencyService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron(): Promise<void> {
    this.logger.debug('Running idempotency key expiration cleanup...');
    const deleted = await this.idempotencyService.purgeExpired();
    this.logger.debug(`Cleanup complete. Removed ${deleted} expired record(s).`);
  }
}
